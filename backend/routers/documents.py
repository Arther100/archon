"""
documents.py — GET /documents, GET /documents/{id}/modules, DELETE /documents/{id}
             — POST /documents/compare — compare two document versions module-by-module
"""

import difflib
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("")
def list_documents(current_user: dict = Depends(get_current_user)):
    """Return documents belonging to the current user (excluding soft-deleted)."""
    sb = get_supabase()
    result = (
        sb.table("documents")
        .select("id, file_name, file_type, created_at, project_id")
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


# ── Compare Two Document Versions ─────────────────────────────────────────────

class CompareRequest(BaseModel):
    old_document_id: str
    new_document_id: str


def _compute_line_diff(old_text: str, new_text: str) -> dict:
    """
    Compute a structured diff between two texts.
    Returns {
        hunks: [{old_start, new_start, lines: [{type, old_line_no, new_line_no, text}]}],
        stats: {added, removed, changed_hunks}
    }
    Groups consecutive changes into hunks with surrounding context lines.
    """
    old_lines = old_text.splitlines()
    new_lines = new_text.splitlines()

    # Build raw diff entries with line numbers
    raw_diff = []
    old_no = 0
    new_no = 0
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, old_lines, new_lines).get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1):
                old_no += 1
                new_no += 1
                raw_diff.append({"type": "unchanged", "old_no": old_no, "new_no": new_no, "text": old_lines[i1 + k]})
        elif tag == 'replace':
            for k in range(i2 - i1):
                old_no += 1
                raw_diff.append({"type": "removed", "old_no": old_no, "new_no": None, "text": old_lines[i1 + k]})
            for k in range(j2 - j1):
                new_no += 1
                raw_diff.append({"type": "added", "old_no": None, "new_no": new_no, "text": new_lines[j1 + k]})
        elif tag == 'delete':
            for k in range(i2 - i1):
                old_no += 1
                raw_diff.append({"type": "removed", "old_no": old_no, "new_no": None, "text": old_lines[i1 + k]})
        elif tag == 'insert':
            for k in range(j2 - j1):
                new_no += 1
                raw_diff.append({"type": "added", "old_no": None, "new_no": new_no, "text": new_lines[j1 + k]})

    # Group into hunks: each hunk = consecutive changes + 3 lines of context above/below
    CONTEXT = 3
    changed_indices = {i for i, d in enumerate(raw_diff) if d["type"] != "unchanged"}
    if not changed_indices:
        return {"hunks": [], "stats": {"added": 0, "removed": 0, "changed_hunks": 0}}

    # Expand changed indices to include context
    visible = set()
    for idx in changed_indices:
        for c in range(max(0, idx - CONTEXT), min(len(raw_diff), idx + CONTEXT + 1)):
            visible.add(c)

    # Split into contiguous hunks
    sorted_vis = sorted(visible)
    hunks = []
    current_hunk = []
    prev = None
    for idx in sorted_vis:
        if prev is not None and idx > prev + 1:
            # Gap — close current hunk, start new one
            hunks.append(current_hunk)
            current_hunk = []
        current_hunk.append(raw_diff[idx])
        prev = idx
    if current_hunk:
        hunks.append(current_hunk)

    # Format hunks
    formatted_hunks = []
    for hunk_lines in hunks:
        old_start = next((l["old_no"] for l in hunk_lines if l["old_no"] is not None), 0)
        new_start = next((l["new_no"] for l in hunk_lines if l["new_no"] is not None), 0)
        formatted_hunks.append({
            "old_start": old_start,
            "new_start": new_start,
            "lines": hunk_lines,
        })

    stats = {
        "added": sum(1 for d in raw_diff if d["type"] == "added"),
        "removed": sum(1 for d in raw_diff if d["type"] == "removed"),
        "changed_hunks": len(formatted_hunks),
    }
    return {"hunks": formatted_hunks, "stats": stats}


def _match_modules(old_modules: list, new_modules: list) -> tuple[list, list, list]:
    """
    Match modules between old and new document by title similarity.
    Returns (matched, added, removed) where:
      matched = [(old_module, new_module, similarity_ratio)]
      added   = [new_modules that have no match in old]
      removed = [old_modules that have no match in new]
    """
    old_titles = {m["title"].strip().lower(): m for m in old_modules}
    new_titles = {m["title"].strip().lower(): m for m in new_modules}

    matched = []
    matched_old_keys = set()
    matched_new_keys = set()

    # Exact matches first
    for key in old_titles:
        if key in new_titles:
            matched.append((old_titles[key], new_titles[key], 1.0))
            matched_old_keys.add(key)
            matched_new_keys.add(key)

    # Fuzzy matches for unmatched
    remaining_old = {k: v for k, v in old_titles.items() if k not in matched_old_keys}
    remaining_new = {k: v for k, v in new_titles.items() if k not in matched_new_keys}

    for old_key, old_mod in remaining_old.items():
        best_ratio = 0
        best_new_key = None
        for new_key in remaining_new:
            if new_key in matched_new_keys:
                continue
            ratio = difflib.SequenceMatcher(None, old_key, new_key).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_new_key = new_key
        if best_ratio >= 0.6 and best_new_key:
            matched.append((old_mod, remaining_new[best_new_key], best_ratio))
            matched_old_keys.add(old_key)
            matched_new_keys.add(best_new_key)

    added = [m for m in new_modules if m["title"].strip().lower() not in matched_new_keys]
    removed = [m for m in old_modules if m["title"].strip().lower() not in matched_old_keys]

    return matched, added, removed


@router.post("/compare")
def compare_documents(body: CompareRequest, current_user: dict = Depends(get_current_user)):
    """
    Compare two document versions module-by-module.
    Returns added/removed/modified modules with line-level diffs.
    Helps developers catch every change when a document version is updated.
    """
    sb = get_supabase()

    # Verify both documents belong to the current user
    old_doc = (
        sb.table("documents")
        .select("id, file_name, project_id")
        .eq("id", body.old_document_id)
        .eq("user_id", current_user["id"])
        .is_("deleted_at", "null")
        .execute()
    )
    if not old_doc.data:
        raise HTTPException(status_code=404, detail="Old document not found.")

    new_doc = (
        sb.table("documents")
        .select("id, file_name, project_id")
        .eq("id", body.new_document_id)
        .eq("user_id", current_user["id"])
        .is_("deleted_at", "null")
        .execute()
    )
    if not new_doc.data:
        raise HTTPException(status_code=404, detail="New document not found.")

    # Get modules for both documents
    old_modules = (
        sb.table("modules")
        .select("id, title, content, \"order\"")
        .eq("document_id", body.old_document_id)
        .order("order")
        .execute()
    ).data or []

    new_modules = (
        sb.table("modules")
        .select("id, title, content, \"order\"")
        .eq("document_id", body.new_document_id)
        .order("order")
        .execute()
    ).data or []

    matched, added, removed = _match_modules(old_modules, new_modules)

    # Build comparison results
    modified_modules = []
    unchanged_modules = []

    for old_mod, new_mod, similarity in matched:
        old_content = (old_mod.get("content") or "").strip()
        new_content = (new_mod.get("content") or "").strip()

        if old_content == new_content:
            unchanged_modules.append({
                "title": new_mod["title"],
                "old_module_id": old_mod["id"],
                "new_module_id": new_mod["id"],
            })
        else:
            diff_result = _compute_line_diff(old_content, new_content)
            modified_modules.append({
                "old_title": old_mod["title"],
                "new_title": new_mod["title"],
                "title_match_ratio": round(similarity, 2),
                "old_module_id": old_mod["id"],
                "new_module_id": new_mod["id"],
                "lines_added": diff_result["stats"]["added"],
                "lines_removed": diff_result["stats"]["removed"],
                "changed_hunks": diff_result["stats"]["changed_hunks"],
                "hunks": diff_result["hunks"],
            })

    added_modules = [{"title": m["title"], "module_id": m["id"], "line_count": len((m.get("content") or "").splitlines())} for m in added]
    removed_modules = [{"title": m["title"], "module_id": m["id"], "line_count": len((m.get("content") or "").splitlines())} for m in removed]

    return {
        "old_document": {"id": old_doc.data[0]["id"], "file_name": old_doc.data[0]["file_name"]},
        "new_document": {"id": new_doc.data[0]["id"], "file_name": new_doc.data[0]["file_name"]},
        "summary": {
            "total_modules_old": len(old_modules),
            "total_modules_new": len(new_modules),
            "added": len(added_modules),
            "removed": len(removed_modules),
            "modified": len(modified_modules),
            "unchanged": len(unchanged_modules),
        },
        "added_modules": added_modules,
        "removed_modules": removed_modules,
        "modified_modules": modified_modules,
        "unchanged_modules": unchanged_modules,
    }
