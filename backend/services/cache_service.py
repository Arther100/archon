"""
cache_service.py — Content-hash based analysis caching
─────────────────────────────────────────────────────────
Eliminates redundant LLM calls for identical module content.

Flow:
1. Hash module text (SHA-256) → check analysis_cache
2. Cache HIT  → return stored blueprint instantly (0 tokens, 0 cost)
3. Cache MISS → caller runs LLM, then stores result via put()
"""

import hashlib
import json
from datetime import datetime, timezone
from db.supabase_client import get_supabase


def _hash(text: str, provider: str, model: str) -> str:
    """SHA-256 of normalised text + provider + model."""
    normalised = text.strip().lower()
    payload = f"{provider}::{model}::{normalised}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_cached(text: str, provider: str, model: str) -> dict | None:
    """
    Look up cached blueprint by content hash.
    Returns the blueprint dict on hit, None on miss.
    Increments hit_count and updates last_hit_at on hit.
    """
    h = _hash(text, provider, model)
    sb = get_supabase()
    try:
        result = (
            sb.table("analysis_cache")
            .select("id, blueprint, input_tokens, output_tokens, total_cost_usd, hit_count")
            .eq("content_hash", h)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None

        row = result.data[0]
        # Bump hit counter
        sb.table("analysis_cache").update({
            "hit_count": (row.get("hit_count") or 0) + 1,
            "last_hit_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", row["id"]).execute()

        return {
            "blueprint": row["blueprint"],
            "input_tokens": row.get("input_tokens", 0),
            "output_tokens": row.get("output_tokens", 0),
            "cost_usd": float(row.get("total_cost_usd", 0)),
            "cache_hit": True,
        }
    except Exception:
        return None


def put_cached(
    text: str,
    provider: str,
    model: str,
    blueprint: dict,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost_usd: float = 0,
) -> bool:
    """Store a fresh blueprint in the cache. Returns True on success."""
    h = _hash(text, provider, model)
    sb = get_supabase()
    try:
        sb.table("analysis_cache").upsert({
            "content_hash": h,
            "provider": provider,
            "model": model,
            "blueprint": blueprint,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_cost_usd": cost_usd,
            "hit_count": 1,
            "last_hit_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="content_hash").execute()
        return True
    except Exception:
        return False


def invalidate(text: str, provider: str, model: str) -> bool:
    """Remove a specific cache entry (for forced re-analysis)."""
    h = _hash(text, provider, model)
    sb = get_supabase()
    try:
        sb.table("analysis_cache").delete().eq("content_hash", h).execute()
        return True
    except Exception:
        return False


def get_cache_stats() -> dict:
    """Return cache statistics for admin dashboard."""
    sb = get_supabase()
    try:
        result = sb.table("analysis_cache").select("id, hit_count, input_tokens, output_tokens, total_cost_usd, provider, model", count="exact").execute()
        rows = result.data or []
        total_entries = result.count or len(rows)
        total_hits = sum(r.get("hit_count", 0) for r in rows)
        total_tokens_saved = sum((r.get("input_tokens", 0) + r.get("output_tokens", 0)) * max(r.get("hit_count", 1) - 1, 0) for r in rows)
        total_cost_saved = sum(float(r.get("total_cost_usd", 0)) * max(r.get("hit_count", 1) - 1, 0) for r in rows)

        # By provider
        by_provider = {}
        for r in rows:
            key = f"{r.get('provider', 'unknown')}/{r.get('model', 'unknown')}"
            if key not in by_provider:
                by_provider[key] = {"entries": 0, "hits": 0, "tokens_saved": 0, "cost_saved": 0}
            by_provider[key]["entries"] += 1
            by_provider[key]["hits"] += r.get("hit_count", 0)
            extra_hits = max(r.get("hit_count", 1) - 1, 0)
            by_provider[key]["tokens_saved"] += (r.get("input_tokens", 0) + r.get("output_tokens", 0)) * extra_hits
            by_provider[key]["cost_saved"] += float(r.get("total_cost_usd", 0)) * extra_hits

        return {
            "total_entries": total_entries,
            "total_hits": total_hits,
            "total_tokens_saved": total_tokens_saved,
            "total_cost_saved": round(total_cost_saved, 4),
            "by_provider": by_provider,
        }
    except Exception as e:
        return {"total_entries": 0, "total_hits": 0, "total_tokens_saved": 0, "total_cost_saved": 0, "by_provider": {}, "error": str(e)}


def clear_all_cache() -> int:
    """Purge entire cache. Returns count deleted."""
    sb = get_supabase()
    try:
        result = sb.table("analysis_cache").select("id", count="exact").execute()
        count = result.count or 0
        if count > 0:
            sb.table("analysis_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        return count
    except Exception:
        return 0
