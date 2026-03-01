-- ============================================================
-- Migration V9 — Request Quota System
-- Adds request_quota and requests_used to user_profiles
-- New users default to 20 requests; admin can adjust
-- ============================================================

-- Add quota columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS request_quota   integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS requests_used   integer NOT NULL DEFAULT 0;

-- Backfill: existing users get 20 quota, keep their used at 0
UPDATE user_profiles
  SET request_quota = 20, requests_used = 0
  WHERE request_quota IS NULL;
