"""
features.py — Admin: Manage feature flags per organization
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_supabase
from middleware.auth_middleware import require_permission
from services.audit_service import log_audit

router = APIRouter(prefix="/features", tags=["Feature Flags"])


class FeatureOverridePayload(BaseModel):
    organization_id: str
    feature_name: str
    enabled: bool


# ── List all plan features ─────────────────────────────────────────────────────

@router.get("/plan-features")
def list_plan_features(user_ctx: dict = Depends(require_permission("manage_features"))):
    """List plans with their features JSON."""
    sb = get_supabase()
    result = sb.table("plans").select("id, name, features").order("price_monthly").execute()
    return {"plans": result.data}


@router.put("/plan-features/{plan_id}")
def update_plan_features(plan_id: str, features: dict, user_ctx: dict = Depends(require_permission("manage_features"))):
    """Update the features JSON for a plan."""
    sb = get_supabase()
    result = sb.table("plans").update({"features": features}).eq("id", plan_id).execute()
    log_audit(user_ctx["id"], "update_plan_features", "plans", plan_id, {"features": features})
    return {"plan": result.data[0] if result.data else None}


# ── Org-level overrides ───────────────────────────────────────────────────────

@router.get("/overrides")
def list_overrides(organization_id: Optional[str] = None, user_ctx: dict = Depends(require_permission("manage_features"))):
    """List feature overrides, optionally filtered by org."""
    sb = get_supabase()
    query = sb.table("organization_features").select("*, organizations(name)")
    if organization_id:
        query = query.eq("organization_id", organization_id)
    result = query.order("created_at", desc=True).execute()
    return {"overrides": result.data}


@router.post("/overrides")
def create_override(body: FeatureOverridePayload, user_ctx: dict = Depends(require_permission("manage_features"))):
    """Create or update a feature override for an organization."""
    sb = get_supabase()
    # Upsert on (organization_id, feature_name)
    try:
        existing = (
            sb.table("organization_features")
            .select("id")
            .eq("organization_id", body.organization_id)
            .eq("feature_name", body.feature_name)
            .limit(1)
            .execute()
        )
        existing_data = existing.data[0] if existing.data else None
    except Exception:
        existing_data = None
    if existing_data:
        result = sb.table("organization_features").update({
            "enabled": body.enabled,
        }).eq("id", existing_data["id"]).execute()
    else:
        result = sb.table("organization_features").insert(body.model_dump()).execute()

    log_audit(user_ctx["id"], "set_feature_override", "organization_features", body.organization_id, body.model_dump())
    return {"override": result.data[0] if result.data else None}


@router.delete("/overrides/{override_id}")
def delete_override(override_id: str, user_ctx: dict = Depends(require_permission("manage_features"))):
    """Remove a feature override (falls back to plan features)."""
    sb = get_supabase()
    sb.table("organization_features").delete().eq("id", override_id).execute()
    log_audit(user_ctx["id"], "delete_feature_override", "organization_features", override_id)
    return {"message": "Override removed."}
