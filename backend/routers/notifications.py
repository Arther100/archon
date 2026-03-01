"""
notifications.py — User notification endpoints
"""

from fastapi import APIRouter, Depends, Query
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_user_profile

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    user_ctx: dict = Depends(get_user_profile),
):
    """List current user's notifications."""
    sb = get_supabase()
    offset = (page - 1) * per_page
    query = (
        sb.table("notifications")
        .select("*", count="exact")
        .eq("user_id", user_ctx["id"])
    )
    if unread_only:
        query = query.eq("is_read", False)
    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    return {"notifications": result.data, "total": result.count, "page": page, "per_page": per_page}


@router.get("/unread-count")
def unread_count(user_ctx: dict = Depends(get_user_profile)):
    """Get unread notification count for bell badge."""
    sb = get_supabase()
    result = (
        sb.table("notifications")
        .select("id", count="exact")
        .eq("user_id", user_ctx["id"])
        .eq("is_read", False)
        .execute()
    )
    return {"unread": result.count or 0}


@router.put("/{notification_id}/read")
def mark_read(notification_id: str, user_ctx: dict = Depends(get_user_profile)):
    """Mark a single notification as read."""
    sb = get_supabase()
    sb.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", user_ctx["id"]).execute()
    return {"message": "Marked as read."}


@router.put("/read-all")
def mark_all_read(user_ctx: dict = Depends(get_user_profile)):
    """Mark all notifications as read."""
    sb = get_supabase()
    sb.table("notifications").update({"is_read": True}).eq("user_id", user_ctx["id"]).eq("is_read", False).execute()
    return {"message": "All marked as read."}
