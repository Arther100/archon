# Document Analyser

Analyzes BRD, FRD, PRD, SRS documents — auto-detects modules, runs Senior BA + Developer level analysis, supports document-grounded Q&A, and exports structured JSON.

**Stack:** React + Vite · FastAPI · Supabase

---

## Quick Start

### 1. Supabase Setup
- Create a project at [supabase.com](https://supabase.com)
- Open **SQL Editor** → paste and run `backend/db/migrations.sql`

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
copy .env.example .env        # Windows
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, LLM_PROVIDER, API key
uvicorn main:app --reload
# API docs → http://localhost:8000/docs
```

**`.env` values to fill:**
| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (Project Settings → API) |
| `LLM_PROVIDER` | `openai` / `gemini` / `ollama` |
| `OPENAI_API_KEY` | Your OpenAI key (if using OpenAI) |
| `GEMINI_API_KEY` | Your Gemini key (if using Gemini) |
| `OPENAI_MODEL` | e.g. `gpt-4o` |

### 3. Frontend

```bash
cd frontend
npm install
copy .env.example .env        # Windows
# VITE_API_URL=http://localhost:8000
npm run dev
# App → http://localhost:5173
```

---

## Features

| Feature | Description |
|---------|-------------|
| 📄 Upload | PDF & DOCX, up to 20MB |
| 🔍 Module Detection | Auto-splits document by headings |
| 🧠 BA Analysis | 8-section output: Goal, Flow, Rules, Responsibilities, Scope, Dependencies, Impact, Risks |
| 🔗 Logic & Connectivity | How modules connect, data flows, what breaks on change |
| 💬 Document Q&A | Ask anything — grounded answers only, `temperature: 0`, cites source section |
| ⬇ JSON Export | Per-module structured JSON — deterministic parse, zero hallucination |

---

## Project Structure

```
document_analyser/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Env settings
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── upload.py            # POST /upload
│   │   ├── documents.py         # GET /documents, /documents/{id}/modules
│   │   ├── analysis.py          # POST+GET /modules/{id}/analyse
│   │   └── qa.py                # POST /documents/{id}/ask
│   ├── services/
│   │   ├── parser.py            # PDF + DOCX extraction
│   │   ├── module_detector.py   # Heading-based splitter
│   │   ├── llm_service.py       # BA analysis (temp=0, anti-hallucination)
│   │   └── qa_service.py        # Q&A (temp=0, grounded only)
│   └── db/
│       ├── supabase_client.py
│       └── migrations.sql
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── app/App.jsx
        ├── config/              # routes, strings, theme, env
        ├── styles/globals.css
        ├── hooks/api.js
        ├── components/layout/Header/
        └── pages/
            ├── Upload/
            ├── Documents/
            ├── Analysis/        # Sidebar + Viewer + JSON + Q&A
            └── NotFound/
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload PDF/DOCX |
| GET | `/documents` | List documents |
| GET | `/documents/{id}/modules` | List modules |
| POST | `/modules/{id}/analyse` | Run BA analysis |
| GET | `/modules/{id}/analysis` | Get Markdown analysis |
| GET | `/modules/{id}/analysis/json` | Get JSON export |
| POST | `/documents/{id}/ask` | Ask a question |
