"""
usage_limiter.py — Token usage tracking and enforcement
Reads total_tokens from user_usage_summary view (aggregated from usage_logs).
Writes new entries to usage_logs table only.
"""

from fastapi import Depends
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_user_profile


def check_usage(user_ctx: dict = Depends(get_user_profile)):
    """Dependency that reads token usage from the usage summary view."""
    profile = user_ctx.get("profile", {})
    user_id = user_ctx["id"]

    # Super admins bypass usage checks
    role = profile.get("roles", {})
    if role and role.get("name") == "super_admin":
        return user_ctx

    sb = get_supabase()
    try:
        summary = (
            sb.table("user_usage_summary")
            .select("total_tokens, total_requests")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        summary_data = summary.data[0] if summary.data else None
    except Exception:
        summary_data = None

    used = summary_data.get("total_tokens", 0) if summary_data else 0

    user_ctx["usage"] = {
        "total_tokens": used,
        "total_requests": summary_data.get("total_requests", 0) if summary_data else 0,
    }
    return user_ctx


def log_usage(user_id: str, org_id: str | None, model: str, tokens: int, operation: str):
    """Record token consumption to usage_logs (the view auto-aggregates)."""
    sb = get_supabase()
    sb.table("usage_logs").insert({
        "user_id": user_id,
        "organization_id": org_id,
        "model_used": model,
        "tokens_consumed": tokens,
        "operation_type": operation,
    }).execute()
