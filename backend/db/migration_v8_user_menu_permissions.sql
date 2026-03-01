-- ============================================================================
-- Migration V8 — User Menu Permission Gates
-- New users (developer role) only get Upload + Documents enabled.
-- Other user menus are visible but disabled until super admin grants access.
-- Run in Supabase SQL Editor AFTER migration_v7_permissions.sql
-- ============================================================================

-- ── 1. Add new user-facing menu permission codes ─────────────────────────────
INSERT INTO permissions (code, description) VALUES
    ('view_dashboard',   'Access the Dashboard page'),
    ('submit_feedback',  'Access the Feedback page & submit feedback'),
    ('view_plans',       'View subscription plans page'),
    ('view_my_usage',    'View personal usage statistics')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Grant ALL new permissions to super_admin ──────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
  AND p.code IN ('view_dashboard', 'submit_feedback', 'view_plans', 'view_my_usage')
ON CONFLICT DO NOTHING;

-- ── 3. Grant user-facing menu permissions to org_admin ───────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'org_admin'
  AND p.code IN ('view_dashboard', 'submit_feedback', 'view_plans', 'view_my_usage', 'change_model')
ON CONFLICT DO NOTHING;

-- ── 4. Developer & Viewer: NO new permissions (only Upload + Documents) ──────
-- They already have: upload_doc, view_analysis, run_analysis, edit_gaps, export_blueprint
-- Super admin can selectively grant view_dashboard, submit_feedback, etc. via Permissions page

-- ============================================================================
-- RESULT: New user (developer role) menu state:
--   ✅ Upload       — enabled (has upload_doc)
--   ✅ Documents    — enabled (has view_analysis)
--   🔒 Dashboard    — disabled (needs view_dashboard)
--   🔒 AI Settings  — disabled (needs change_model)
--   🔒 Feedback     — disabled (needs submit_feedback)
--   🔒 Plans        — disabled (needs view_plans)
--   🔒 My Usage     — disabled (needs view_my_usage)
--   🔒 Admin items  — hidden (needs admin_panel + specific admin perms)
-- ============================================================================
