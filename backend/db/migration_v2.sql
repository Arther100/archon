-- ============================================================
-- Enhancement 5 Migration — Architecture Context Injection
-- Run this in your Supabase SQL Editor AFTER the initial migration
-- ============================================================

-- Add standards_text column to documents table
alter table documents add column if not exists standards_text text default null;
