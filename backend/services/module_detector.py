"""
module_detector.py
------------------
Splits a document into functional modules/sections.

Strategy (in priority order):
1. DOCX with heading styles → split ONLY on Heading 1 paragraphs.
   Heading 2+ and body text stay inside the module as content.
   This correctly groups sub-sections (1. Adding Owners, 2. Editing Ownership)
   under their parent module (Ownership) rather than splitting them out.

2. DOCX with no heading styles / PDF → regex-based fallback.
   Conservative patterns: ALL CAPS lines, or top-level numbered sections only.
   Does NOT split on sub-numbered items like "1. Adding Owners".

No LLM used — purely deterministic.
"""

import re
from typing import List, Dict


# ─── Regex patterns for PDF fallback ──────────────────────────────────────────
# Conservative: only match top-level section headings, not sub-numbered items.
HEADING_PATTERNS = [
    r"^[A-Z][A-Z /&\-]{5,}$",                              # ALL CAPS (min 6 chars)
    r"^\d+\.\s+[A-Z][^\n]{3,}$",                           # "1. Title" (not "1.1")
    r"^(Module|Section|Chapter|Feature|Appendix)\s*[:\-–\d]",  # keyword headings
    r"^#{1,2}\s+.+",                                        # Markdown H1/H2 only
]
COMPILED = [re.compile(p, re.MULTILINE) for p in HEADING_PATTERNS]


def _is_pdf_heading(line: str) -> bool:
    line = line.strip()
    if len(line) < 4 or len(line) > 100:
        return False
    return any(p.match(line) for p in COMPILED)


# ─── DOCX heading-style detector ──────────────────────────────────────────────

def detect_modules_from_structured(paragraphs: List[Dict]) -> List[Dict]:
    """
    Split using python-docx heading levels.
    Splits on Heading 1 ONLY — sub-headings stay inside the module.
    Falls back to regex if no heading styles found.
    """
    has_headings = any(p["level"] is not None for p in paragraphs)

    if has_headings:
        return _split_by_heading_level(paragraphs, split_level=1)
    else:
        # No styles — use conservative regex on the raw text
        raw_text = "\n".join(p["text"] for p in paragraphs)
        return detect_modules_from_text(raw_text)


def _split_by_heading_level(paragraphs: List[Dict], split_level: int = 1) -> List[Dict]:
    """Split paragraph list into modules at the given heading level."""
    modules: List[Dict] = []
    current_title = "Document Overview"
    current_lines: List[str] = []
    order = 0

    for para in paragraphs:
        if para["level"] == split_level:
            # Save previous module
            content = "\n".join(current_lines).strip()
            if content or (modules == [] and current_title != "Document Overview"):
                if content:
                    modules.append({"title": current_title, "content": content, "order": order})
                    order += 1
            current_title = para["text"]
            current_lines = []
        else:
            current_lines.append(para["text"])

    # Save final module
    content = "\n".join(current_lines).strip()
    if content:
        modules.append({"title": current_title, "content": content, "order": order})

    # Fallback: entire doc as one module
    if not modules:
        all_text = "\n".join(p["text"] for p in paragraphs)
        modules.append({"title": "Full Document", "content": all_text.strip(), "order": 0})

    return modules


# ─── PDF / plain text detector ────────────────────────────────────────────────

def detect_modules_from_text(raw_text: str) -> List[Dict]:
    """Regex-based conservative heading detector for plain text / PDF."""
    lines = raw_text.splitlines()
    modules: List[Dict] = []
    current_title = "Document Overview"
    current_lines: List[str] = []
    order = 0

    for line in lines:
        if _is_pdf_heading(line) and current_lines:
            content = "\n".join(current_lines).strip()
            if content:
                modules.append({"title": current_title, "content": content, "order": order})
                order += 1
            current_title = line.strip()
            current_lines = []
        else:
            current_lines.append(line)

    content = "\n".join(current_lines).strip()
    if content:
        modules.append({"title": current_title, "content": content, "order": order})

    if not modules:
        modules.append({"title": "Full Document", "content": raw_text.strip(), "order": 0})

    return modules


# ─── Public entry point ───────────────────────────────────────────────────────

def detect_modules(raw_text: str) -> List[Dict]:
    """Detect modules from plain text (used when structured data not available)."""
    return detect_modules_from_text(raw_text)
