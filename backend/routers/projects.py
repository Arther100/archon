"""
projects.py — Project grouping CRUD
POST   /projects                          — create project
GET    /projects                          — list user's projects (with doc counts)
GET    /projects/{id}                     — get project detail + linked documents
PUT    /projects/{id}                     — update project name/description
DELETE /projects/{id}                     — delete project (unlinks docs, doesn't delete them)
POST   /projects/{id}/documents           — assign documents to project
DELETE /projects/{id}/documents/{doc_id}  — remove document from project
GET    /projects/{id}/context             — get cross-document context summary for AI
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/projects", tags=["Projects"])


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class AssignDocuments(BaseModel):
    document_ids: list[str]


# ── Create Project ────────────────────────────────────────────────────────────

@router.post("")
def create_project(body: ProjectCreate, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("projects").insert({
        "name": body.name.strip(),
        "description": (body.description or "").strip(),
        "user_id": current_user["id"],
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create project.")

    return {"project": result.data[0]}


# ── List Projects ─────────────────────────────────────────────────────────────

@router.get("")
def list_projects(current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    projects = (
        sb.table("projects")
        .select("id, name, description, created_at, updated_at")
        .eq("user_id", current_user["id"])
        .order("updated_at", desc=True)
        .execute()
    )

    # Get document counts per project
    enriched = []
    for p in (projects.data or []):
        doc_count = (
            sb.table("documents")
            .select("id", count="exact")
            .eq("project_id", p["id"])
            .is_("deleted_at", "null")
            .execute()
        )
        enriched.append({
            **p,
            "document_count": doc_count.count or 0,
        })

    return {"projects": enriched}


# ── Get Project Detail ────────────────────────────────────────────────────────

@router.get("/{project_id}")
def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()
    project = (
        sb.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Get linked documents
    docs = (
        sb.table("documents")
        .select("id, file_name, file_type, created_at")
        .eq("project_id", project_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .execute()
    )

    # Get module count per document
    doc_ids = [d["id"] for d in (docs.data or [])]
    module_counts = {}
    if doc_ids:
        modules = (
            sb.table("modules")
            .select("document_id")
            .in_("document_id", doc_ids)
            .execute()
        )
        for m in (modules.data or []):
            did = m["document_id"]
            module_counts[did] = module_counts.get(did, 0) + 1

    enriched_docs = [
        {**d, "module_count": module_counts.get(d["id"], 0)}
        for d in (docs.data or [])
    ]

    return {
        "project": project.data[0],
        "documents": enriched_docs,
    }


# ── Update Project ────────────────────────────────────────────────────────────

@router.put("/{project_id}")
def update_project(project_id: str, body: ProjectUpdate, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()

    existing = sb.table("projects").select("id").eq("id", project_id).eq("user_id", current_user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found.")

    updates = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.description is not None:
        updates["description"] = body.description.strip()

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    sb.table("projects").update(updates).eq("id", project_id).execute()
    return {"message": "Project updated.", "project_id": project_id}


# ── Delete Project ────────────────────────────────────────────────────────────

@router.delete("/{project_id}")
def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()

    existing = sb.table("projects").select("id").eq("id", project_id).eq("user_id", current_user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Unlink documents (don't delete them)
    sb.table("documents").update({"project_id": None}).eq("project_id", project_id).execute()
    # Delete project
    sb.table("projects").delete().eq("id", project_id).execute()

    return {"message": "Project deleted. Documents have been unlinked.", "project_id": project_id}


# ── Assign Documents to Project ───────────────────────────────────────────────

@router.post("/{project_id}/documents")
def assign_documents(project_id: str, body: AssignDocuments, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()

    # Verify project belongs to user
    existing = sb.table("projects").select("id").eq("id", project_id).eq("user_id", current_user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Verify all documents belong to user
    for doc_id in body.document_ids:
        doc = sb.table("documents").select("id").eq("id", doc_id).eq("user_id", current_user["id"]).execute()
        if not doc.data:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found.")

    # Assign
    for doc_id in body.document_ids:
        sb.table("documents").update({"project_id": project_id}).eq("id", doc_id).execute()

    return {"message": f"{len(body.document_ids)} document(s) assigned.", "project_id": project_id}


# ── Remove Document from Project ──────────────────────────────────────────────

@router.delete("/{project_id}/documents/{document_id}")
def remove_document_from_project(project_id: str, document_id: str, current_user: dict = Depends(get_current_user)):
    sb = get_supabase()

    doc = (
        sb.table("documents")
        .select("id")
        .eq("id", document_id)
        .eq("project_id", project_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found in this project.")

    sb.table("documents").update({"project_id": None}).eq("id", document_id).execute()
    return {"message": "Document removed from project.", "document_id": document_id}


# ── Cross-Document Context Summary (for AI) ──────────────────────────────────

@router.get("/{project_id}/context")
def get_project_context(project_id: str, current_user: dict = Depends(get_current_user)):
    """
    Build a cross-document context summary for the AI.
    Returns module titles + summaries from all documents in the project.
    This helps the LLM understand the full project flow when analysing any module.
    """
    sb = get_supabase()

    # Verify project
    project = sb.table("projects").select("id, name").eq("id", project_id).eq("user_id", current_user["id"]).execute()
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Get all documents in project
    docs = (
        sb.table("documents")
        .select("id, file_name")
        .eq("project_id", project_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not docs.data:
        return {"project_name": project.data[0]["name"], "context_summary": "", "module_count": 0}

    doc_ids = [d["id"] for d in docs.data]

    # Get all modules with their latest analysis summaries
    modules = (
        sb.table("modules")
        .select("id, title, document_id, \"order\"")
        .in_("document_id", doc_ids)
        .order("order")
        .execute()
    )

    context_parts = []
    doc_name_map = {d["id"]: d["file_name"] for d in docs.data}

    for m in (modules.data or []):
        # Get latest analysis summary for this module
        analysis = (
            sb.table("analyses")
            .select("output_json")
            .eq("module_id", m["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        summary = ""
        if analysis.data:
            bp = analysis.data[0].get("output_json") or {}
            summary = bp.get("documented", {}).get("summary", "")

        doc_name = doc_name_map.get(m["document_id"], "Unknown")
        context_parts.append(
            f"[{doc_name}] Module: {m['title']}"
            + (f" — {summary}" if summary else "")
        )

    context_summary = "\n".join(context_parts)

    return {
        "project_name": project.data[0]["name"],
        "context_summary": context_summary,
        "module_count": len(modules.data or []),
        "document_count": len(docs.data),
    }
