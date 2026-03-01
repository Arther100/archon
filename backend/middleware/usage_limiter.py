"""
usage_limiter.py — Token usage tracking and enforcement
Checks monthly quota before allowing LLM requests.
"""

from fastapi import HTTPException, Depends
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_user_profile


def check_usage(user_ctx: dict = Depends(get_user_profile)):
    """Dependency that checks token usage against monthly limit."""
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
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        summary_data = summary.data[0] if summary.data else None
    except Exception:
        summary_data = None

    if not summary_data:
        # Auto-create usage summary
        sb.table("user_usage_summary").insert({
            "user_id": user_id,
            "organization_id": profile.get("organization_id"),
            "monthly_limit": 1000000,
            "tokens_used": 0,
            "remaining_tokens": 1000000,
        }).execute()
        return user_ctx

    data = summary_data
    used = data.get("tokens_used", 0)
    limit = data.get("monthly_limit", 1000000)

    if limit > 0 and used >= limit:
        raise HTTPException(
            status_code=429,
            detail="Monthly token limit exceeded. Please upgrade your plan."
        )

    # Return usage info for potential warning
    user_ctx["usage"] = {
        "tokens_used": used,
        "monthly_limit": limit,
        "remaining": limit - used,
        "percentage": round((used / limit) * 100, 1) if limit > 0 else 0,
    }
    return user_ctx


def log_usage(user_id: str, org_id: str | None, model: str, tokens: int, operation: str):
    """Record token consumption after an LLM call."""
    sb = get_supabase()

    # Insert log
    sb.table("usage_logs").insert({
        "user_id": user_id,
        "organization_id": org_id,
        "model_used": model,
        "tokens_consumed": tokens,
        "operation_type": operation,
    }).execute()

    # Update summary
    try:
        summary = (
            sb.table("user_usage_summary")
            .select("tokens_used, monthly_limit")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        summary_data = summary.data[0] if summary.data else None
    except Exception:
        summary_data = None
    if summary_data:
        new_used = (summary_data.get("tokens_used", 0) or 0) + tokens
        new_remaining = max(0, (summary_data.get("monthly_limit", 1000000) or 1000000) - new_used)
        sb.table("user_usage_summary").update({
            "tokens_used": new_used,
            "remaining_tokens": new_remaining,
        }).eq("user_id", user_id).execute()
