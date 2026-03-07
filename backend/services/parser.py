"""
parser.py
---------
Extracts rich structured content from PDF, DOCX, and DOC files.

For DOCX:
- Paragraphs with heading styles → module boundaries
- Body paragraphs → content
- Tables → extracted as pipe-delimited text rows (critical for field detection)
- Images → extracted as base64-encoded bytes for LLM vision analysis

For PDF:
- Plain text extraction via pdfminer

For DOC (legacy):
- Converted to DOCX via LibreOffice headless, then processed as DOCX
- Fallback: plain text extraction via antiword/textract
"""

import io
import re
import base64
import logging
import os
import subprocess
import tempfile
from typing import List, Dict, Optional
from pdfminer.high_level import extract_text as pdf_extract
from docx import Document as DocxDocument

logger = logging.getLogger(__name__)


# ── Formatting & Detection Helpers ────────────────────────────────────────────

def _is_run_strikethrough(run) -> bool:
    """Check if a DOCX run has strikethrough formatting (indicates removed/superseded requirement)."""
    try:
        from docx.oxml.ns import qn
        rPr = run._element.find(qn('w:rPr'))
        if rPr is None:
            return False
        for tag in ('w:strike', 'w:dstrike'):
            elem = rPr.find(qn(tag))
            if elem is not None:
                val = elem.get(qn('w:val'), 'true')
                if val.lower() not in ('false', '0', 'off'):
                    return True
        return False
    except Exception:
        return False


def _extract_formatted_text(para) -> str:
    """
    Extract paragraph text preserving key formatting as LLM-visible markers:
    - Strikethrough → [REMOVED: text]  (deleted/superseded requirement)
    - Bold         → **text**          (emphasis / inline section headers)
    Falls back to para.text if runs are empty.
    """
    if not para.runs:
        return para.text.strip()
    parts = []
    for run in para.runs:
        text = run.text
        if not text:
            continue
        if _is_run_strikethrough(run):
            parts.append(f"[REMOVED: {text}]")
        elif run.bold and len(text.strip()) > 2:
            parts.append(f"**{text}**")
        else:
            parts.append(text)
    return "".join(parts).strip() or para.text.strip()


def _is_separator_line(line: str) -> bool:
    """Detect horizontal rule / separator lines like '____', '----', '===='."""
    stripped = line.strip()
    if len(stripped) < 5:
        return False
    unique_chars = set(stripped)
    return len(unique_chars) <= 2 and unique_chars.issubset({'-', '_', '=', '~', '*', ' '})


def _wrap_ascii_tables_in_text(raw_text: str) -> str:
    """
    Post-process plain text to detect ASCII-art tables (pipe-delimited rows)
    and wrap them in [TABLE START]...[TABLE END] markers for LLM awareness.
    Handles BRD-style inline tables that are NOT real Word/PDF table objects.
    """
    lines = raw_text.splitlines()
    result = []
    in_table = False
    table_lines = []
    for line in lines:
        stripped = line.strip()
        is_table_row = stripped.count('|') >= 2 and not stripped.startswith('[TABLE')
        is_table_sep = bool(re.match(r'^[\s|+\-=]+$', stripped)) and len(stripped) > 5
        if is_table_row or (is_table_sep and in_table):
            if not in_table:
                in_table = True
                table_lines = []
            table_lines.append(stripped)
        else:
            if in_table and table_lines:
                result.append("[TABLE START]")
                result.extend(table_lines)
                result.append("[TABLE END]")
                in_table = False
                table_lines = []
            result.append(line)
    if in_table and table_lines:
        result.append("[TABLE START]")
        result.extend(table_lines)
        result.append("[TABLE END]")
    return "\n".join(result)


def _wrap_json_blocks_in_text(raw_text: str) -> str:
    """
    Post-process plain text to detect JSON-like blocks (objects/arrays)
    and wrap them in [JSON START]...[JSON END] markers for LLM awareness.
    """
    lines = raw_text.splitlines()
    result = []
    in_json = False
    json_lines = []
    brace_depth = 0

    for line in lines:
        stripped = line.strip()
        if not in_json and (stripped.startswith('{') or stripped.startswith('[')):
            in_json = True
            json_lines = []
            brace_depth = 0

        if in_json:
            json_lines.append(line)
            brace_depth += stripped.count('{') + stripped.count('[')
            brace_depth -= stripped.count('}') + stripped.count(']')
            if brace_depth <= 0:
                # Validate it looks like real JSON (at least 3 lines with keys)
                block = "\n".join(json_lines)
                if len(json_lines) >= 3 and ('"' in block or "'" in block):
                    result.append("[JSON START]")
                    result.extend(json_lines)
                    result.append("[JSON END]")
                else:
                    result.extend(json_lines)
                in_json = False
                json_lines = []
                brace_depth = 0
        else:
            result.append(line)

    # Flush any remaining unclosed JSON
    if json_lines:
        result.extend(json_lines)

    return "\n".join(result)


# ── DOCX Structured Extraction ────────────────────────────────────────────────

def extract_structured_from_docx(file_bytes: bytes) -> List[Dict]:
    """
    Extract all content from DOCX preserving heading levels, tables, image data, and JSON blocks.
    Returns list of: {"text": str, "level": int|None, "style": str, "is_table": bool, "image_data": str|None, "image_mime": str|None}
    """
    doc = DocxDocument(io.BytesIO(file_bytes))
    paragraphs = []
    image_count = 0

    # We need to iterate body elements in order to interleave tables with paragraphs
    from docx.oxml.ns import qn
    body = doc.element.body

    for child in body.iterchildren():
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag

        if tag == 'p':
            # Paragraph
            from docx.text.paragraph import Paragraph
            para = Paragraph(child, doc)
            text = _extract_formatted_text(para)

            # Check for inline images
            blips = child.findall('.//' + qn('a:blip'))
            if blips:
                image_count += 1
                image_b64 = None
                image_mime = None
                # Extract actual image bytes from the DOCX package
                try:
                    for blip in blips:
                        r_embed = blip.get(qn('r:embed'))
                        if r_embed:
                            rel = doc.part.rels.get(r_embed)
                            if rel and hasattr(rel, 'target_part'):
                                img_bytes = rel.target_part.blob
                                content_type = rel.target_part.content_type or 'image/png'
                                image_b64 = base64.b64encode(img_bytes).decode('ascii')
                                image_mime = content_type
                                break
                except Exception as e:
                    logger.warning("Failed to extract image %d bytes: %s", image_count, str(e))

                img_marker = f"[IMAGE {image_count}: Visual content at this position"
                if image_b64:
                    img_marker += " — image data attached for analysis]"
                else:
                    img_marker += " — image could not be extracted]"

                paragraphs.append({
                    "text": img_marker,
                    "level": None, "style": "image", "is_table": False,
                    "image_data": image_b64, "image_mime": image_mime
                })
                if text:
                    paragraphs.append({"text": text, "level": None, "style": para.style.name if para.style else "", "is_table": False, "image_data": None, "image_mime": None})
                continue

            if not text:
                continue

            style_name = para.style.name if para.style else ""
            level = None
            if style_name.startswith("Heading"):
                try:
                    level = int(style_name.replace("Heading", "").strip())
                except ValueError:
                    level = 1

            paragraphs.append({"text": text, "level": level, "style": style_name, "is_table": False, "image_data": None, "image_mime": None})

        elif tag == 'tbl':
            # Table — extract all rows as pipe-delimited text
            from docx.table import Table
            table = Table(child, doc)
            table_lines = []
            headers = []

            for row_idx, row in enumerate(table.rows):
                cells = []
                for cell in row.cells:
                    cell_text = " | ".join(p.text.strip() for p in cell.paragraphs if p.text.strip())
                    if not cell_text:
                        cell_text = cell.text.strip()
                    cells.append(cell_text)

                row_text = " | ".join(cells)
                if row_text.strip():
                    if row_idx == 0:
                        headers = cells
                        table_lines.append(f"TABLE HEADER: {row_text}")
                        table_lines.append("-" * len(row_text))
                    else:
                        # Also produce a key:value format for clarity
                        if headers and len(cells) == len(headers):
                            kv = " | ".join(f"{h}: {v}" for h, v in zip(headers, cells) if v)
                            table_lines.append(f"ROW: {kv}")
                        else:
                            table_lines.append(f"ROW: {row_text}")

            if table_lines:
                table_text = "\n".join(table_lines)
                paragraphs.append({
                    "text": f"[TABLE START]\n{table_text}\n[TABLE END]",
                    "level": None, "style": "table", "is_table": True,
                    "image_data": None, "image_mime": None
                })

    # Post-process: detect JSON blocks in paragraph text
    for para in paragraphs:
        if not para.get("is_table") and para.get("style") != "image":
            para["text"] = _wrap_json_blocks_in_text(para["text"])

    return paragraphs


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract full text from DOCX including table content (for Q&A)."""
    paragraphs = extract_structured_from_docx(file_bytes)
    return "\n".join(p["text"] for p in paragraphs)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract plain text from PDF bytes."""
    try:
        return pdf_extract(io.BytesIO(file_bytes)).strip()
    except Exception as e:
        raise ValueError(f"PDF extraction failed: {str(e)}")


# ── DOC (legacy) Conversion ───────────────────────────────────────────────────────

def _convert_doc_to_docx(file_bytes: bytes) -> bytes:
    """
    Convert legacy .doc to .docx using LibreOffice headless.
    Returns the .docx file bytes.
    Raises ValueError if LibreOffice is not installed or conversion fails.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        doc_path = os.path.join(tmpdir, "input.doc")
        with open(doc_path, "wb") as f:
            f.write(file_bytes)

        try:
            result = subprocess.run(
                ["libreoffice", "--headless", "--convert-to", "docx", "--outdir", tmpdir, doc_path],
                capture_output=True, text=True, timeout=60
            )
        except FileNotFoundError:
            # Try 'soffice' as alternative command name
            try:
                result = subprocess.run(
                    ["soffice", "--headless", "--convert-to", "docx", "--outdir", tmpdir, doc_path],
                    capture_output=True, text=True, timeout=60
                )
            except FileNotFoundError:
                raise ValueError(
                    "LibreOffice is not installed. Install it to support .doc files. "
                    "On Ubuntu: sudo apt install libreoffice-core. "
                    "On Windows: install LibreOffice and add to PATH."
                )

        if result.returncode != 0:
            raise ValueError(f"DOC to DOCX conversion failed: {result.stderr[:300]}")

        docx_path = os.path.join(tmpdir, "input.docx")
        if not os.path.exists(docx_path):
            raise ValueError("DOC to DOCX conversion produced no output file.")

        with open(docx_path, "rb") as f:
            return f.read()


def extract_text_from_doc(file_bytes: bytes) -> str:
    """Extract text from legacy .doc by converting to .docx first."""
    docx_bytes = _convert_doc_to_docx(file_bytes)
    return extract_text_from_docx(docx_bytes)


def extract_structured_from_doc(file_bytes: bytes) -> List[Dict]:
    """Extract structured content from legacy .doc by converting to .docx first."""
    docx_bytes = _convert_doc_to_docx(file_bytes)
    return extract_structured_from_docx(docx_bytes)


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """Extract raw text for storage and Q&A."""
    if file_type == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif file_type == "docx":
        return extract_text_from_docx(file_bytes)
    elif file_type == "doc":
        return extract_text_from_doc(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def extract_structured(file_bytes: bytes, file_type: str) -> List[Dict]:
    """Extract structured paragraphs for module detection."""
    if file_type == "docx":
        return extract_structured_from_docx(file_bytes)
    elif file_type == "doc":
        return extract_structured_from_doc(file_bytes)
    else:
        raw = extract_text_from_pdf(file_bytes)
        # Post-process: detect ASCII tables, JSON blocks, and separator lines in plain text
        processed = _wrap_ascii_tables_in_text(raw)
        processed = _wrap_json_blocks_in_text(processed)
        paragraphs = []
        for line in processed.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            is_table = stripped.startswith("[TABLE")
            is_sep = _is_separator_line(stripped)
            paragraphs.append({
                "text": stripped,
                "level": None,
                "style": "table" if is_table else ("separator" if is_sep else ""),
                "is_table": is_table,
            })
        return paragraphs
