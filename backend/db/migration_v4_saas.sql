-- ============================================================
-- Archon SaaS Migration v4 — All SaaS tables
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: uses CREATE ... IF NOT EXISTS everywhere
-- ============================================================

-- ── 1. plans ─────────────────────────────────────────────────────────────────
create table if not exists plans (
    id              uuid primary key default gen_random_uuid(),
    name            text not null unique,
    created_at      timestamptz default now()
);

-- Safely add columns in case table already existed without them
alter table plans add column if not exists description     text;
alter table plans add column if not exists price_monthly   numeric(10,2) default 0;
alter table plans add column if not exists price_yearly    numeric(10,2) default 0;
alter table plans add column if not exists request_quota   integer default 20;
alter table plans add column if not exists max_documents   integer default 10;
alter table plans add column if not exists max_file_size_mb integer default 10;
alter table plans add column if not exists features        jsonb default '[]';
alter table plans add column if not exists is_active       boolean default true;

-- Seed default plans
insert into plans (name, description, price_monthly, price_yearly, request_quota, max_documents, features, is_active)
values
    ('free',       'Free tier',             0,     0,    20,   10, '["basic_analysis","qa"]', true),
    ('pro',        'Professional',          19.99, 199,  200,  100,'["basic_analysis","qa","export","priority"]', true),
    ('enterprise', 'Enterprise unlimited',  99.99, 999,  9999, 9999,'["basic_analysis","qa","export","priority","admin","sso"]', true)
on conflict (name) do nothing;

-- ── 2. organizations ─────────────────────────────────────────────────────────
create table if not exists organizations (
    id                    uuid primary key default gen_random_uuid(),
    name                  text not null,
    plan_id               uuid references plans(id),
    subscription_status   text default 'active' check (subscription_status in ('active','trialing','past_due','canceled','unpaid')),
    seats                 integer default 5,
    created_at            timestamptz default now(),
    updated_at            timestamptz default now()
);

-- Seed a default organization
insert into organizations (name, subscription_status)
select 'Default Organization', 'active'
where not exists (select 1 from organizations limit 1);

-- ── 3. roles ─────────────────────────────────────────────────────────────────
create table if not exists roles (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text,
    created_at  timestamptz default now()
);

insert into roles (name, description) values
    ('super_admin', 'Full platform access'),
    ('org_admin',   'Organization administrator'),
    ('developer',   'Standard developer user'),
    ('viewer',      'Read-only access')
on conflict (name) do nothing;

-- ── 4. permissions ───────────────────────────────────────────────────────────
create table if not exists permissions (
    id          uuid primary key default gen_random_uuid(),
    code        text not null unique,
    description text,
    created_at  timestamptz default now()
);

insert into permissions (code, description) values
    ('documents:read',    'View documents'),
    ('documents:write',   'Upload documents'),
    ('documents:delete',  'Delete documents'),
    ('analysis:read',     'View analysis'),
    ('analysis:write',    'Generate analysis'),
    ('qa:read',           'Ask questions'),
    ('admin:users',       'Manage users'),
    ('admin:plans',       'Manage plans'),
    ('admin:orgs',        'Manage organizations'),
    ('admin:audit',       'View audit logs'),
    ('admin:broadcast',   'Send broadcasts'),
    ('settings:ai',       'Configure AI settings')
on conflict (code) do nothing;

-- ── 5. role_permissions ──────────────────────────────────────────────────────
create table if not exists role_permissions (
    role_id       uuid references roles(id) on delete cascade,
    permission_id uuid references permissions(id) on delete cascade,
    primary key (role_id, permission_id)
);

-- Seed role → permission mappings
do $$
declare
    r_super     uuid; r_org uuid; r_dev uuid; r_viewer uuid;
    p_doc_r     uuid; p_doc_w uuid; p_doc_d uuid;
    p_ana_r     uuid; p_ana_w uuid; p_qa_r uuid;
    p_adm_u     uuid; p_adm_p uuid; p_adm_o uuid;
    p_adm_a     uuid; p_adm_b uuid; p_set_ai uuid;
begin
    select id into r_super  from roles where name='super_admin';
    select id into r_org    from roles where name='org_admin';
    select id into r_dev    from roles where name='developer';
    select id into r_viewer from roles where name='viewer';

    select id into p_doc_r  from permissions where code='documents:read';
    select id into p_doc_w  from permissions where code='documents:write';
    select id into p_doc_d  from permissions where code='documents:delete';
    select id into p_ana_r  from permissions where code='analysis:read';
    select id into p_ana_w  from permissions where code='analysis:write';
    select id into p_qa_r   from permissions where code='qa:read';
    select id into p_adm_u  from permissions where code='admin:users';
    select id into p_adm_p  from permissions where code='admin:plans';
    select id into p_adm_o  from permissions where code='admin:orgs';
    select id into p_adm_a  from permissions where code='admin:audit';
    select id into p_adm_b  from permissions where code='admin:broadcast';
    select id into p_set_ai from permissions where code='settings:ai';

    -- super_admin: all
    insert into role_permissions (role_id, permission_id)
    values (r_super, p_doc_r),(r_super, p_doc_w),(r_super, p_doc_d),
           (r_super, p_ana_r),(r_super, p_ana_w),(r_super, p_qa_r),
           (r_super, p_adm_u),(r_super, p_adm_p),(r_super, p_adm_o),
           (r_super, p_adm_a),(r_super, p_adm_b),(r_super, p_set_ai)
    on conflict do nothing;

    -- org_admin: everything except plans
    insert into role_permissions (role_id, permission_id)
    values (r_org, p_doc_r),(r_org, p_doc_w),(r_org, p_doc_d),
           (r_org, p_ana_r),(r_org, p_ana_w),(r_org, p_qa_r),
           (r_org, p_adm_u),(r_org, p_adm_o),(r_org, p_adm_a),(r_org, p_set_ai)
    on conflict do nothing;

    -- developer: core features
    insert into role_permissions (role_id, permission_id)
    values (r_dev, p_doc_r),(r_dev, p_doc_w),(r_dev, p_doc_d),
           (r_dev, p_ana_r),(r_dev, p_ana_w),(r_dev, p_qa_r),(r_dev, p_set_ai)
    on conflict do nothing;

    -- viewer: read only
    insert into role_permissions (role_id, permission_id)
    values (r_viewer, p_doc_r),(r_viewer, p_ana_r),(r_viewer, p_qa_r)
    on conflict do nothing;
end $$;

-- ── 6. user_profiles ─────────────────────────────────────────────────────────
create table if not exists user_profiles (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null unique references auth.users on delete cascade,
    organization_id uuid references organizations(id),
    role_id         uuid references roles(id),
    is_active       boolean default true,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

-- ── 7. notifications ─────────────────────────────────────────────────────────
create table if not exists notifications (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users on delete cascade,
    title       text not null,
    message     text not null,
    type        text default 'info' check (type in ('info','success','warning','error')),
    is_read     boolean default false,
    action_url  text,
    created_at  timestamptz default now()
);

create index if not exists idx_notifications_user_unread
    on notifications (user_id, is_read, created_at desc);

-- ── 8. feedback ──────────────────────────────────────────────────────────────
create table if not exists feedback (
    id              uuid primary key default gen_random_uuid(),
    submitted_by    uuid references auth.users on delete set null,
    category        text default 'general',
    rating          integer check (rating between 1 and 5),
    message         text not null,
    status          text default 'open' check (status in ('open','reviewed','resolved')),
    admin_notes     text,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

-- ── 9. ai_settings ───────────────────────────────────────────────────────────
create table if not exists ai_settings (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null unique references auth.users on delete cascade,
    provider        text default 'openai',
    model           text,
    api_key         text,
    temperature     numeric(3,2) default 0.3,
    max_tokens      integer default 2048,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

-- ── 10. usage_logs ───────────────────────────────────────────────────────────
create table if not exists usage_logs (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references auth.users on delete set null,
    action      text not null,
    document_id uuid references documents(id) on delete set null,
    created_at  timestamptz default now()
);

-- Safely add columns in case table already existed without them
alter table usage_logs add column if not exists tokens_used integer default 0;
alter table usage_logs add column if not exists cost_usd    numeric(10,6) default 0;
alter table usage_logs add column if not exists metadata    jsonb default '{}';

create index if not exists idx_usage_logs_user_created
    on usage_logs (user_id, created_at desc);

-- ── 11. user_usage_summary (view) ────────────────────────────────────────────
-- Drop if it exists as a table (old schema), then recreate as a view
drop table if exists user_usage_summary cascade;
drop view if exists user_usage_summary cascade;
create or replace view user_usage_summary as
select
    up.user_id,
    u.email,
    up.role_id,
    r.name                              as role_name,
    up.organization_id,
    o.name                              as org_name,
    count(ul.id)                        as total_requests,
    coalesce(sum(ul.tokens_used), 0)    as total_tokens,
    coalesce(sum(ul.cost_usd), 0)       as total_cost_usd,
    max(ul.created_at)                  as last_active
from user_profiles up
join auth.users u         on u.id = up.user_id
left join roles r         on r.id = up.role_id
left join organizations o on o.id = up.organization_id
left join usage_logs ul   on ul.user_id = up.user_id
group by up.user_id, u.email, up.role_id, r.name, up.organization_id, o.name;

-- ── 12. audit_logs ───────────────────────────────────────────────────────────
create table if not exists audit_logs (
    id          uuid primary key default gen_random_uuid(),
    actor_id    uuid references auth.users on delete set null,
    action      text not null,
    target_type text,
    target_id   text,
    details     jsonb default '{}',
    ip_address  text,
    created_at  timestamptz default now()
);

create index if not exists idx_audit_logs_created
    on audit_logs (created_at desc);

-- ── Done ─────────────────────────────────────────────────────────────────────
-- All SaaS tables created. No RLS added here since backend uses service role.
