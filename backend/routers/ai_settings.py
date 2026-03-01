"""
ai_settings.py — BYOK: Bring Your Own Key management
Users store/update their AI provider API keys (encrypted).
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_user_profile
from services.encryption import encrypt_value, decrypt_value, mask_key
from services.audit_service import log_audit

router = APIRouter(prefix="/ai-settings", tags=["AI Settings"])


class AIKeyPayload(BaseModel):
    provider: str           # openai | google | anthropic | azure_openai
    api_key: str
    model_preference: Optional[str] = None
    base_url: Optional[str] = None


# ── Get current settings (masked) ─────────────────────────────────────────────

@router.get("")
def get_ai_settings(user_ctx: dict = Depends(get_user_profile)):
    """Get user's AI settings with masked keys."""
    sb = get_supabase()
    profile = user_ctx.get("profile", {})
    org_id = profile.get("organization_id")

    settings = (
        sb.table("ai_settings")
        .select("*")
        .eq("user_id", user_ctx["id"])
        .execute()
    )
    items = []
    for s in (settings.data or []):
        try:
            real_key = decrypt_value(s["encrypted_api_key"])
            masked = mask_key(real_key)
        except Exception:
            masked = "****invalid****"
        items.append({
            "id": s["id"],
            "provider": s["provider"],
            "masked_key": masked,
            "model_preference": s.get("model_preference"),
            "base_url": s.get("base_url"),
            "is_valid": s.get("is_valid", False),
            "created_at": s.get("created_at"),
            "updated_at": s.get("updated_at"),
        })
    return {"settings": items}


# ── Save / Update key ─────────────────────────────────────────────────────────

@router.post("")
def save_ai_key(body: AIKeyPayload, user_ctx: dict = Depends(get_user_profile)):
    """Save or update an AI provider API key."""
    sb = get_supabase()
    profile = user_ctx.get("profile", {})
    encrypted = encrypt_value(body.api_key)

    # Check existing for this user + provider
    try:
        existing = (
            sb.table("ai_settings")
            .select("id")
            .eq("user_id", user_ctx["id"])
            .eq("provider", body.provider)
            .limit(1)
            .execute()
        )
        existing_data = existing.data[0] if existing.data else None
    except Exception:
        existing_data = None

    record = {
        "user_id": user_ctx["id"],
        "organization_id": profile.get("organization_id"),
        "provider": body.provider,
        "encrypted_api_key": encrypted,
        "model_preference": body.model_preference,
        "base_url": body.base_url,
        "is_valid": False,  # Will be validated separately
    }

    if existing_data:
        result = sb.table("ai_settings").update(record).eq("id", existing_data["id"]).execute()
    else:
        result = sb.table("ai_settings").insert(record).execute()

    log_audit(user_ctx["id"], "save_ai_key", "ai_settings", body.provider)
    return {"message": f"API key for {body.provider} saved.", "setting": result.data[0] if result.data else None}


# ── Validate key ───────────────────────────────────────────────────────────────

@router.post("/{setting_id}/validate")
def validate_ai_key(setting_id: str, user_ctx: dict = Depends(get_user_profile)):
    """Validate an API key by making a test call."""
    sb = get_supabase()
    try:
        setting = (
            sb.table("ai_settings")
            .select("*")
            .eq("id", setting_id)
            .eq("user_id", user_ctx["id"])
            .limit(1)
            .execute()
        )
        setting_data = setting.data[0] if setting.data else None
    except Exception:
        setting_data = None
    if not setting_data:
        raise HTTPException(status_code=404, detail="Setting not found.")

    try:
        real_key = decrypt_value(setting_data["encrypted_api_key"])
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decrypt key.")

    provider = setting_data["provider"]
    is_valid = False
    error_msg = None

    try:
        if provider == "openai":
            import openai
            client = openai.OpenAI(api_key=real_key, base_url=setting_data.get("base_url"))
            client.models.list()
            is_valid = True
        elif provider == "google":
            import google.generativeai as genai
            genai.configure(api_key=real_key)
            list(genai.list_models())
            is_valid = True
        elif provider == "anthropic":
            import httpx
            resp = httpx.get(
                "https://api.anthropic.com/v1/models",
                headers={"x-api-key": real_key, "anthropic-version": "2023-06-01"},
                timeout=10,
            )
            is_valid = resp.status_code == 200
        else:
            # For others, just mark as valid since we can't test
            is_valid = True
    except Exception as e:
        error_msg = str(e)

    sb.table("ai_settings").update({"is_valid": is_valid}).eq("id", setting_id).execute()
    return {"is_valid": is_valid, "error": error_msg}


# ── Delete key ─────────────────────────────────────────────────────────────────

@router.delete("/{setting_id}")
def delete_ai_key(setting_id: str, user_ctx: dict = Depends(get_user_profile)):
    """Remove a saved API key."""
    sb = get_supabase()
    sb.table("ai_settings").delete().eq("id", setting_id).eq("user_id", user_ctx["id"]).execute()
    log_audit(user_ctx["id"], "delete_ai_key", "ai_settings", setting_id)
    return {"message": "API key removed."}
