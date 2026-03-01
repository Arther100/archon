"""
analysis.py
-----------
POST /modules/{id}/analyse        — run full blueprint analysis (stores confidence + accuracy)
GET  /modules/{id}/analysis       — get latest blueprint JSON + scores
GET  /modules/{id}/analyses       — list all historical runs
POST /modules/{id}/api-schema     — save edited API schema
GET  /modules/{id}/api-schema     — get saved/generated API schema
"""

import json
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from pydantic import BaseModel
from db.supabase_client import get_supabase
from services.llm_service import analyse_module
from middleware.quota_middleware import check_and_increment_quota

router = APIRouter(prefix="/modules", tags=["Analysis"])


# ── Helper: compute accuracy_level ────────────────────────────────────────────

def compute_accuracy(blueprint: dict) -> int:
    """
    Compute a server-side accuracy score (0-100).
    Based on: % of fields with real validation rules, penalised by gap count.
    """
    fields = blueprint.get("documented", {}).get("fields", [])
    if not fields:
        return 0
    ns_phrases = {"not specified in the document", "not specified", "", None}
    fields_with_validation = sum(
        1 for f in fields
        if str(f.get("validation", "") or "").strip().lower() not in ns_phrases
    )
    gap_count = len(blueprint.get("gaps", {}).get("missing_specs", []))
    raw = (fields_with_validation / len(fields)) * 100 - (gap_count * 3)
    return max(0, min(100, round(raw)))


# ── Trigger Full Blueprint Analysis ───────────────────────────────────────────

@router.post("/{module_id}/analyse")
async def trigger_analysis(module_id: str, request: Request, force: bool = Query(False, description="Force re-analysis, bypass cache"), _quota: dict = Depends(check_and_increment_quota)):
    """Run full blueprint analysis: documented + gaps + connectivity + API schema + scores."""
    sb = get_supabase()

    module = (
        sb.table("modules")
        .select("id, title, content, document_id, documents(standards_text)")
        .eq("id", module_id)
        .execute()
    )
    if not module.data:
        raise HTTPException(status_code=404, detail="Module not found.")

    mod = module.data[0]
    if not mod.get("content", "").strip():
        raise HTTPException(status_code=422, detail="Module has no content to analyse.")

    standards = None
    if mod.get("documents") and mod["documents"].get("standards_text"):
        standards = mod["documents"]["standards_text"]

    # Extract user context from request state (set by auth middleware)
    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
    org_id = getattr(request.state, "organization_id", None) if hasattr(request, "state") else None

    try:
        blueprint = await analyse_module(
            mod["content"],
            standards_text=standards,
            use_cache=not force,
            user_id=user_id,
            module_id=module_id,
            document_id=mod.get("document_id"),
            organization_id=org_id,
        )
    except Exception as e:
        err = str(e)
        if "api_key" in err.lower() or "authentication" in err.lower() or "401" in err:
            raise HTTPException(status_code=502, detail="Invalid OpenAI API key. Update OPENAI_API_KEY in backend/.env")
        if "quota" in err.lower() or "billing" in err.lower() or "credit" in err.lower():
            raise HTTPException(status_code=502, detail="OpenAI account has no credits. Add billing at platform.openai.com")
        if "model" in err.lower() or "does not exist" in err.lower():
            raise HTTPException(status_code=502, detail="Invalid model. Set OPENAI_MODEL=gpt-4o-mini in backend/.env")
        raise HTTPException(status_code=502, detail=f"LLM error: {err[:300]}")

    # Extract token usage before storing
    token_usage = blueprint.pop("_token_usage", {})

    # Compute scores
    confidence = blueprint.get("confidence_score")
    if confidence is not None:
        try:
            confidence = max(0, min(100, int(confidence)))
        except (TypeError, ValueError):
            confidence = None

    accuracy = compute_accuracy(blueprint)

    # Get current version count
    existing = (
        sb.table("analyses")
        .select("id", count="exact")
        .eq("module_id", module_id)
        .execute()
    )
    version = (existing.count or 0) + 1

    # Store scores inside the blueprint JSON so they survive without extra columns
    blueprint["_scores"] = {
        "confidence_score": confidence,
        "accuracy_level": accuracy,
        "version": version,
    }

    result = sb.table("analyses").insert({
        "module_id": module_id,
        "output_md": blueprint.get("documented", {}).get("summary", ""),
        "output_json": blueprint,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to store analysis.")

    field_count = len(blueprint.get("documented", {}).get("fields", []))
    gap_count   = len(blueprint.get("gaps", {}).get("missing_specs", []))

    return {
        "module_id": module_id,
        "module_title": mod["title"],
        "analysis_id": result.data[0]["id"],
        "status": "completed",
        "field_count": field_count,
        "gap_count": gap_count,
        "confidence_score": confidence,
        "accuracy_level": accuracy,
        "version": version,
        "token_usage": token_usage,
    }


# ── Get Latest Blueprint ───────────────────────────────────────────────────────

@router.get("/{module_id}/analysis")
def get_analysis(module_id: str):
    """Return latest blueprint JSON + scores for a module."""
    sb = get_supabase()
    result = (
        sb.table("analyses")
        .select("id, output_json, created_at")
        .eq("module_id", module_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No analysis found. Run POST /modules/{id}/analyse first.")

    row = result.data[0]
    bp = row["output_json"] or {}
    scores = bp.get("_scores", {})
    return {
        "module_id": module_id,
        "analysis": bp,
        "confidence_score": scores.get("confidence_score"),
        "accuracy_level": scores.get("accuracy_level"),
        "version": scores.get("version", 1),
        "created_at": row["created_at"],
    }


# ── History: All Past Runs ─────────────────────────────────────────────────────

@router.get("/{module_id}/analyses")
def get_analysis_history(module_id: str):
    """Return all historical analysis runs for a module (for the History tab)."""
    sb = get_supabase()
    result = (
        sb.table("analyses")
        .select("id, created_at, output_json")
        .eq("module_id", module_id)
        .order("created_at", desc=True)
        .execute()
    )

    history = []
    for row in (result.data or []):
        bp = row.get("output_json") or {}
        scores = bp.get("_scores", {})
        history.append({
            "analysis_id":      row["id"],
            "version":          scores.get("version", 1),
            "created_at":       row["created_at"],
            "confidence_score": scores.get("confidence_score"),
            "accuracy_level":   scores.get("accuracy_level"),
            "field_count":      len(bp.get("documented", {}).get("fields", [])),
            "gap_count":        len(bp.get("gaps", {}).get("missing_specs", [])),
        })

    return {"module_id": module_id, "history": history}


# ── Restore a Specific Run ─────────────────────────────────────────────────────

@router.get("/{module_id}/analyses/{analysis_id}")
def get_analysis_by_id(module_id: str, analysis_id: str):
    """Restore a specific historical analysis run."""
    sb = get_supabase()
    result = (
        sb.table("analyses")
        .select("id, output_json, created_at")
        .eq("module_id", module_id)
        .eq("id", analysis_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis run not found.")

    row = result.data[0]
    bp = row["output_json"] or {}
    scores = bp.get("_scores", {})
    return {
        "module_id":        module_id,
        "analysis":         bp,
        "confidence_score": scores.get("confidence_score"),
        "accuracy_level":   scores.get("accuracy_level"),
        "version":          scores.get("version", 1),
        "created_at":       row["created_at"],
    }


# ── Get API Schema ─────────────────────────────────────────────────────────────

@router.get("/{module_id}/api-schema")
def get_api_schema(module_id: str):
    """Return just the API schema portion of the analysis (for the editor)."""
    sb = get_supabase()
    result = (
        sb.table("analyses")
        .select("output_json, created_at")
        .eq("module_id", module_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No analysis found.")

    output = result.data[0]["output_json"] or {}
    return {
        "module_id": module_id,
        "api_schema": output.get("api_schema", {}),
        "created_at": result.data[0]["created_at"],
    }


# ── Save Edited API Schema ─────────────────────────────────────────────────────

class ApiSchemaPayload(BaseModel):
    api_schema: dict


@router.post("/{module_id}/api-schema")
def save_api_schema(module_id: str, body: ApiSchemaPayload):
    """Save the user-edited API schema back into the stored analysis."""
    sb = get_supabase()

    result = (
        sb.table("analyses")
        .select("id, output_json")
        .eq("module_id", module_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No analysis found. Run analysis first.")

    record = result.data[0]
    current_json = record["output_json"] or {}
    current_json["api_schema"] = body.api_schema

    sb.table("analyses").update({"output_json": current_json}).eq("id", record["id"]).execute()

    return {"module_id": module_id, "status": "saved"}
