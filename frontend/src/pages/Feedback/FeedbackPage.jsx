// FeedbackPage.jsx — Submit + view own feedback
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'

const CATEGORIES = ['general', 'bug', 'feature', 'improvement']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUS_COLORS = { open: '#3b82f6', in_review: '#f59e0b', resolved: '#22c55e', closed: '#6b7280' }

export default function FeedbackPage() {
    const { accent } = useTheme()
    const [list, setList] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ title: '', description: '', category: 'general', priority: 'medium' })
    const [submitting, setSubmitting] = useState(false)
    const [selected, setSelected] = useState(null)
    const [detail, setDetail] = useState(null)

    const load = async () => {
        setLoading(true)
        try {
            const d = await api.myFeedback()
            setList(d.feedback || [])
        } catch { }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const handleSubmit = async () => {
        if (!form.title || !form.description) return
        setSubmitting(true)
        try {
            await api.submitFeedback(form)
            setShowForm(false)
            setForm({ title: '', description: '', category: 'general', priority: 'medium' })
            load()
        } catch { }
        setSubmitting(false)
    }

    const viewDetail = async (id) => {
        setSelected(id)
        try {
            const d = await api.getFeedback(id)
            setDetail(d)
        } catch { }
    }

    const inputStyle = {
        width: '100%', padding: '10px 14px', background: '#0d1219', border: '1px solid #1e2a3d',
        borderRadius: 8, color: '#f0f4ff', fontSize: '0.82rem', fontFamily: "'Inter',sans-serif", outline: 'none',
    }
    const btnStyle = (bg) => ({
        padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter',sans-serif", background: bg, color: '#fff',
    })

    if (selected && detail) {
        return (
            <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
                <button onClick={() => { setSelected(null); setDetail(null) }} style={{ ...btnStyle('transparent'), color: '#8896b3', marginBottom: 16, padding: '6px 0' }}>← Back</button>
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: 24 }}>
                    <h2 style={{ fontSize: '1.1rem', color: '#f0f4ff', fontWeight: 700, marginBottom: 8 }}>{detail.feedback?.title}</h2>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLORS[detail.feedback?.status] || '#6b7280'}22`, color: STATUS_COLORS[detail.feedback?.status] || '#6b7280' }}>{detail.feedback?.status}</span>
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99, background: '#1e2a3d', color: '#8896b3' }}>{detail.feedback?.category}</span>
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99, background: '#1e2a3d', color: '#8896b3' }}>{detail.feedback?.priority}</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#8896b3', lineHeight: 1.6 }}>{detail.feedback?.description}</p>

                    {/* Replies */}
                    <div style={{ marginTop: 20, borderTop: '1px solid #1e2a3d', paddingTop: 16 }}>
                        <h3 style={{ fontSize: '0.82rem', color: '#f0f4ff', fontWeight: 600, marginBottom: 10 }}>Replies</h3>
                        {(detail.replies || []).length === 0 ? (
                            <p style={{ fontSize: '0.78rem', color: '#4a5568' }}>No replies yet.</p>
                        ) : detail.replies.map(r => (
                            <div key={r.id} style={{ padding: '10px 14px', borderRadius: 8, background: '#0d1219', marginBottom: 8 }}>
                                <p style={{ fontSize: '0.8rem', color: '#f0f4ff' }}>{r.content}</p>
                                <p style={{ fontSize: '0.68rem', color: '#4a5568', marginTop: 4 }}>{new Date(r.created_at).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff' }}>💬 Feedback</h1>
                    <p style={{ fontSize: '0.78rem', color: '#8896b3', marginTop: 4 }}>Submit bugs, feature requests, or suggestions.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={btnStyle(accent)}>{showForm ? 'Cancel' : '+ New Feedback'}</button>
            </div>

            {showForm && (
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                    <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ ...inputStyle, marginBottom: 10 }} />
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..." rows={4} style={{ ...inputStyle, marginBottom: 10, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <button onClick={handleSubmit} disabled={submitting} style={{ ...btnStyle(accent), opacity: submitting ? 0.6 : 1 }}>
                        {submitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                </div>
            )}

            {loading ? <p style={{ color: '#4a5568' }}>Loading...</p> : list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#4a5568', fontSize: '0.85rem' }}>No feedback submitted yet.</div>
            ) : list.map(f => (
                <div key={f.id} onClick={() => viewDetail(f.id)} style={{
                    background: '#111622', border: '1px solid #1e2a3d', borderRadius: 12,
                    padding: '14px 18px', marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = accent + '44'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2a3d'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f4ff' }}>{f.title}</span>
                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLORS[f.status] || '#6b7280'}22`, color: STATUS_COLORS[f.status] || '#6b7280' }}>{f.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <span style={{ fontSize: '0.68rem', color: '#4a5568' }}>{f.category}</span>
                        <span style={{ fontSize: '0.68rem', color: '#4a5568' }}>·</span>
                        <span style={{ fontSize: '0.68rem', color: '#4a5568' }}>{f.priority}</span>
                        <span style={{ fontSize: '0.68rem', color: '#4a5568' }}>·</span>
                        <span style={{ fontSize: '0.68rem', color: '#4a5568' }}>{new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}
