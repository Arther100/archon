"""
documents.py — GET /documents, GET /documents/{id}/modules, DELETE /documents/{id}
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("")
def list_documents(current_user: dict = Depends(get_current_user)):
    """Return documents belonging to the current user (excluding soft-deleted)."""
    sb = get_supabase()
    result = (
        sb.table("documents")
        .select("id, file_name, file_type, created_at")
        .eq("user_id", current_user["id"])
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    return {"documents": result.data}


@router.delete("/{document_id}")
def soft_delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    """Soft-delete a document by setting deleted_at timestamp."""
    sb = get_supabase()

    # Verify document exists, is not already deleted, and belongs to current user
    doc = sb.table("documents").select("id").eq("id", document_id).eq("user_id", current_user["id"]).is_("deleted_at", "null").execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    now = datetime.now(timezone.utc).isoformat()
    sb.table("documents").update({"deleted_at": now}).eq("id", document_id).execute()
    return {"message": "Document moved to trash.", "document_id": document_id}


@router.get("/{document_id}/modules")
def list_modules(document_id: str):
    """Return all detected modules for a given document."""
    sb = get_supabase()

    # Verify document exists
    doc = sb.table("documents").select("id, file_name").eq("id", document_id).execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    modules = (
        sb.table("modules")
        .select("id, title, \"order\"")
        .eq("document_id", document_id)
        .order("order")
        .execute()
    )

    # Check which modules already have at least one analysis
    module_ids = [m["id"] for m in modules.data]
    analysed_ids = set()
    if module_ids:
        analyses = (
            sb.table("analyses")
            .select("module_id")
            .in_("module_id", module_ids)
            .execute()
        )
        analysed_ids = {a["module_id"] for a in (analyses.data or [])}

    enriched = [
        {**m, "has_analysis": m["id"] in analysed_ids}
        for m in modules.data
    ]

    return {
        "document_id": document_id,
        "file_name": doc.data[0]["file_name"],
        "modules": enriched,
    }
