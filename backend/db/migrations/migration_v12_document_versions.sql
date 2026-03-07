-- Migration v12: Document Version Tracking
-- Adds version_label and parent_document_id to link document versions together
-- Run this in Supabase SQL Editor

-- ──────────────────────────────────────────────────────────
-- Version tracking columns on documents table
-- ──────────────────────────────────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_label TEXT DEFAULT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents (parent_document_id) WHERE parent_document_id IS NOT NULL;

COMMENT ON COLUMN documents.version_label IS 'Version label like v1, v2, v2.1 — user-assigned';
COMMENT ON COLUMN documents.parent_document_id IS 'Links to the previous version of this document for version comparison';
