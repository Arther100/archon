"""
upload.py — POST /upload
Accepts PDF or DOCX, extracts text, splits into modules, stores all in Supabase.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
from config import settings
from services.parser import extract_text, extract_structured
from services.module_detector import detect_modules_from_structured, detect_modules_from_text
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    standards: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    # ── Validate extension ────────────────────────────────
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '.{ext}' not allowed. Supported: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # ── Validate size ─────────────────────────────────────
    file_bytes = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max allowed: {settings.MAX_UPLOAD_SIZE_MB}MB"
        )

    # ── Extract raw text (for storage + Q&A) ─────────────
    try:
        raw_text = extract_text(file_bytes, ext)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Document appears to be empty or unreadable.")

    # ── Detect modules (heading-style aware for DOCX) ─────
    try:
        structured = extract_structured(file_bytes, ext)
        modules = detect_modules_from_structured(structured)
    except Exception:
        modules = detect_modules_from_text(raw_text)

    # ── Store in Supabase ─────────────────────────────────
    sb = get_supabase()

    doc_result = sb.table("documents").insert({
        "file_name": file.filename,
        "file_type": ext,
        "raw_text": raw_text,
        "standards_text": standards.strip() if standards else None,
        "user_id": current_user["id"],
    }).execute()

    if not doc_result.data:
        raise HTTPException(status_code=500, detail="Failed to store document.")

    document_id = doc_result.data[0]["id"]

    module_rows = [
        {
            "document_id": document_id,
            "title": m["title"],
            "content": m["content"],
            "order": m["order"],
        }
        for m in modules
    ]
    sb.table("modules").insert(module_rows).execute()

    return {
        "document_id": document_id,
        "file_name": file.filename,
        "file_type": ext,
        "module_count": len(modules),
        "modules": [{"title": m["title"], "order": m["order"]} for m in modules],
    }
