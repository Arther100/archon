-- migration_v13_fix_usage_view.sql
-- Fix user_usage_summary view to aggregate from token_usage_logs (actual data source)
-- instead of the unused usage_logs table.

DROP VIEW IF EXISTS user_usage_summary CASCADE;

CREATE OR REPLACE VIEW user_usage_summary AS
SELECT
    up.user_id,
    u.email,
    up.role_id,
    r.name                                  AS role_name,
    up.organization_id,
    o.name                                  AS org_name,
    count(tul.id)                           AS total_requests,
    coalesce(sum(tul.total_tokens), 0)      AS total_tokens,
    coalesce(sum(tul.cost_usd), 0)          AS total_cost_usd,
    max(tul.created_at)                     AS last_active
FROM user_profiles up
JOIN auth.users u           ON u.id = up.user_id
LEFT JOIN roles r           ON r.id = up.role_id
LEFT JOIN organizations o   ON o.id = up.organization_id
LEFT JOIN token_usage_logs tul ON tul.user_id = up.user_id
GROUP BY up.user_id, u.email, up.role_id, r.name, up.organization_id, o.name;
