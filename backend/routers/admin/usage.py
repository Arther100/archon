"""
usage.py — Admin: Usage monitoring dashboard data
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from db.supabase_client import get_supabase
from middleware.auth_middleware import require_permission, get_user_profile

router = APIRouter(prefix="/usage", tags=["Usage Monitoring"])


@router.get("/summary")
def usage_summary(user_ctx: dict = Depends(require_permission("view_usage"))):
    """Global usage summary for admin dashboard."""
    sb = get_supabase()
    summaries = sb.table("user_usage_summary").select("*").execute()
    data = summaries.data or []

    total_tokens = sum(s.get("tokens_used", 0) for s in data)
    total_limit = sum(s.get("monthly_limit", 0) for s in data)
    users_near_limit = sum(
        1 for s in data
        if s.get("monthly_limit", 0) > 0
        and (s.get("tokens_used", 0) / s["monthly_limit"]) >= 0.9
    )
    users_over_limit = sum(
        1 for s in data
        if s.get("monthly_limit", 0) > 0
        and s.get("tokens_used", 0) >= s["monthly_limit"]
    )

    return {
        "total_users": len(data),
        "total_tokens_used": total_tokens,
        "total_token_limit": total_limit,
        "users_near_limit_90": users_near_limit,
        "users_over_limit": users_over_limit,
    }


@router.get("/users")
def usage_by_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    organization_id: Optional[str] = None,
    user_ctx: dict = Depends(require_permission("view_usage")),
):
    """Per-user usage breakdown."""
    sb = get_supabase()
    offset = (page - 1) * per_page
    query = sb.table("user_usage_summary").select("*", count="exact")
    if organization_id:
        query = query.eq("organization_id", organization_id)
    result = query.order("tokens_used", desc=True).range(offset, offset + per_page - 1).execute()
    return {
        "users": result.data,
        "total": result.count,
        "page": page,
        "per_page": per_page,
    }


@router.get("/logs")
def usage_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    user_id: Optional[str] = None,
    operation_type: Optional[str] = None,
    user_ctx: dict = Depends(require_permission("view_usage")),
):
    """Detailed usage log entries."""
    sb = get_supabase()
    offset = (page - 1) * per_page
    query = sb.table("usage_logs").select("*", count="exact")
    if user_id:
        query = query.eq("user_id", user_id)
    if operation_type:
        query = query.eq("operation_type", operation_type)
    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    return {
        "logs": result.data,
        "total": result.count,
        "page": page,
        "per_page": per_page,
    }


# ── User's own usage ──────────────────────────────────────────────────────────

@router.get("/me")
def my_usage(user_ctx: dict = Depends(get_user_profile)):
    """Get current user's usage summary."""
    sb = get_supabase()
    try:
        summary = (
            sb.table("user_usage_summary")
            .select("*")
            .eq("user_id", user_ctx["id"])
            .limit(1)
            .execute()
        )
        summary_data = summary.data[0] if summary.data else None
    except Exception:
        summary_data = None
    data = summary_data or {"tokens_used": 0, "monthly_limit": 1000000, "remaining_tokens": 1000000}
    pct = round((data.get("tokens_used", 0) / max(data.get("monthly_limit", 1), 1)) * 100, 1)
    return {
        "usage": {
            **data,
            "percentage": pct,
            "warning": pct >= 90,
        }
    }
