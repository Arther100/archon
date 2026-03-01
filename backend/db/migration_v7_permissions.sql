-- ============================================================================
-- Migration V7 — Permission-Controlled Admin Menus
-- Adds missing permission codes + grants them to super_admin
-- Run in Supabase SQL Editor AFTER migration_v6_batch.sql
-- ============================================================================

-- ── 1. Add new permission codes ──────────────────────────────────────────────
INSERT INTO permissions (code, description) VALUES
    ('manage_batch',   'Manage batch processing, cache & cost settings'),
    ('manage_email',   'Manage email configuration & send emails')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Grant new permissions to super_admin ──────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
  AND p.code IN ('manage_batch', 'manage_email')
ON CONFLICT DO NOTHING;

-- ── 3. Ensure org_admin has common admin permissions ─────────────────────────
-- (they already have manage_users, view_usage, manage_feedback from v5)
-- Optionally grant them view_audit_log and manage_batch for delegated admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'org_admin'
  AND p.code IN ('view_audit_log', 'admin_panel', 'manage_org')
ON CONFLICT DO NOTHING;
