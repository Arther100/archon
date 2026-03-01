"""
audit_service.py — Record admin actions for audit trail.
"""

from db.supabase_client import get_supabase


def log_audit(actor_id: str, action: str, entity_type: str = None, entity_id: str = None, details: dict = None):
    """Insert an audit log entry."""
    sb = get_supabase()
    sb.table("audit_logs").insert({
        "actor_id": actor_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
    }).execute()
