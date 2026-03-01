"""
notification_service.py — Create notifications for users.
"""

from db.supabase_client import get_supabase


def create_notification(
    user_id: str,
    notif_type: str,
    title: str,
    message: str = "",
    organization_id: str = None,
    related_entity_id: str = None,
):
    """Insert a notification record."""
    sb = get_supabase()
    sb.table("notifications").insert({
        "user_id": user_id,
        "organization_id": organization_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "related_entity_id": related_entity_id,
    }).execute()


def create_broadcast_notifications(broadcast_id: str, target_type: str, target_value: str, title: str, content: str):
    """Create notification entries for all targeted users based on broadcast target."""
    sb = get_supabase()

    if target_type == "all":
        users = sb.table("user_profiles").select("user_id").execute()
    elif target_type == "organization":
        users = sb.table("user_profiles").select("user_id").eq("organization_id", target_value).execute()
    elif target_type == "role":
        try:
            role = sb.table("roles").select("id").eq("name", target_value).limit(1).execute()
            role_data = role.data[0] if role.data else None
        except Exception:
            role_data = None
        if not role_data:
            return
        users = sb.table("user_profiles").select("user_id").eq("role_id", role_data["id"]).execute()
    elif target_type == "location":
        users = sb.table("user_profiles").select("user_id").eq("location_country", target_value).execute()
    else:
        return

    for u in (users.data or []):
        create_notification(
            user_id=u["user_id"],
            notif_type="broadcast",
            title=title,
            message=content,
            related_entity_id=broadcast_id,
        )
