-- Migration v4: Soft delete support for documents
-- Run this in Supabase SQL Editor

-- Add deleted_at column for soft delete
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering of non-deleted documents
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents (deleted_at) WHERE deleted_at IS NULL;
