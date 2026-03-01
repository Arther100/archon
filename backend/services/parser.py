"""
parser.py
---------
Extracts rich structured content from PDF and DOCX files.

For DOCX:
- Paragraphs with heading styles → module boundaries
- Body paragraphs → content
- Tables → extracted as pipe-delimited text rows (critical for field detection)
- Images → noted as [IMAGE: position marker] for LLM awareness

For PDF:
- Plain text extraction via pdfminer
"""

import io
from typing import List, Dict
from pdfminer.high_level import extract_text as pdf_extract
from docx import Document as DocxDocument


# ── DOCX Structured Extraction ────────────────────────────────────────────────

def extract_structured_from_docx(file_bytes: bytes) -> List[Dict]:
    """
    Extract all content from DOCX preserving heading levels, tables, and image markers.
    Returns list of: {"text": str, "level": int|None, "style": str, "is_table": bool}
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
            text = para.text.strip()

            # Check for inline images
            if child.findall('.//' + qn('a:blip')):
                image_count += 1
                paragraphs.append({
                    "text": f"[IMAGE {image_count}: Visual content at this position — describe or analyse if visible]",
                    "level": None, "style": "image", "is_table": False
                })
                if text:
                    paragraphs.append({"text": text, "level": None, "style": para.style.name if para.style else "", "is_table": False})
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

            paragraphs.append({"text": text, "level": level, "style": style_name, "is_table": False})

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
                    "level": None, "style": "table", "is_table": True
                })

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


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """Extract raw text for storage and Q&A."""
    if file_type == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif file_type == "docx":
        return extract_text_from_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def extract_structured(file_bytes: bytes, file_type: str) -> List[Dict]:
    """Extract structured paragraphs for module detection."""
    if file_type == "docx":
        return extract_structured_from_docx(file_bytes)
    else:
        raw = extract_text_from_pdf(file_bytes)
        return [{"text": line.strip(), "level": None, "style": "", "is_table": False}
                for line in raw.splitlines() if line.strip()]
