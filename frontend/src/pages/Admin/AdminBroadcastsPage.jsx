// AdminBroadcastsPage.jsx — Admin: Send broadcast messages
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../i18n'
import ConfirmModal from '../../components/common/ConfirmModal'

export default function AdminBroadcastsPage() {
    const { accent } = useTheme()
    const { t } = useLanguage()
    const [broadcasts, setBroadcasts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ title: '', content: '', target_type: 'all', target_value: '', priority: 'normal' })
    const [sending, setSending] = useState(false)
    const [msg, setMsg] = useState('')
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    const load = async () => {
        setLoading(true)
        try { const d = await api.adminListBroadcasts(); setBroadcasts(d.broadcasts || []) } catch { }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const handleSend = async () => {
        if (!form.title || !form.content) return
        setSending(true)
        try {
            await api.adminCreateBroadcast(form)
            setMsg('Broadcast sent!')
            setShowForm(false)
            setForm({ title: '', content: '', target_type: 'all', target_value: '', priority: 'normal' })
            load()
        } catch (e) { setMsg(e.message) }
        setSending(false)
    }

    const handleDelete = async (id) => {
        setConfirmDeleteId(id)
    }

    const confirmDelete = async () => {
        const id = confirmDeleteId
        setConfirmDeleteId(null)
        try { await api.adminDeleteBroadcast(id); load() } catch { }
    }

    const inputStyle = { width: '100%', padding: '10px 14px', background: '#0d1219', border: '1px solid #1e2a3d', borderRadius: 8, color: '#f0f4ff', fontSize: '0.82rem', fontFamily: "'Inter',sans-serif", outline: 'none' }
    const btnStyle = (bg) => ({ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter',sans-serif", background: bg, color: '#fff' })

    const priorityColor = { low: '#6b7280', normal: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' }

    return (
        <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff' }}>📢 Broadcasts</h1>
                    <p style={{ fontSize: '0.78rem', color: '#8896b3', marginTop: 4 }}>Send announcements to users.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={btnStyle(accent)}>{showForm ? 'Cancel' : '+ New Broadcast'}</button>
            </div>

            {msg && <div style={{ padding: '8px 14px', borderRadius: 8, background: '#111622', border: '1px solid #1e2a3d', marginBottom: 12, fontSize: '0.78rem', color: accent }}>{msg}</div>}

            {showForm && (
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                    <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Broadcast title" style={{ ...inputStyle, marginBottom: 10 }} />
                    <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Message content..." rows={3} style={{ ...inputStyle, marginBottom: 10, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <select value={form.target_type} onChange={e => setForm({ ...form, target_type: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                            <option value="all">All Users</option>
                            <option value="organization">By Organization</option>
                            <option value="role">By Role</option>
                            <option value="location">By Location</option>
                        </select>
                        {form.target_type !== 'all' && (
                            <input value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} placeholder={`Target ${form.target_type} value`} style={{ ...inputStyle, flex: 1 }} />
                        )}
                        <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                            {['low', 'normal', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <button onClick={handleSend} disabled={sending} style={{ ...btnStyle(accent), opacity: sending ? 0.6 : 1 }}>{sending ? 'Sending...' : 'Send Broadcast'}</button>
                </div>
            )}

            {loading ? <p style={{ color: '#4a5568' }}>Loading...</p> : broadcasts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#4a5568' }}>No broadcasts sent yet.</div>
            ) : broadcasts.map(b => (
                <div key={b.id} style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 12, padding: '14px 18px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f4ff', marginBottom: 4 }}>{b.title}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99, background: `${priorityColor[b.priority]}22`, color: priorityColor[b.priority] }}>{b.priority}</span>
                            <span style={{ fontSize: '0.68rem', color: '#4a5568' }}>→ {b.target_type}{b.target_value ? `: ${b.target_value}` : ''}</span>
                            <span style={{ fontSize: '0.68rem', color: '#4a5568' }}>{new Date(b.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button onClick={() => handleDelete(b.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer' }}>Delete</button>
                </div>
            ))}
            <ConfirmModal
                open={!!confirmDeleteId}
                title={t('confirm.deleteTitle')}
                message={t('confirm.deleteBroadcast')}
                confirmLabel={t('confirm.yes')}
                cancelLabel={t('confirm.cancel')}
                danger
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    )
}
