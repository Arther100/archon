"""
upload.py — POST /upload
Accepts PDF, DOCX, or DOC, extracts text, splits into modules, stores all in Supabase.
"""

import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
from config import settings
from services.parser import extract_text, extract_structured
from services.module_detector import detect_modules_from_structured, detect_modules_from_text
from db.supabase_client import get_supabase
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/upload", tags=["Upload"])


def _collect_images_for_modules(structured_paragraphs, modules):
    """
    Map extracted images back to the modules they belong to.
    Uses order of paragraphs to associate images with the correct module.
    Returns {module_order: [{"data": base64, "mime": mime_type}, ...]}
    """
    # Collect all images with their text-stream position
    images_by_position = []
    text_pos = 0
    for para in structured_paragraphs:
        if para.get("image_data"):
            images_by_position.append({
                "text_pos": text_pos,
                "data": para["image_data"],
                "mime": para.get("image_mime", "image/png"),
            })
        text_pos += len(para.get("text", "")) + 1  # +1 for newline

    if not images_by_position:
        return {}

    # Calculate module text boundaries
    module_images = {}
    cumulative = 0
    for m in modules:
        start = cumulative
        end = cumulative + len(m.get("content", ""))
        module_images[m["order"]] = [
            {"data": img["data"], "mime": img["mime"]}
            for img in images_by_position
            # Associate image if its position falls within this module's text range
            # (approximate — images near module boundaries go to nearest module)
        ]
        cumulative = end + 1

    # Simpler approach: distribute images to modules based on paragraph order
    module_images = {}
    current_module_idx = 0
    module_titles = [m["title"] for m in modules]
    current_images = []

    for para in structured_paragraphs:
        # Check if this paragraph starts a new module (heading match)
        if para.get("level") == 1 and para.get("text") in module_titles:
            if current_images and current_module_idx < len(modules):
                module_images[modules[current_module_idx]["order"]] = current_images
                current_images = []
            idx = module_titles.index(para["text"])
            current_module_idx = idx

        if para.get("image_data"):
            current_images.append({
                "data": para["image_data"],
                "mime": para.get("image_mime", "image/png"),
            })

    # Save last batch
    if current_images and current_module_idx < len(modules):
        order = modules[current_module_idx]["order"]
        existing = module_images.get(order, [])
        existing.extend(current_images)
        module_images[order] = existing

    return module_images


@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    standards: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),
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

    # ── Detect modules (heading-style aware for DOCX/DOC) ─
    structured = None
    try:
        structured = extract_structured(file_bytes, ext)
        modules = detect_modules_from_structured(structured)
    except Exception:
        modules = detect_modules_from_text(raw_text)

    # ── Collect images from structured content ────────────
    module_images = {}
    if structured:
        module_images = _collect_images_for_modules(structured, modules)

    # ── Store in Supabase ─────────────────────────────────
    sb = get_supabase()

    doc_row = {
        "file_name": file.filename,
        "file_type": ext,
        "raw_text": raw_text,
        "standards_text": standards.strip() if standards else None,
        "user_id": current_user["id"],
    }
    if project_id and project_id.strip():
        doc_row["project_id"] = project_id.strip()

    doc_result = sb.table("documents").insert(doc_row).execute()

    if not doc_result.data:
        raise HTTPException(status_code=500, detail="Failed to store document.")

    document_id = doc_result.data[0]["id"]

    module_rows = []
    for m in modules:
        row = {
            "document_id": document_id,
            "title": m["title"],
            "content": m["content"],
            "order": m["order"],
        }
        # Store image metadata (base64 data) as JSON if images exist for this module
        images = module_images.get(m["order"], [])
        if images:
            # Store as JSON string — limited to first 5 images to avoid DB bloat
            row["image_data"] = json.dumps(images[:5])
        module_rows.append(row)

    sb.table("modules").insert(module_rows).execute()

    return {
        "document_id": document_id,
        "file_name": file.filename,
        "file_type": ext,
        "module_count": len(modules),
        "modules": [{"title": m["title"], "order": m["order"]} for m in modules],
    }
