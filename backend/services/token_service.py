"""
token_service.py — LLM Token Usage Tracking & Cost Calculation
───────────────────────────────────────────────────────────────
Logs every LLM call with token counts, cost, and metadata.
Provides cost calculation using admin-configurable pricing.
Feeds the admin cost dashboard and user usage monitoring.
"""

from datetime import datetime, timezone, timedelta
from db.supabase_client import get_supabase
from config import settings

# ── Default pricing (fallback if cost_settings table not available) ──────────
DEFAULT_PRICING = {
    ("openai", "gpt-4o-mini"): {"input": 0.15, "output": 0.60},
    ("openai", "gpt-4o"): {"input": 2.50, "output": 10.00},
    ("openai", "gpt-4-turbo"): {"input": 10.00, "output": 30.00},
    ("gemini", "gemini-1.5-pro"): {"input": 1.25, "output": 5.00},
    ("gemini", "gemini-1.5-flash"): {"input": 0.075, "output": 0.30},
    ("ollama", "llama3"): {"input": 0, "output": 0},
}

_pricing_cache = {}
_pricing_cache_time = None


def _get_pricing(provider: str, model: str) -> dict:
    """Get pricing from DB with in-memory cache (5 min TTL)."""
    global _pricing_cache, _pricing_cache_time
    now = datetime.now(timezone.utc)

    # Refresh cache every 5 minutes
    if _pricing_cache_time and (now - _pricing_cache_time).seconds < 300 and _pricing_cache:
        key = (provider, model)
        if key in _pricing_cache:
            return _pricing_cache[key]

    try:
        sb = get_supabase()
        result = sb.table("cost_settings").select("*").eq("is_active", True).execute()
        _pricing_cache = {}
        for r in (result.data or []):
            _pricing_cache[(r["provider"], r["model"])] = {
                "input": float(r["input_cost_per_1m"]),
                "output": float(r["output_cost_per_1m"]),
                "batch_discount_pct": r.get("batch_discount_pct", 50),
            }
        _pricing_cache_time = now
    except Exception:
        pass

    key = (provider, model)
    if key in _pricing_cache:
        return _pricing_cache[key]

    # Fallback
    fallback = DEFAULT_PRICING.get(key, {"input": 0, "output": 0})
    fallback["batch_discount_pct"] = 50
    return fallback


def calculate_cost(
    input_tokens: int,
    output_tokens: int,
    provider: str = None,
    model: str = None,
    is_batch: bool = False,
) -> float:
    """Calculate cost in USD for a single LLM call."""
    p = provider or settings.LLM_PROVIDER.lower()
    m = model or _get_model_name(p)
    pricing = _get_pricing(p, m)

    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    total = input_cost + output_cost

    if is_batch and pricing.get("batch_discount_pct", 0) > 0:
        total *= (1 - pricing["batch_discount_pct"] / 100)

    return round(total, 6)


def _get_model_name(provider: str) -> str:
    if provider == "openai":
        return settings.OPENAI_MODEL
    elif provider == "gemini":
        return settings.GEMINI_MODEL
    elif provider == "ollama":
        return settings.OLLAMA_MODEL
    return "unknown"


def log_usage(
    request_type: str = "analysis",
    input_tokens: int = 0,
    output_tokens: int = 0,
    provider: str = None,
    model: str = None,
    cache_hit: bool = False,
    user_id: str = None,
    organization_id: str = None,
    module_id: str = None,
    document_id: str = None,
    batch_job_id: str = None,
    metadata: dict = None,
) -> dict:
    """
    Log a single LLM usage event and return the log entry.
    Calculates cost automatically from token counts.
    """
    p = provider or settings.LLM_PROVIDER.lower()
    m = model or _get_model_name(p)
    total_tokens = input_tokens + output_tokens
    cost = 0.0 if cache_hit else calculate_cost(input_tokens, output_tokens, p, m, is_batch=bool(batch_job_id))

    record = {
        "request_type": request_type,
        "provider": p,
        "model": m,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "cost_usd": cost,
        "cache_hit": cache_hit,
        "metadata": metadata or {},
    }

    # Optional foreign keys
    if user_id:
        record["user_id"] = user_id
    if organization_id:
        record["organization_id"] = organization_id
    if module_id:
        record["module_id"] = module_id
    if document_id:
        record["document_id"] = document_id
    if batch_job_id:
        record["batch_job_id"] = batch_job_id

    try:
        sb = get_supabase()
        result = sb.table("token_usage_logs").insert(record).execute()
        return result.data[0] if result.data else record
    except Exception:
        return record


def get_usage_summary(
    days: int = 30,
    user_id: str = None,
    organization_id: str = None,
) -> dict:
    """Get aggregated usage statistics."""
    sb = get_supabase()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        query = sb.table("token_usage_logs").select("*").gte("created_at", since)
        if user_id:
            query = query.eq("user_id", user_id)
        if organization_id:
            query = query.eq("organization_id", organization_id)

        result = query.order("created_at", desc=True).execute()
        rows = result.data or []

        total_calls = len(rows)
        total_input = sum(r.get("input_tokens", 0) for r in rows)
        total_output = sum(r.get("output_tokens", 0) for r in rows)
        total_tokens = sum(r.get("total_tokens", 0) for r in rows)
        total_cost = sum(float(r.get("cost_usd", 0)) for r in rows)
        cache_hits = sum(1 for r in rows if r.get("cache_hit"))
        cache_misses = total_calls - cache_hits

        # By request type
        by_type = {}
        for r in rows:
            rt = r.get("request_type", "unknown")
            if rt not in by_type:
                by_type[rt] = {"calls": 0, "tokens": 0, "cost": 0}
            by_type[rt]["calls"] += 1
            by_type[rt]["tokens"] += r.get("total_tokens", 0)
            by_type[rt]["cost"] += float(r.get("cost_usd", 0))

        # By day (last N days)
        daily = {}
        for r in rows:
            day = r.get("created_at", "")[:10]
            if day not in daily:
                daily[day] = {"calls": 0, "tokens": 0, "cost": 0, "cache_hits": 0}
            daily[day]["calls"] += 1
            daily[day]["tokens"] += r.get("total_tokens", 0)
            daily[day]["cost"] += float(r.get("cost_usd", 0))
            if r.get("cache_hit"):
                daily[day]["cache_hits"] += 1

        # Estimated savings from cache
        tokens_saved = sum(
            r.get("total_tokens", 0) for r in rows if r.get("cache_hit")
        )
        cost_saved = sum(
            calculate_cost(r.get("input_tokens", 0), r.get("output_tokens", 0), r.get("provider"), r.get("model"))
            for r in rows if r.get("cache_hit")
        )

        return {
            "period_days": days,
            "total_calls": total_calls,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_tokens": total_tokens,
            "total_cost_usd": round(total_cost, 4),
            "cache_hits": cache_hits,
            "cache_misses": cache_misses,
            "cache_hit_rate": round(cache_hits / max(total_calls, 1) * 100, 1),
            "tokens_saved_by_cache": tokens_saved,
            "cost_saved_by_cache": round(cost_saved, 4),
            "by_type": by_type,
            "daily": dict(sorted(daily.items())),
        }
    except Exception as e:
        return {
            "period_days": days, "total_calls": 0, "total_tokens": 0,
            "total_cost_usd": 0, "cache_hits": 0, "cache_misses": 0,
            "error": str(e),
        }


def get_cost_settings() -> list:
    """Return all cost settings for admin."""
    sb = get_supabase()
    try:
        result = sb.table("cost_settings").select("*").order("provider").execute()
        return result.data or []
    except Exception:
        return []


def update_cost_setting(setting_id: str, input_cost: float, output_cost: float, batch_discount: int) -> dict:
    """Update pricing for a specific model."""
    sb = get_supabase()
    global _pricing_cache_time
    _pricing_cache_time = None  # Invalidate cache

    result = sb.table("cost_settings").update({
        "input_cost_per_1m": input_cost,
        "output_cost_per_1m": output_cost,
        "batch_discount_pct": batch_discount,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", setting_id).execute()
    return result.data[0] if result.data else {}
