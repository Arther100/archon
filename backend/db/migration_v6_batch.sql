-- ============================================================================
-- Migration V6 — Batch Processing, Response Caching & Token Tracking
-- Run in Supabase SQL Editor
-- ============================================================================

-- ── 1. Analysis Cache ────────────────────────────────────────────────────────
-- Content-hash based cache to skip duplicate LLM calls
CREATE TABLE IF NOT EXISTS analysis_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_hash TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'openai',
    model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    blueprint JSONB NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_cost_usd NUMERIC(10,6) DEFAULT 0,
    hit_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_hit_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_hash ON analysis_cache(content_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_provider ON analysis_cache(provider, model);

-- ── 2. Token Usage Logs ──────────────────────────────────────────────────────
-- Per-call token tracking for cost monitoring
CREATE TABLE IF NOT EXISTS token_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    organization_id UUID,
    request_type TEXT NOT NULL DEFAULT 'analysis', -- analysis | qa | merge | batch
    provider TEXT NOT NULL DEFAULT 'openai',
    model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    cache_hit BOOLEAN DEFAULT false,
    module_id UUID,
    document_id UUID,
    batch_job_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_logs_user ON token_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_logs_org ON token_usage_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_logs_type ON token_usage_logs(request_type);
CREATE INDEX IF NOT EXISTS idx_token_logs_batch ON token_usage_logs(batch_job_id);

-- ── 3. Batch Jobs ────────────────────────────────────────────────────────────
-- Queue for batch analysis processing
CREATE TABLE IF NOT EXISTS batch_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    organization_id UUID,
    document_id UUID NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'analyse_all_modules', -- analyse_all_modules | re_analyse_all | selective
    status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed | cancelled
    priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
    -- Progress tracking
    total_modules INTEGER DEFAULT 0,
    completed_modules INTEGER DEFAULT 0,
    failed_modules INTEGER DEFAULT 0,
    cached_modules INTEGER DEFAULT 0,
    -- Cost tracking
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cost_usd NUMERIC(10,6) DEFAULT 0,
    estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
    tokens_saved_by_cache INTEGER DEFAULT 0,
    cost_saved_by_cache NUMERIC(10,6) DEFAULT 0,
    -- OpenAI Batch API
    openai_batch_id TEXT, -- OpenAI batch ID if using Batch API
    use_batch_api BOOLEAN DEFAULT false,
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_user ON batch_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_doc ON batch_jobs(document_id);

-- ── 4. Batch Job Items ───────────────────────────────────────────────────────
-- Per-module tracking within a batch job
CREATE TABLE IF NOT EXISTS batch_job_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_job_id UUID NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
    module_id UUID NOT NULL,
    module_title TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed | cached
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    cache_hit BOOLEAN DEFAULT false,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_items_job ON batch_job_items(batch_job_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_status ON batch_job_items(batch_job_id, status);

-- ── 5. Cost Settings ─────────────────────────────────────────────────────────
-- Admin-configurable pricing per model
CREATE TABLE IF NOT EXISTS cost_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_cost_per_1m NUMERIC(10,4) NOT NULL DEFAULT 0.15,  -- $/1M tokens
    output_cost_per_1m NUMERIC(10,4) NOT NULL DEFAULT 0.60,
    batch_discount_pct INTEGER DEFAULT 50, -- OpenAI Batch API discount %
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(provider, model)
);

-- Seed default pricing (as of March 2026)
INSERT INTO cost_settings (provider, model, input_cost_per_1m, output_cost_per_1m, batch_discount_pct) VALUES
    ('openai', 'gpt-4o-mini', 0.15, 0.60, 50),
    ('openai', 'gpt-4o', 2.50, 10.00, 50),
    ('openai', 'gpt-4-turbo', 10.00, 30.00, 50),
    ('gemini', 'gemini-1.5-pro', 1.25, 5.00, 0),
    ('gemini', 'gemini-1.5-flash', 0.075, 0.30, 0),
    ('ollama', 'llama3', 0, 0, 0)
ON CONFLICT (provider, model) DO NOTHING;

-- ── 6. Daily Cost Aggregation View ──────────────────────────────────────────
CREATE OR REPLACE VIEW daily_cost_summary AS
SELECT
    DATE(created_at) AS day,
    provider,
    model,
    request_type,
    COUNT(*) AS call_count,
    SUM(input_tokens) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens,
    SUM(total_tokens) AS total_tokens,
    SUM(cost_usd) AS total_cost,
    COUNT(*) FILTER (WHERE cache_hit = true) AS cache_hits,
    COUNT(*) FILTER (WHERE cache_hit = false) AS cache_misses
FROM token_usage_logs
GROUP BY DATE(created_at), provider, model, request_type;

-- ── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_settings ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_all_cache" ON analysis_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all_token_logs" ON token_usage_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all_batch_jobs" ON batch_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all_batch_items" ON batch_job_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all_cost_settings" ON cost_settings FOR ALL USING (true) WITH CHECK (true);
