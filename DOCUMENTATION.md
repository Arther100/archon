# Archon — Complete Project Documentation

> **From Requirements to Architecture. With Precision.**
>
> Version 3.0.0 · Codename: Archon · Last updated: March 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Technology Stack](#3-technology-stack)
4. [Backend — API Server](#4-backend--api-server)
   - 4.1 [Configuration & Environment](#41-configuration--environment)
   - 4.2 [Application Bootstrap](#42-application-bootstrap)
   - 4.3 [Authentication & Authorization](#43-authentication--authorization)
   - 4.4 [Core Features — Document Pipeline](#44-core-features--document-pipeline)
   - 4.5 [AI / LLM Engine](#45-ai--llm-engine)
   - 4.6 [SaaS Features](#46-saas-features)
   - 4.7 [Admin Panel APIs](#47-admin-panel-apis)
   - 4.8 [Middleware Layer](#48-middleware-layer)
   - 4.9 [Services Layer](#49-services-layer)
5. [Frontend — React SPA](#5-frontend--react-spa)
   - 5.1 [Build & Configuration](#51-build--configuration)
   - 5.2 [App Shell & Routing](#52-app-shell--routing)
   - 5.3 [Context Providers (Global State)](#53-context-providers-global-state)
   - 5.4 [API Client](#54-api-client)
   - 5.5 [User-Facing Pages](#55-user-facing-pages)
   - 5.6 [Admin Pages](#56-admin-pages)
   - 5.7 [Shared Components](#57-shared-components)
   - 5.8 [Internationalization (i18n)](#58-internationalization-i18n)
   - 5.9 [Theming](#59-theming)
   - 5.10 [Styling Approach](#510-styling-approach)
6. [Database — Supabase PostgreSQL](#6-database--supabase-postgresql)
   - 6.1 [Core Document Tables](#61-core-document-tables)
   - 6.2 [RBAC & Multi-Tenancy Tables](#62-rbac--multi-tenancy-tables)
   - 6.3 [Feature & Communication Tables](#63-feature--communication-tables)
   - 6.4 [Batch Processing & Cost Tables](#64-batch-processing--cost-tables)
   - 6.5 [Entity-Relationship Map](#65-entity-relationship-map)
   - 6.6 [Permission System](#66-permission-system)
   - 6.7 [Migration History](#67-migration-history)
7. [Data Flow — End to End](#7-data-flow--end-to-end)
8. [Security Model](#8-security-model)
9. [Cost Control Mechanisms](#9-cost-control-mechanisms)
10. [Deployment](#10-deployment)

---

## 1. Project Overview

**Archon** is a multi-tenant SaaS platform that transforms complex requirement documents (PDF/DOCX) into structured system blueprints. It automates the process that a Solutions Architect or Business Analyst would perform manually — extracting functional specifications, detecting gaps, mapping cross-module dependencies, and generating API-ready architecture.

### What Archon Does

1. **Upload** a requirements document (PDF or DOCX, up to 20 MB)
2. **Detect Modules** — the system automatically splits the document into functional sections/modules (e.g., "User Management", "Payment Processing", "Notifications")
3. **Analyse Each Module** — an LLM (OpenAI, Gemini, or Ollama) extracts a structured "blueprint" from each module containing:
   - Documented facts (summary, business goal, business flow, data fields, functional rules, user actions, system behaviors, scope boundaries)
   - Developer gaps (missing specifications, ambiguous requirements, recommendations, risk flags)
   - Cross-module connectivity (dependencies, shared fields, what it provides to other modules)
   - API schema (REST endpoints for GET/POST/PUT/DELETE)
   - Confidence and accuracy scores
4. **Ask Questions** — users can ask natural-language questions about the document or specific modules, with zero-hallucination guarantees
5. **Cross-Module Connectivity** — view how modules depend on each other, shared data fields, and run deep LLM-powered dependency analysis
6. **Export** — download API schemas as JSON

### Who Uses It

- **Solutions Architects** — to rapidly blueprint a system from requirements
- **Business Analysts** — to identify gaps and ambiguities in requirement documents
- **Development Leads** — to get a head start on API design and module structure
- **QA Teams** — to understand what's specified vs. what's missing

### Multi-Tenancy & SaaS

Archon is a full SaaS platform with:
- Organizations with subscription plans
- Role-based access control (RBAC) with granular permissions
- Per-user request quotas and monthly token limits
- BYOK (Bring Your Own Key) for AI providers
- Admin panel for user management, broadcast messaging, feature flags, audit logs, and batch processing
- Feedback system with admin reply threads
- Email notifications for key events

---

## 2. Architecture Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React SPA)                      │
│  React 18 + Vite + react-router-dom                             │
│  Hosted as static site on Render                                 │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐   │
│  │AuthCtx  │ │PermCtx   │ │NotifCtx   │ │ThemeCtx          │   │
│  │(JWT)    │ │(RBAC)    │ │(Polling)  │ │(8 accent colors) │   │
│  └─────────┘ └──────────┘ └───────────┘ └──────────────────┘   │
│  10 User Pages + 10 Admin Pages + Auth Page                      │
│  Centralized API client with auto token refresh                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ HTTPS (REST API)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI + Python)                    │
│  Hosted on Render (Web Service)                                  │
│  ┌───────────┐ ┌───────────────┐ ┌──────────────────────────┐   │
│  │Auth       │ │RBAC Middleware │ │Feature Flags / Quotas    │   │
│  │Middleware │ │(Permissions)   │ │Usage Limiter             │   │
│  └───────────┘ └───────────────┘ └──────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ ROUTERS: auth, upload, documents, analysis, qa,           │   │
│  │ dependencies, feedback, notifications, ai_settings        │   │
│  │ ADMIN: users, orgs, plans, features, usage, audit,        │   │
│  │ broadcasts, email, batch                                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ SERVICES: LLM Engine, Parser, Q&A, Batch Processing,     │   │
│  │ Cache, Token Tracking, Email (SMTP), Encryption,          │   │
│  │ Audit Logger, Notification Creator, Module Detector        │   │
│  └───────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌───────────┐ ┌─────────┐ ┌──────────┐
             │ Supabase  │ │ OpenAI  │ │ SMTP     │
             │ (Auth +   │ │ Gemini  │ │ (Gmail)  │
             │ PostgreSQL)│ │ Ollama  │ │          │
             └───────────┘ └─────────┘ └──────────┘
```

### Key Architectural Decisions

- **Supabase** is used for both authentication (JWT-based) and the PostgreSQL database
- **Service role key** is used on the backend (bypasses RLS) — all authorization is handled in the FastAPI middleware layer, not at the database level
- **No ORM** — all database queries use the Supabase Python client (PostgREST under the hood)
- **Inline styles** — the frontend uses no CSS-in-JS library; all styling is done with inline React styles and CSS custom properties
- **Multi-provider LLM** — the system supports OpenAI, Google Gemini, and local Ollama models with a unified interface
- **Content-hash caching** — identical document content produces the same analysis, eliminating redundant LLM calls

---

## 3. Technology Stack

### Backend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | FastAPI | 0.110.0 |
| Server | Uvicorn | 0.29.0 |
| Database Client | Supabase Python SDK | 2.4.3 |
| LLM (Primary) | OpenAI Python SDK | 1.23.3 |
| LLM (Alternate) | Google Generative AI | 0.5.4 |
| HTTP Client | HTTPX | 0.27.0 |
| PDF Parsing | pdfminer.six | 20221105 |
| DOCX Parsing | python-docx | 1.1.0 |
| Encryption | cryptography (Fernet) | 42.0.5 |
| Environment | python-dotenv | 1.0.1 |

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| UI Library | React | 18.2 |
| Build Tool | Vite | 5.2 |
| Routing | react-router-dom | 6.22.3 |
| File Upload | react-dropzone | 14.2.3 |
| Markdown | react-markdown | 9.0.1 |
| Code Highlighting | react-syntax-highlighter | 15.5.0 |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Auth & Database | Supabase (hosted PostgreSQL + Auth) |
| Backend Hosting | Render (Web Service, Free Plan) |
| Frontend Hosting | Render (Static Site) |
| Email | SMTP (Gmail) |

---

## 4. Backend — API Server

### 4.1 Configuration & Environment

All configuration is centralized in a single `Settings` class that reads from environment variables (with `.env` file support via `python-dotenv`).

**Environment variable groups:**

| Group | Purpose |
|-------|---------|
| **Supabase** | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for auth/login), `SUPABASE_SERVICE_KEY` (for server-side DB operations) |
| **LLM Provider** | `LLM_PROVIDER` (openai/gemini/ollama), plus per-provider API keys and model names |
| **OpenAI** | `OPENAI_API_KEY`, `OPENAI_MODEL` (default: gpt-4o-mini) |
| **Gemini** | `GEMINI_API_KEY`, `GEMINI_MODEL` (default: gemini-1.5-pro) |
| **Ollama** | `OLLAMA_BASE_URL` (default: localhost:11434), `OLLAMA_MODEL` (default: llama3) |
| **Upload** | `MAX_UPLOAD_SIZE_MB` (20), `ALLOWED_EXTENSIONS` (pdf, docx) |
| **SMTP** | Host, port, user, password, from name/email for transactional emails |
| **Frontend** | `FRONTEND_URL` for email template links |
| **CORS** | `ALLOWED_ORIGINS` for cross-origin requests |

**Two Supabase clients are maintained:**
- **Service client** (singleton) — uses the service role key, bypasses RLS, used for all database operations
- **Auth client** (new instance per request) — uses the anon key, used exclusively for login/signup to prevent session leakage between requests

---

### 4.2 Application Bootstrap

The FastAPI application is configured in `main.py`:

1. Reads version info from `version.json` (shared between frontend and backend)
2. Creates the FastAPI app with title, description, and version
3. Configures CORS middleware with configurable allowed origins
4. Registers all routers:
   - **Core routers** (no prefix): upload, documents, analysis, qa, dependencies, auth
   - **SaaS routers** (no prefix): feedback, notifications, ai-settings
   - **Admin routers** (under `/admin`): organizations, users, features, audit, usage, broadcasts, email, batch
   - **Plans router** (under `/plans`): both public and admin endpoints
5. Exposes a health-check endpoint at `GET /`

---

### 4.3 Authentication & Authorization

#### Authentication Flow

Archon uses **Supabase Auth** with JWT tokens:

1. **Signup** — the backend calls Supabase Admin API to create a user (email pre-confirmed, no email verification required). A welcome email is sent via SMTP in a background thread. A `user_profiles` record is auto-created with the default "developer" role.

2. **Login** — the backend signs in via Supabase Auth using email/password. Returns:
   - `access_token` (short-lived JWT)
   - `refresh_token` (long-lived, for renewing the access token)
   - User metadata (display_name, avatar_url, theme_color, quotas, etc.)

3. **Token refresh** — the frontend calls `/auth/refresh` every 50 minutes with the refresh token to get a new access/refresh token pair. This happens automatically in the background.

4. **Logout** — invalidates the Supabase session server-side.

5. **Session restoration** — on page load, the frontend calls `GET /auth/me` with the stored access token. If it fails, it attempts a refresh. If refresh also fails, the user is logged out.

#### Authorization (RBAC) — How Permissions Work

The authorization system is a **dependency chain** in FastAPI:

```
get_current_user (validates JWT)
    → get_user_profile (fetches profile + role + org from DB)
        → get_user_permissions (fetches permission codes from role_permissions table)
            → require_permission("manage_users") (checks if user has the specific permission)
```

**Four roles exist** (in order of privilege):
1. **super_admin** — full platform access, bypasses all permission checks
2. **org_admin** — manages their organization's users and resources
3. **developer** — standard user, can upload and analyse documents
4. **viewer** — read-only access

**Key design decision:** `super_admin` bypasses ALL permission checks at the middleware level. This means even if the `role_permissions` table is incomplete, super_admin can access everything.

**Profile auto-creation:** When a user accesses `/auth/me/profile` or any protected endpoint, if their `user_profiles` record doesn't exist, one is automatically created with the "developer" role and the first available organization. This uses `INSERT` (not `UPSERT`) to prevent accidentally overwriting an existing user's role.

---

### 4.4 Core Features — Document Pipeline

#### Step 1: Upload

**Endpoint:** `POST /upload`

The upload process:
1. Validates file extension (must be PDF or DOCX)
2. Validates file size (max 20 MB)
3. Extracts raw text using the parser service:
   - **DOCX** — preserves paragraph structure, headings, table content (with `[TABLE START/END]` markers), and image placeholders
   - **PDF** — extracts plain text using pdfminer
4. Detects modules using the module detector service
5. Inserts a `documents` row with the raw text
6. Inserts `modules` rows for each detected section
7. Returns the document ID and list of modules

#### Step 2: Module Detection

Module detection is **purely deterministic** (no LLM involved):

- **DOCX with heading styles** — splits on `Heading 1` elements. Sub-headings (Heading 2, 3, etc.) stay inside their parent module. This preserves the document's natural structure.
- **PDF or DOCX without headings** — uses regex patterns to detect section boundaries:
  - ALL CAPS lines (e.g., "USER MANAGEMENT") — minimum 6 characters
  - Top-level numbered sections (e.g., "1. Introduction", "2. Requirements") — but NOT sub-numbered like "1.1" or "1.2"
  - Common section keywords (e.g., "Module:", "Section:", "Chapter:", "Feature:", "Appendix:")
  - Markdown-style headings (`# Title` or `## Title`)
- Each module gets a title and its associated content text.

##### What Happens When a Document Has No Structure at All

This is a critical fallback path. When a document is plain text with no headings, no ALL-CAPS sections, no numbered sections, and no recognizable section keywords:

1. **DOCX path:** The parser extracts all paragraphs but finds no heading styles → falls through to `detect_modules_from_text()` (the same regex-based detector used for PDFs)
2. **Regex scan finds nothing:** None of the heading patterns match any line in the text
3. **Single-module fallback activates:** The entire document becomes **one module** titled **"Full Document"** (or "Document Overview" if the regex loop runs but produces no splits) — all the text goes into that single module's content
4. **The LLM still analyses it fully:** The entire text is sent to the LLM as one large module. If the text exceeds 10,000 characters, the chunking strategy kicks in — the text is split into overlapping chunks (800-char overlap), each chunk is analysed independently, and results are merged into a single coherent blueprint
5. **The analysis output is the same structure:** Even for a single "Full Document" module, the LLM still extracts fields, rules, gaps, API schemas, and connectivity (though connectivity will be empty since there's only one module)

**In short:** The system never fails on unstructured documents. The worst case is that the entire document becomes one large module called "Full Document", and the LLM analyses all of it together. The user sees one module in the sidebar instead of multiple, but the full blueprint (fields, rules, gaps, API) is still generated.

**Example scenarios:**

| Document Type | What Happens | Module Count |
|---|---|---|
| DOCX with Heading 1 styles | Splits cleanly on each H1 | Multiple (one per H1) |
| DOCX with no heading styles but ALL CAPS sections | Regex splits on ALL CAPS lines | Multiple |
| PDF with numbered sections ("1. User Management") | Regex splits on numbered headings | Multiple |
| Plain text email paste, no structure at all | Entire content → "Full Document" | 1 |
| PDF with only body text paragraphs | Entire content → "Full Document" | 1 |
| DOCX with only Heading 2/3 (no Heading 1) | Regex fallback on the text | Depends on regex matches |

**Parser error fallback:** If the structured parser (`extract_structured`) fails for any reason on a DOCX file, the upload endpoint catches the exception and falls back to `detect_modules_from_text()` using the already-extracted raw text. This ensures uploads never fail due to parsing issues.

#### Step 3: Analysis (Blueprint Generation)

**Endpoint:** `POST /modules/{module_id}/analyse`

This is the core value proposition. For each module:

1. Check the analysis cache (SHA-256 hash of module content) — if a cached result exists, return it immediately
2. Build a detailed LLM prompt with:
   - A persona (Solutions Architect / Business Analyst) with strict zero-hallucination rules
   - The module text
   - A structured output schema (JSON) that the LLM must follow
3. If the text is long (>10,000 characters), split it into overlapping chunks (800-char overlap) and analyse each chunk separately, then merge the results. **This is especially important for unstructured documents that become a single "Full Document" module** — a 50-page PDF with no headings might produce one module with 200,000+ characters, which gets split into ~20 overlapping chunks, each analysed independently, then intelligently merged (arrays are concatenated with deduplication, strings keep the longest version, API schemas are merged additively)
4. Call the configured LLM provider (OpenAI, Gemini, or Ollama)
5. Parse the JSON response from the LLM output
6. Calculate confidence and accuracy scores based on:
   - Field extraction quality (how many fields have real validation rules)
   - Gap count (fewer gaps = higher accuracy)
7. Log token usage and cost
8. Cache the result for future identical content
9. Store in the `analyses` table with version number

**The output blueprint structure:**
- **Documented** — summary, business_goal, business_flow, fields (with label, type, required, description, validation, **input_type**), functional_rules, user_actions, system_behaviors, scope_in, scope_out
- **Gaps** — missing_specs, ambiguous requirements, developer_recommendations, risk_flags
- **Connectivity** — depends_on, provides_to, shared_fields, **integration_points** (external systems the module must integrate with)
- **API Schema** — resource name, base endpoint, and full REST operations (GET/POST/PUT/DELETE with paths, descriptions, request bodies, response schemas)

**Field `input_type` property:** Each extracted field includes an `input_type` that maps to a UI widget: `text`, `textarea`, `number`, `email`, `tel`, `url`, `date`, `datetime-local`, `select`, `radio`, `checkbox`, `file`, `password`, `hidden`, `color`, `range`, `search`, `time`. The frontend renders appropriate filter chips and badges for these types.

**Accuracy calculation formula:**
- Start with the percentage of fields that have real validation rules (excluding generic values like "not specified" or "none")
- Penalize by the number of gaps: `accuracy = field_quality_pct - (gap_count × 2)`
- Clamp the result to 0–100
- Confidence and accuracy scores are stored inside `output_json` as `_scores` (embedded in the JSONB column, not as separate database columns)

#### API Schema Editing

**Endpoints:** `GET /modules/{id}/api-schema` and `PUT /modules/{id}/api-schema`

The API schema generated by the LLM is fully editable:
- **GET** returns just the API schema portion from the latest analysis (for the schema editor tab)
- **PUT** accepts a `{ "api_schema": {...} }` body and patches the stored `output_json` in the analyses table, allowing users to refine the generated REST endpoints without re-running the full analysis

#### Analysis History & Restore

**Endpoint:** `POST /modules/{id}/analyses/{analysis_id}/restore`

Reverts a module to a specific historical analysis version. The selected analysis becomes the active one, allowing users to undo re-analyses if the previous output was better.

#### Cache Bypass (Force Re-Analysis)

The `POST /modules/{id}/analyse` endpoint accepts a `force_reanalyse=true` query parameter that bypasses the content-hash cache even if a cached result exists. This is useful when the LLM model has been changed or the user wants a fresh analysis.

#### Module Enrichment

When listing modules via `GET /documents/{id}/modules`, each module in the response is enriched with an `is_analysed` boolean flag (checked by querying the `analyses` table). This lets the frontend show which modules have been analysed and which haven't.

#### Step 4: Q&A

**Endpoints:** `POST /documents/{id}/ask` (document-wide) and `POST /modules/{id}/ask` (module-scoped)

The Q&A system enforces a **zero-hallucination contract**:
- The LLM is given ONLY the document/module text as context
- If the answer cannot be found in the provided text, the system returns: "Not specified in the document."
- Each answer includes a `sourced` boolean and a `confidence` indicator
- Token usage is tracked and quota is consumed

#### Step 5: Cross-Module Connectivity

Three approaches are available:

1. **Deterministic connectivity** (`GET /documents/{id}/connectivity-map`) — scans all analysed modules and finds:
   - Shared fields (same field name appearing in multiple modules)
   - Connectivity sections from each module's analysis
   - No LLM call required

2. **Deep LLM analysis** (`POST /documents/{id}/connectivity-map`) — sends all module field summaries to the LLM for deep cross-module dependency analysis. Requires at least 2 analysed modules.

3. **Legacy dependencies** (`GET /documents/{id}/dependencies`) — basic LLM-based dependency detection from module titles only.

---

### 4.5 AI / LLM Engine

The LLM service is the brain of the analysis system. It supports three providers through a unified interface:

**OpenAI** — uses the chat completions API with structured JSON output mode. Default model: `gpt-4o-mini` (cost-effective). Also supports `gpt-4o` and `gpt-4-turbo`.

**Google Gemini** — uses the generative AI SDK. Default model: `gemini-1.5-pro`. Configured for JSON output with safety settings disabled for technical content.

**Ollama** — connects to a local Ollama instance via HTTP. Default model: `llama3`. Useful for air-gapped environments or cost-free development.

**The AI skill contract** is defined in `skill/skill.md` — a comprehensive document that specifies:
- The exact Senior Business Analyst / Solutions Architect persona
- 10 non-negotiable behavioral rules for the LLM
- Module detection heuristics table
- The required 8-section output format per module
- A quality checklist for shipping analyses
- Database schema reference for context
- A full setup checklist for new deployments

This file serves as the canonical reference for how the analysis engine should behave.

**The system prompt** is a detailed persona description that instructs the LLM to act as a "Deterministic Requirement-to-System Blueprint Engine". Key rules:
- Extract ONLY what is explicitly stated in the document
- Never invent, assume, or hallucinate information
- Flag anything unclear as a "gap" rather than guessing
- Follow the exact JSON output schema
- Include specific field types (string, integer, boolean, date, enum, uuid, email, phone, url, decimal, float, text, file, json, array, object)

**Chunking strategy** for large documents:
- If module text exceeds 10,000 characters, split into chunks with 800-character overlap
- Analyse each chunk independently
- Merge results by combining all extracted fields, rules, gaps, etc.
- Remove duplicates

**Cost tracking:**
- Every LLM call logs input tokens, output tokens, provider, model, and calculated cost
- Costs are calculated using admin-configurable pricing per model (stored in `cost_settings` table)
- Default prices: gpt-4o-mini at $0.15/$0.60 per million tokens, gpt-4o at $2.50/$10.00, gemini-1.5-pro at $1.25/$5.00, Ollama at $0.00

**LLM error classification:**
Both the analysis and Q&A services implement structured error handling that translates provider-specific errors into user-friendly HTTP 502 responses:
- Invalid API key → "Invalid OpenAI/Gemini API key"
- Quota/billing exceeded → "Account has no credits or billing limit reached"
- Invalid model name → "Invalid model specified"
- Other errors → generic "LLM processing error" with logged details

---

### 4.6 SaaS Features

#### Feedback System

Users can submit feedback with:
- Title, description, category (general/bug/feature_request/improvement/question), priority (low/medium/high/critical)
- View their own feedback history and status
- Admins can change status (open → in_review → resolved → closed), reply with threaded messages
- Replies trigger email notifications to the feedback submitter

#### Notification System

- In-app notifications with title, message, type (info/success/warning/error)
- Unread count badge (polled every 30 seconds from the frontend)
- Mark individual or all notifications as read
- Created by various system events: feedback replies, admin messages, broadcasts, role changes

#### AI Settings (BYOK — Bring Your Own Key)

Users can provide their own API keys for:
- OpenAI, Google (Gemini), Anthropic, Azure OpenAI
- Keys are encrypted with Fernet (symmetric encryption) before storage
- Keys can be validated by making a test API call to the provider
- When a user has a valid BYOK key, their analyses use that key instead of the platform default

#### Plans & Subscriptions

- Three default plans: Free (500K tokens, 2 users), Basic ($499/mo, 1M tokens, 3 users), Pro ($999/mo, 3M tokens, 10 users)
- Plans define: price, token limits, max users, and a features JSON object for feature flags
- Users can choose a plan (auto-creates an organization if they don't have one)
- Admins can create/update plans

---

### 4.7 Admin Panel APIs

The admin panel provides 10 management areas:

#### User Management
- List all users (super_admin sees all; org_admin sees only their org)
- Update user role, organization, location, active status
- Adjust per-user request quotas
- Send direct messages (creates notification + sends email)
- Delete users (removes profile, related data, and Supabase auth account)

#### Organization Management
- CRUD operations for organizations
- Assign plans and subscription status (active/trialing/past_due/canceled/unpaid)

#### Role Permissions (Super Admin Only)
- View the complete role × permission matrix
- Toggle individual permissions for any role
- This is the most sensitive admin function — only super_admin can access it

#### Feature Flags
- Per-plan feature toggle management
- Organization-level feature overrides (can enable features beyond the plan, or disable them)
- Override takes precedence over plan features

#### Usage Monitoring
- Global summary: total users, total tokens consumed, users near limit, users over limit
- Per-user usage breakdown with progress bars
- Detailed usage log entries

#### Audit Logging
- Every admin action is recorded: who did what, to which entity, with what details
- Filterable by action type, paginated
- Actions tracked: update_user, delete_user, create_org, update_plan, etc.

#### Broadcast Messaging
- Send messages to: all users, specific organization, specific role, or specific location
- Creates individual notifications for each targeted user
- Sends email notifications in background threads

#### Email Administration
- View SMTP configuration status
- Send test emails
- Send custom HTML emails to any address

#### Batch Processing
- Create batch jobs to analyse all modules of a document at once
- Execute in two modes:
  - **Concurrent** — all modules analysed in parallel (faster but higher burst cost)
  - **Sequential** — one module at a time (predictable)
- **OpenAI Batch API** — submit jobs to OpenAI's batch endpoint for 50% cost discount (asynchronous, requires polling)
- Track per-module status, token usage, cache hits
- View cache statistics and clear cache
- Configure per-model pricing

---

### 4.8 Middleware Layer

#### Auth Middleware (RBAC Chain)

The middleware builds a dependency chain that progressive enriches the request context:

1. **get_current_user** — extracts and validates the JWT token via Supabase's `auth.get_user()`. Returns user ID, email, and metadata.

2. **get_user_profile** — fetches the `user_profiles` record for the authenticated user, then enriches it with role name and organization details via separate queries. If no profile exists, auto-creates one with the "developer" role (using INSERT, not UPSERT, to protect existing profiles).

3. **get_user_permissions** — fetches all permission codes assigned to the user's role from the `role_permissions` → `permissions` tables.

4. **require_permission(code)** — factory function that returns a FastAPI dependency. Checks if the user has the specific permission code. Super_admin bypasses this check entirely.

5. **require_role(role_name)** — factory function for role-based checks. Super_admin passes all role checks.

6. **require_super_admin** — enforces the super_admin role specifically.

#### Feature Flags Middleware

Checks if a feature is enabled for the user's organization:
1. Super_admin bypass → always enabled
2. Check organization's subscription status (must be active)
3. Check organization-level overrides first
4. Fall back to plan-level features JSON

#### Quota Middleware

Enforces per-user request limits:
- Reads `request_quota` and `requests_used` from user metadata
- Returns HTTP 429 if quota is exceeded
- Increments the counter on each request

#### Usage Limiter

Enforces monthly token limits:
- Reads from `user_usage_summary` table
- Returns HTTP 429 if monthly token limit exceeded
- Super_admin bypass
- Records consumption after each LLM call

---

### 4.9 Services Layer

| Service | Purpose |
|---------|---------|
| **LLM Service** | Core analysis engine — builds prompts, calls LLM providers, parses JSON responses, handles chunking for large texts, calculates scores |
| **Parser Service** | Extracts text from PDF (pdfminer) and DOCX (python-docx) files. Preserves structure for DOCX (headings, tables, images). Returns both structured elements and full text |
| **Q&A Service** | Grounded question-answering with zero-hallucination enforcement. Scoped to document or individual module |
| **Module Detector** | Deterministic (no LLM) document splitting into functional modules. Uses heading styles for DOCX, regex patterns for PDF |
| **Batch Service** | Manages batch analysis jobs — creation, concurrent/sequential execution, OpenAI Batch API integration, status tracking |
| **Cache Service** | SHA-256 content-hash caching for analysis results. Tracks hit counts, tokens saved, cost saved |
| **Token Service** | LLM token usage tracking, cost calculation with configurable pricing, usage aggregation for reporting |
| **Email Service** | SMTP-based transactional emails with dark-themed HTML templates for: welcome, password change, usage warnings, feedback replies, broadcasts, admin messages |
| **Encryption Service** | Fernet symmetric encryption for BYOK API keys. Uses SHA-256 of an environment variable as the encryption key |
| **Audit Service** | Simple audit trail — records who did what to which entity with details |
| **Notification Service** | Creates notification records. Supports targeted notifications (all users, by org, by role, by location) |

---

## 5. Frontend — React SPA

### 5.1 Build & Configuration

The frontend is a React 18 single-page application built with Vite:

- **No CSS-in-JS library** — all styling uses inline React styles and CSS custom properties
- **No state management library** — uses React Context for global state
- **No UI component library** — all components are custom-built
- **Fonts** — Inter (body text) + JetBrains Mono (code blocks)
- **Vite proxy** — in development, `/api/*` requests are proxied to the backend URL, bypassing CORS entirely

Configuration is layered:
- `env.js` — reads `VITE_API_URL` from environment
- `app.js` — app-wide constants (name, tagline, URLs, branding)
- `routes.js` — all route path constants
- `theme.js` — design token definitions (colors, fonts, spacing, shadows)
- `version.js` — version, codename, release date (injected by Vite from `version.json`)

---

### 5.2 App Shell & Routing

The app has two layout modes:

**Auth layout** — just the login/signup page, no sidebar or header.

**Main layout** — sidebar + header + content area, used for all authenticated routes.

**Route protection** works in two layers:
1. **ProtectedRoute** — checks if the user is authenticated (has a valid token). If not, redirects to `/auth`.
2. **PermissionRoute** — checks if the user has a specific permission code. If not, shows a "Feature Locked" page with a lock icon.

**Provider hierarchy** (wraps the entire app):
```
BrowserRouter
  → AuthProvider (JWT state, login/logout)
    → PermissionProvider (RBAC, menu items)
      → NotificationProvider (unread count polling)
        → ThemeProvider (accent colors)
          → LanguageProvider (i18n)
            → AppLayout (Sidebar + Header + Routes)
```

**Mobile responsiveness:**
- At ≤768px, the sidebar becomes a slide-in overlay triggered by a hamburger button
- Tables become horizontally scrollable
- Detail panels become full-screen overlays

---

### 5.3 Context Providers (Global State)

#### AuthContext
**State:** `user` (object), `token` (string), `loading` (boolean), `authChecked` (boolean)

**What it does:**
- Stores JWT tokens and user info in `localStorage`
- On mount, validates the stored token by calling `GET /auth/me`
- If the token is expired, attempts a refresh using the stored refresh token
- Schedules automatic token refresh every 50 minutes
- Provides `login`, `signup`, `logout`, `updateUser`, and `refreshQuota` functions

#### PermissionContext
**State:** `profile`, `permissions` (array of code strings), `role`, `organization`, `loading`

**What it does:**
- On authentication, fetches `GET /auth/me/profile` to get the user's RBAC profile
- Extracts role name and organization details
- Provides `hasPermission(code)` and `hasRole(roleName)` helper functions
- Super_admin always returns `true` for all permission checks
- **Builds the sidebar menu** — each menu item has `show` (visible?) and `enabled` (clickable?) flags based on the user's permissions
- Computes convenience flags: `isSuperAdmin`, `isOrgAdmin`, `isAdmin`
- Provides a `routePermissionMap` that maps URL paths to required permission codes

#### NotificationContext
**State:** `unreadCount`, `notifications` (array), `loading`

**What it does:**
- Polls `GET /notifications/unread-count` every 30 seconds
- Provides functions to fetch notifications, mark as read, mark all as read
- The unread count drives the bell badge in the header

#### ThemeContext
**State:** `accent` (hex color string)

**What it does:**
- Provides 8 accent color choices: blue, purple, emerald, amber, rose, cyan, orange, pink
- Persists the selected color in `localStorage`
- Syncs theme color from the user's profile (stored on the backend)
- Sets CSS custom properties on the document root for global theming

---

### 5.4 API Client

All API communication goes through a centralized `api` object in `hooks/api.js`.

**How it works:**
1. Every request adds an `Authorization: Bearer <token>` header automatically
2. If any request returns HTTP 401:
   - Attempts to refresh the token using the stored refresh token
   - If refresh succeeds, retries the original request with the new token
   - If refresh fails, clears all stored data and redirects to `/auth`
3. The base URL comes from `VITE_API_URL` (set to `/api` in development for proxy, or the full backend URL in production)

**Total API surface:** ~80+ functions covering auth, documents, analysis, Q&A, feedback, notifications, AI settings, plans, usage, and all admin operations.

---

### 5.5 User-Facing Pages

#### Upload Page (`/`)
The landing page for authenticated users. Features a drag-and-drop zone (powered by react-dropzone) that accepts PDF and DOCX files up to 20 MB. Users can optionally provide "Architecture Standards" text that will be injected into the analysis prompt. After upload, the user is redirected to the analysis page for the new document.

Three info cards explain the platform's value: Smart Detection (automatic module splitting), Detailed Analysis (LLM-powered blueprints), Privacy First (data handling).

#### Documents Page (`/documents`)
Displays all uploaded documents in a grid layout with:
- Stats bar showing total count, PDF count, DOCX count
- Document cards with file type icon, name, upload date, and module count
- Delete action with confirmation modal
- Click to navigate to the analysis page
- Empty state prompting upload

#### Analysis Page (`/documents/:id`) — The Core Experience
This is the most complex page (~1,177 lines). It displays:

**Left sidebar:** Vertical module list (horizontal scroll on mobile). Clicking a module loads its analysis instantly from a client-side cache.

**Six tabs:**

1. **📊 Analysis** — Split-view showing:
   - Left: "Documented Facts" — summary, business goal, business flow, functional rules, user actions, system behaviors, scope boundaries. Rendered as Markdown.
   - Right: "Developer Gap Analysis" — missing specs, ambiguous requirements, developer recommendations, risk flags. Rendered as Markdown.
   - A "Run Analysis" / "Re-Analyse" button at the top

2. **🔤 Fields** — Extracted data fields displayed in a section-grouped table:
   - Each field shows: label, type (color-coded badge), required status, description
   - Type filter chips to show only specific field types (15+ types: string, integer, boolean, date, enum, uuid, email, phone, url, etc.)
   - Click a field row to see its full details in a side panel (desktop) or overlay (mobile)

3. **🔌 API Schema** — REST API design generated from the module:
   - Tabs for each HTTP method (GET/POST/PUT/DELETE) with method-specific color coding
   - Editable JSON with save-to-server functionality
   - Download as JSON file

4. **🔗 Connectivity** — Cross-module dependency visualization:
   - Overview sub-tab: stats cards + module dependency list
   - Connections sub-tab: from→to module connections with strength and relationship type
   - Shared Fields sub-tab: fields that appear in multiple modules
   - "Deep LLM Analysis" button for comprehensive cross-module analysis

5. **🕰 History** — Analysis version history table:
   - Date, version number, confidence score, accuracy score, field count, gap count
   - Restore button to revert to any previous analysis

6. **💬 Chat** — Q&A interface:
   - Toggle between document-wide and module-scoped questions
   - Chat-style UI with user messages and AI responses
   - AI responses rendered as Markdown with source badges (✓ sourced / ⚠ not in document)
   - Auto-scroll to latest message

A **collapsible Q&A panel** also appears at the bottom of the Analysis, Fields, and API tabs for quick questions without switching tabs.

#### Dashboard (`/dashboard`) — Permission: `view_dashboard`
Overview page showing:
- Stat cards: document count, tokens used, token limit, unread notifications
- Monthly usage progress bar with percentage and color coding (green → amber → red)
- Quick-action buttons: Upload, AI Settings, Feedback, Plans
- Recent notifications with mark-as-read functionality

#### AI Settings (`/ai-settings`) — Permission: `change_model`
BYOK key management interface:
- List of saved API keys showing provider, model, masked key, validation status
- Add new key: select provider (OpenAI/Gemini/Anthropic/Azure OpenAI), enter model name, API key, optional base URL (for Azure)
- Validate key (makes a test call to the provider)
- Delete key with confirmation

#### Feedback (`/feedback`) — Permission: `submit_feedback`
- Submit feedback form: title, description, category dropdown, priority dropdown
- List of user's own submitted feedback with status badges (open/in_review/resolved/closed)
- Click to view detail with admin reply thread

#### Plans (`/plans`) — Permission: `view_plans`
- Grid of plan cards showing: name, monthly price, token limit, max users
- Feature checklist with ✅/❌ indicators
- Current plan highlighted
- "Choose Plan" button

#### Usage (`/usage`) — Permission: `view_my_usage`
- Circular progress indicator showing usage percentage
- Horizontal progress bar
- Stats: tokens used, tokens remaining, monthly limit
- Status badge and near-limit warning alert

---

### 5.6 Admin Pages

All admin pages are hidden from the sidebar if the user lacks the required permission.

#### Admin Users (`/admin/users`)
- Searchable user list with expandable rows
- Each row shows: avatar, display name, email, role badge (color-coded), organization, active status, quota progress bar
- Actions: edit role/location/active status, adjust quota, send message, delete
- Role dropdown populated from the backend's role list

#### Admin Organizations (`/admin/organizations`)
- Organization list with plan name and subscription status
- Create new organization: name, plan selection, subscription status
- Delete with confirmation

#### Admin Permissions (`/admin/permissions`) — **Super Admin Only**
- Matrix table: roles as columns × permissions as rows
- Toggle edit mode to flip individual permission toggles
- Legend explaining all permission codes
- Save button to persist changes per role

#### Admin Features (`/admin/features`)
- Per-plan feature grids (toggle switches)
- Organization-level override management (add/remove)

#### Admin Usage (`/admin/usage`)
- Summary cards: total users, total tokens, near-limit users, over-limit users
- Per-user usage table with progress bars and sorting

#### Admin Audit (`/admin/audit`)
- Filterable audit log table: timestamp, actor email, action type, entity type, details (JSON)
- Filter by action type dropdown
- Pagination

#### Admin Broadcasts (`/admin/broadcasts`)
- Create form: title, content, target type (all/organization/role/location), priority
- List of sent broadcasts with delete option

#### Admin Batch (`/admin/batch`) — 4 sub-tabs
- **Jobs** — create batch job for a document, view job list, execute (concurrent/sequential), submit to OpenAI Batch API, poll status, cancel
- **Cache** — cache statistics (entries, hit count, tokens saved, cost saved), clear-all button
- **Token Usage** — period selector (7/30/90 days), daily breakdown table
- **Cost Settings** — per-model pricing editor

#### Admin Plans (`/admin/plans`)
- Create plan form: name, price, token limit, max users, feature toggles
- List of existing plans with edit capability

#### Admin Feedback (`/admin/feedback`)
- All feedback list with status and priority filters
- Detail view with status change buttons (open → in_review → resolved → closed)
- Reply form for admin responses

---

### 5.7 Shared Components

#### Header
Sticky top bar containing:
- Logo and tagline (desktop only)
- Navigation links: Upload, Documents
- Language switcher dropdown (4 languages)
- Role badge (color-coded: super_admin = red/gold, org_admin = purple, developer = blue, viewer = gray)
- Request quota progress pill showing `used/limit` with a lightning bolt icon and a mini progress bar with color thresholds: **green** (<70%), **yellow** (70-90%), **red** (≥90%)
- Notification bell icon (unread count badge driven by NotificationContext)
- Avatar button opening a dropdown menu: Profile, Change Password, Theme, Logout

#### Sidebar
Dynamic navigation built from the PermissionContext's `menuItems` array:
- Collapsible (230px ↔ 60px wide)
- User section: Upload, Documents, Dashboard, AI Settings, Feedback, Plans, My Usage
- Admin divider (only shown if user has `admin_panel` permission)
- Admin section: Users, Organizations, Feedback, Broadcasts, Features, Usage, Audit, Plans, Batch, Email, Permissions
- Disabled items show a 🔒 icon and are non-clickable
- Active item highlighted with the theme accent color
- The **Dashboard** menu item displays the notification unread count badge (red circle with number)
- Bottom section: role indicator + app version

#### Profile Modal
Three-tab modal accessible from the header dropdown:
- **Profile tab** — edit display name, upload avatar (≤500KB), bio, phone, GitHub URL, LinkedIn URL
- **Password tab** — change password (requires current password)
- **Theme tab** — grid of 8 accent color choices

#### Confirm Modal
Reusable confirmation dialog used for destructive actions (delete document, delete user, etc.). Supports danger and normal styling modes.

---

### 5.8 Internationalization (i18n)

Archon supports 4 languages:
- 🇬🇧 **English** (default)
- 🇮🇳 **Tamil** (தமிழ்)
- 🇮🇳 **Hindi** (हिन्दी)
- 🇫🇷 **French** (Français)

The i18n system uses a custom `t()` function with dot-path resolution (e.g., `t('analysis.tabs.fields')`). If a key is missing in the selected language, it falls back to English automatically.

Language selection is persisted in `localStorage` under the `archon_language` key. The language switcher appears both on the login page and in the header.

Translation covers: sidebar labels, page titles, form labels, button text, status messages, analysis section headers, and error messages.

---

### 5.9 Theming

The theme system provides 8 accent colors that can be selected by each user:
- Blue (#3b82f6), Purple (#8b5cf6), Emerald (#10b981), Amber (#f59e0b)
- Rose (#f43f5e), Cyan (#06b6d4), Orange (#f97316), Pink (#ec4899)

The selected color is:
- Stored in `localStorage` for immediate access
- Synced to the user's profile on the backend (`theme_color` field)
- Applied as CSS custom properties on the document root (`--accent`, `--accent-10`, `--accent-20`, etc.)
- Used throughout all inline styles for borders, backgrounds, highlights, and interactive elements

---

### 5.10 Styling Approach

The frontend uses a pure inline-styles approach:
- **No CSS-in-JS library** (no styled-components, emotion, etc.)
- **No utility framework** (no Tailwind)
- **CSS custom properties** defined in `globals.css` for colors, fonts, and spacing
- **Inline `style` objects** in every component for layout and appearance
- **A single `globals.css`** file for: font imports, CSS variable definitions, base resets, markdown output styling, animations (fadeIn, spin, pulse), spinner class, and responsive breakpoints
- **Responsive design** via JavaScript (`useIsMobile` hook at 768px breakpoint) and CSS media queries for fine-grained adjustments

---

## 6. Database — Supabase PostgreSQL

### 6.1 Core Document Tables

#### `documents`
Stores uploaded documents with their extracted raw text.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Unique document identifier |
| user_id | uuid (FK → auth.users) | Who uploaded it |
| file_name | text | Original filename |
| file_type | text | 'pdf' or 'docx' |
| raw_text | text | Full extracted text content |
| standards_text | text | Optional architecture standards injected into analysis |
| deleted_at | timestamptz | Soft-delete timestamp (null = active) |
| created_at | timestamptz | Upload timestamp |

RLS enabled — users can only access their own documents.

#### `modules`
Stores detected sections/modules within a document.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Unique module identifier |
| document_id | uuid (FK → documents) | Parent document |
| title | text | Module/section name |
| content | text | Module's text content |
| order | integer | Display order |

RLS enabled — access controlled through parent document ownership.

#### `analyses`
Stores LLM-generated blueprint analysis results with versioning.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Unique analysis identifier |
| module_id | uuid (FK → modules) | Which module was analysed |
| output_md | text | Legacy markdown output |
| output_json | jsonb | Structured blueprint JSON |
| confidence_score | integer | 0-100 confidence in analysis quality |
| accuracy_level | integer | 0-100 accuracy based on field quality and gaps |
| version | integer | Increments with each re-analysis |
| created_at | timestamptz | When the analysis was performed |

RLS enabled — access controlled through modules → documents → user ownership chain.

---

### 6.2 RBAC & Multi-Tenancy Tables

#### `plans`
Subscription plans that organizations can subscribe to.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Plan identifier |
| name | text (unique) | Plan name (Free, Basic, Pro, Enterprise) |
| description | text | Marketing description |
| price_monthly | numeric | Monthly price in USD |
| token_limit | bigint | Monthly token allowance |
| max_users | integer | Maximum users per organization |
| features | jsonb | Feature flag object for this plan |
| is_active | boolean | Whether the plan is available for selection |

Default plans: Free (0, 500K tokens), Basic ($499, 1M), Pro ($999, 3M), Enterprise (custom).

#### `organizations`
Multi-tenant organizations that group users together.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Organization identifier |
| name | text | Organization name |
| plan_id | uuid (FK → plans) | Subscribed plan |
| subscription_status | text | active/trialing/past_due/canceled/unpaid |
| seats | integer | Maximum members |
| created_at / updated_at | timestamptz | Timestamps |

#### `roles`
System roles for RBAC.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Role identifier |
| name | text (unique) | Role key (super_admin, org_admin, developer, viewer) |
| description | text | Human-readable description |

Four predefined roles: super_admin (full access), org_admin (org management), developer (standard), viewer (read-only).

#### `permissions`
Granular permission codes.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Permission identifier |
| code | text (unique) | Machine-readable code (e.g., 'manage_users') |
| description | text | Human-readable description |

32 permission codes covering: document operations, analysis, admin functions, dashboard access, feedback, plans, and more.

#### `role_permissions`
Many-to-many mapping of which roles have which permissions.

| Column | Type | Purpose |
|--------|------|---------|
| role_id | uuid (FK → roles) | Role |
| permission_id | uuid (FK → permissions) | Permission |
| (composite PK) | | (role_id, permission_id) |

Super_admin gets ALL permissions. Each other role gets a curated subset.

#### `user_profiles`
Extended user information beyond Supabase Auth.

| Column | Type | Purpose |
|--------|------|---------|
| user_id | uuid (PK, FK → auth.users) | User identifier (also the PK) |
| organization_id | uuid (FK → organizations) | Which org the user belongs to |
| role_id | uuid (FK → roles) | User's role |
| is_active | boolean | Account active status |
| location_country / location_city | text | For broadcast targeting |
| avatar_url | text | Base64 avatar image |
| request_quota | integer | Per-user request limit (default 20) |
| requests_used | integer | Current usage count |
| created_at / updated_at | timestamptz | Timestamps |

---

### 6.3 Feature & Communication Tables

#### `organization_features`
Per-organization feature flag overrides (takes precedence over plan features).

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Override identifier |
| organization_id | uuid (FK → organizations) | Target organization |
| feature_name | text | Feature key name |
| enabled | boolean | Whether it's enabled |
| (unique constraint) | | (organization_id, feature_name) |

#### `notifications`
In-app notification records.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Notification identifier |
| user_id | uuid (FK → auth.users) | Recipient |
| title / message | text | Notification content |
| type | text | info/success/warning/error |
| is_read | boolean | Read status |
| created_at | timestamptz | When created |

Indexed on `(user_id, is_read, created_at DESC)` for efficient unread count queries.

#### `feedback` + `feedback_replies`
User feedback with threaded admin responses.

**feedback:** id, submitted_by, organization_id, title, description, category, priority, status, created_at
**feedback_replies:** id, feedback_id (FK), replied_by, content, created_at

#### `broadcast_messages`
Admin broadcast messages targeting specific audiences.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Broadcast identifier |
| title / content | text | Message content |
| target_type | text | all/organization/role/location |
| target_value | text | Specific target (e.g., org ID, role name, country) |
| priority | text | normal/important/urgent |
| sent_by | uuid | Admin who sent it |

#### `audit_logs`
System audit trail for admin actions.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Log entry identifier |
| actor_id | uuid (FK → auth.users) | Who performed the action |
| action | text | Action type (update_user, delete_org, etc.) |
| entity_type | text | Target entity type (user_profiles, organizations, etc.) |
| entity_id | text | Target entity ID |
| details | jsonb | Additional context (what changed) |
| created_at | timestamptz | When the action occurred |

#### `ai_settings`
BYOK API key storage (per user).

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Settings identifier |
| user_id | uuid (FK → auth.users) | Key owner |
| provider | text | openai/google/anthropic/azure_openai |
| encrypted_api_key | text | Fernet-encrypted API key |
| model_preference | text | Preferred model name |
| base_url | text | Custom endpoint (for Azure OpenAI) |
| is_valid | boolean | Whether the key passed validation |

---

### 6.4 Batch Processing & Cost Tables

#### `analysis_cache`
Content-hash based cache to avoid redundant LLM calls.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Cache entry identifier |
| content_hash | text (unique) | SHA-256 of the module content |
| provider / model | text | Which LLM generated this |
| blueprint | jsonb | The cached analysis result |
| input_tokens / output_tokens | integer | Token counts |
| total_cost_usd | numeric | What it cost to generate |
| hit_count | integer | How many times this cache entry was reused |
| last_hit_at | timestamptz | Last access time |

#### `token_usage_logs`
Per-request LLM token usage tracking.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Log entry identifier |
| user_id / organization_id | uuid | Who/which org |
| request_type | text | analysis/qa/connectivity/batch |
| provider / model | text | Which LLM |
| input_tokens / output_tokens / total_tokens | integer | Token breakdown |
| cost_usd | numeric | Calculated cost |
| cache_hit | boolean | Whether this was served from cache |
| module_id / document_id / batch_job_id | uuid | Context references |
| created_at | timestamptz | When the call was made |

#### `batch_jobs` + `batch_job_items`
Batch processing job tracking.

**batch_jobs:** id, user_id, document_id, status (pending/running/completed/failed/cancelled), total/completed/failed/cached modules, total tokens and cost, OpenAI batch ID (for Batch API mode), timestamps.

**batch_job_items:** id, batch_job_id (FK), module_id, status, tokens, cost, cache_hit, error_message, timestamps.

#### `cost_settings`
Admin-configurable LLM pricing.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Settings identifier |
| provider / model | text (unique together) | Which model |
| input_cost_per_1m | numeric | Cost per 1M input tokens |
| output_cost_per_1m | numeric | Cost per 1M output tokens |
| batch_discount_pct | integer | Discount percentage for batch API (default 50%) |

Default prices seeded for: gpt-4o-mini, gpt-4o, gpt-4-turbo, gemini-1.5-pro, gemini-1.5-flash, llama3.

#### `user_usage_summary`
Aggregated monthly token usage per user.

| Column | Type | Purpose |
|--------|------|---------|
| user_id | uuid (PK) | User identifier |
| monthly_limit | bigint | Token limit for the month |
| tokens_used | bigint | Tokens consumed so far |
| remaining_tokens | bigint | Tokens remaining |
| reset_date | timestamptz | When the counter resets (first of next month) |

---

### 6.5 Entity-Relationship Map

```
auth.users (Supabase built-in)
  │
  ├──< documents ──< modules ──< analyses
  │       │
  │       └──< usage_logs
  │
  ├──< user_profiles ──> roles ──< role_permissions ──> permissions
  │       │
  │       └──> organizations ──> plans
  │               │
  │               ├──< organization_features
  │               └──< user_groups ──< group_users
  │
  ├──< notifications
  ├──< feedback ──< feedback_replies
  ├──< ai_settings
  ├──< audit_logs
  ├──< broadcast_messages
  ├──< token_usage_logs
  └──< user_usage_summary

batch_jobs ──< batch_job_items
analysis_cache (standalone)
cost_settings (standalone)
```

---

### 6.6 Permission System

The system has 32 permission codes organized into functional areas:

| Area | Codes | Purpose |
|------|-------|---------|
| **Document Operations** | upload_doc, view_analysis, run_analysis, edit_gaps, export_blueprint | Core document pipeline access |
| **Admin Functions** | manage_users, manage_org, manage_plans, manage_features, manage_feedback, manage_batch, manage_email | Admin panel sections |
| **View Permissions** | view_usage, view_feedback, view_audit_log, view_dashboard, view_plans, view_my_usage | Read-only access to data |
| **User Actions** | change_model, submit_feedback, send_broadcast, admin_panel | Specific actions |
| **Legacy Codes** | documents:read/write/delete, analysis:read/write, qa:read, admin:*, settings:ai | v4-era codes (still in DB) |

**Default role assignments:**
- **super_admin** — ALL permissions (also bypasses checks at middleware level)
- **org_admin** — all admin + view permissions except manage_plans
- **developer** — upload_doc, view_analysis, run_analysis (Dashboard, Feedback, Plans, Usage disabled by default)
- **viewer** — view_analysis only

---

### 6.7 Migration History

| Version | File | What It Added |
|---------|------|---------------|
| v1 | migrations.sql | Core tables: documents, modules, analyses. RLS policies |
| v2 | migration_v2.sql | `standards_text` column on documents (architecture context) |
| v3 | migration_v3.sql | Analysis versioning: confidence_score, accuracy_level, version |
| v4 | migration_v4.sql | Soft-delete: `deleted_at` on documents |
| v4-saas | migration_v4_saas.sql | Full SaaS: plans, organizations, roles, permissions, user_profiles, notifications, feedback, ai_settings, usage_logs, audit_logs |
| v5 | migration_v5_fixed.sql | Refined RBAC: new permission codes, user_groups, organization_features, broadcast_messages, feedback_replies, user_usage_summary table |
| v6 | migration_v6_batch.sql | Batch processing: analysis_cache, token_usage_logs, batch_jobs, batch_job_items, cost_settings |
| v7 | migration_v7_permissions.sql | New permissions: manage_batch, manage_email |
| v8 | migration_v8_user_menu_permissions.sql | User menu gates: view_dashboard, submit_feedback, view_plans, view_my_usage |
| v9 | migration_v9_request_quota.sql | Request quota: request_quota and requests_used on user_profiles |
| fix | fix_superadmin.sql | FK repair, avatar_url column, super_admin assignment |

---

## 7. Data Flow — End to End

### Upload → Analysis → Q&A (Happy Path)

```
User drops PDF/DOCX on Upload Page
  │
  ▼
POST /upload
  │ ① Validate file type and size
  │ ② Extract text (pdfminer for PDF, python-docx for DOCX)
  │ ③ Detect modules (heading-based for DOCX, regex for PDF)
  │    └── If NO headings or patterns found → entire doc becomes
  │        one module titled "Full Document"
  │ ④ Insert document + modules into Supabase
  │
  ▼
Frontend redirects to /documents/:id (Analysis Page)
  │
  ▼
GET /documents/:id/modules → lists all modules
  │
  ▼
User clicks "Run Analysis" on a module
  │
  ▼
POST /modules/:id/analyse
  │ ① Check analysis_cache (SHA-256 of content)
  │   ├── Cache HIT → return cached blueprint (no LLM call)
  │   └── Cache MISS → continue
  │ ② Build system prompt + module text
  │ ③ If text > 10K chars → split into overlapping chunks
  │ ④ Call LLM (OpenAI/Gemini/Ollama)
  │ ⑤ Parse JSON response
  │ ⑥ Calculate confidence + accuracy scores
  │ ⑦ Log token usage + cost
  │ ⑧ Cache the result
  │ ⑨ Store in analyses table (new version)
  │
  ▼
Frontend displays blueprint in 6 tabs
  │
  ▼
User asks a question in the Chat tab
  │
  ▼
POST /documents/:id/ask  (or /modules/:id/ask)
  │ ① Build Q&A prompt with document/module text as context
  │ ② Call LLM with zero-hallucination instructions
  │ ③ Return answer with sourced flag + confidence
  │ ④ Log token usage + decrement quota
```

### Authentication Flow

```
User enters email + password on Auth Page
  │
  ▼
POST /auth/login
  │ ① Supabase Auth: sign_in_with_password
  │ ② Return access_token, refresh_token, user metadata
  │
  ▼
Frontend stores tokens in localStorage
  │
  ▼
AuthContext calls GET /auth/me to validate
  │
  ▼
PermissionContext calls GET /auth/me/profile
  │ ① Fetch user_profiles + role + org
  │ ② Fetch permission codes from role_permissions
  │ ③ Build menu items based on permissions
  │
  ▼
App renders with permission-gated routes + sidebar
  │
  ▼
Every 50 minutes: POST /auth/refresh
  │ ① Exchange refresh_token for new token pair
  │ ② Update localStorage
```

### Admin Broadcast Flow

```
Admin creates a broadcast on Admin Broadcasts Page
  │
  ▼
POST /admin/broadcasts
  │ ① Insert broadcast_messages record
  │ ② Query target users based on target_type:
  │   - all → all active users
  │   - organization → users in specific org
  │   - role → users with specific role
  │   - location → users in specific country
  │ ③ Create notification for each targeted user
  │ ④ Send email to each user (background threads)
  │ ⑤ Log audit entry
```

---

## 8. Security Model

### Authentication
- **JWT-based** via Supabase Auth
- Access tokens are short-lived; refresh tokens handle renewal
- Tokens stored in `localStorage` (not cookies) — the app is an SPA, not SSR
- All API requests include `Authorization: Bearer <token>` header

### Authorization
- **RBAC with granular permissions** — not just role checks but specific permission codes
- **super_admin bypasses ALL checks** at the middleware level
- Profile auto-creation uses `INSERT` (not `UPSERT`) to prevent role downgrade attacks
- Admin actions require specific permission codes, not just "is admin"

### Data Isolation
- Documents are scoped to the user who uploaded them (enforced by queries filtering on user_id)
- Org admins can only see users within their organization
- The backend uses the Supabase **service role key** (bypasses RLS) — authorization is enforced in FastAPI middleware, not at the DB level

### API Key Security
- BYOK keys are encrypted with **Fernet symmetric encryption** before storage
- The encryption key is derived from an environment variable using SHA-256
- Keys are displayed masked in the UI (e.g., `sk-****...xYz`)

### CORS
- Allowed origins configured via the `ALLOWED_ORIGINS` environment variable
- In development, Vite's proxy is used to bypass CORS entirely

### Input Validation
- File upload: type validation (PDF/DOCX only) + size validation (20 MB max)
- Request bodies validated via Pydantic models
- SQL injection prevented by using Supabase client (parameterized queries)

---

## 9. Cost Control Mechanisms

Archon implements multiple layers of cost control to manage LLM expenses:

### 1. Content-Hash Caching
- Every module's content is hashed with SHA-256
- If the same content has been analysed before (even by a different user), the cached result is returned instantly
- Cache tracks: hit count, tokens saved, cost saved
- Admins can view cache statistics and clear cache when needed

### 2. Per-User Request Quotas
- Each user has a configurable `request_quota` (default: 20 requests)
- Every LLM-consuming action (analysis, Q&A) decrements the quota
- Returns HTTP 429 when quota is exhausted
- Admins can adjust individual user quotas

### 3. Monthly Token Limits
- Each user has a monthly token allowance (from `user_usage_summary`)
- Checked before every LLM call
- Resets on the first of each month
- Super_admin bypasses this limit

### 4. OpenAI Batch API
- Batch jobs can be submitted to OpenAI's Batch API for a 50% cost discount
- Asynchronous processing (submit, then poll for results)
- Best for large documents with many modules

### 5. Admin Cost Visibility
- Token usage logged per-request with full metadata
- Daily cost summaries
- Per-model cost configuration
- Cache savings reporting (tokens saved × cost per token)

### 6. Model Selection
- Default model (gpt-4o-mini) is the most cost-effective
- Users with BYOK keys use their own quota
- Ollama support enables free local processing for development

---

## 10. Deployment

### Render Configuration

The project is deployed on Render using `render.yaml`:

**Backend (Web Service):**
- Runtime: Python
- Root directory: `backend/`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Plan: Free
- Environment variables (configured manually in Render dashboard, marked `sync: false` in render.yaml):
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
  - `OPENAI_API_KEY`, `LLM_PROVIDER`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`
  - `FRONTEND_URL`, `ALLOWED_ORIGINS`

**Frontend (Static Site):**
- Build: `cd frontend && npm install && npm run build`
- Publish: `frontend/dist/`
- SPA routing: all paths rewrite to `index.html`
- Environment: `VITE_API_URL` points to the backend URL

### URLs
- **Frontend:** `https://archon-frontend-bukh.onrender.com`
- **Backend API:** `https://archon-backend-wvml.onrender.com`
- **API Documentation:** `https://archon-backend-wvml.onrender.com/docs` (Swagger UI)

### Local Development
1. Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
2. Frontend: `cd frontend && npm install && npm run dev`
3. The frontend Vite config proxies `/api/*` to the backend, avoiding CORS issues in development

---

> **Note:** The project's `README.md` contains an older API reference table that is partially stale (e.g., references endpoints like `GET /health` that don't exist in the current codebase, and omits newer admin, notification, feedback, batch, and Q&A endpoints). This `DOCUMENTATION.md` file supersedes the README as the authoritative project reference.

*This documentation covers the complete Archon platform as of version 3.0.0. For code-level details, refer to the inline comments in each source file and the AI skill contract in `skill/skill.md`.*
