"""
qa_service.py
-------------
Grounded Q&A with zero hallucination contract.

Supports:
- scope="document" : answers from full raw document text
- scope="module: <ModuleName>" : answers scoped to a single module's content

New (Enhancement 1 + 2):
- source_section: returns cited section heading from the answer
"""

import os
import asyncio
from config import settings
from services.token_service import log_usage, calculate_cost

# ── System Prompt ─────────────────────────────────────────────────────────────

QA_SYSTEM_PROMPT = """You are a Senior Business Analyst and Senior Developer.
Your job is to answer questions STRICTLY based on the provided document text.

ABSOLUTE RULES (non-negotiable):
1. You MUST ONLY use information present in the provided text.
2. If the answer is not clearly stated, respond EXACTLY with: "Not specified in the document."
3. Never infer, assume, or add context beyond what's written.
4. Never hallucinate features, numbers, rules, or logic.
5. Always cite the section heading where you found the answer.

ANSWER FORMAT:
**Business Perspective:** <1–3 sentences explaining what this means to the business>
**Developer Perspective:** <1–3 sentences explaining implementation impact>
**Source Section:** <The heading or section title where you found this, or "Not specified in the document.">

If the answer is NOT in the text, output only:
"Not specified in the document."
"""

QA_PROMPT_TEMPLATE = """SCOPE: {scope}

DOCUMENT TEXT:
\"\"\"
{text}
\"\"\"

QUESTION: {question}

Answer strictly from the text above. Cite the source section."""


# ── LLM Callers ───────────────────────────────────────────────────────────────

async def _call_openai(prompt: str) -> tuple[str, dict]:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    resp = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": QA_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
        max_tokens=1000,
    )
    usage = {
        "input_tokens": resp.usage.prompt_tokens if resp.usage else 0,
        "output_tokens": resp.usage.completion_tokens if resp.usage else 0,
    }
    return resp.choices[0].message.content.strip(), usage


async def _call_gemini(prompt: str) -> tuple[str, dict]:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    full_prompt = f"{QA_SYSTEM_PROMPT}\n\n{prompt}"
    loop = asyncio.get_event_loop()
    resp = await loop.run_in_executor(None, model.generate_content, full_prompt)
    text = resp.text.strip()
    usage = {
        "input_tokens": len(full_prompt) // 4,
        "output_tokens": len(text) // 4,
    }
    return text, usage


async def _call_ollama(prompt: str) -> tuple[str, dict]:
    import httpx
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": f"{QA_SYSTEM_PROMPT}\n\n{prompt}",
        "stream": False,
        "options": {"temperature": 0},
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
        text = data["response"].strip()
        usage = {
            "input_tokens": data.get("prompt_eval_count", len(payload["prompt"]) // 4),
            "output_tokens": data.get("eval_count", len(text) // 4),
        }
        return text, usage


# ── Public API ────────────────────────────────────────────────────────────────

async def ask_question(
    question: str,
    text: str,
    scope: str = "document",
    user_id: str = None,
    document_id: str = None,
    module_id: str = None,
    organization_id: str = None,
) -> dict:
    """
    Ask a question grounded in `text`.
    scope: "document" or "module: <ModuleName>"
    Returns: {"answer": str, "sourced": bool, "source_section": str, "_token_usage": dict}
    """
    prompt = QA_PROMPT_TEMPLATE.format(scope=scope, text=text[:60000], question=question)

    provider = settings.LLM_PROVIDER.lower()
    if provider == "openai":
        raw, usage = await _call_openai(prompt)
    elif provider == "gemini":
        raw, usage = await _call_gemini(prompt)
    elif provider == "ollama":
        raw, usage = await _call_ollama(prompt)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")

    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)
    model_name = settings.OPENAI_MODEL if provider == "openai" else (
        settings.GEMINI_MODEL if provider == "gemini" else settings.OLLAMA_MODEL
    )
    cost = calculate_cost(input_tokens, output_tokens, provider, model_name)

    # Log token usage
    log_usage(
        request_type="qa_question",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        provider=provider,
        model=model_name,
        cache_hit=False,
        user_id=user_id,
        module_id=module_id,
        document_id=document_id,
        organization_id=organization_id,
    )

    # Parse source section (Enhancement 2)
    source_section = ""
    sourced = True
    for line in raw.splitlines():
        if line.strip().lower().startswith("**source section:**"):
            source_section = line.split(":", 1)[-1].strip().lstrip("*").strip()
            break

    not_specified = "not specified in the document" in raw.lower()
    if not_specified:
        sourced = False

    return {
        "answer": raw,
        "sourced": sourced,
        "source_section": source_section,
        "_token_usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": round(cost, 6),
            "provider": provider,
            "model": model_name,
        },
    }
