"""
feedback.py — User feedback system + admin management
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
import threading
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_user_profile, require_permission
from services.audit_service import log_audit
from services.notification_service import create_notification
from services.email_service import send_feedback_reply_email

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackPayload(BaseModel):
    title: str
    description: str
    category: str = "general"  # general | bug | feature | improvement
    priority: str = "medium"   # low | medium | high | critical


class FeedbackReplyPayload(BaseModel):
    content: str


# ── User endpoints ─────────────────────────────────────────────────────────────

@router.post("")
def submit_feedback(body: FeedbackPayload, user_ctx: dict = Depends(get_user_profile)):
    """Submit new feedback."""
    sb = get_supabase()
    profile = user_ctx.get("profile", {})
    record = {
        **body.model_dump(),
        "submitted_by": user_ctx["id"],
        "organization_id": profile.get("organization_id"),
        "status": "open",
    }
    result = sb.table("feedback").insert(record).execute()
    return {"feedback": result.data[0] if result.data else None}


@router.get("/mine")
def my_feedback(user_ctx: dict = Depends(get_user_profile)):
    """List current user's feedback submissions."""
    sb = get_supabase()
    result = (
        sb.table("feedback")
        .select("*")
        .eq("submitted_by", user_ctx["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return {"feedback": result.data}


@router.get("/{feedback_id}")
def get_feedback(feedback_id: str, user_ctx: dict = Depends(get_user_profile)):
    """Get feedback detail with replies."""
    sb = get_supabase()
    try:
        fb = sb.table("feedback").select("*").eq("id", feedback_id).limit(1).execute()
        fb_data = fb.data[0] if fb.data else None
    except Exception:
        fb_data = None
    if not fb_data:
        raise HTTPException(status_code=404, detail="Feedback not found.")
    # Only owner or admin can view
    profile = user_ctx.get("profile", {})
    role_name = (profile.get("roles") or {}).get("name", "")
    if fb_data["submitted_by"] != user_ctx["id"] and role_name not in ("super_admin", "org_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")

    replies = (
        sb.table("feedback_replies")
        .select("*")
        .eq("feedback_id", feedback_id)
        .order("created_at")
        .execute()
    )
    return {"feedback": fb_data, "replies": replies.data}


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("")
def list_all_feedback(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    user_ctx: dict = Depends(require_permission("manage_feedback")),
):
    """Admin: list all feedback with filters, ordered by priority."""
    sb = get_supabase()
    offset = (page - 1) * per_page

    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    query = sb.table("feedback").select("*", count="exact")
    if status:
        query = query.eq("status", status)
    if priority:
        query = query.eq("priority", priority)
    if category:
        query = query.eq("category", category)

    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()

    # Sort by priority in Python (Supabase doesn't support custom ordering)
    items = sorted(result.data or [], key=lambda x: priority_order.get(x.get("priority", "medium"), 2))

    return {"feedback": items, "total": result.count, "page": page, "per_page": per_page}


@router.put("/{feedback_id}/status")
def update_feedback_status(
    feedback_id: str,
    status: str,
    user_ctx: dict = Depends(require_permission("manage_feedback")),
):
    """Admin: update feedback status (open, in_review, resolved, closed)."""
    sb = get_supabase()
    result = sb.table("feedback").update({"status": status}).eq("id", feedback_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Feedback not found.")

    # Notify the submitter
    fb = result.data[0]
    create_notification(
        user_id=fb["submitted_by"],
        notif_type="feedback_update",
        title=f"Feedback status updated to '{status}'",
        message=f"Your feedback '{fb.get('title', '')}' status was changed to {status}.",
        related_entity_id=feedback_id,
    )
    log_audit(user_ctx["id"], "update_feedback_status", "feedback", feedback_id, {"status": status})
    return {"feedback": fb}


@router.post("/{feedback_id}/reply")
def reply_to_feedback(
    feedback_id: str,
    body: FeedbackReplyPayload,
    user_ctx: dict = Depends(require_permission("manage_feedback")),
):
    """Admin: reply to feedback."""
    sb = get_supabase()
    try:
        fb = sb.table("feedback").select("submitted_by, title").eq("id", feedback_id).limit(1).execute()
        fb_data = fb.data[0] if fb.data else None
    except Exception:
        fb_data = None
    if not fb_data:
        raise HTTPException(status_code=404, detail="Feedback not found.")

    reply = sb.table("feedback_replies").insert({
        "feedback_id": feedback_id,
        "replied_by": user_ctx["id"],
        "content": body.content,
    }).execute()

    # Send email notification to submitter
    try:
        submitter_auth = sb.auth.admin.get_user_by_id(fb_data["submitted_by"])
        if submitter_auth and submitter_auth.user:
            threading.Thread(
                target=send_feedback_reply_email,
                args=(submitter_auth.user.email, fb_data.get("title", ""), body.content),
                daemon=True,
            ).start()
    except Exception:
        pass

    # Notify submitter
    create_notification(
        user_id=fb_data["submitted_by"],
        notif_type="feedback_reply",
        title="New reply on your feedback",
        message=f"Admin replied to your feedback: '{fb_data.get('title', '')}'",
        related_entity_id=feedback_id,
    )
    return {"reply": reply.data[0] if reply.data else None}
