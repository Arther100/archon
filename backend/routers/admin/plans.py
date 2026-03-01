"""
plans.py — Admin: Plan CRUD + user plan detail / checkout placeholder
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db.supabase_client import get_supabase
from middleware.auth_middleware import require_permission, get_user_profile
from services.audit_service import log_audit

router = APIRouter(prefix="/plans", tags=["Plans"])


class PlanPayload(BaseModel):
    name: str
    price_monthly: float = 0
    token_limit: int = 1000000
    max_users: int = 3
    features: dict = {}
    is_active: bool = True


# ── Public: List available plans ───────────────────────────────────────────────

@router.get("")
def list_plans():
    """Public — list active plans for plan selection page."""
    sb = get_supabase()
    result = sb.table("plans").select("*").eq("is_active", True).order("price_monthly").execute()
    return {"plans": result.data}


@router.get("/{plan_id}")
def get_plan(plan_id: str):
    """Public — plan detail page."""
    sb = get_supabase()
    try:
        result = sb.table("plans").select("*").eq("id", plan_id).limit(1).execute()
        plan_data = result.data[0] if result.data else None
    except Exception:
        plan_data = None
    if not plan_data:
        raise HTTPException(status_code=404, detail="Plan not found.")
    return {"plan": plan_data}


# ── User: Choose plan (placeholder checkout) ──────────────────────────────────

@router.post("/{plan_id}/choose")
def choose_plan(plan_id: str, user_ctx: dict = Depends(get_user_profile)):
    """User selects a plan — placeholder until payment integration."""
    sb = get_supabase()
    try:
        plan_result = sb.table("plans").select("*").eq("id", plan_id).limit(1).execute()
        plan_data = plan_result.data[0] if plan_result.data else None
    except Exception:
        plan_data = None
    if not plan_data:
        raise HTTPException(status_code=404, detail="Plan not found.")

    profile = user_ctx.get("profile", {})
    org_id = profile.get("organization_id")
    if not org_id:
        # Auto-create org for user
        org = sb.table("organizations").insert({
            "name": f"{user_ctx['email']}'s Organization",
            "plan_id": plan_id,
            "subscription_status": "active" if plan_data["price_monthly"] == 0 else "pending_payment",
            "created_by": user_ctx["id"],
        }).execute()
        org_id = org.data[0]["id"]
        sb.table("user_profiles").update({"organization_id": org_id}).eq("user_id", user_ctx["id"]).execute()
    else:
        sb.table("organizations").update({
            "plan_id": plan_id,
            "subscription_status": "active" if plan_data["price_monthly"] == 0 else "pending_payment",
        }).eq("id", org_id).execute()

    return {
        "message": "Plan selected.",
        "plan": plan_data["name"],
        "status": "active" if plan_data["price_monthly"] == 0 else "pending_payment",
    }


# ── Admin: Plan CRUD ──────────────────────────────────────────────────────────

@router.post("/admin/create")
def create_plan(body: PlanPayload, user_ctx: dict = Depends(require_permission("manage_plans"))):
    sb = get_supabase()
    result = sb.table("plans").insert(body.model_dump()).execute()
    log_audit(user_ctx["id"], "create_plan", "plans", result.data[0]["id"] if result.data else None)
    return {"plan": result.data[0] if result.data else None}


@router.put("/admin/{plan_id}")
def update_plan(plan_id: str, body: PlanPayload, user_ctx: dict = Depends(require_permission("manage_plans"))):
    sb = get_supabase()
    result = sb.table("plans").update(body.model_dump()).eq("id", plan_id).execute()
    log_audit(user_ctx["id"], "update_plan", "plans", plan_id)
    return {"plan": result.data[0] if result.data else None}
