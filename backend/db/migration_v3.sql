-- ============================================================
-- Document Analyser — Migration v3
-- Run in Supabase SQL Editor
-- ============================================================

-- Add confidence_score, accuracy_level, and version to analyses
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accuracy_level   integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS version          integer DEFAULT 1;

-- Add index for fast history queries
CREATE INDEX IF NOT EXISTS idx_analyses_module_created
  ON analyses (module_id, created_at DESC);
