"""
supabase_client.py
------------------
Initialises and exports a single Supabase client instance.
Uses the SERVICE key for server-side operations (bypasses RLS where needed).
"""

from supabase import create_client, Client
from config import settings

_client: Client | None = None


def get_supabase() -> Client:
    """Singleton client using SERVICE key — for DB / admin operations."""
    global _client
    if _client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "Supabase credentials not configured. "
                "Copy .env.example to .env and fill in SUPABASE_URL and SUPABASE_SERVICE_KEY."
            )
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _client


def get_supabase_auth() -> Client:
    """Fresh client using ANON key — for auth (login / signup) operations.

    A new instance is created every time so that internal session state from
    one request never leaks into another.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise RuntimeError(
            "Supabase auth credentials not configured. "
            "Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set in .env."
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
