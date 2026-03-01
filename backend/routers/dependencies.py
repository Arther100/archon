"""
dependencies.py — Cross-Module Connectivity
GET  /documents/{id}/dependencies        — basic dependency graph (legacy)
GET  /documents/{id}/connectivity-map    — full field-level connectivity analysis
POST /documents/{id}/connectivity-map    — generate fresh cross-module analysis using LLM
"""

import json
from fastapi import APIRouter, HTTPException, Request, Depends
from db.supabase_client import get_supabase
from services.llm_service import _llm, _extract_json, analyse_cross_module_connectivity
from middleware.quota_middleware import check_and_increment_quota

router = APIRouter(tags=["Dependencies"])

DEP_SYSTEM = """You are a Senior Solution Architect.
Analyse the provided list of module titles and their brief descriptions.
Identify which modules depend on or reference other modules.
Return ONLY a JSON array like:
[
  {"from": "Module A title", "to": "Module B title", "reason": "one-line explanation"},
  ...
]
Only include real dependencies you can justify. Return [] if none found."""


@router.get("/documents/{document_id}/dependencies")
async def get_dependencies(document_id: str):
    """
    Legacy: basic dependency detection from module titles + raw content snippets.
    """
    sb = get_supabase()

    modules = (
        sb.table("modules")
        .select("id, title, content")
        .eq("document_id", document_id)
        .order("order")
        .execute()
    )
    if not modules.data:
        raise HTTPException(status_code=404, detail="No modules found for this document.")

    module_summaries = "\n".join(
        f'- "{m["title"]}": {m["content"][:300].replace(chr(10), " ")}…'
        for m in modules.data
    )

    user_prompt = f"""Document modules:
{module_summaries}

Find cross-module dependencies. Return JSON array only."""

    try:
        raw, _usage = await _llm(DEP_SYSTEM, user_prompt)
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start == -1:
            deps = []
        else:
            deps = json.loads(raw[start:end])
    except Exception:
        deps = []

    return {
        "document_id": document_id,
        "module_count": len(modules.data),
        "dependencies": deps,
    }


def _collect_modules_with_fields(document_id: str) -> list[dict]:
    """Gather all modules and their analyzed fields for a document."""
    sb = get_supabase()

    modules = (
        sb.table("modules")
        .select("id, title, order")
        .eq("document_id", document_id)
        .order("order")
        .execute()
    )
    if not modules.data:
        return []

    result = []
    for mod in modules.data:
        # Get latest analysis
        analysis = (
            sb.table("analyses")
            .select("output_json")
            .eq("module_id", mod["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        fields = []
        connectivity = {}
        if analysis.data and analysis.data[0].get("output_json"):
            bp = analysis.data[0]["output_json"]
            if isinstance(bp, str):
                try:
                    bp = json.loads(bp)
                except Exception:
                    bp = {}
            fields = bp.get("documented", {}).get("fields", [])
            connectivity = bp.get("connectivity", {})

        result.append({
            "id": mod["id"],
            "title": mod["title"],
            "order": mod.get("order", 0),
            "fields": fields,
            "connectivity": connectivity,
            "has_analysis": len(fields) > 0,
        })

    return result


@router.get("/documents/{document_id}/connectivity-map")
async def get_connectivity_map(document_id: str):
    """
    Get the stored connectivity map, or build a deterministic one from individual module analyses.
    No LLM call — uses existing per-module connectivity data + field name matching.
    """
    sb = get_supabase()
    modules = _collect_modules_with_fields(document_id)
    if not modules:
        raise HTTPException(status_code=404, detail="No modules found.")

    analyzed_modules = [m for m in modules if m["has_analysis"]]
    unanalyzed_modules = [m for m in modules if not m["has_analysis"]]

    # ── Deterministic cross-reference: find shared field names ────────────
    field_index = {}  # field_name → [{module_id, module_title, field}]
    for mod in analyzed_modules:
        for f in mod["fields"]:
            fname = f.get("name", "").lower().strip()
            if fname:
                if fname not in field_index:
                    field_index[fname] = []
                field_index[fname].append({
                    "module_id": mod["id"],
                    "module_title": mod["title"],
                    "field": f,
                })

    # Fields appearing in 2+ modules
    shared_field_map = []
    for fname, entries in field_index.items():
        if len(entries) >= 2:
            module_titles = list(set(e["module_title"] for e in entries))
            module_ids = list(set(e["module_id"] for e in entries))
            shared_field_map.append({
                "field_name": fname,
                "field_label": entries[0]["field"].get("label", fname),
                "field_type": entries[0]["field"].get("type", "unknown"),
                "modules": module_titles,
                "module_ids": module_ids,
                "count": len(entries),
            })

    # ── Build connections from per-module connectivity sections ───────────
    connections = []
    for mod in analyzed_modules:
        conn = mod.get("connectivity", {})
        for dep in (conn.get("depends_on") or []):
            connections.append({
                "from_module": mod["title"],
                "from_module_id": mod["id"],
                "to_module": dep.split(":")[0].strip() if ":" in dep else dep,
                "relationship": "depends_on",
                "reason": dep,
                "strength": "medium",
            })
        for prov in (conn.get("provides_to") or []):
            connections.append({
                "from_module": mod["title"],
                "from_module_id": mod["id"],
                "to_module": prov.split(":")[0].strip() if ":" in prov else prov,
                "relationship": "provides_to",
                "reason": prov,
                "strength": "medium",
            })

    # ── Add connections from shared fields ────────────────────────────────
    for sf in shared_field_map:
        if len(sf["modules"]) == 2:
            connections.append({
                "from_module": sf["modules"][0],
                "to_module": sf["modules"][1],
                "relationship": "shares_data",
                "shared_fields": [sf["field_name"]],
                "reason": f"Shared field '{sf['field_label']}' ({sf['field_type']}) used in both modules",
                "strength": "strong" if sf["field_type"] in ("dropdown", "search", "navigation") else "medium",
            })

    # ── Module summary ────────────────────────────────────────────────────
    module_summary = []
    for mod in modules:
        module_summary.append({
            "id": mod["id"],
            "title": mod["title"],
            "order": mod.get("order", 0),
            "field_count": len(mod["fields"]),
            "has_analysis": mod["has_analysis"],
            "has_connectivity": bool(mod.get("connectivity", {}).get("depends_on") or mod.get("connectivity", {}).get("provides_to")),
        })

    return {
        "document_id": document_id,
        "module_count": len(modules),
        "analyzed_count": len(analyzed_modules),
        "unanalyzed_count": len(unanalyzed_modules),
        "connections": connections,
        "shared_field_map": shared_field_map,
        "modules": module_summary,
        "unanalyzed_modules": [{"id": m["id"], "title": m["title"]} for m in unanalyzed_modules],
    }


@router.post("/documents/{document_id}/connectivity-map")
async def generate_connectivity_map(document_id: str, request: Request, _quota: dict = Depends(check_and_increment_quota)):
    """
    Generate a deep cross-module connectivity analysis using LLM.
    Sends ALL modules' field lists to the LLM for intelligent dependency detection.
    """
    modules = _collect_modules_with_fields(document_id)
    if not modules:
        raise HTTPException(status_code=404, detail="No modules found.")

    analyzed = [m for m in modules if m["has_analysis"]]
    if len(analyzed) < 2:
        raise HTTPException(
            status_code=422,
            detail=f"Need at least 2 analyzed modules for cross-module analysis. Currently {len(analyzed)} analyzed."
        )

    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
    org_id = getattr(request.state, "organization_id", None) if hasattr(request, "state") else None

    result = await analyse_cross_module_connectivity(
        modules_with_fields=analyzed,
        user_id=user_id,
        document_id=document_id,
        organization_id=org_id,
    )

    # Attach module summary
    result["module_count"] = len(modules)
    result["analyzed_count"] = len(analyzed)
    result["modules"] = [
        {"id": m["id"], "title": m["title"], "order": m.get("order", 0), "field_count": len(m["fields"]), "has_analysis": m["has_analysis"]}
        for m in modules
    ]

    return result
