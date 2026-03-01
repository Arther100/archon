// AdminAuditPage.jsx — Admin: Audit log viewer
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'

export default function AdminAuditPage() {
    const { accent } = useTheme()
    const [logs, setLogs] = useState([])
    const [actions, setActions] = useState([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [filter, setFilter] = useState({ action: '', entity_type: '' })
    const perPage = 50

    const load = async () => {
        setLoading(true)
        try {
            const d = await api.adminListAuditLogs(page, perPage, filter)
            setLogs(d.logs || [])
            setTotal(d.total || 0)
        } catch { }
        setLoading(false)
    }

    useEffect(() => {
        api.adminAuditActions().then(d => setActions(d.actions || [])).catch(() => {})
    }, [])
    useEffect(() => { load() }, [page, filter.action, filter.entity_type])

    const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', color: '#8896b3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #1e2a3d' }
    const tdStyle = { padding: '10px 14px', fontSize: '0.78rem', color: '#f0f4ff', borderBottom: '1px solid #1a2233' }
    const inputStyle = { padding: '8px 12px', background: '#0d1219', border: '1px solid #1e2a3d', borderRadius: 8, color: '#f0f4ff', fontSize: '0.78rem', fontFamily: "'Inter',sans-serif", outline: 'none' }

    const totalPages = Math.ceil(total / perPage)

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>🔍 Audit Log</h1>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 16 }}>Track all admin actions and system events.</p>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <select value={filter.action} onChange={e => { setFilter({ ...filter, action: e.target.value }); setPage(1) }} style={inputStyle}>
                    <option value="">All actions</option>
                    {actions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <input value={filter.entity_type} onChange={e => { setFilter({ ...filter, entity_type: e.target.value }); setPage(1) }} placeholder="Entity type..." style={inputStyle} />
            </div>

            {loading ? <p style={{ color: '#4a5568' }}>Loading...</p> : (
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Timestamp</th>
                                    <th style={thStyle}>Actor</th>
                                    <th style={thStyle}>Action</th>
                                    <th style={thStyle}>Entity</th>
                                    <th style={thStyle}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(l => (
                                    <tr key={l.id}>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: '0.72rem', color: '#8896b3' }}>{new Date(l.created_at).toLocaleString()}</span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.7rem' }}>{l.actor_id?.slice(0, 10)}...</span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.7rem', background: `${accent}15`, color: accent }}>{l.action}</span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: '0.75rem', color: '#8896b3' }}>{l.entity_type || '—'}</span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: '0.7rem', color: '#4a5568', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                                {l.details ? JSON.stringify(l.details).slice(0, 60) : '—'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #1e2a3d', background: 'transparent', color: '#8896b3', cursor: page <= 1 ? 'default' : 'pointer', fontSize: '0.78rem' }}>← Prev</button>
                    <span style={{ padding: '6px 14px', fontSize: '0.78rem', color: '#8896b3' }}>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #1e2a3d', background: 'transparent', color: '#8896b3', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '0.78rem' }}>Next →</button>
                </div>
            )}
        </div>
    )
}
