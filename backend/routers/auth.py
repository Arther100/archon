"""
auth.py — Authentication Router
POST /auth/signup  — create account
POST /auth/login   — get access_token
POST /auth/logout  — sign out
GET  /auth/me      — get current user info
POST /auth/avatar  — upload profile picture
"""

import base64
import threading
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from db.supabase_client import get_supabase, get_supabase_auth
from services.email_service import send_welcome_email, send_password_changed_email
from middleware.quota_middleware import DEFAULT_QUOTA

router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer(auto_error=False)


class AuthPayload(BaseModel):
    email: str
    password: str


class SignupPayload(BaseModel):
    email: str
    password: str
    username: str | None = None


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


class UpdateProfilePayload(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    theme_color: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    phone: str | None = None
    bio: str | None = None


# ── Sign Up ────────────────────────────────────────────────────────────────────

@router.post("/signup")
def signup(body: SignupPayload):
    sb_admin = get_supabase()
    try:
        # Build user metadata with optional username
        user_metadata = {"request_quota": DEFAULT_QUOTA, "requests_used": 0}
        if body.username:
            user_metadata["display_name"] = body.username.strip()
        # Use admin API to create user with email pre-confirmed
        # so users can log in immediately without email verification
        create_payload = {
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": user_metadata,
        }
        res = sb_admin.auth.admin.create_user(create_payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if res.user is None:
        raise HTTPException(status_code=400, detail="Signup failed. Check email/password requirements.")

    # Send welcome email in background thread (non-blocking)
    threading.Thread(target=send_welcome_email, args=(res.user.email,), daemon=True).start()

    return {
        "user_id": str(res.user.id),
        "email": res.user.email,
        "message": "Account created. Check your email to confirm (if email confirmation is enabled).",
    }


# ── Login ──────────────────────────────────────────────────────────────────────

@router.post("/login")
def login(body: AuthPayload):
    sb = get_supabase_auth()
    try:
        res = sb.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception as e:
        detail = str(e)
        # Surface the real Supabase error so the user knows what went wrong
        raise HTTPException(status_code=401, detail=detail)

    if res.user is None or res.session is None:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    meta = res.user.user_metadata or {}
    return {
        "access_token": res.session.access_token,
        "refresh_token": res.session.refresh_token,
        "token_type": "bearer",
        "user_id": str(res.user.id),
        "email": res.user.email,
        "display_name": meta.get("display_name", ""),
        "avatar_url": meta.get("avatar_url", ""),
        "theme_color": meta.get("theme_color", "#3b6ef5"),
        "github_url": meta.get("github_url", ""),
        "linkedin_url": meta.get("linkedin_url", ""),
        "phone": meta.get("phone", ""),
        "bio": meta.get("bio", ""),
        "request_quota": meta.get("request_quota", DEFAULT_QUOTA),
        "requests_used": meta.get("requests_used", 0),
    }


# ── Logout ─────────────────────────────────────────────────────────────────────

class RefreshPayload(BaseModel):
    refresh_token: str


@router.post("/refresh")
def refresh_token(body: RefreshPayload):
    """Exchange a refresh token for a new access + refresh token pair."""
    sb = get_supabase_auth()
    try:
        res = sb.auth.refresh_session(body.refresh_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Refresh failed: {str(e)}")

    if not res.session:
        raise HTTPException(status_code=401, detail="Could not refresh session.")

    meta = res.user.user_metadata or {} if res.user else {}
    return {
        "access_token": res.session.access_token,
        "refresh_token": res.session.refresh_token,
        "user_id": str(res.user.id) if res.user else "",
        "email": res.user.email if res.user else "",
        "display_name": meta.get("display_name", ""),
        "avatar_url": meta.get("avatar_url", ""),
        "theme_color": meta.get("theme_color", "#3b6ef5"),
        "github_url": meta.get("github_url", ""),
        "linkedin_url": meta.get("linkedin_url", ""),
        "phone": meta.get("phone", ""),
        "bio": meta.get("bio", ""),
        "request_quota": meta.get("request_quota", DEFAULT_QUOTA),
        "requests_used": meta.get("requests_used", 0),
    }


@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    sb = get_supabase()
    try:
        if credentials:
            sb.auth.sign_out()
    except Exception:
        pass
    return {"message": "Logged out successfully."}


# ── Me ─────────────────────────────────────────────────────────────────────────

@router.get("/me")
def me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    sb = get_supabase()
    try:
        user = sb.auth.get_user(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    meta = user.user.user_metadata or {}
    return {
        "user_id": str(user.user.id),
        "email": user.user.email,
        "display_name": meta.get("display_name", ""),
        "avatar_url": meta.get("avatar_url", ""),
        "theme_color": meta.get("theme_color", "#3b6ef5"),
        "github_url": meta.get("github_url", ""),
        "linkedin_url": meta.get("linkedin_url", ""),
        "phone": meta.get("phone", ""),
        "bio": meta.get("bio", ""),
        "request_quota": meta.get("request_quota", DEFAULT_QUOTA),
        "requests_used": meta.get("requests_used", 0),
        "created_at": str(user.user.created_at),
    }


# ── Me — RBAC profile + permissions ───────────────────────────────────────────

@router.get("/me/profile")
def me_profile(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Return user RBAC profile with role, org, and permission codes."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    sb = get_supabase()
    try:
        user = sb.auth.get_user(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user_id = str(user.user.id)

    # Fetch user_profile with joined role and org — use .limit(1) to avoid 204 errors
    try:
        result = (
            sb.table("user_profiles")
            .select("*, roles(name, description), organizations(id, name, plan_id, subscription_status)")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        profile_data = result.data[0] if result.data else None
    except Exception:
        profile_data = None

    if not profile_data:
        # Auto-create
        role_id = None
        try:
            default_role = sb.table("roles").select("id").eq("name", "developer").limit(1).execute()
            role_id = default_role.data[0]["id"] if default_role.data else None
        except Exception:
            pass

        # Auto-assign to default organization
        org_id = None
        try:
            default_org = (
                sb.table("organizations")
                .select("id")
                .order("created_at")
                .limit(1)
                .execute()
            )
            org_id = default_org.data[0]["id"] if default_org.data else None
        except Exception:
            pass

        new_profile = {"user_id": user_id, "role_id": role_id}
        if org_id:
            new_profile["organization_id"] = org_id
        sb.table("user_profiles").insert(new_profile).execute()
        try:
            result = (
                sb.table("user_profiles")
                .select("*, roles(name, description), organizations(id, name, plan_id, subscription_status)")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            profile_data = result.data[0] if result.data else None
        except Exception:
            profile_data = None

    # Fetch permission codes
    permissions = []
    prof = profile_data or {}
    if prof.get("role_id"):
        try:
            perms = (
                sb.table("role_permissions")
                .select("permissions(code)")
                .eq("role_id", prof["role_id"])
                .execute()
            )
            permissions = [p["permissions"]["code"] for p in (perms.data or []) if p.get("permissions")]
        except Exception:
            pass

    return {"profile": prof, "permissions": permissions}


# ── Change Password ───────────────────────────────────────────────────────────

@router.post("/change-password")
def change_password(body: ChangePasswordPayload, credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    sb = get_supabase()
    # Verify current user
    try:
        user_resp = sb.auth.get_user(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    # Verify current password by attempting login
    sb_auth = get_supabase_auth()
    try:
        sb_auth.auth.sign_in_with_password({
            "email": user_resp.user.email,
            "password": body.current_password,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    # Update password via admin API
    try:
        sb.auth.admin.update_user_by_id(
            str(user_resp.user.id),
            {"password": body.new_password}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update password: {str(e)}")

    # Notify user via email
    threading.Thread(target=send_password_changed_email, args=(user_resp.user.email,), daemon=True).start()

    return {"message": "Password changed successfully."}


# ── Update Profile ─────────────────────────────────────────────────────────────
@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(...), credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Upload a profile picture and store as data URI in user metadata."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    sb = get_supabase()
    try:
        user_resp = sb.auth.get_user(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    # Validate file type
    allowed = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF, WebP, and SVG images are allowed.")

    # Read and size-check (max 2 MB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be smaller than 2 MB.")

    # Convert to data URI
    b64 = base64.b64encode(contents).decode("utf-8")
    data_uri = f"data:{file.content_type};base64,{b64}"

    # Save to user metadata
    meta = user_resp.user.user_metadata or {}
    meta["avatar_url"] = data_uri
    try:
        sb.auth.admin.update_user_by_id(
            str(user_resp.user.id),
            {"user_metadata": meta}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save avatar: {str(e)}")

    return {"avatar_url": data_uri, "message": "Avatar uploaded successfully."}

@router.post("/profile")
def update_profile(body: UpdateProfilePayload, credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    sb = get_supabase()
    try:
        user_resp = sb.auth.get_user(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    # Merge with existing metadata
    meta = user_resp.user.user_metadata or {}
    if body.display_name is not None:
        meta["display_name"] = body.display_name
    if body.avatar_url is not None:
        meta["avatar_url"] = body.avatar_url
    if body.theme_color is not None:
        meta["theme_color"] = body.theme_color
    if body.github_url is not None:
        meta["github_url"] = body.github_url
    if body.linkedin_url is not None:
        meta["linkedin_url"] = body.linkedin_url
    if body.phone is not None:
        meta["phone"] = body.phone
    if body.bio is not None:
        meta["bio"] = body.bio

    try:
        sb.auth.admin.update_user_by_id(
            str(user_resp.user.id),
            {"user_metadata": meta}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

    return {
        "message": "Profile updated.",
        "display_name": meta.get("display_name", ""),
        "avatar_url": meta.get("avatar_url", ""),
        "theme_color": meta.get("theme_color", "#3b6ef5"),
        "github_url": meta.get("github_url", ""),
        "linkedin_url": meta.get("linkedin_url", ""),
        "phone": meta.get("phone", ""),
        "bio": meta.get("bio", ""),
    }
