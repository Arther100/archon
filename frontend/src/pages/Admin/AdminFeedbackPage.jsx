// AdminFeedbackPage.jsx — Admin: Manage all feedback
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'

const STATUS_COLORS = { open: '#3b82f6', in_review: '#f59e0b', resolved: '#22c55e', closed: '#6b7280' }
const STATUSES = ['open', 'in_review', 'resolved', 'closed']

export default function AdminFeedbackPage() {
    const { accent } = useTheme()
    const [list, setList] = useState([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(null)
    const [detail, setDetail] = useState(null)
    const [reply, setReply] = useState('')
    const [filter, setFilter] = useState({ status: '', priority: '' })

    const load = async () => {
        setLoading(true)
        try {
            const d = await api.listAllFeedback(1, 50, filter)
            setList(d.feedback || [])
        } catch { }
        setLoading(false)
    }
    useEffect(() => { load() }, [filter.status, filter.priority])

    const viewDetail = async (id) => {
        setSelected(id)
        try { const d = await api.getFeedback(id); setDetail(d) } catch { }
    }

    const changeStatus = async (id, status) => {
        try { await api.updateFeedbackStatus(id, status); viewDetail(id); load() } catch { }
    }

    const sendReply = async () => {
        if (!reply.trim()) return
        try { await api.replyToFeedback(selected, reply); setReply(''); viewDetail(selected) } catch { }
    }

    const inputStyle = { width: '100%', padding: '10px 14px', background: '#0d1219', border: '1px solid #1e2a3d', borderRadius: 8, color: '#f0f4ff', fontSize: '0.82rem', fontFamily: "'Inter',sans-serif", outline: 'none' }

    if (selected && detail) {
        return (
            <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
                <button onClick={() => { setSelected(null); setDetail(null) }} style={{ background: 'none', border: 'none', color: '#8896b3', cursor: 'pointer', fontSize: '0.82rem', marginBottom: 16 }}>← Back to list</button>
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: 24 }}>
                    <h2 style={{ fontSize: '1.1rem', color: '#f0f4ff', fontWeight: 700, marginBottom: 8 }}>{detail.feedback?.title}</h2>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        {STATUSES.map(s => (
                            <button key={s} onClick={() => changeStatus(selected, s)} style={{
                                padding: '3px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                                background: detail.feedback?.status === s ? `${STATUS_COLORS[s]}22` : 'transparent',
                                color: STATUS_COLORS[s], border: `1px solid ${STATUS_COLORS[s]}33`,
                            }}>{s}</button>
                        ))}
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#8896b3', lineHeight: 1.6, marginBottom: 16 }}>{detail.feedback?.description}</p>
                    <div style={{ fontSize: '0.72rem', color: '#4a5568', marginBottom: 16 }}>Category: {detail.feedback?.category} · Priority: {detail.feedback?.priority}</div>

                    {/* Replies */}
                    <div style={{ borderTop: '1px solid #1e2a3d', paddingTop: 16 }}>
                        <h3 style={{ fontSize: '0.82rem', color: '#f0f4ff', fontWeight: 600, marginBottom: 10 }}>Replies</h3>
                        {(detail.replies || []).map(r => (
                            <div key={r.id} style={{ padding: '10px 14px', borderRadius: 8, background: '#0d1219', marginBottom: 8 }}>
                                <p style={{ fontSize: '0.8rem', color: '#f0f4ff' }}>{r.content}</p>
                                <p style={{ fontSize: '0.68rem', color: '#4a5568', marginTop: 4 }}>{new Date(r.created_at).toLocaleString()}</p>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a reply..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && sendReply()} />
                            <button onClick={sendReply} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Reply</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>📋 Feedback Management</h1>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 16 }}>Review and respond to user feedback.</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="">All statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filter.priority} onChange={e => setFilter({ ...filter, priority: e.target.value })} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="">All priorities</option>
                    {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>

            {loading ? <p style={{ color: '#4a5568' }}>Loading...</p> : list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#4a5568' }}>No feedback found.</div>
            ) : list.map(f => (
                <div key={f.id} onClick={() => viewDetail(f.id)} style={{
                    background: '#111622', border: '1px solid #1e2a3d', borderRadius: 12, padding: '14px 18px', marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = accent + '44'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2a3d'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f4ff' }}>{f.title}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLORS[f.status]}22`, color: STATUS_COLORS[f.status] }}>{f.status}</span>
                            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99, background: '#1e2a3d', color: f.priority === 'critical' ? '#ef4444' : f.priority === 'high' ? '#f59e0b' : '#8896b3' }}>{f.priority}</span>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#4a5568', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.description}</p>
                </div>
            ))}
        </div>
    )
}
