"""
broadcasts.py — Admin: Broadcast message management
"""

import threading
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_supabase
from middleware.auth_middleware import require_permission
from services.audit_service import log_audit
from services.notification_service import create_broadcast_notifications
from services.email_service import send_broadcast_email

router = APIRouter(prefix="/broadcasts", tags=["Broadcasts"])


class BroadcastPayload(BaseModel):
    title: str
    content: str
    target_type: str = "all"  # all | organization | role | location
    target_value: Optional[str] = None
    priority: str = "normal"  # low | normal | high | urgent


@router.get("")
def list_broadcasts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_ctx: dict = Depends(require_permission("send_broadcast")),
):
    sb = get_supabase()
    offset = (page - 1) * per_page
    result = (
        sb.table("broadcast_messages")
        .select("*", count="exact")
        .order("created_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    return {"broadcasts": result.data, "total": result.count, "page": page, "per_page": per_page}


@router.post("")
def create_broadcast(body: BroadcastPayload, user_ctx: dict = Depends(require_permission("send_broadcast"))):
    sb = get_supabase()
    record = {
        **body.model_dump(),
        "sent_by": user_ctx["id"],
    }
    result = sb.table("broadcast_messages").insert(record).execute()
    broadcast = result.data[0] if result.data else None

    if broadcast:
        create_broadcast_notifications(
            broadcast_id=broadcast["id"],
            target_type=body.target_type,
            target_value=body.target_value or "",
            title=body.title,
            content=body.content,
        )
        log_audit(user_ctx["id"], "send_broadcast", "broadcast_messages", broadcast["id"], body.model_dump())

        # Send broadcast email to all users (background thread)
        def _send_emails():
            try:
                users_resp = sb.table("user_profiles").select("email").execute()
                for u in (users_resp.data or []):
                    if u.get("email"):
                        send_broadcast_email(u["email"], body.title, body.content)
            except Exception:
                pass
        threading.Thread(target=_send_emails, daemon=True).start()

    return {"broadcast": broadcast}


@router.delete("/{broadcast_id}")
def delete_broadcast(broadcast_id: str, user_ctx: dict = Depends(require_permission("send_broadcast"))):
    sb = get_supabase()
    sb.table("broadcast_messages").delete().eq("id", broadcast_id).execute()
    log_audit(user_ctx["id"], "delete_broadcast", "broadcast_messages", broadcast_id)
    return {"message": "Broadcast deleted."}
