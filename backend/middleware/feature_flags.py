"""
feature_flags.py — Feature flag enforcement
Checks plan features + org-level overrides.
"""

from fastapi import HTTPException, Depends
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_user_profile


def check_feature(feature_name: str):
    """Factory — returns dependency that checks if a feature is enabled for user's org."""
    def checker(user_ctx: dict = Depends(get_user_profile)):
        profile = user_ctx.get("profile", {})
        org = profile.get("organizations")

        # Super admins bypass feature checks
        role = profile.get("roles", {})
        if role and role.get("name") == "super_admin":
            return user_ctx

        if not org or not org.get("plan_id"):
            raise HTTPException(status_code=403, detail="No active plan. Please subscribe.")

        if org.get("subscription_status") not in ("active", "trial"):
            raise HTTPException(status_code=403, detail="Subscription is not active.")

        sb = get_supabase()

        # 1. Check org-level override first
        try:
            override = (
                sb.table("organization_features")
                .select("enabled")
                .eq("organization_id", org["id"])
                .eq("feature_name", feature_name)
                .limit(1)
                .execute()
            )
            override_data = override.data[0] if override.data else None
        except Exception:
            override_data = None
        if override_data is not None:
            if not override_data["enabled"]:
                raise HTTPException(status_code=403, detail=f"Feature '{feature_name}' is disabled for your organization.")
            return user_ctx

        # 2. Fall back to plan features
        try:
            plan = sb.table("plans").select("features").eq("id", org["plan_id"]).limit(1).execute()
            plan_data = plan.data[0] if plan.data else None
        except Exception:
            plan_data = None
        if plan_data:
            features = plan_data.get("features", {})
            if not features.get(feature_name, False):
                raise HTTPException(
                    status_code=403,
                    detail=f"Feature '{feature_name}' is not available in your current plan. Please upgrade."
                )

        return user_ctx
    return checker
