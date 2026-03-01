-- ============================================================
-- Archon — Super Admin Fix SQL
-- Run ALL of this at once in Supabase SQL Editor
-- Safe to run even if some tables already exist
-- ============================================================

-- ── 1. roles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    description text,
    created_at  timestamptz DEFAULT now()
);

INSERT INTO roles (name, description) VALUES
    ('super_admin', 'Full platform access'),
    ('org_admin',   'Organization administrator'),
    ('developer',   'Standard developer user'),
    ('viewer',      'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- ── 2. organizations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    plan_id             uuid,
    subscription_status text DEFAULT 'active',
    seats               integer DEFAULT 5,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

INSERT INTO organizations (name)
SELECT 'Default Organization'
WHERE NOT EXISTS (SELECT 1 FROM organizations LIMIT 1);

-- ── 3. user_profiles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
    organization_id uuid,
    role_id         uuid,
    is_active       boolean DEFAULT true,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- Add FK to roles (needed for PostgREST embedded join to work)
DO $$ BEGIN
    ALTER TABLE user_profiles
        ADD CONSTRAINT user_profiles_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES roles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add FK to organizations
DO $$ BEGIN
    ALTER TABLE user_profiles
        ADD CONSTRAINT user_profiles_org_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. notifications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    title       text NOT NULL,
    message     text NOT NULL,
    type        text DEFAULT 'info',
    is_read     boolean DEFAULT false,
    action_url  text,
    created_at  timestamptz DEFAULT now()
);

-- ── 5. permissions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        text NOT NULL UNIQUE,
    description text,
    created_at  timestamptz DEFAULT now()
);

INSERT INTO permissions (code, description) VALUES
    ('documents:read',   'View documents'),
    ('documents:write',  'Upload documents'),
    ('documents:delete', 'Delete documents'),
    ('analysis:read',    'View analysis'),
    ('analysis:write',   'Generate analysis'),
    ('qa:read',          'Ask questions'),
    ('admin:users',      'Manage users'),
    ('admin:plans',      'Manage plans'),
    ('admin:orgs',       'Manage organizations'),
    ('admin:audit',      'View audit logs'),
    ('admin:broadcast',  'Send broadcasts'),
    ('settings:ai',      'Configure AI settings')
ON CONFLICT (code) DO NOTHING;

-- ── 6. role_permissions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       uuid REFERENCES roles(id) ON DELETE CASCADE,
    permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Grant ALL permissions to super_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Grant core permissions to org_admin (everything except admin:plans)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'org_admin'
  AND p.code NOT IN ('admin:plans')
ON CONFLICT DO NOTHING;

-- Grant user permissions to developer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'developer'
  AND p.code IN ('documents:read','documents:write','documents:delete','analysis:read','analysis:write','qa:read','settings:ai')
ON CONFLICT DO NOTHING;

-- Grant read-only to viewer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'viewer'
  AND p.code IN ('documents:read','analysis:read','qa:read')
ON CONFLICT DO NOTHING;

-- ── 7. Assign super_admin to owner account ───────────────────────────────────
INSERT INTO user_profiles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
CROSS JOIN roles r
WHERE u.email = 'arvijay605@gmail.com'
  AND r.name = 'super_admin'
ON CONFLICT (user_id) DO UPDATE SET role_id = excluded.role_id;

-- ── 8. Reload PostgREST schema cache ─────────────────────────────────────────
-- This is CRITICAL — without it, PostgREST won't know about the new FKs
-- and embedded joins will fail silently
NOTIFY pgrst, 'reload schema';

-- ── Done ─────────────────────────────────────────────────────────────────────
-- Verify: check that the super_admin profile was set correctly
SELECT u.email, r.name as role
FROM user_profiles up
JOIN auth.users u ON u.id = up.user_id
JOIN roles r ON r.id = up.role_id
WHERE u.email = 'arvijay605@gmail.com';
