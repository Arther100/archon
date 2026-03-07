-- Migration v11: Projects — group documents under a project for full-flow AI understanding
-- Run this in Supabase SQL Editor

-- ──────────────────────────────────────────────────────────
-- Table: projects
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- Link documents to projects (nullable — unassigned docs stay as-is)
-- ──────────────────────────────────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents (project_id) WHERE project_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────
-- Function: auto-update updated_at on projects
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();
