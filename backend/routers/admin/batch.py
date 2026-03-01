"""
batch.py — Admin: Batch Processing, Cache & Token Cost Management
─────────────────────────────────────────────────────────────────
Endpoints:
  POST /batch/jobs                — Create a batch job for a document
  GET  /batch/jobs                — List all batch jobs
  GET  /batch/jobs/{id}           — Get batch job detail + items
  POST /batch/jobs/{id}/execute   — Execute batch job (sequential/concurrent)
  POST /batch/jobs/{id}/submit    — Submit to OpenAI Batch API (50% discount)
  POST /batch/jobs/{id}/poll      — Poll OpenAI Batch API status
  POST /batch/jobs/{id}/cancel    — Cancel a pending job
  GET  /batch/stats               — Overall batch statistics
  GET  /batch/cache               — Cache stats
  POST /batch/cache/clear         — Clear all cache
  GET  /batch/costs               — Cost settings
  PUT  /batch/costs/{id}          — Update cost setting
  GET  /batch/usage               — Token usage summary
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_supabase
from services.batch_service import (
    create_batch_job,
    execute_batch_job,
    submit_openai_batch,
    poll_openai_batch,
    get_batch_job,
    list_batch_jobs,
    cancel_batch_job,
)
from services.cache_service import get_cache_stats, clear_all_cache
from services.token_service import get_usage_summary, get_cost_settings, update_cost_setting

try:
    from middleware.auth_middleware import require_permission, get_user_profile
except ImportError:
    # Fallback if middleware not available
    def require_permission(perm):
        async def dep():
            return {"user_id": "system", "role": "super_admin"}
        return dep
    def get_user_profile():
        return {"user_id": "system", "role": "super_admin"}

router = APIRouter(prefix="/batch", tags=["Batch Processing"])


# ── Request Models ────────────────────────────────────────────────────────────

class CreateJobRequest(BaseModel):
    document_id: str
    job_type: str = "analyse_all_modules"
    use_batch_api: bool = False
    priority: int = 5


class UpdateCostRequest(BaseModel):
    input_cost_per_1m: Optional[float] = None
    output_cost_per_1m: Optional[float] = None
    batch_discount_pct: Optional[float] = None


# ── Batch Job Endpoints ───────────────────────────────────────────────────────

@router.post("/jobs")
async def create_job(body: CreateJobRequest, user_ctx: dict = Depends(require_permission("manage_batch"))):
    """Create a new batch processing job for all modules in a document."""
    try:
        result = create_batch_job(
            user_id=user_ctx.get("user_id"),
            document_id=body.document_id,
            job_type=body.job_type,
            use_batch_api=body.use_batch_api,
            organization_id=user_ctx.get("organization_id"),
            priority=body.priority,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create job: {str(e)[:300]}")


@router.get("/jobs")
def list_jobs(
    status: Optional[str] = None,
    document_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_ctx: dict = Depends(require_permission("view_usage")),
):
    """List all batch jobs with optional filters."""
    try:
        return list_batch_jobs(
            document_id=document_id,
            status=status,
            page=page,
            per_page=per_page,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:300])


@router.get("/jobs/{job_id}")
def get_job(job_id: str, user_ctx: dict = Depends(require_permission("view_usage"))):
    """Get detailed batch job info with per-module items."""
    try:
        return get_batch_job(job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/jobs/{job_id}/execute")
async def execute_job(
    job_id: str,
    mode: str = Query("concurrent", regex="^(sequential|concurrent)$"),
    user_ctx: dict = Depends(require_permission("manage_batch")),
):
    """Execute a batch job. Mode: 'sequential' or 'concurrent'."""
    try:
        result = await execute_batch_job(job_id, mode=mode)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)[:300]}")


@router.post("/jobs/{job_id}/submit")
async def submit_to_openai(job_id: str, user_ctx: dict = Depends(require_permission("manage_batch"))):
    """Submit batch job to OpenAI Batch API for 50% cost discount."""
    try:
        result = await submit_openai_batch(job_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Submission failed: {str(e)[:300]}")


@router.post("/jobs/{job_id}/poll")
async def poll_batch(job_id: str, user_ctx: dict = Depends(require_permission("view_usage"))):
    """Poll OpenAI Batch API for results."""
    try:
        result = await poll_openai_batch(job_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Poll failed: {str(e)[:300]}")


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, user_ctx: dict = Depends(require_permission("manage_batch"))):
    """Cancel a pending batch job."""
    try:
        return cancel_batch_job(job_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Batch Statistics ──────────────────────────────────────────────────────────

@router.get("/stats")
def batch_stats(user_ctx: dict = Depends(require_permission("view_usage"))):
    """Get overall batch processing statistics."""
    sb = get_supabase()

    jobs = sb.table("batch_jobs").select("status, total_modules, completed_modules, failed_modules, cached_modules, total_cost_usd, estimated_cost_usd").execute()
    data = jobs.data or []

    total_jobs = len(data)
    completed_jobs = sum(1 for j in data if j.get("status") == "completed")
    processing_jobs = sum(1 for j in data if j.get("status") == "processing")
    pending_jobs = sum(1 for j in data if j.get("status") == "pending")
    failed_jobs = sum(1 for j in data if j.get("status") == "failed")

    total_modules = sum(j.get("total_modules", 0) for j in data)
    completed_modules = sum(j.get("completed_modules", 0) for j in data)
    cached_modules = sum(j.get("cached_modules", 0) for j in data)
    total_cost = sum(j.get("total_cost_usd", 0) or 0 for j in data)
    estimated_savings = sum(j.get("estimated_cost_usd", 0) or 0 for j in data) - total_cost

    return {
        "total_jobs": total_jobs,
        "by_status": {
            "completed": completed_jobs,
            "processing": processing_jobs,
            "pending": pending_jobs,
            "failed": failed_jobs,
        },
        "total_modules_processed": total_modules,
        "modules_completed": completed_modules,
        "modules_cached": cached_modules,
        "total_cost_usd": round(total_cost, 4),
        "estimated_savings_usd": round(max(0, estimated_savings), 4),
        "cache_hit_rate": round(cached_modules / max(total_modules, 1) * 100, 1),
    }


# ── Cache Endpoints ───────────────────────────────────────────────────────────

@router.get("/cache")
def cache_stats(user_ctx: dict = Depends(require_permission("view_usage"))):
    """Get cache statistics."""
    try:
        return get_cache_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:300])


@router.post("/cache/clear")
def clear_cache(user_ctx: dict = Depends(require_permission("manage_batch"))):
    """Clear all analysis cache."""
    try:
        return clear_all_cache()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:300])


# ── Token Usage Endpoints ─────────────────────────────────────────────────────

@router.get("/usage")
def token_usage(
    days: int = Query(30, ge=1, le=365),
    user_id: Optional[str] = None,
    user_ctx: dict = Depends(require_permission("view_usage")),
):
    """Get token usage summary with daily breakdown."""
    try:
        return get_usage_summary(days=days, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:300])


# ── Cost Settings Endpoints ───────────────────────────────────────────────────

@router.get("/costs")
def list_cost_settings(user_ctx: dict = Depends(require_permission("view_usage"))):
    """Get all cost settings per model."""
    try:
        return get_cost_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:300])


@router.put("/costs/{setting_id}")
def update_cost(
    setting_id: str,
    body: UpdateCostRequest,
    user_ctx: dict = Depends(require_permission("manage_batch")),
):
    """Update cost settings for a specific model."""
    try:
        return update_cost_setting(
            setting_id=setting_id,
            input_cost=body.input_cost_per_1m,
            output_cost=body.output_cost_per_1m,
            batch_discount=body.batch_discount_pct,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:300])
