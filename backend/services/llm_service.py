"""
llm_service.py
--------------
Deterministic Requirement-to-System Blueprint Engine.

Stage 2: Deep Intra-Module Analysis
Stage 3: Cross-Module Connectivity
Stage 4: Engineering Synthesis (Gaps + API Schema)

Returns a structured JSON object — NOT Markdown.
Zero hallucination: enforced via system prompt + temperature=0.

Output JSON schema:
{
  "documented": {
    "summary": str,
    "business_goal": str,
    "business_flow": [str],
    "fields": [{name, type, label, required, validation, dropdown_values, search_behavior, navigation_target, global, description}],
    "functional_rules": [str],
    "user_actions": [str],
    "system_behaviors": [str],
    "scope_in": [str],
    "scope_out": [str]
  },
  "gaps": {
    "missing_specs": [str],
    "ambiguous": [str],
    "developer_recommendations": [str],
    "risk_flags": [str]
  },
  "connectivity": {
    "depends_on": [str],
    "provides_to": [str],
    "shared_fields": [str]
  },
  "api_schema": {
    "resource": str,
    "base_endpoint": str,
    "GET": {endpoint, query_params, response_example},
    "POST": {endpoint, payload, response_example},
    "PUT": {endpoint, payload, response_example},
    "DELETE": {endpoint, response_example}
  }
}
"""

import json
import asyncio
import re
from config import settings
from services.cache_service import get_cached, put_cached
from services.token_service import log_usage, calculate_cost

# ── Chunking constants ────────────────────────────────────────────────────────
CHUNK_CHAR_LIMIT = 10_000
CHUNK_OVERLAP = 800

# ── System Prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a Deterministic Requirement-to-System Blueprint Engine.
You think exactly like a Senior Solution Architect + Senior Business Analyst with 15+ years of experience.

ABSOLUTE RULES:
1. Extract information ONLY from the provided text. NEVER invent or infer beyond what is written.
2. If a value is not stated, use exactly: "Not specified in the document"
3. For empty lists return []. For missing strings return "Not specified in the document".
4. Return ONLY valid JSON. No markdown, no code fences, no extra text.
5. Every field object MUST correspond to an explicitly mentioned field in the text.
6. When document has TABLE data ([TABLE START]...[TABLE END]) — extract EVERY row as a separate field.
7. When document has section groupings like 'General → Store Name' or 'Dates → Date Signed' — preserve the section as field.section.
8. If a field type is not stated, INFER from context: 
   - 'lookup'/'dropdown'/'select'/'choose' → dropdown
   - 'search' → search
   - 'date' → date
   - 'toggle'/'yes/no'/'boolean' → boolean
   - 'multi'/'multiple' → multi-select
   - 'grid' → grid
   - 'text'/'name'/'number'/'code' → text or number
   - 'email' → text (with email validation)
   - 'currency'/'amount'/'price' → currency
9. For API schema — build payload from ACTUAL field list, not generic examples.
10. Extract ALL fields. Document may have 5, 15, or 50+ fields — get every one of them.
11. When text contains [REMOVED: ...] markers, the requirement was DELETED or SUPERSEDED — note in gaps.ambiguous as "Removed requirement: original text".
12. When text defines data entities/schemas with bulleted attributes (e.g., "Product_Master" with "product_id", "product_name"), extract ALL of them into data_entities with full attribute lists and FK relationships.
13. When text mentions "Future" or "(Future)" next to a feature, include it in scope_out with "Future:" prefix AND in the future_scope list.
14. When text contains inline questions or discussion comments (e.g., "Can you be more specific?", "Alex to confirm"), extract these as discussion_items.
15. When text contains "Pending:" sections, extract items in gaps.missing_specs with "Pending:" prefix.
16. When text has separator lines or entity definitions (Product_Master, Medicine_Details), treat them as distinct logical sections within the module.
17. Distinguish between CURRENT development items and FUTURE items — tag future_scope items clearly.

FIELD TYPES (use exactly these):
text | number | dropdown | multi-select | search | date | datetime | boolean | currency | textarea | file | grid | navigation | badge | action-button

FIELD OBJECT:
{
  "name": "snake_case_identifier",
  "label": "Exact label from document",
  "section": "Section group (e.g. General, Dates, Ownership, Contact) or null",
  "type": "one of the types above",
  "required": true | false | "Not specified in the document",
  "editable_mode": "both | create-only | view-only | Not specified in the document",
  "validation": "exact validation rule from document, or inferred from type if obvious, else Not specified",
  "dropdown_values": ["val1"] or [],
  "search_behavior": "how search/filter works or null",
  "navigation_target": "target screen/module or null",
  "global": true if used across modules | false,
  "description": "Senior developer explanation: what this field does, why it matters, how to implement it"
}"""

BLUEPRINT_PROMPT = """Perform a COMPLETE engineering blueprint analysis of this module.

MODULE TEXT (includes tables, paragraphs, and image markers — analyse ALL of it):
\"\"\"
{module_text}
\"\"\"

{standards_section}

CRITICAL — FIELD EXTRACTION RULES (follow strictly):
1. Scan EVERY line including [TABLE START]...[TABLE END] blocks
2. Each TABLE ROW is a separate field — extract every single one
3. Patterns to detect fields: 'Label | Type | Validation', 'Section → Field: rule', bullet lists, numbered specs
4. Output field.section from grouping headers (e.g. General, Dates, Ownership Summary, Address, Contact, Operations)
5. Infer field type if not stated: lookup→dropdown, toggle/yes/no→boolean, multi→multi-select, grid→grid
6. editable_mode: 'create-only' if "read-only after create", 'view-only' if totally locked, 'both' otherwise
7. Build API payload and response using the ACTUAL detected field names — not placeholders
8. For [IMAGE N:] markers — describe what the image likely shows based on surrounding text
9. Extract ALL fields — there could be 5 to 50+, do not skip any

Return ONLY this exact JSON (no markdown, no fences, valid JSON):

{{
  "documented": {{
    "summary": "complete 2-3 sentence module summary",
    "business_goal": "what business problem this solves",
    "business_flow": ["step 1", "step 2"],
    "fields": [
      {{
        "name": "snake_case_id",
        "label": "Exact Label From Document",
        "section": "Section group (General/Dates/Ownership/Address/Contact/Operations/etc) or null",
        "type": "text|number|dropdown|multi-select|search|date|datetime|boolean|currency|textarea|file|grid|navigation|badge|action-button",
        "required": true,
        "editable_mode": "both|create-only|view-only|Not specified in the document",
        "validation": "exact rule from document",
        "dropdown_values": [],
        "search_behavior": null,
        "navigation_target": null,
        "global": false,
        "description": "Senior dev explanation: purpose, business meaning, implementation notes, edge cases"
      }}
    ],
    "functional_rules": ["every business rule exactly as stated"],
    "user_actions": ["what users can do"],
    "system_behaviors": ["what system does automatically"],
    "scope_in": ["explicitly in scope"],
    "scope_out": ["explicitly excluded"],
    "images": ["Image N: what it likely shows based on surrounding context"],
    "future_scope": ["features explicitly marked as Future or not-yet-implemented"],
    "data_entities": [
      {{
        "entity_name": "ExactNameFromDocument",
        "description": "purpose of this entity",
        "attributes": [
          {{"name": "field_name", "type": "PK|FK|string|ENUM|BOOLEAN|decimal|date", "constraints": "PK/FK/NOT NULL/UNIQUE/ENUM values", "description": "what this stores"}}
        ],
        "relationships": ["OtherEntity (FK: linking_field)"]
      }}
    ],
    "discussion_items": ["inline questions, unresolved comments, items needing stakeholder confirmation"]
  }},
  "gaps": {{
    "missing_specs": ["specific missing requirement a developer NEEDS to implement correctly"],
    "ambiguous": ["requirement that is unclear or contradictory"],
    "developer_recommendations": ["concrete recommendation: how a senior dev would solve each gap"],
    "risk_flags": ["what breaks or goes wrong if this gap is not addressed"],
    "pending_decisions": ["items explicitly marked as Pending or awaiting confirmation"]
  }},
  "connectivity": {{
    "depends_on": ["ModuleName: reason this module needs data/state from it"],
    "provides_to": ["ModuleName: what data or state this module feeds into it"],
    "shared_fields": ["fieldName: used by both Module X and Module Y"]
  }},
  "api_schema": {{
    "resource": "actual resource name derived from module (e.g. location, store, owner)",
    "base_endpoint": "/api/v1/resource",
    "GET": {{
      "endpoint": "GET /api/v1/resource",
      "description": "Retrieve list or single record",
      "query_params": [
        {{"name": "actual_filter_field", "type": "string", "required": false, "description": "filter by this field"}}
      ],
      "response_example": {{
        "id": "uuid",
        "field1_from_detected_list": "value",
        "field2_from_detected_list": "value"
      }}
    }},
    "POST": {{
      "endpoint": "POST /api/v1/resource",
      "description": "Create new record",
      "payload": {{
        "mandatory_field_1": "value (Required)",
        "mandatory_field_2": "value (Required)",
        "optional_field_1": "value (Optional)"
      }},
      "response_example": {{
        "id": "uuid",
        "status": "created",
        "data": {{}}
      }}
    }},
    "PUT": {{
      "endpoint": "PUT /api/v1/resource/{{id}}",
      "description": "Update editable fields only (exclude create-only/read-only fields)",
      "payload": {{
        "editable_field_1": "new value",
        "editable_field_2": "new value"
      }},
      "response_example": {{
        "id": "uuid",
        "status": "updated",
        "data": {{}}
      }}
    }},
    "DELETE": {{
      "endpoint": "DELETE /api/v1/resource/{{id}}",
      "description": "Delete record",
      "response_example": {{"message": "Deleted successfully", "id": "uuid"}}
    }}
  }},
  "confidence_score": 75
}}

CONFIDENCE SCORE RULE: Set "confidence_score" (integer 0-100) at the END of the JSON.
- 90-100: Document is extremely detailed — every field, rule, and behavior is explicitly stated.
- 70-89:  Most fields and rules are present but some validation details are missing.
- 50-69:  Moderate — core flow is described but significant specs are absent.
- 30-49:  Sparse — high-level description only, many fields inferred.
- 0-29:   Very vague — almost nothing is explicitly specified."""


MERGE_PROMPT = """You are merging multiple chunk analyses of the same large module into one coherent blueprint.

CHUNK ANALYSES (JSON objects):
\"\"\"
{chunk_analyses}
\"\"\"

Merge into a single JSON blueprint. Rules:
- Combine all arrays (fields, rules, gaps, etc.) — deduplicate by content
- Keep all unique items from all chunks
- For strings (summary, business_goal etc.) use the most complete version
- Preserve the api_schema from the first chunk unless a later chunk adds more fields
- Return ONLY valid JSON. Same structure as input chunks.
- No markdown, no fences."""


# ── LLM Callers ───────────────────────────────────────────────────────────────

async def _call_openai(system: str, user: str) -> tuple[str, dict]:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    resp = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0,
        max_tokens=4000,
        response_format={"type": "json_object"},
    )
    usage = {
        "input_tokens": resp.usage.prompt_tokens if resp.usage else 0,
        "output_tokens": resp.usage.completion_tokens if resp.usage else 0,
    }
    return resp.choices[0].message.content.strip(), usage


async def _call_gemini(system: str, user: str) -> tuple[str, dict]:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    full_prompt = f"{system}\n\n{user}\n\nReturn ONLY valid JSON."
    loop = asyncio.get_event_loop()
    resp = await loop.run_in_executor(None, model.generate_content, full_prompt)
    text = resp.text.strip()
    # Estimate tokens (Gemini doesn't always return usage)
    usage = {
        "input_tokens": len(full_prompt) // 4,
        "output_tokens": len(text) // 4,
    }
    return text, usage


async def _call_ollama(system: str, user: str) -> tuple[str, dict]:
    import httpx
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": f"{system}\n\n{user}\n\nReturn ONLY valid JSON.",
        "stream": False,
        "options": {"temperature": 0},
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
        text = data["response"].strip()
        # Ollama may return token counts
        usage = {
            "input_tokens": data.get("prompt_eval_count", len(payload["prompt"]) // 4),
            "output_tokens": data.get("eval_count", len(text) // 4),
        }
        return text, usage


async def _llm(system: str, user: str) -> tuple[str, dict]:
    """Call LLM and return (raw_text, usage_dict)."""
    provider = settings.LLM_PROVIDER.lower()
    if provider == "openai":
        return await _call_openai(system, user)
    elif provider == "gemini":
        return await _call_gemini(system, user)
    elif provider == "ollama":
        return await _call_ollama(system, user)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")


# ── JSON extraction helper ────────────────────────────────────────────────────

def _extract_json(raw: str) -> dict:
    """Extract and parse JSON from LLM response — handles code fences."""
    # Strip markdown fences if present
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
    # Find first { to last }
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start == -1:
        raise ValueError("No JSON found in LLM response")
    return json.loads(cleaned[start:end])


# ── Chunker ───────────────────────────────────────────────────────────────────

def _chunk_text(text: str) -> list[str]:
    if len(text) <= CHUNK_CHAR_LIMIT:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_CHAR_LIMIT, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - CHUNK_OVERLAP
    return chunks


# ── Blueprint empty structure ─────────────────────────────────────────────────

def _empty_blueprint() -> dict:
    return {
        "documented": {
            "summary": "Not specified in the document",
            "business_goal": "Not specified in the document",
            "business_flow": [],
            "fields": [],
            "functional_rules": [],
            "user_actions": [],
            "system_behaviors": [],
            "scope_in": [],
            "scope_out": [],
            "future_scope": [],
            "data_entities": [],
            "discussion_items": [],
        },
        "gaps": {
            "missing_specs": [],
            "ambiguous": [],
            "developer_recommendations": [],
            "risk_flags": [],
            "pending_decisions": [],
        },
        "connectivity": {
            "depends_on": [],
            "provides_to": [],
            "shared_fields": [],
        },
        "api_schema": {
            "resource": "unknown",
            "base_endpoint": "/api/v1/resource",
            "GET": {"endpoint": "GET /api/v1/resource", "query_params": [], "response_example": {}},
            "POST": {"endpoint": "POST /api/v1/resource", "payload": {}, "response_example": {}},
            "PUT": {"endpoint": "PUT /api/v1/resource/{id}", "payload": {}, "response_example": {}},
            "DELETE": {"endpoint": "DELETE /api/v1/resource/{id}", "response_example": {"message": "Deleted successfully"}},
        },
    }


def _merge_dicts(base: dict, new: dict) -> dict:
    """Deep merge, concatenating lists and keeping most complete strings."""
    for key, val in new.items():
        if key not in base:
            base[key] = val
        elif isinstance(val, list) and isinstance(base[key], list):
            # Deduplicate by string representation
            existing = [str(x) for x in base[key]]
            for item in val:
                if str(item) not in existing:
                    base[key].append(item)
                    existing.append(str(item))
        elif isinstance(val, dict) and isinstance(base[key], dict):
            base[key] = _merge_dicts(base[key], val)
        elif isinstance(val, str) and len(val) > len(str(base.get(key, ""))):
            base[key] = val
    return base


# ── Public API ────────────────────────────────────────────────────────────────

async def analyse_module(
    module_text: str,
    standards_text: str = None,
    use_cache: bool = True,
    user_id: str = None,
    module_id: str = None,
    document_id: str = None,
    organization_id: str = None,
) -> dict:
    """
    Full blueprint analysis of a module.
    Returns structured dict with documented/gaps/connectivity/api_schema + _token_usage.

    Cache layer: checks for cached result first (SHA-256 hash of text+provider+model).
    Token layer: logs every LLM call with full metadata.
    """
    text = module_text.strip()
    provider = settings.LLM_PROVIDER.lower()
    model_name = _get_model_name(provider)

    # ── Cache check ───────────────────────────────────────────────────────
    if use_cache:
        cached = get_cached(text, provider, model_name)
        if cached:
            # Log as cache hit
            log_usage(
                request_type="module_analysis",
                input_tokens=cached.get("input_tokens", 0),
                output_tokens=cached.get("output_tokens", 0),
                provider=provider,
                model=model_name,
                cache_hit=True,
                user_id=user_id,
                module_id=module_id,
                document_id=document_id,
                organization_id=organization_id,
            )
            blueprint = cached["blueprint"]
            blueprint["_token_usage"] = {
                "input_tokens": 0,
                "output_tokens": 0,
                "cost_usd": 0,
                "cache_hit": True,
                "provider": provider,
                "model": model_name,
            }
            return blueprint

    # ── Build prompt ──────────────────────────────────────────────────────
    standards_section = ""
    if standards_text and standards_text.strip():
        standards_section = f"""ARCHITECTURE STANDARDS (compliance filter — flag violations in gaps.risk_flags):
\"\"\"
{standards_text.strip()[:3000]}
\"\"\"
"""

    chunks = _chunk_text(text)
    total_input = 0
    total_output = 0

    if len(chunks) == 1:
        # Fast path
        prompt = BLUEPRINT_PROMPT.format(module_text=text, standards_section=standards_section)
        raw, usage = await _llm(SYSTEM_PROMPT, prompt)
        total_input += usage.get("input_tokens", 0)
        total_output += usage.get("output_tokens", 0)
        try:
            blueprint = _extract_json(raw)
        except Exception:
            blueprint = _empty_blueprint()
    else:
        # Chunked path — analyse each chunk, merge
        chunk_results = []
        for i, chunk in enumerate(chunks):
            prompt = BLUEPRINT_PROMPT.format(
                module_text=f"[Part {i+1} of {len(chunks)}]\n\n{chunk}",
                standards_section=standards_section if i == 0 else "",
            )
            try:
                raw, usage = await _llm(SYSTEM_PROMPT, prompt)
                total_input += usage.get("input_tokens", 0)
                total_output += usage.get("output_tokens", 0)
                parsed = _extract_json(raw)
                chunk_results.append(parsed)
            except Exception:
                continue

        if not chunk_results:
            blueprint = _empty_blueprint()
        else:
            blueprint = chunk_results[0]
            for chunk in chunk_results[1:]:
                for top_key in ["documented", "gaps", "connectivity"]:
                    if top_key in chunk and top_key in blueprint:
                        blueprint[top_key] = _merge_dicts(blueprint[top_key], chunk[top_key])

    # ── Calculate cost + log ──────────────────────────────────────────────
    cost = calculate_cost(total_input, total_output, provider, model_name)

    log_usage(
        request_type="module_analysis",
        input_tokens=total_input,
        output_tokens=total_output,
        provider=provider,
        model=model_name,
        cache_hit=False,
        user_id=user_id,
        module_id=module_id,
        document_id=document_id,
        organization_id=organization_id,
    )

    # ── Cache the result ──────────────────────────────────────────────────
    if use_cache:
        put_cached(text, provider, model_name, blueprint, total_input, total_output, cost)


    # ── Generate test case summaries for UI tab ──
    def generate_test_cases(bp):
      documented = bp.get("documented", {})
      business_flows = documented.get("business_flow", [])
      user_actions = documented.get("user_actions", [])
      fields = documented.get("fields", [])
      test_cases = []
      # 1. Business flow test cases
      for i, flow in enumerate(business_flows):
        test_cases.append({
          "title": f"Business Flow Step {i+1}",
          "description": flow,
          "steps": [flow],
          "expected_result": "As described in the business flow."
        })
      # 2. User action test cases
      for i, action in enumerate(user_actions):
        test_cases.append({
          "title": f"User Action {i+1}",
          "description": action,
          "steps": [action],
          "expected_result": "Action is performed successfully."
        })
      # 3. Field-level test cases (basic validation)
      for f in fields:
        label = f.get("label") or f.get("name")
        if not label:
          continue
        test_cases.append({
          "title": f"Field Validation: {label}",
          "description": f"Validate the field '{label}' as per requirements.",
          "steps": [
            f"Enter valid and invalid values for '{label}'.",
            "Check required/optional status.",
            f"Check validation: {f.get('validation', 'Not specified')}"
          ],
          "expected_result": f"Field '{label}' accepts only valid input and enforces all rules."
        })
      return test_cases

    blueprint["test_cases"] = generate_test_cases(blueprint)

    # Attach token usage metadata
    blueprint["_token_usage"] = {
      "input_tokens": total_input,
      "output_tokens": total_output,
      "cost_usd": round(cost, 6),
      "cache_hit": False,
      "provider": provider,
      "model": model_name,
    }

    return blueprint


def _get_model_name(provider: str) -> str:
    if provider == "openai":
        return settings.OPENAI_MODEL
    elif provider == "gemini":
        return settings.GEMINI_MODEL
    elif provider == "ollama":
        return settings.OLLAMA_MODEL
    return "unknown"


# ── Cross-Module Connectivity Analysis ────────────────────────────────────────

CROSS_MODULE_SYSTEM = """You are a Senior Solution Architect performing cross-module dependency analysis.
You will be given a list of modules, each with their analyzed fields (name, type, label, section).
Your job is to detect REAL data dependencies between modules — shared fields, lookup references,
master-data relationships, and data flows.

RULES:
1. Only report dependencies you can JUSTIFY from the field data.
2. A "shared field" means the same logical data appears in multiple modules (e.g. policy_type in Settings is referenced as a dropdown in Insurance).
3. A "depends_on" means Module A needs data/config from Module B to function (e.g. Insurance needs policy_type values from Settings).
4. A "provides_to" means Module A supplies master data that Module B consumes.
5. Look for patterns: dropdown fields whose values come from another module, foreign-key-like references, shared lookup tables.
6. Return ONLY valid JSON. No markdown, no code fences."""

CROSS_MODULE_PROMPT = """Analyse cross-module connectivity for these {module_count} modules:

{module_field_summaries}

Return this exact JSON structure:
{{
  "connections": [
    {{
      "from_module": "Source Module Title",
      "from_module_id": "source_module_uuid",
      "to_module": "Target Module Title",
      "to_module_id": "target_module_uuid",
      "relationship": "depends_on | provides_to | shares_data",
      "shared_fields": ["field_name_1", "field_name_2"],
      "reason": "Clear explanation of why this dependency exists",
      "strength": "strong | medium | weak"
    }}
  ],
  "shared_field_map": [
    {{
      "field_name": "policy_type",
      "field_label": "Policy Type",
      "modules": ["Module A", "Module B"],
      "module_ids": ["uuid_a", "uuid_b"],
      "master_module": "Module that owns/defines this field",
      "master_module_id": "uuid_master",
      "usage": "How this field connects the modules"
    }}
  ],
  "dependency_groups": [
    {{
      "group_name": "Insurance Flow",
      "modules": ["Settings", "Insurance", "Claims"],
      "module_ids": ["uuid1", "uuid2", "uuid3"],
      "description": "These modules form a connected workflow"
    }}
  ],
  "orphan_modules": ["Module with no detected dependencies"]
}}"""


async def analyse_cross_module_connectivity(
    modules_with_fields: list[dict],
    user_id: str = None,
    document_id: str = None,
    organization_id: str = None,
) -> dict:
    """
    Cross-module connectivity analysis.
    Takes list of {id, title, fields: [{name, type, label, section}]} and returns connectivity map.
    """
    provider = settings.LLM_PROVIDER.lower()
    model_name = _get_model_name(provider)

    # Build field summary per module
    summaries = []
    for mod in modules_with_fields:
        field_lines = []
        for f in mod.get("fields", []):
            parts = [f"name={f.get('name', '?')}"]
            if f.get("type"): parts.append(f"type={f['type']}")
            if f.get("label"): parts.append(f"label=\"{f['label']}\"")
            if f.get("section"): parts.append(f"section={f['section']}")
            if f.get("dropdown_values"): parts.append(f"values={f['dropdown_values']}")
            if f.get("navigation_target"): parts.append(f"nav_target={f['navigation_target']}")
            if f.get("global"): parts.append("global=true")
            field_lines.append("    " + ", ".join(parts))

        summaries.append(
            f"MODULE: \"{mod['title']}\" (id: {mod['id']})\n"
            f"  Fields ({len(mod.get('fields', []))}):\n" +
            "\n".join(field_lines) if field_lines else "    (no fields detected)"
        )

    module_field_summaries = "\n\n".join(summaries)
    prompt = CROSS_MODULE_PROMPT.format(
        module_count=len(modules_with_fields),
        module_field_summaries=module_field_summaries,
    )

    try:
        raw, usage = await _llm(CROSS_MODULE_SYSTEM, prompt)
        result = _extract_json(raw)
    except Exception:
        result = {"connections": [], "shared_field_map": [], "dependency_groups": [], "orphan_modules": []}
        usage = {"input_tokens": 0, "output_tokens": 0}

    # Log usage
    cost = calculate_cost(usage.get("input_tokens", 0), usage.get("output_tokens", 0), provider, model_name)
    log_usage(
        request_type="cross_module_connectivity",
        input_tokens=usage.get("input_tokens", 0),
        output_tokens=usage.get("output_tokens", 0),
        provider=provider,
        model=model_name,
        cache_hit=False,
        user_id=user_id,
        document_id=document_id,
        organization_id=organization_id,
    )

    result["_token_usage"] = {
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "cost_usd": round(cost, 6),
        "provider": provider,
        "model": model_name,
    }

    return result
