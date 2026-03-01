---
name: document-analyser-ba-skill
description: >
  A Senior Business Analyst skill for analyzing large software requirement
  documents (BRD, FRD, PRD, SRS). Parses, splits, and explains each
  functional module to software developers (frontend, backend, architects)
  using a strict, structured BA output format.
  Tech stack — Frontend: React + Vite | Backend: FastAPI | DB: Supabase
---

# Document Analyser — Senior BA Skill

## Purpose

This skill powers an AI system that reads large requirement documents (BRD, FRD, PRD, SRS)
and explains every functional module to software developers and architects with
the precision of a **Senior Business Analyst** — not a chatbot.

**Target output consumers:** Frontend developers, backend developers, architects.

---

## Pipeline (End-to-End Flow)

```
PDF / Word Upload
    ↓
Parse + Extract Raw Text              [FastAPI + python-docx / pdfminer]
    ↓
Structure & Chunk Text                [Split by headings / page breaks]
    ↓
Light LLM — Module Detection          [Detect functional module boundaries]
    ↓
Module Isolation                      [Each module = independent analysis unit]
    ↓
Senior BA Prompt (THIS SKILL)         [One call per module]
    ↓
Structured BA Output (Markdown)       [Stored in Supabase]
    ↓
(Optional) JSON / Schema Export       [For downstream dev tooling]
```

---

## STRICT BEHAVIORAL RULES (NON-NEGOTIABLE)

These rules apply to every single module analysis. No exceptions.

1. Explain **ONLY** what is explicitly stated or clearly derivable from the document.
2. **NEVER** invent functionality, rules, or flows not present in the text.
3. If something is missing, unclear, or ambiguous — **state it explicitly**.
4. Do **NOT** assume how the system should work unless the document says so.
5. Separate **business intent** from **technical implementation**.
6. Same terms used in different modules may carry different meanings — **never merge them**.
7. Prefer **clarity over completeness** — "Not specified" is a valid and correct answer.
8. Do **NOT** write code.
9. Do **NOT** summarize vaguely.
10. Do **NOT** be conversational. Be structured and developer-focused.

---

## Senior BA Analysis Prompt

Use this prompt exactly for each isolated module block. Replace `{MODULE_TEXT}` with
the extracted text of the module being analyzed.

```
Analyze the following requirement document content
from the perspective of a Senior Business Analyst.

Context:
- Document Type: Requirement / Functional Specification
- Target Audience: Software Developers & Architects
- Scope: Explain business logic, flow, impact, and gaps
- This content belongs to ONE functional module only

TASKS:
1. Identify the business goal of this module.
2. Explain the business flow step-by-step.
3. Describe key functional rules and conditions.
4. Clarify responsibilities (what the system does vs user actions).
5. Define what is in scope and out of scope.
6. Identify dependencies on other modules.
7. Highlight missing, unclear, or ambiguous requirements.
8. Explain potential impact if this module's logic changes.

IMPORTANT:
- Base every explanation on the given text only.
- If a detail is not mentioned, explicitly say "Not specified in the document".
- Do not merge logic from other modules.
- Use simple, precise language.
- Use bullet points and numbered steps where appropriate.

Document content:
<<<
{MODULE_TEXT}
>>>
```

---

## Required Output Format (Per Module)

Every module analysis MUST produce output in this exact structure.
No sections may be skipped. If there is nothing to write, state "Not specified in the document."

```markdown
## Module: [Module Name]

### 1. Business Goal
(Why this module exists — the business problem it solves)

### 2. Business Flow
(Numbered end-to-end steps — from trigger to outcome)
1. ...
2. ...
3. ...

### 3. Functional Rules & Logic
(Business rules, validations, conditions, calculations)
- Rule 1: ...
- Rule 2: ...

### 4. Responsibilities
**User Actions:**
- ...

**System Behavior:**
- ...

### 5. Scope Analysis
#### In Scope
- ...

#### Out of Scope
- ...

#### Not Specified / Unclear
- ...

### 6. Dependencies
(Other modules or external processes this module relies on)
- ...

### 7. Impact Analysis
(What is affected — other modules, data, users — if this module's logic changes)
- ...

### 8. Risks & Gaps
(Ambiguities, missing flows, edge cases not addressed, potential design conflicts)
- ...
```

---

## Module Detection Rules

When splitting a large document into modules, apply these rules:

| Signal                         | Action                                      |
|-------------------------------|---------------------------------------------|
| Section heading (numbered)     | Treat as a new module                       |
| Repeated entity/feature name   | Group under one module                      |
| Heading with verb phrase       | Likely a flow — keep in one module          |
| Cross-references               | Note as dependency, keep modules separate   |
| Same term, different context   | Treat as distinct — do NOT merge            |
| No heading but distinct logic  | Split by logical boundary, label [Unlabeled Module N] |

---

## Tech Stack (Implementation Reference)

| Layer       | Technology       | Responsibility                                               |
|-------------|------------------|--------------------------------------------------------------|
| Frontend    | React + Vite     | Upload UI, document list, module viewer, BA output rendering |
| Backend     | FastAPI (Python) | File parsing, module detection, LLM orchestration, API layer |
| Database    | Supabase         | Store documents, modules, BA analysis output, user sessions  |

### Backend Responsibilities (FastAPI)
- `POST /upload` — Accept PDF or Word file, parse text, detect modules
- `GET /documents` — List uploaded documents for the current user
- `GET /documents/{id}/modules` — Return list of detected modules
- `GET /modules/{id}/analysis` — Return BA analysis output for a module
- `POST /modules/{id}/analyse` — Trigger LLM analysis for a specific module
- LLM integration (OpenAI / Gemini / Ollama) — inject `MODULE_TEXT` into the BA prompt

### Frontend Responsibilities (React + Vite)
- File upload page (PDF / Word)
- Document list view
- Module list sidebar per document
- BA analysis viewer — render all 8 sections per module
- Export option (Markdown / JSON)

### Database Schema (Supabase)

**Table: `documents`**
| Column         | Type       | Description                          |
|---------------|------------|--------------------------------------|
| `id`          | UUID       | Primary key                          |
| `user_id`     | UUID       | FK to auth.users                     |
| `file_name`   | TEXT       | Original uploaded file name          |
| `file_type`   | TEXT       | `pdf` or `docx`                      |
| `raw_text`    | TEXT       | Full extracted text                  |
| `created_at`  | TIMESTAMP  | Upload timestamp                     |

**Table: `modules`**
| Column         | Type       | Description                          |
|---------------|------------|--------------------------------------|
| `id`          | UUID       | Primary key                          |
| `document_id` | UUID       | FK to `documents`                    |
| `title`       | TEXT       | Detected module name / heading       |
| `content`     | TEXT       | Raw module text                      |
| `order`       | INTEGER    | Position in document                 |

**Table: `analyses`**
| Column         | Type       | Description                          |
|---------------|------------|--------------------------------------|
| `id`          | UUID       | Primary key                          |
| `module_id`   | UUID       | FK to `modules`                      |
| `output_md`   | TEXT       | Full BA analysis in Markdown         |
| `output_json` | JSONB      | (Optional) Structured JSON export    |
| `created_at`  | TIMESTAMP  | Analysis generation timestamp        |

---

## What the USER Must Provide

To build and run this system, the following must be provided by the project owner:

### 1. Supabase Project
- [ ] Supabase project URL (`SUPABASE_URL`)
- [ ] Supabase anon/public key (`SUPABASE_ANON_KEY`)
- [ ] Supabase service role key — for backend server-side access (`SUPABASE_SERVICE_KEY`)
- [ ] Auth configuration (email/password or magic link — confirm which)
- [ ] Storage bucket name (if files are stored in Supabase Storage, not just text)

### 2. LLM API Access
- [ ] LLM provider choice: **OpenAI / Gemini / Ollama (local)** — confirm which
- [ ] API key for the chosen provider (`OPENAI_API_KEY` or `GEMINI_API_KEY`)
- [ ] Preferred model (e.g. `gpt-4o`, `gemini-1.5-pro`, `llama3`)

### 3. Environment Configuration
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the React frontend
- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `LLM_API_KEY` for the FastAPI backend

### 4. Document Requirements
- [ ] Confirm supported formats: **PDF only / Word (.docx) only / both**
- [ ] Max file size limit (for upload validation)
- [ ] Language of documents: English only or multilingual?

### 5. Deployment (Optional — for production)
- [ ] Hosting choice for FastAPI: **Railway / Render / AWS / local only**
- [ ] Hosting choice for React frontend: **Vercel / Netlify / other**
- [ ] Custom domain (if any)

---

## Application Design Contract Reference

All frontend code must follow the design and structure rules defined in:
`skill/skill.md`

Key rules that apply here:
- No hardcoded strings, colors, routes, or API URLs
- All config centralized in `src/config/`
- UI components are dumb — receive data via props only
- Pages orchestrate data and compose UI
- Responsive behavior is centralized

---

## Quality Checklist (Before Shipping Any Module Analysis)

- [ ] All 8 sections are present and populated
- [ ] No invented logic — every statement traces to the document
- [ ] Ambiguities are explicitly listed in Section 8
- [ ] "Not specified" used where information is absent (not left blank)
- [ ] Business flow is numbered and sequential
- [ ] Responsibilities clearly separate user vs system
- [ ] Dependencies name the actual module, not a vague reference
- [ ] Impact analysis is specific, not generic