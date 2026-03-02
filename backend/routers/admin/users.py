"""
users.py — Admin: User management (assign role, org, activate/deactivate, delete, message)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import threading
from db.supabase_client import get_supabase
from middleware.auth_middleware import require_super_admin, require_permission
from middleware.quota_middleware import DEFAULT_QUOTA
from services.audit_service import log_audit
from services.notification_service import create_notification
from services.email_service import send_admin_message_email, send_role_changed_email

router = APIRouter(prefix="/users", tags=["Admin - Users"])


class UpdateUserPayload(BaseModel):
    role_id: str | None = None
    organization_id: str | None = None
    is_active: bool | None = None
    location_country: str | None = None
    location_city: str | None = None


class UpdateQuotaPayload(BaseModel):
    request_quota: int
    reset_used: bool = False


class SendMessagePayload(BaseModel):
    title: str
    message: str


@router.get("")
def list_users(user_ctx: dict = Depends(require_permission("manage_users"))):
    """List all user profiles (super_admin sees all, org_admin sees own org)."""
    sb = get_supabase()
    profile = user_ctx.get("profile") or {}
    role = profile.get("roles") or {}

    query = sb.table("user_profiles").select("*, roles(name), organizations!user_profiles_organization_id_fkey(name)")

    if role.get("name") != "super_admin":
        org_id = profile.get("organization_id")
        if org_id:
            query = query.eq("organization_id", org_id)

    result = query.order("created_at", desc=True).execute()

    # Enrich with email from auth metadata (stored in supabase auth)
    users = []
    for p in (result.data or []):
        try:
            auth_user = sb.auth.admin.get_user_by_id(p["user_id"])
            meta = (auth_user.user.user_metadata or {}) if auth_user and auth_user.user else {}
            email = auth_user.user.email if auth_user and auth_user.user else "unknown"
            display_name = meta.get("display_name", "")
            github_url = meta.get("github_url", "")
            linkedin_url = meta.get("linkedin_url", "")
            phone = meta.get("phone", "")
            bio = meta.get("bio", "")
            request_quota = meta.get("request_quota", DEFAULT_QUOTA)
            requests_used = meta.get("requests_used", 0)
        except Exception:
            email = "unknown"
            display_name = ""
            github_url = ""
            linkedin_url = ""
            phone = ""
            bio = ""
            request_quota = DEFAULT_QUOTA
            requests_used = 0
        users.append({
            **p,
            "email": email,
            "display_name": display_name,
            "github_url": github_url,
            "linkedin_url": linkedin_url,
            "phone": phone,
            "bio": bio,
            "request_quota": request_quota,
            "requests_used": requests_used,
        })
    return {"users": users}


@router.put("/{user_id}")
def update_user(user_id: str, body: UpdateUserPayload, user_ctx: dict = Depends(require_permission("manage_users"))):
    sb = get_supabase()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    result = sb.table("user_profiles").update(updates).eq("user_id", user_id).execute()
    log_audit(user_ctx["id"], "update_user", "user_profiles", user_id, updates)

    # Send email if role was changed
    if body.role_id:
        try:
            auth_user = sb.auth.admin.get_user_by_id(user_id)
            new_role = sb.table("roles").select("name").eq("id", body.role_id).limit(1).execute()
            if auth_user and auth_user.user and new_role.data:
                threading.Thread(
                    target=send_role_changed_email,
                    args=(auth_user.user.email, new_role.data[0]["name"]),
                    daemon=True,
                ).start()
        except Exception:
            pass

    return {"profile": result.data[0] if result.data else None}


@router.put("/{user_id}/quota")
def update_user_quota(user_id: str, body: UpdateQuotaPayload, user_ctx: dict = Depends(require_permission("manage_users"))):
    """Admin: update request quota for a user."""
    sb = get_supabase()
    try:
        auth_user = sb.auth.admin.get_user_by_id(user_id)
        if not auth_user or not auth_user.user:
            raise HTTPException(status_code=404, detail="User not found.")
        meta = auth_user.user.user_metadata or {}
        meta["request_quota"] = body.request_quota
        if body.reset_used:
            meta["requests_used"] = 0
        sb.auth.admin.update_user_by_id(user_id, {"user_metadata": meta})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update quota: {e}")

    log_audit(user_ctx["id"], "update_user_quota", "user_profiles", user_id, {
        "request_quota": body.request_quota,
        "reset_used": body.reset_used,
    })
    return {
        "message": "Quota updated.",
        "request_quota": body.request_quota,
        "requests_used": meta.get("requests_used", 0),
    }


@router.delete("/{user_id}")
def delete_user(user_id: str, user_ctx: dict = Depends(require_permission("manage_users"))):
    """Admin: delete a user (remove profile + Supabase auth account)."""
    sb = get_supabase()

    # Cannot delete self
    if user_id == user_ctx["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")

    # Delete user profile
    sb.table("user_profiles").delete().eq("user_id", user_id).execute()

    # Delete related data
    sb.table("ai_settings").delete().eq("user_id", user_id).execute()
    sb.table("notifications").delete().eq("user_id", user_id).execute()
    sb.table("feedback").delete().eq("submitted_by", user_id).execute()

    # Delete from Supabase Auth
    try:
        sb.auth.admin.delete_user(user_id)
    except Exception as e:
        pass  # Profile already cleaned up, auth deletion is best-effort

    log_audit(user_ctx["id"], "delete_user", "user_profiles", user_id)
    return {"message": "User deleted successfully."}


@router.post("/{user_id}/message")
def send_message_to_user(user_id: str, body: SendMessagePayload, user_ctx: dict = Depends(require_permission("manage_users"))):
    """Admin: send a direct notification/message to a specific user."""
    sb = get_supabase()

    # Verify user exists
    try:
        profile = sb.table("user_profiles").select("user_id").eq("user_id", user_id).limit(1).execute()
        profile_data = profile.data[0] if profile.data else None
    except Exception:
        profile_data = None
    if not profile_data:
        raise HTTPException(status_code=404, detail="User not found.")

    create_notification(
        user_id=user_id,
        notif_type="admin_message",
        title=body.title,
        message=body.message,
    )

    # Also send via email
    try:
        auth_user = sb.auth.admin.get_user_by_id(user_id)
        if auth_user and auth_user.user:
            threading.Thread(
                target=send_admin_message_email,
                args=(auth_user.user.email, body.title, body.message),
                daemon=True,
            ).start()
    except Exception:
        pass

    log_audit(user_ctx["id"], "send_user_message", "user_profiles", user_id, {"title": body.title})
    return {"message": f"Message sent to user {user_id}."}


@router.get("/roles")
def list_roles(user_ctx: dict = Depends(require_permission("manage_users"))):
    sb = get_supabase()
    result = sb.table("roles").select("*").order("name").execute()
    return {"roles": result.data}


# ── Permission Management ──────────────────────────────────────────────────────

@router.get("/permissions")
def list_role_permissions(user_ctx: dict = Depends(require_super_admin)):
    """Super admin: list all roles with their assigned permission codes."""
    sb = get_supabase()

    roles = sb.table("roles").select("*").order("name").execute()
    permissions = sb.table("permissions").select("*").order("code").execute()

    # Get assigned permissions per role
    role_perms = sb.table("role_permissions").select("role_id, permission_id, permissions(code)").execute()

    # Build a map of role_id -> [permission_codes]
    perm_map = {}
    for rp in (role_perms.data or []):
        rid = rp["role_id"]
        code = rp.get("permissions", {}).get("code")
        if code:
            perm_map.setdefault(rid, []).append(code)

    role_list = []
    for r in (roles.data or []):
        role_list.append({
            **r,
            "assigned_permissions": perm_map.get(r["id"], []),
        })

    return {
        "roles": role_list,
        "all_permissions": permissions.data or [],
    }


@router.put("/permissions/{role_id}")
def update_role_permissions(role_id: str, permission_codes: list[str], user_ctx: dict = Depends(require_super_admin)):
    """Super admin: update the set of permissions for a given role."""
    sb = get_supabase()

    # Validate role exists
    try:
        role = sb.table("roles").select("id, name").eq("id", role_id).limit(1).execute()
        role_data = role.data[0] if role.data else None
    except Exception:
        role_data = None
    if not role_data:
        raise HTTPException(status_code=404, detail="Role not found.")

    # Cannot modify super_admin role permissions
    if role_data["name"] == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot modify super_admin permissions (they bypass all checks).")

    # Get permission IDs from codes
    all_perms = sb.table("permissions").select("id, code").execute()
    code_to_id = {p["code"]: p["id"] for p in (all_perms.data or [])}

    # Validate all codes exist
    for code in permission_codes:
        if code not in code_to_id:
            raise HTTPException(status_code=400, detail=f"Unknown permission code: {code}")

    # Delete existing role_permissions for this role
    sb.table("role_permissions").delete().eq("role_id", role_id).execute()

    # Insert new permissions
    if permission_codes:
        records = [{"role_id": role_id, "permission_id": code_to_id[c]} for c in permission_codes]
        sb.table("role_permissions").insert(records).execute()

    log_audit(user_ctx["id"], "update_role_permissions", "roles", role_id, {"permissions": permission_codes})
    return {"message": f"Permissions updated for role '{role_data['name']}'.", "permissions": permission_codes}
