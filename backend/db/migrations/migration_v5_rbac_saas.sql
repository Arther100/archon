-- Migration v5: Multi-Tenant SaaS with RBAC, Feature Flags, Feedback, Notifications, BYOK, Usage, Plans
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════
-- 1. PLANS
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    price_monthly NUMERIC(10,2) DEFAULT 0,
    token_limit BIGINT DEFAULT 1000000,
    max_users INT DEFAULT 3,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default plans
INSERT INTO plans (name, price_monthly, token_limit, max_users, features) VALUES
('Free',       0,    500000,  2,  '{"analysis_enabled":true,"api_blueprint_enabled":true,"graph_enabled":false,"export_enabled":false,"team_management_enabled":false,"ai_settings_enabled":false}'),
('Basic',      499,  1000000, 3,  '{"analysis_enabled":true,"api_blueprint_enabled":true,"graph_enabled":false,"export_enabled":true,"team_management_enabled":false,"ai_settings_enabled":true}'),
('Pro',        999,  3000000, 10, '{"analysis_enabled":true,"api_blueprint_enabled":true,"graph_enabled":true,"export_enabled":true,"team_management_enabled":true,"ai_settings_enabled":true}'),
('Enterprise', 0,    0,       0,  '{"analysis_enabled":true,"api_blueprint_enabled":true,"graph_enabled":true,"export_enabled":true,"team_management_enabled":true,"ai_settings_enabled":true}')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- 2. ORGANIZATIONS
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan_id UUID REFERENCES plans(id),
    subscription_status TEXT DEFAULT 'active',       -- active | pending_payment | expired | suspended
    subscription_expires_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 3. ROLES
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO roles (name, description, is_system) VALUES
('super_admin', 'Platform owner — full system access', TRUE),
('org_admin',   'Organization admin — manages org users & settings', TRUE),
('developer',   'Upload, analyze, edit, export', TRUE),
('viewer',      'View-only access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- 4. PERMISSIONS
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO permissions (code, description) VALUES
('upload_doc',       'Upload documents'),
('view_analysis',    'View analysis results'),
('run_analysis',     'Run/re-run analysis'),
('edit_gaps',        'Edit gap analysis'),
('export_blueprint', 'Export blueprint/API schema'),
('manage_users',     'Manage organization users'),
('manage_org',       'Manage organization settings'),
('change_model',     'Change AI model/key settings'),
('view_usage',       'View usage statistics'),
('manage_plans',     'Manage subscription plans'),
('manage_features',  'Toggle feature flags globally'),
('view_feedback',    'View feedback submissions'),
('manage_feedback',  'Respond to / manage feedback'),
('send_broadcast',   'Send broadcast messages'),
('view_audit',       'View audit logs'),
('admin_panel',      'Access admin panel')
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- 5. ROLE → PERMISSION MAPPING
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Super admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Org admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'org_admin' AND p.code IN ('upload_doc','view_analysis','run_analysis','edit_gaps','export_blueprint','manage_users','change_model','view_usage','view_feedback','manage_feedback')
ON CONFLICT DO NOTHING;

-- Developer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'developer' AND p.code IN ('upload_doc','view_analysis','run_analysis','edit_gaps','export_blueprint')
ON CONFLICT DO NOTHING;

-- Viewer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.code IN ('view_analysis')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- 6. USER PROFILES (extends Supabase auth.users)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY,               -- matches auth.users.id
    organization_id UUID REFERENCES organizations(id),
    role_id UUID REFERENCES roles(id),
    location_country TEXT DEFAULT '',
    location_city TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 7. USER GROUPS (location-based / custom)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_users (
    group_id UUID REFERENCES user_groups(id) ON DELETE CASCADE,
    user_id UUID,
    PRIMARY KEY (group_id, user_id)
);

-- ═══════════════════════════════════════════════════
-- 8. ORGANIZATION FEATURES (per-org overrides)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS organization_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    plan_required TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, feature_name)
);

-- ═══════════════════════════════════════════════════
-- 9. AI SETTINGS (BYOK — per-org API keys)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    provider TEXT NOT NULL DEFAULT 'openai',          -- openai | azure_openai | anthropic | custom
    model_name TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    api_key_encrypted TEXT NOT NULL,
    is_validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 10. FEEDBACK
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'other',           -- bug | feature_request | improvement | performance | other
    priority INT DEFAULT 3,                  -- 1=critical, 2=high, 3=medium, 4=low
    status TEXT DEFAULT 'open',              -- open | in_review | planned | in_progress | resolved | rejected
    related_module TEXT,
    screenshot_url TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 11. NOTIFICATIONS
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID,
    type TEXT NOT NULL,                       -- feedback_reply | system_message | usage_warning | broadcast | plan_update
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    related_entity_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = FALSE;

-- ═══════════════════════════════════════════════════
-- 12. BROADCAST MESSAGES
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    target_type TEXT DEFAULT 'all',           -- all | organization | role | location
    target_value TEXT,                        -- org_id | role_name | country etc.
    priority INT DEFAULT 3,
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 13. USAGE LOGS
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID,
    model_used TEXT,
    tokens_consumed BIGINT DEFAULT 0,
    operation_type TEXT,                      -- structure | deep_analysis | api_gen | qa
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_usage_summary (
    user_id UUID PRIMARY KEY,
    organization_id UUID,
    monthly_limit BIGINT DEFAULT 1000000,
    tokens_used BIGINT DEFAULT 0,
    remaining_tokens BIGINT DEFAULT 1000000,
    reset_date TIMESTAMPTZ DEFAULT (date_trunc('month', now()) + interval '1 month')
);

-- ═══════════════════════════════════════════════════
-- 14. AUDIT LOGS
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id, created_at DESC);
