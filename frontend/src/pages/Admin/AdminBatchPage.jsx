// AdminBatchPage.jsx — Admin: Batch Processing, Cache & Cost Management Dashboard
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../i18n'
import ConfirmModal from '../../components/common/ConfirmModal'

const TABS = ['Jobs', 'Cache', 'Token Usage', 'Cost Settings']

export default function AdminBatchPage() {
    const { accent } = useTheme()
    const [tab, setTab] = useState(0)

    const cardStyle = { background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: '18px 22px' }
    const labelStyle = { fontSize: '0.72rem', color: '#8896b3', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }
    const valueStyle = { fontSize: '1.5rem', fontWeight: 700, color: '#f0f4ff' }
    const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', color: '#8896b3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #1e2a3d' }
    const tdStyle = { padding: '10px 14px', fontSize: '0.8rem', color: '#f0f4ff', borderBottom: '1px solid #1a2233' }
    const btnStyle = (active) => ({
        padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
        background: active ? accent : 'transparent', color: active ? '#fff' : '#8896b3',
        transition: 'all 0.2s',
    })

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>⚡ Batch & Costs</h1>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 20 }}>Manage batch processing, analysis cache, token usage & pricing.</p>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
                {TABS.map((t, i) => (
                    <button key={t} onClick={() => setTab(i)} style={btnStyle(tab === i)}>{t}</button>
                ))}
            </div>

            {tab === 0 && <JobsTab accent={accent} cardStyle={cardStyle} labelStyle={labelStyle} valueStyle={valueStyle} thStyle={thStyle} tdStyle={tdStyle} />}
            {tab === 1 && <CacheTab accent={accent} cardStyle={cardStyle} labelStyle={labelStyle} valueStyle={valueStyle} />}
            {tab === 2 && <TokenUsageTab accent={accent} cardStyle={cardStyle} labelStyle={labelStyle} valueStyle={valueStyle} thStyle={thStyle} tdStyle={tdStyle} />}
            {tab === 3 && <CostSettingsTab accent={accent} cardStyle={cardStyle} labelStyle={labelStyle} valueStyle={valueStyle} thStyle={thStyle} tdStyle={tdStyle} />}
        </div>
    )
}


// ── Jobs Tab ────────────────────────────────────────────────────────────────────

function JobsTab({ accent, cardStyle, labelStyle, valueStyle, thStyle, tdStyle }) {
    const [stats, setStats] = useState(null)
    const [jobs, setJobs] = useState([])
    const [loading, setLoading] = useState(true)
    const [documents, setDocuments] = useState([])
    const [selectedDoc, setSelectedDoc] = useState('')
    const [creating, setCreating] = useState(false)
    const [useBatchApi, setUseBatchApi] = useState(false)
    const [executing, setExecuting] = useState(null)
    const [msg, setMsg] = useState('')

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([api.batchStats(), api.batchListJobs(), api.listDocuments()])
            .then(([s, j, d]) => {
                setStats(s)
                setJobs(j.jobs || [])
                setDocuments(d.documents || d || [])
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { load() }, [load])

    const createJob = async () => {
        if (!selectedDoc) return
        setCreating(true)
        setMsg('')
        try {
            const res = await api.batchCreateJob({ document_id: selectedDoc, use_batch_api: useBatchApi })
            setMsg(`✅ Job created! ${res.total_modules} modules (${res.cached_modules} cached). Est. cost: $${res.estimated_cost_usd}`)
            load()
        } catch (e) { setMsg(`❌ ${e.message}`) }
        finally { setCreating(false) }
    }

    const executeJob = async (jobId, mode = 'concurrent') => {
        setExecuting(jobId)
        setMsg('')
        try {
            const res = await api.batchExecuteJob(jobId, mode)
            setMsg(`✅ Job ${res.status}: ${res.completed} completed, ${res.cached} cached, ${res.failed} failed. Cost: $${res.total_cost_usd}`)
            load()
        } catch (e) { setMsg(`❌ ${e.message}`) }
        finally { setExecuting(null) }
    }

    const submitOpenAI = async (jobId) => {
        setExecuting(jobId)
        setMsg('')
        try {
            const res = await api.batchSubmitOpenAI(jobId)
            setMsg(`✅ ${res.message}`)
            load()
        } catch (e) { setMsg(`❌ ${e.message}`) }
        finally { setExecuting(null) }
    }

    const pollJob = async (jobId) => {
        setMsg('')
        try {
            const res = await api.batchPollJob(jobId)
            setMsg(`📊 Status: ${res.status} — ${res.completed_requests || 0}/${res.total_requests || 0} requests done`)
            load()
        } catch (e) { setMsg(`❌ ${e.message}`) }
    }

    const cancelJob = async (jobId) => {
        try {
            await api.batchCancelJob(jobId)
            setMsg('✅ Job cancelled.')
            load()
        } catch (e) { setMsg(`❌ ${e.message}`) }
    }

    const statusBadge = (status) => {
        const colors = { completed: '#22c55e', processing: '#3b82f6', pending: '#f59e0b', failed: '#ef4444', cancelled: '#6b7280' }
        return (
            <span style={{
                padding: '3px 10px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 600,
                background: (colors[status] || '#6b7280') + '22', color: colors[status] || '#8896b3',
            }}>{status}</span>
        )
    }

    if (loading) return <div style={{ color: '#4a5568', padding: 16 }}>Loading...</div>

    return (
        <div>
            {/* Stats row */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                    <div style={cardStyle}>
                        <div style={labelStyle}>Total Jobs</div>
                        <div style={valueStyle}>{stats.total_jobs}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={labelStyle}>Modules Processed</div>
                        <div style={valueStyle}>{stats.total_modules_processed}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={labelStyle}>Cache Hit Rate</div>
                        <div style={{ ...valueStyle, color: accent }}>{stats.cache_hit_rate}%</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={labelStyle}>Total Cost</div>
                        <div style={valueStyle}>${stats.total_cost_usd}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={labelStyle}>Est. Savings</div>
                        <div style={{ ...valueStyle, color: '#22c55e' }}>${stats.estimated_savings_usd}</div>
                    </div>
                </div>
            )}

            {/* Create job */}
            <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                    value={selectedDoc}
                    onChange={e => setSelectedDoc(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #1e2a3d', background: '#0d1219', color: '#f0f4ff', fontSize: '0.8rem', flex: 1, minWidth: 200 }}
                >
                    <option value="">Select document...</option>
                    {documents.map(d => <option key={d.id} value={d.id}>{d.filename || d.title || d.id}</option>)}
                </select>
                <label style={{ fontSize: '0.75rem', color: '#8896b3', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={useBatchApi} onChange={e => setUseBatchApi(e.target.checked)} /> OpenAI Batch API (50% off)
                </label>
                <button onClick={createJob} disabled={!selectedDoc || creating}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', opacity: !selectedDoc || creating ? 0.5 : 1 }}>
                    {creating ? 'Creating...' : '+ Create Batch Job'}
                </button>
            </div>

            {msg && <div style={{ ...cardStyle, marginBottom: 16, fontSize: '0.82rem', color: msg.startsWith('❌') ? '#ef4444' : '#22c55e' }}>{msg}</div>}

            {/* Jobs table */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Job ID</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Modules</th>
                                <th style={thStyle}>Cached</th>
                                <th style={thStyle}>Cost</th>
                                <th style={thStyle}>Created</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.length === 0 && (
                                <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#4a5568' }}>No batch jobs yet.</td></tr>
                            )}
                            {jobs.map(j => (
                                <tr key={j.id}>
                                    <td style={tdStyle}><span style={{ fontSize: '0.7rem', fontFamily: "'JetBrains Mono',monospace" }}>{j.id?.slice(0, 8)}...</span></td>
                                    <td style={tdStyle}>{statusBadge(j.status)}</td>
                                    <td style={tdStyle}>{j.completed_modules}/{j.total_modules}</td>
                                    <td style={tdStyle}>{j.cached_modules || 0}</td>
                                    <td style={tdStyle}>${(j.total_cost_usd || 0).toFixed(4)}</td>
                                    <td style={tdStyle}><span style={{ fontSize: '0.72rem' }}>{new Date(j.created_at).toLocaleDateString()}</span></td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {j.status === 'pending' && (
                                                <>
                                                    <button onClick={() => executeJob(j.id)} disabled={executing === j.id}
                                                        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: accent, color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
                                                        {executing === j.id ? '⏳' : '▶ Run'}
                                                    </button>
                                                    {j.use_batch_api && (
                                                        <button onClick={() => submitOpenAI(j.id)} disabled={executing === j.id}
                                                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
                                                            🔄 OpenAI
                                                        </button>
                                                    )}
                                                    <button onClick={() => cancelJob(j.id)}
                                                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
                                                        ✕
                                                    </button>
                                                </>
                                            )}
                                            {j.status === 'processing' && j.openai_batch_id && (
                                                <button onClick={() => pollJob(j.id)}
                                                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
                                                    📡 Poll
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}


// ── Cache Tab ───────────────────────────────────────────────────────────────────

function CacheTab({ accent, cardStyle, labelStyle, valueStyle }) {
    const { t } = useLanguage()
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [clearing, setClearing] = useState(false)
    const [msg, setMsg] = useState('')
    const [confirmClear, setConfirmClear] = useState(false)

    const load = useCallback(() => {
        setLoading(true)
        api.batchCacheStats()
            .then(s => setStats(s))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { load() }, [load])

    const clearCache = async () => {
        setConfirmClear(true)
    }

    const confirmClearCache = async () => {
        setConfirmClear(false)
        setClearing(true)
        try {
            const res = await api.batchClearCache()
            setMsg(`✅ Cache cleared. ${res.deleted_entries} entries removed.`)
            load()
        } catch (e) { setMsg(`❌ ${e.message}`) }
        finally { setClearing(false) }
    }

    if (loading) return <div style={{ color: '#4a5568', padding: 16 }}>Loading...</div>

    return (
        <div>
            {stats && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Cached Entries</div>
                            <div style={valueStyle}>{stats.total_entries}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Total Hits</div>
                            <div style={valueStyle}>{stats.total_hits?.toLocaleString()}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Tokens Saved</div>
                            <div style={{ ...valueStyle, color: '#22c55e' }}>{stats.total_tokens_saved?.toLocaleString()}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Cost Saved</div>
                            <div style={{ ...valueStyle, color: '#22c55e' }}>${stats.total_cost_saved?.toFixed(4)}</div>
                        </div>
                    </div>

                    {/* By provider breakdown */}
                    {stats.by_provider && stats.by_provider.length > 0 && (
                        <div style={{ ...cardStyle, marginBottom: 20 }}>
                            <div style={{ ...labelStyle, marginBottom: 12 }}>By Provider</div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {stats.by_provider.map(p => (
                                    <div key={p.provider} style={{ background: '#0d1219', borderRadius: 10, padding: '10px 16px', minWidth: 140 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: accent, marginBottom: 4 }}>{p.provider}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#8896b3' }}>{p.entries} entries · {p.hits} hits</div>
                                        <div style={{ fontSize: '0.72rem', color: '#22c55e' }}>Saved: ${p.cost_saved?.toFixed(4)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {msg && <div style={{ ...cardStyle, marginBottom: 16, fontSize: '0.82rem', color: msg.startsWith('❌') ? '#ef4444' : '#22c55e' }}>{msg}</div>}

            <button onClick={clearCache} disabled={clearing}
                style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', opacity: clearing ? 0.5 : 1 }}>
                {clearing ? 'Clearing...' : '🗑 Clear All Cache'}
            </button>

            <ConfirmModal
                open={confirmClear}
                title={t('confirm.deleteTitle')}
                message={t('confirm.clearCache')}
                confirmLabel={t('confirm.yes')}
                cancelLabel={t('confirm.cancel')}
                danger
                onConfirm={confirmClearCache}
                onCancel={() => setConfirmClear(false)}
            />
        </div>
    )
}


// ── Token Usage Tab ─────────────────────────────────────────────────────────────

function TokenUsageTab({ accent, cardStyle, labelStyle, valueStyle, thStyle, tdStyle }) {
    const [data, setData] = useState(null)
    const [days, setDays] = useState(30)
    const [loading, setLoading] = useState(true)

    const load = useCallback(() => {
        setLoading(true)
        api.batchTokenUsage(days)
            .then(d => setData(d))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [days])

    useEffect(() => { load() }, [load])

    if (loading) return <div style={{ color: '#4a5568', padding: 16 }}>Loading...</div>

    return (
        <div>
            {/* Period selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[7, 30, 90].map(d => (
                    <button key={d} onClick={() => setDays(d)}
                        style={{
                            padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: days === d ? accent : '#111622', color: days === d ? '#fff' : '#8896b3',
                            fontWeight: 600, fontSize: '0.78rem',
                        }}>{d}d</button>
                ))}
            </div>

            {data && (
                <>
                    {/* Summary cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Total Calls</div>
                            <div style={valueStyle}>{data.total_calls?.toLocaleString()}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Input Tokens</div>
                            <div style={valueStyle}>{data.total_input_tokens?.toLocaleString()}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Output Tokens</div>
                            <div style={valueStyle}>{data.total_output_tokens?.toLocaleString()}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Total Cost</div>
                            <div style={{ ...valueStyle, color: '#f59e0b' }}>${data.total_cost?.toFixed(4)}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Cache Hit Rate</div>
                            <div style={{ ...valueStyle, color: '#22c55e' }}>{data.cache_hit_rate?.toFixed(1)}%</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={labelStyle}>Est. Savings</div>
                            <div style={{ ...valueStyle, color: '#22c55e' }}>${data.savings?.estimated_savings?.toFixed(4)}</div>
                        </div>
                    </div>

                    {/* By type breakdown */}
                    {data.by_type && data.by_type.length > 0 && (
                        <div style={{ ...cardStyle, marginBottom: 20 }}>
                            <div style={{ ...labelStyle, marginBottom: 12 }}>By Request Type</div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {data.by_type.map(t => (
                                    <div key={t.request_type} style={{ background: '#0d1219', borderRadius: 10, padding: '10px 16px', minWidth: 150 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: accent, marginBottom: 4 }}>{t.request_type}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#8896b3' }}>{t.calls} calls · ${t.cost?.toFixed(4)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Daily breakdown table */}
                    {data.daily && data.daily.length > 0 && (
                        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e2a3d' }}>
                                <span style={labelStyle}>Daily Breakdown</span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Calls</th>
                                            <th style={thStyle}>Input Tokens</th>
                                            <th style={thStyle}>Output Tokens</th>
                                            <th style={thStyle}>Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.daily.map(d => (
                                            <tr key={d.date}>
                                                <td style={tdStyle}>{d.date}</td>
                                                <td style={tdStyle}>{d.calls}</td>
                                                <td style={tdStyle}>{d.input_tokens?.toLocaleString()}</td>
                                                <td style={tdStyle}>{d.output_tokens?.toLocaleString()}</td>
                                                <td style={tdStyle}>${d.cost?.toFixed(4)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}


// ── Cost Settings Tab ───────────────────────────────────────────────────────────

function CostSettingsTab({ accent, cardStyle, labelStyle, valueStyle, thStyle, tdStyle }) {
    const [settings, setSettings] = useState([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState('')

    const load = useCallback(() => {
        setLoading(true)
        api.batchCostSettings()
            .then(d => setSettings(d.settings || d || []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { load() }, [load])

    const startEdit = (s) => {
        setEditing(s.id)
        setForm({
            input_cost_per_1m: s.input_cost_per_1m_tokens,
            output_cost_per_1m: s.output_cost_per_1m_tokens,
            batch_discount_pct: s.batch_discount_pct,
        })
    }

    const save = async () => {
        try {
            await api.batchUpdateCost(editing, form)
            setMsg('✅ Updated successfully.')
            setEditing(null)
            load()
        } catch (e) { setMsg(`❌ ${e.message}`) }
    }

    if (loading) return <div style={{ color: '#4a5568', padding: 16 }}>Loading...</div>

    return (
        <div>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 16 }}>Configure cost per 1M tokens for each model. These affect cost calculations and usage reports.</p>

            {msg && <div style={{ ...cardStyle, marginBottom: 16, fontSize: '0.82rem', color: msg.startsWith('❌') ? '#ef4444' : '#22c55e' }}>{msg}</div>}

            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Provider</th>
                                <th style={thStyle}>Model</th>
                                <th style={thStyle}>Input / 1M tokens</th>
                                <th style={thStyle}>Output / 1M tokens</th>
                                <th style={thStyle}>Batch Discount</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settings.map(s => (
                                <tr key={s.id}>
                                    <td style={tdStyle}>
                                        <span style={{ fontWeight: 600, color: accent }}>{s.provider}</span>
                                    </td>
                                    <td style={tdStyle}>{s.model}</td>
                                    <td style={tdStyle}>
                                        {editing === s.id ? (
                                            <input type="number" step="0.01" value={form.input_cost_per_1m} onChange={e => setForm({ ...form, input_cost_per_1m: parseFloat(e.target.value) })}
                                                style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #1e2a3d', background: '#0d1219', color: '#f0f4ff', fontSize: '0.8rem' }} />
                                        ) : `$${s.input_cost_per_1m_tokens}`}
                                    </td>
                                    <td style={tdStyle}>
                                        {editing === s.id ? (
                                            <input type="number" step="0.01" value={form.output_cost_per_1m} onChange={e => setForm({ ...form, output_cost_per_1m: parseFloat(e.target.value) })}
                                                style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #1e2a3d', background: '#0d1219', color: '#f0f4ff', fontSize: '0.8rem' }} />
                                        ) : `$${s.output_cost_per_1m_tokens}`}
                                    </td>
                                    <td style={tdStyle}>
                                        {editing === s.id ? (
                                            <input type="number" step="1" value={form.batch_discount_pct} onChange={e => setForm({ ...form, batch_discount_pct: parseInt(e.target.value) })}
                                                style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid #1e2a3d', background: '#0d1219', color: '#f0f4ff', fontSize: '0.8rem' }} />
                                        ) : `${s.batch_discount_pct}%`}
                                    </td>
                                    <td style={tdStyle}>
                                        {editing === s.id ? (
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={save} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                                                <button onClick={() => setEditing(null)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #4a5568', background: 'transparent', color: '#8896b3', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => startEdit(s)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: accent + '22', color: accent, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
