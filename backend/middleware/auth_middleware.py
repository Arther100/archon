"""
auth_middleware.py — RBAC enforcement helpers
Extracts user, role, permissions from JWT token + user_profiles table.
"""

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from db.supabase_client import get_supabase

security = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extract and validate current user from JWT token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    sb = get_supabase()
    try:
        user_resp = sb.auth.get_user(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {
        "id": str(user_resp.user.id),
        "email": user_resp.user.email,
        "metadata": user_resp.user.user_metadata or {},
        "token": credentials.credentials,
    }


def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Fetch user profile with role and organization (separate queries, no embedded joins)."""
    sb = get_supabase()
    user_id = current_user["id"]

    # ── Fetch profile (plain query) ─────────────────────────────────────────
    profile_data = None
    try:
        result = sb.table("user_profiles").select("*").eq("user_id", user_id).limit(1).execute()
        profile_data = result.data[0] if result.data else None
    except Exception:
        pass

    # ── Auto-create if missing (upsert to avoid duplicate crash) ────────────
    if not profile_data:
        role_id = None
        try:
            default_role = sb.table("roles").select("id").eq("name", "developer").limit(1).execute()
            role_id = default_role.data[0]["id"] if default_role.data else None
        except Exception:
            pass

        org_id = None
        try:
            default_org = sb.table("organizations").select("id").order("created_at").limit(1).execute()
            org_id = default_org.data[0]["id"] if default_org.data else None
        except Exception:
            pass

        new_profile = {"user_id": user_id, "role_id": role_id}
        if org_id:
            new_profile["organization_id"] = org_id

        try:
            sb.table("user_profiles").upsert(new_profile, on_conflict="user_id").execute()
        except Exception:
            pass

        try:
            result = sb.table("user_profiles").select("*").eq("user_id", user_id).limit(1).execute()
            profile_data = result.data[0] if result.data else None
        except Exception:
            pass

    # ── Enrich with role and org data (separate queries) ────────────────────
    if profile_data and profile_data.get("role_id"):
        try:
            role_result = sb.table("roles").select("name, description").eq("id", profile_data["role_id"]).limit(1).execute()
            profile_data["roles"] = role_result.data[0] if role_result.data else None
        except Exception:
            profile_data["roles"] = None
    if profile_data and profile_data.get("organization_id"):
        try:
            org_result = sb.table("organizations").select("id, name, plan_id, subscription_status").eq("id", profile_data["organization_id"]).limit(1).execute()
            profile_data["organizations"] = org_result.data[0] if org_result.data else None
        except Exception:
            profile_data["organizations"] = None

    return {**current_user, "profile": profile_data}


def get_user_permissions(user_with_profile: dict = Depends(get_user_profile)):
    """Fetch all permission codes for the user's role."""
    profile = user_with_profile.get("profile")
    if not profile or not profile.get("role_id"):
        return {**user_with_profile, "permissions": []}

    sb = get_supabase()
    try:
        rp_result = sb.table("role_permissions").select("permission_id").eq("role_id", profile["role_id"]).execute()
        perm_ids = [rp["permission_id"] for rp in (rp_result.data or [])]
        if perm_ids:
            p_result = sb.table("permissions").select("code").in_("id", perm_ids).execute()
            codes = [p["code"] for p in (p_result.data or [])]
        else:
            codes = []
    except Exception:
        codes = []
    return {**user_with_profile, "permissions": codes}


def require_permission(permission_code: str):
    """Factory — returns a dependency that enforces a specific permission."""
    def checker(user_ctx: dict = Depends(get_user_permissions)):
        if permission_code not in user_ctx.get("permissions", []):
            raise HTTPException(status_code=403, detail=f"Permission denied: {permission_code}")
        return user_ctx
    return checker


def require_role(role_name: str):
    """Factory — returns a dependency that enforces a minimum role."""
    def checker(user_ctx: dict = Depends(get_user_profile)):
        profile = user_ctx.get("profile", {})
        role = profile.get("roles", {})
        if not role or role.get("name") != role_name:
            # Super admin passes all role checks
            if role and role.get("name") == "super_admin":
                return user_ctx
            raise HTTPException(status_code=403, detail=f"Role required: {role_name}")
        return user_ctx
    return checker


def require_super_admin(user_ctx: dict = Depends(get_user_profile)):
    """Enforce super_admin role."""
    profile = user_ctx.get("profile", {})
    role = profile.get("roles", {})
    if not role or role.get("name") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required.")
    return user_ctx
