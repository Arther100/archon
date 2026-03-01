"""
batch_service.py — Batch Processing Engine + OpenAI Batch API Integration
──────────────────────────────────────────────────────────────────────────
Three processing modes:
  1. SEQUENTIAL  — analyse modules one by one (current behavior, with caching)
  2. CONCURRENT  — analyse all modules in parallel (faster, same cost)
  3. OPENAI_BATCH — submit to OpenAI Batch API (50% discount, 24hr window)

Features:
  - Job queue with status tracking
  - Per-module progress updates
  - Cache-aware: skip modules with cached results
  - Cost estimation before execution
  - Retry logic for failed modules
  - OpenAI Batch API file upload + polling
"""

import json
import asyncio
import hashlib
import tempfile
import os
from datetime import datetime, timezone
from typing import Optional

from config import settings
from db.supabase_client import get_supabase
from services.llm_service import analyse_module, SYSTEM_PROMPT, BLUEPRINT_PROMPT, _extract_json, _empty_blueprint
from services.cache_service import get_cached, put_cached
from services.token_service import log_usage, calculate_cost


# ── Job Management ────────────────────────────────────────────────────────────

def create_batch_job(
    user_id: str,
    document_id: str,
    job_type: str = "analyse_all_modules",
    use_batch_api: bool = False,
    organization_id: str = None,
    priority: int = 5,
) -> dict:
    """Create a new batch job and its per-module items."""
    sb = get_supabase()

    # Get all modules for this document
    modules = sb.table("modules").select("id, title, content").eq("document_id", document_id).order("order").execute()
    if not modules.data:
        raise ValueError("No modules found for this document.")

    total = len(modules.data)

    # Get standards text
    doc = sb.table("documents").select("standards_text").eq("id", document_id).limit(1).execute()
    standards = doc.data[0].get("standards_text") if doc.data else None

    # Estimate cost — check how many are cached vs not
    provider = settings.LLM_PROVIDER.lower()
    model = _get_model_for_provider(provider)
    cached_count = 0
    uncached_count = 0

    for mod in modules.data:
        content = (mod.get("content") or "").strip()
        if not content:
            continue
        hit = get_cached(content, provider, model)
        if hit:
            cached_count += 1
        else:
            uncached_count += 1

    # Rough estimate: ~14,500 input + ~4,000 output per module
    est_input = uncached_count * 14500
    est_output = uncached_count * 4000
    est_cost = calculate_cost(est_input, est_output, provider, model, is_batch=use_batch_api)

    # Create job record
    job_record = {
        "user_id": user_id,
        "document_id": document_id,
        "job_type": job_type,
        "status": "pending",
        "priority": priority,
        "total_modules": total,
        "completed_modules": 0,
        "failed_modules": 0,
        "cached_modules": cached_count,
        "estimated_cost_usd": est_cost,
        "use_batch_api": use_batch_api,
        "metadata": {
            "standards_present": bool(standards),
            "provider": provider,
            "model": model,
        },
    }
    if organization_id:
        job_record["organization_id"] = organization_id

    result = sb.table("batch_jobs").insert(job_record).execute()
    if not result.data:
        raise ValueError("Failed to create batch job.")

    job = result.data[0]

    # Create per-module items
    items = []
    for mod in modules.data:
        content = (mod.get("content") or "").strip()
        hit = get_cached(content, provider, model) if content else None
        items.append({
            "batch_job_id": job["id"],
            "module_id": mod["id"],
            "module_title": mod.get("title", ""),
            "status": "cached" if hit else "pending",
            "cache_hit": bool(hit),
        })

    if items:
        sb.table("batch_job_items").insert(items).execute()

    return {
        "job": job,
        "total_modules": total,
        "cached_modules": cached_count,
        "modules_to_analyse": uncached_count,
        "estimated_cost_usd": round(est_cost, 6),
        "estimated_savings": round(cached_count * calculate_cost(14500, 4000, provider, model), 6),
    }


def _get_model_for_provider(provider: str) -> str:
    if provider == "openai":
        return settings.OPENAI_MODEL
    elif provider == "gemini":
        return settings.GEMINI_MODEL
    elif provider == "ollama":
        return settings.OLLAMA_MODEL
    return "unknown"


# ── Execute Batch Job (Sequential/Concurrent) ────────────────────────────────

async def execute_batch_job(job_id: str, mode: str = "concurrent") -> dict:
    """
    Execute a batch job. Modes:
      - 'sequential': one module at a time
      - 'concurrent': all modules in parallel
    """
    sb = get_supabase()

    # Load job
    job_result = sb.table("batch_jobs").select("*").eq("id", job_id).limit(1).execute()
    if not job_result.data:
        raise ValueError("Batch job not found.")
    job = job_result.data[0]

    if job["status"] not in ("pending", "failed"):
        raise ValueError(f"Job is {job['status']}, cannot execute.")

    # Update status to processing
    sb.table("batch_jobs").update({
        "status": "processing",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", job_id).execute()

    # Load pending items
    items_result = sb.table("batch_job_items").select("*").eq("batch_job_id", job_id).eq("status", "pending").execute()
    pending_items = items_result.data or []

    # Load modules
    module_ids = [item["module_id"] for item in pending_items]
    if not module_ids:
        # All cached — mark complete
        sb.table("batch_jobs").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).execute()
        return {"job_id": job_id, "status": "completed", "message": "All modules were cached."}

    # Get document standards
    doc = sb.table("documents").select("standards_text").eq("id", job["document_id"]).limit(1).execute()
    standards = doc.data[0].get("standards_text") if doc.data else None

    provider = settings.LLM_PROVIDER.lower()
    model = _get_model_for_provider(provider)

    # Build tasks
    async def process_module(item):
        module_result = sb.table("modules").select("id, title, content").eq("id", item["module_id"]).limit(1).execute()
        if not module_result.data:
            return _fail_item(sb, item, "Module not found")

        mod = module_result.data[0]
        content = (mod.get("content") or "").strip()
        if not content:
            return _fail_item(sb, item, "Empty module content")

        # Check cache first (double-check)
        cached = get_cached(content, provider, model)
        if cached:
            return _complete_cached_item(sb, item, cached, job_id, mod, provider, model)

        # Mark processing
        sb.table("batch_job_items").update({
            "status": "processing",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", item["id"]).execute()

        try:
            blueprint = await analyse_module(content, standards_text=standards)

            # Estimate tokens (we don't have exact counts from analyse_module yet)
            est_input = len(content) // 4 + 3000  # rough char-to-token + prompt overhead
            est_output = len(json.dumps(blueprint)) // 4
            cost = calculate_cost(est_input, est_output, provider, model)

            # Cache the result
            put_cached(content, provider, model, blueprint, est_input, est_output, cost)

            # Log token usage
            log_usage(
                request_type="batch_analysis",
                input_tokens=est_input,
                output_tokens=est_output,
                provider=provider,
                model=model,
                module_id=mod["id"],
                document_id=job["document_id"],
                batch_job_id=job_id,
                user_id=job.get("user_id"),
                organization_id=job.get("organization_id"),
            )

            # Store analysis in analyses table (same as single analysis)
            from routers.analysis import compute_accuracy
            confidence = blueprint.get("confidence_score")
            if confidence is not None:
                try:
                    confidence = max(0, min(100, int(confidence)))
                except (TypeError, ValueError):
                    confidence = None
            accuracy = compute_accuracy(blueprint)

            existing = sb.table("analyses").select("id", count="exact").eq("module_id", mod["id"]).execute()
            version = (existing.count or 0) + 1
            blueprint["_scores"] = {"confidence_score": confidence, "accuracy_level": accuracy, "version": version}

            sb.table("analyses").insert({
                "module_id": mod["id"],
                "output_md": blueprint.get("documented", {}).get("summary", ""),
                "output_json": blueprint,
            }).execute()

            # Mark item complete
            sb.table("batch_job_items").update({
                "status": "completed",
                "input_tokens": est_input,
                "output_tokens": est_output,
                "cost_usd": cost,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", item["id"]).execute()

            return {"module_id": mod["id"], "status": "completed", "cost": cost, "tokens": est_input + est_output}

        except Exception as e:
            return _fail_item(sb, item, str(e)[:500])

    # Execute
    if mode == "concurrent":
        results = await asyncio.gather(*[process_module(item) for item in pending_items], return_exceptions=True)
    else:
        results = []
        for item in pending_items:
            r = await process_module(item)
            results.append(r)

    # Summarise
    completed = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "completed")
    failed = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "failed")
    cached_count = job.get("cached_modules", 0)
    total_cost = sum(r.get("cost", 0) for r in results if isinstance(r, dict))
    total_tokens = sum(r.get("tokens", 0) for r in results if isinstance(r, dict))

    final_status = "completed" if failed == 0 else ("failed" if completed == 0 else "completed")

    sb.table("batch_jobs").update({
        "status": final_status,
        "completed_modules": completed + cached_count,
        "failed_modules": failed,
        "total_input_tokens": sum(r.get("input_tokens", 0) for r in results if isinstance(r, dict)),
        "total_output_tokens": sum(r.get("output_tokens", 0) for r in results if isinstance(r, dict)),
        "total_cost_usd": total_cost,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", job_id).execute()

    return {
        "job_id": job_id,
        "status": final_status,
        "completed": completed,
        "failed": failed,
        "cached": cached_count,
        "total_cost_usd": round(total_cost, 6),
        "total_tokens": total_tokens,
    }


def _fail_item(sb, item, error_msg):
    sb.table("batch_job_items").update({
        "status": "failed",
        "error_message": error_msg,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", item["id"]).execute()
    return {"module_id": item["module_id"], "status": "failed", "cost": 0, "tokens": 0}


def _complete_cached_item(sb, item, cached, job_id, mod, provider, model):
    # Log as cache hit
    log_usage(
        request_type="batch_analysis",
        input_tokens=cached.get("input_tokens", 0),
        output_tokens=cached.get("output_tokens", 0),
        provider=provider,
        model=model,
        cache_hit=True,
        module_id=mod["id"],
        batch_job_id=job_id,
    )
    sb.table("batch_job_items").update({
        "status": "cached",
        "cache_hit": True,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", item["id"]).execute()
    return {"module_id": mod["id"], "status": "cached", "cost": 0, "tokens": 0}


# ── OpenAI Batch API ──────────────────────────────────────────────────────────

async def submit_openai_batch(job_id: str) -> dict:
    """
    Submit all pending modules to OpenAI Batch API for 50% discount.
    Creates a JSONL file with all requests and uploads to OpenAI.
    """
    from openai import AsyncOpenAI

    sb = get_supabase()
    job_result = sb.table("batch_jobs").select("*").eq("id", job_id).limit(1).execute()
    if not job_result.data:
        raise ValueError("Batch job not found.")
    job = job_result.data[0]

    # Get pending items
    items_result = sb.table("batch_job_items").select("*").eq("batch_job_id", job_id).eq("status", "pending").execute()
    pending = items_result.data or []
    if not pending:
        return {"message": "No pending modules to submit."}

    # Get standards
    doc = sb.table("documents").select("standards_text").eq("id", job["document_id"]).limit(1).execute()
    standards = doc.data[0].get("standards_text") if doc.data else None
    standards_section = ""
    if standards and standards.strip():
        standards_section = f'ARCHITECTURE STANDARDS:\n"""\n{standards.strip()[:3000]}\n"""'

    # Build JSONL
    lines = []
    for item in pending:
        mod_result = sb.table("modules").select("id, content").eq("id", item["module_id"]).limit(1).execute()
        if not mod_result.data:
            continue
        content = (mod_result.data[0].get("content") or "").strip()
        if not content:
            continue

        prompt = BLUEPRINT_PROMPT.format(module_text=content, standards_section=standards_section)
        lines.append(json.dumps({
            "custom_id": item["id"],  # batch_job_item ID for matching
            "method": "POST",
            "url": "/v1/chat/completions",
            "body": {
                "model": settings.OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0,
                "max_tokens": 4000,
                "response_format": {"type": "json_object"},
            }
        }))

    if not lines:
        return {"message": "No valid modules to submit."}

    # Write JSONL to temp file and upload
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write("\n".join(lines))
        tmp_path = f.name

    try:
        # Upload file
        with open(tmp_path, "rb") as f:
            file_obj = await client.files.create(file=f, purpose="batch")

        # Create batch
        batch = await client.batches.create(
            input_file_id=file_obj.id,
            endpoint="/v1/chat/completions",
            completion_window="24h",
            metadata={"job_id": job_id, "document_id": job["document_id"]},
        )

        # Update job with batch ID
        sb.table("batch_jobs").update({
            "status": "processing",
            "openai_batch_id": batch.id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {**job.get("metadata", {}), "openai_file_id": file_obj.id},
        }).eq("id", job_id).execute()

        # Mark items as processing
        for item in pending:
            sb.table("batch_job_items").update({"status": "processing"}).eq("id", item["id"]).execute()

        return {
            "job_id": job_id,
            "openai_batch_id": batch.id,
            "file_id": file_obj.id,
            "modules_submitted": len(lines),
            "status": "submitted",
            "message": f"Submitted {len(lines)} modules to OpenAI Batch API. Results within 24hrs.",
        }
    finally:
        os.unlink(tmp_path)


async def poll_openai_batch(job_id: str) -> dict:
    """
    Check status of an OpenAI Batch API job and retrieve results if complete.
    """
    from openai import AsyncOpenAI

    sb = get_supabase()
    job_result = sb.table("batch_jobs").select("*").eq("id", job_id).limit(1).execute()
    if not job_result.data:
        raise ValueError("Batch job not found.")
    job = job_result.data[0]

    if not job.get("openai_batch_id"):
        raise ValueError("This job doesn't have an OpenAI batch ID.")

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    batch = await client.batches.retrieve(job["openai_batch_id"])

    result = {
        "job_id": job_id,
        "openai_status": batch.status,
        "total_requests": batch.request_counts.total if batch.request_counts else 0,
        "completed_requests": batch.request_counts.completed if batch.request_counts else 0,
        "failed_requests": batch.request_counts.failed if batch.request_counts else 0,
    }

    if batch.status == "completed" and batch.output_file_id:
        # Download results
        content = await client.files.content(batch.output_file_id)
        text = content.text

        provider = settings.LLM_PROVIDER.lower()
        model = settings.OPENAI_MODEL
        total_cost = 0
        completed = 0
        failed = 0

        for line in text.strip().split("\n"):
            try:
                entry = json.loads(line)
                item_id = entry.get("custom_id")
                response = entry.get("response", {})
                body = response.get("body", {})
                usage = body.get("usage", {})

                input_tokens = usage.get("prompt_tokens", 0)
                output_tokens = usage.get("completion_tokens", 0)
                cost = calculate_cost(input_tokens, output_tokens, provider, model, is_batch=True)
                total_cost += cost

                # Get the LLM output
                choices = body.get("choices", [])
                raw_content = choices[0]["message"]["content"] if choices else ""

                blueprint = _extract_json(raw_content)

                # Get module info from item
                item_result = sb.table("batch_job_items").select("module_id").eq("id", item_id).limit(1).execute()
                if not item_result.data:
                    continue
                module_id = item_result.data[0]["module_id"]

                # Store analysis
                from routers.analysis import compute_accuracy
                confidence = blueprint.get("confidence_score")
                if confidence is not None:
                    try:
                        confidence = max(0, min(100, int(confidence)))
                    except (TypeError, ValueError):
                        confidence = None
                accuracy = compute_accuracy(blueprint)

                existing = sb.table("analyses").select("id", count="exact").eq("module_id", module_id).execute()
                version = (existing.count or 0) + 1
                blueprint["_scores"] = {"confidence_score": confidence, "accuracy_level": accuracy, "version": version}

                sb.table("analyses").insert({
                    "module_id": module_id,
                    "output_md": blueprint.get("documented", {}).get("summary", ""),
                    "output_json": blueprint,
                }).execute()

                # Cache it
                mod_content_result = sb.table("modules").select("content").eq("id", module_id).limit(1).execute()
                if mod_content_result.data:
                    put_cached(mod_content_result.data[0]["content"], provider, model, blueprint, input_tokens, output_tokens, cost)

                # Log usage
                log_usage(
                    request_type="batch_api_analysis",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    provider=provider,
                    model=model,
                    module_id=module_id,
                    document_id=job["document_id"],
                    batch_job_id=job_id,
                    user_id=job.get("user_id"),
                )

                # Update item
                sb.table("batch_job_items").update({
                    "status": "completed",
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost_usd": cost,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", item_id).execute()

                completed += 1

            except Exception as e:
                if item_id:
                    sb.table("batch_job_items").update({
                        "status": "failed",
                        "error_message": str(e)[:500],
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", item_id).execute()
                failed += 1

        # Update job
        sb.table("batch_jobs").update({
            "status": "completed",
            "completed_modules": completed + job.get("cached_modules", 0),
            "failed_modules": failed,
            "total_cost_usd": total_cost,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).execute()

        result["status"] = "completed"
        result["completed"] = completed
        result["failed"] = failed
        result["total_cost_usd"] = round(total_cost, 6)

    elif batch.status in ("failed", "cancelled", "expired"):
        sb.table("batch_jobs").update({
            "status": "failed",
            "error_message": f"OpenAI batch {batch.status}",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).execute()
        result["status"] = "failed"

    else:
        result["status"] = "processing"
        result["message"] = f"OpenAI batch is {batch.status}. Check again later."

    return result


# ── Job Queries ───────────────────────────────────────────────────────────────

def get_batch_job(job_id: str) -> dict:
    """Get a single batch job with its items."""
    sb = get_supabase()
    job = sb.table("batch_jobs").select("*").eq("id", job_id).limit(1).execute()
    if not job.data:
        raise ValueError("Job not found.")

    items = sb.table("batch_job_items").select("*").eq("batch_job_id", job_id).order("created_at").execute()

    return {
        "job": job.data[0],
        "items": items.data or [],
    }


def list_batch_jobs(
    user_id: str = None,
    document_id: str = None,
    status: str = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """List batch jobs with filters."""
    sb = get_supabase()
    offset = (page - 1) * per_page

    query = sb.table("batch_jobs").select("*", count="exact")
    if user_id:
        query = query.eq("user_id", user_id)
    if document_id:
        query = query.eq("document_id", document_id)
    if status:
        query = query.eq("status", status)

    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    return {
        "jobs": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


def cancel_batch_job(job_id: str) -> dict:
    """Cancel a pending batch job."""
    sb = get_supabase()
    job = sb.table("batch_jobs").select("status").eq("id", job_id).limit(1).execute()
    if not job.data:
        raise ValueError("Job not found.")
    if job.data[0]["status"] not in ("pending",):
        raise ValueError("Only pending jobs can be cancelled.")

    sb.table("batch_jobs").update({
        "status": "cancelled",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", job_id).execute()

    sb.table("batch_job_items").update({"status": "cancelled"}).eq("batch_job_id", job_id).eq("status", "pending").execute()

    return {"job_id": job_id, "status": "cancelled"}
