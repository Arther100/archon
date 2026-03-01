-- ============================================================
-- Document Analyser — Supabase Migration
-- Run this in your Supabase SQL Editor (Project > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────
-- Table: documents
-- ──────────────────────────────────────────────────────────
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade,
  file_name    text not null,
  file_type    text not null check (file_type in ('pdf', 'docx')),
  raw_text     text,
  created_at   timestamptz default now()
);

alter table documents enable row level security;

create policy "Users can manage their own documents"
  on documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- Table: modules
-- ──────────────────────────────────────────────────────────
create table if not exists modules (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid references documents(id) on delete cascade,
  title        text not null,
  content      text,
  "order"      integer default 0
);

alter table modules enable row level security;

create policy "Users can manage modules of their documents"
  on modules for all
  using (
    exists (
      select 1 from documents d
      where d.id = modules.document_id
        and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from documents d
      where d.id = modules.document_id
        and d.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────
-- Table: analyses
-- ──────────────────────────────────────────────────────────
create table if not exists analyses (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid references modules(id) on delete cascade,
  output_md    text,
  output_json  jsonb,
  created_at   timestamptz default now()
);

alter table analyses enable row level security;

create policy "Users can manage analyses of their modules"
  on analyses for all
  using (
    exists (
      select 1 from modules m
      join documents d on d.id = m.document_id
      where m.id = analyses.module_id
        and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from modules m
      join documents d on d.id = m.document_id
      where m.id = analyses.module_id
        and d.user_id = auth.uid()
    )
  );
