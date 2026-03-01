"""
quota_middleware.py — Request Quota enforcement
Reads request_quota / requests_used from Supabase Auth user_metadata.
New users default to 20 requests.
"""

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from db.supabase_client import get_supabase

security = HTTPBearer(auto_error=False)

DEFAULT_QUOTA = 20


def check_and_increment_quota(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency that:
      1. Authenticates the user via JWT
      2. Reads request_quota / requests_used from user_metadata
      3. If used >= quota → 429 Too Many Requests
      4. Otherwise increments requests_used and saves back
    Returns the user dict with quota info attached.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    sb = get_supabase()
    try:
        user_resp = sb.auth.get_user(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    meta = user_resp.user.user_metadata or {}
    quota = meta.get("request_quota", DEFAULT_QUOTA)
    used = meta.get("requests_used", 0)

    # Ensure they're ints
    try:
        quota = int(quota)
    except (TypeError, ValueError):
        quota = DEFAULT_QUOTA
    try:
        used = int(used)
    except (TypeError, ValueError):
        used = 0

    if used >= quota:
        raise HTTPException(
            status_code=429,
            detail=f"Request quota exceeded. You have used all {quota} requests. Contact admin to increase your quota.",
        )

    # Increment and save
    meta["requests_used"] = used + 1
    # Ensure quota is set (for users who signed up before this feature)
    if "request_quota" not in meta:
        meta["request_quota"] = DEFAULT_QUOTA

    try:
        sb.auth.admin.update_user_by_id(
            str(user_resp.user.id),
            {"user_metadata": meta},
        )
    except Exception:
        pass  # Best-effort save — don't block the request

    return {
        "id": str(user_resp.user.id),
        "email": user_resp.user.email,
        "request_quota": quota,
        "requests_used": used + 1,
    }
