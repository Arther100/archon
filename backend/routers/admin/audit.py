"""
audit.py — Admin: Audit log viewer
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from db.supabase_client import get_supabase
from middleware.auth_middleware import require_permission

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("")
def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_ctx: dict = Depends(require_permission("view_audit_log")),
):
    """Paginated audit log viewer with optional filters."""
    sb = get_supabase()
    offset = (page - 1) * per_page

    query = sb.table("audit_logs").select("*", count="exact")
    if actor_id:
        query = query.eq("actor_id", actor_id)
    if action:
        query = query.ilike("action", f"%{action}%")
    if entity_type:
        query = query.eq("entity_type", entity_type)

    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    return {
        "logs": result.data,
        "total": result.count,
        "page": page,
        "per_page": per_page,
    }


@router.get("/actions")
def list_action_types(user_ctx: dict = Depends(require_permission("view_audit_log"))):
    """List distinct action types for filter dropdown."""
    sb = get_supabase()
    result = sb.table("audit_logs").select("action").execute()
    actions = list({row["action"] for row in (result.data or [])})
    actions.sort()
    return {"actions": actions}
