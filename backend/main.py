"""
main.py — FastAPI App Entry Point
Archon Backend — SaaS Edition
"""

import json
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Read version from single source of truth ─────────────────────────────────
_version_path = os.path.join(os.path.dirname(__file__), '..', 'version.json')
with open(_version_path) as _vf:
    _version_info = json.load(_vf)
_APP_VERSION = _version_info.get('version', '0.0.0')
_APP_CODENAME = _version_info.get('codename', 'Archon')

# ── Existing routers ─────────────────────────────────────────────────────────
from routers import upload, documents, analysis, qa, dependencies, auth

# ── New SaaS routers ─────────────────────────────────────────────────────────
from routers import feedback, notifications, ai_settings
from routers.admin import organizations as admin_orgs
from routers.admin import users as admin_users
from routers.admin import plans as admin_plans
from routers.admin import features as admin_features
from routers.admin import audit as admin_audit
from routers.admin import usage as admin_usage
from routers.admin import broadcasts as admin_broadcasts
from routers.admin import email as admin_email
from routers.admin import batch as admin_batch

app = FastAPI(
    title=f"{_APP_CODENAME} API",
    description=(
        "Multi-tenant SaaS document analysis platform with RBAC, BYOK, "
        "feedback, notifications, usage monitoring and admin panel."
    ),
    version=_APP_VERSION,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Core Routers ──────────────────────────────────────────────────────────────
app.include_router(upload.router)
app.include_router(documents.router)
app.include_router(analysis.router)
app.include_router(qa.router)
app.include_router(dependencies.router)
app.include_router(auth.router)

# ── SaaS Routers ─────────────────────────────────────────────────────────────
app.include_router(feedback.router)
app.include_router(notifications.router)
app.include_router(ai_settings.router)

# ── Admin Routers (prefixed /admin) ──────────────────────────────────────────
app.include_router(admin_orgs.router,      prefix="/admin")
app.include_router(admin_users.router,     prefix="/admin")
app.include_router(admin_plans.router)       # has /plans prefix, admin endpoints under /plans/admin/*
app.include_router(admin_features.router,  prefix="/admin")
app.include_router(admin_audit.router,     prefix="/admin")
app.include_router(admin_usage.router,     prefix="/admin")
app.include_router(admin_broadcasts.router, prefix="/admin")
app.include_router(admin_email.router, prefix="/admin")
app.include_router(admin_batch.router, prefix="/admin")

# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": f"{_APP_CODENAME} API", "version": _APP_VERSION}
