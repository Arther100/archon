// AdminUsagePage.jsx — Admin: Global usage monitoring dashboard
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'

export default function AdminUsagePage() {
    const { accent } = useTheme()
    const [summary, setSummary] = useState(null)
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([api.adminUsageSummary(), api.adminUsageByUsers()])
            .then(([s, u]) => { setSummary(s); setUsers(u.users || []) })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const cardStyle = { background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: '18px 22px' }
    const labelStyle = { fontSize: '0.72rem', color: '#8896b3', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }
    const valueStyle = { fontSize: '1.5rem', fontWeight: 700, color: '#f0f4ff' }
    const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', color: '#8896b3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #1e2a3d' }
    const tdStyle = { padding: '10px 14px', fontSize: '0.8rem', color: '#f0f4ff', borderBottom: '1px solid #1a2233' }

    if (loading) return <div style={{ padding: 32, color: '#4a5568' }}>Loading...</div>

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>📊 Usage Monitor</h1>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 20 }}>Platform-wide token usage overview.</p>

            {/* Summary cards */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                    <div style={cardStyle}>
                        <div style={labelStyle}>Total Users</div>
                        <div style={valueStyle}>{summary.total_users}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={labelStyle}>Total Tokens Used</div>
                        <div style={valueStyle}>{summary.total_tokens_used?.toLocaleString()}</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={labelStyle}>Total Requests</div>
                        <div style={valueStyle}>{summary.total_requests?.toLocaleString()}</div>
                    </div>
                </div>
            )}

            {/* User usage table */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>User</th>
                                <th style={thStyle}>Role</th>
                                <th style={thStyle}>Organization</th>
                                <th style={thStyle}>Tokens Used</th>
                                <th style={thStyle}>Requests</th>
                                <th style={thStyle}>Last Active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                    <tr key={u.user_id}>
                                        <td style={tdStyle}>
                                            <div>
                                                <span style={{ fontSize: '0.8rem', color: '#f0f4ff' }}>{u.email || u.user_id?.slice(0, 12)}</span>
                                            </div>
                                        </td>
                                        <td style={tdStyle}><span style={{ fontSize: '0.72rem', color: '#8896b3' }}>{u.role_name || '—'}</span></td>
                                        <td style={tdStyle}><span style={{ fontSize: '0.72rem', color: '#8896b3' }}>{u.org_name || '—'}</span></td>
                                        <td style={tdStyle}>{(u.total_tokens || 0).toLocaleString()}</td>
                                        <td style={tdStyle}>{(u.total_requests || 0).toLocaleString()}</td>
                                        <td style={tdStyle}><span style={{ fontSize: '0.72rem', color: '#8896b3' }}>{u.last_active ? new Date(u.last_active).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
