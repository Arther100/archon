"""
qa.py
-----
POST /documents/{id}/ask      — document-wide Q&A
POST /modules/{id}/ask        — module-scoped Q&A (Enhancement 1)

All answers are grounded strictly in the provided text.
No hallucination — if not in text, returns 'Not specified in the document.'
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db.supabase_client import get_supabase
from services.qa_service import ask_question
from middleware.quota_middleware import check_and_increment_quota

router = APIRouter(tags=["Q&A"])


class QuestionRequest(BaseModel):
    question: str


def _llm_error_handler(e: Exception):
    err = str(e)
    if "api_key" in err.lower() or "authentication" in err.lower() or "401" in err:
        raise HTTPException(status_code=502, detail="Invalid OpenAI API key. Update OPENAI_API_KEY in backend/.env")
    if "quota" in err.lower() or "billing" in err.lower() or "credit" in err.lower():
        raise HTTPException(status_code=502, detail="OpenAI account has no credits. Add billing at platform.openai.com")
    if "model" in err.lower() or "does not exist" in err.lower():
        raise HTTPException(status_code=502, detail="Invalid model. Set OPENAI_MODEL=gpt-4o-mini in backend/.env")
    raise HTTPException(status_code=502, detail=f"LLM error: {err[:300]}")


# ── Document-wide Q&A ────────────────────────────────────────────────────────

@router.post("/documents/{document_id}/ask")
async def ask_document(document_id: str, body: QuestionRequest, _quota: dict = Depends(check_and_increment_quota)):
    """Answer a question from the full document text."""
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    sb = get_supabase()
    doc = sb.table("documents").select("id, file_name, raw_text").eq("id", document_id).execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    raw_text = doc.data[0].get("raw_text", "")
    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Document has no extractable text.")

    try:
        result = await ask_question(body.question, raw_text, scope="document")
    except Exception as e:
        _llm_error_handler(e)

    return {
        "document_id": document_id,
        "file_name": doc.data[0]["file_name"],
        "scope": "document",
        "question": body.question,
        "answer": result["answer"],
        "sourced": result["sourced"],
        "source_section": result.get("source_section", ""),
    }


# ── Module-scoped Q&A ────────────────────────────────────────────────────────

@router.post("/modules/{module_id}/ask")
async def ask_module(module_id: str, body: QuestionRequest, _quota: dict = Depends(check_and_increment_quota)):
    """
    Answer a question scoped ONLY to a specific module's content.
    Prevents semantic collision — e.g. 'Status' in Ownership vs 'Status' in Lease
    returns different answers because context is isolated to that module.
    """
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    sb = get_supabase()

    # Fetch module + its parent document name
    module = (
        sb.table("modules")
        .select("id, title, content, document_id, documents(file_name)")
        .eq("id", module_id)
        .execute()
    )
    if not module.data:
        raise HTTPException(status_code=404, detail="Module not found.")

    mod = module.data[0]
    content = mod.get("content", "")
    if not content.strip():
        raise HTTPException(status_code=422, detail="Module has no content.")

    try:
        result = await ask_question(body.question, content, scope=f"module: {mod['title']}")
    except Exception as e:
        _llm_error_handler(e)

    return {
        "module_id": module_id,
        "module_title": mod["title"],
        "document_id": mod["document_id"],
        "scope": f"module: {mod['title']}",
        "question": body.question,
        "answer": result["answer"],
        "sourced": result["sourced"],
        "source_section": result.get("source_section", ""),
    }
