"""
organizations.py — Admin: Organization CRUD
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db.supabase_client import get_supabase
from middleware.auth_middleware import require_permission
from services.audit_service import log_audit

router = APIRouter(prefix="/organizations", tags=["Admin - Organizations"])


class CreateOrgPayload(BaseModel):
    name: str
    plan_id: str | None = None


class UpdateOrgPayload(BaseModel):
    name: str | None = None
    plan_id: str | None = None
    subscription_status: str | None = None


@router.get("")
def list_organizations(user_ctx: dict = Depends(require_permission("manage_org"))):
    sb = get_supabase()
    result = sb.table("organizations").select("*, plans(name, price_monthly)").order("created_at", desc=True).execute()
    return {"organizations": result.data}


@router.post("")
def create_organization(body: CreateOrgPayload, user_ctx: dict = Depends(require_permission("manage_org"))):
    sb = get_supabase()
    data = {"name": body.name, "created_by": user_ctx["id"]}
    if body.plan_id:
        data["plan_id"] = body.plan_id
    result = sb.table("organizations").insert(data).execute()
    log_audit(user_ctx["id"], "create_organization", "organizations", result.data[0]["id"] if result.data else None)
    return {"organization": result.data[0] if result.data else None}


@router.put("/{org_id}")
def update_organization(org_id: str, body: UpdateOrgPayload, user_ctx: dict = Depends(require_permission("manage_org"))):
    sb = get_supabase()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    result = sb.table("organizations").update(updates).eq("id", org_id).execute()
    log_audit(user_ctx["id"], "update_organization", "organizations", org_id, updates)
    return {"organization": result.data[0] if result.data else None}


@router.delete("/{org_id}")
def delete_organization(org_id: str, user_ctx: dict = Depends(require_permission("manage_org"))):
    sb = get_supabase()
    sb.table("organizations").delete().eq("id", org_id).execute()
    log_audit(user_ctx["id"], "delete_organization", "organizations", org_id)
    return {"message": "Organization deleted."}
