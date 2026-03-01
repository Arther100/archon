// AdminOrgsPage.jsx — Admin: Organization management
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../i18n'
import ConfirmModal from '../../components/common/ConfirmModal'

export default function AdminOrgsPage() {
    const { accent } = useTheme()
    const { t } = useLanguage()
    const [orgs, setOrgs] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ name: '', plan_id: '', subscription_status: 'active' })
    const [plans, setPlans] = useState([])
    const [msg, setMsg] = useState('')
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    const load = async () => {
        setLoading(true)
        try {
            const [o, p] = await Promise.all([api.adminListOrgs(), api.listPlans()])
            setOrgs(o.organizations || [])
            setPlans(p.plans || [])
        } catch { }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const handleCreate = async () => {
        if (!form.name) return
        try {
            await api.adminCreateOrg(form)
            setShowForm(false)
            setForm({ name: '', plan_id: '', subscription_status: 'active' })
            load()
        } catch (e) { setMsg(e.message) }
    }

    const handleDelete = async (id) => {
        setConfirmDeleteId(id)
    }

    const confirmDelete = async () => {
        const id = confirmDeleteId
        setConfirmDeleteId(null)
        try { await api.adminDeleteOrg(id); load() } catch (e) { setMsg(e.message) }
    }

    const inputStyle = { width: '100%', padding: '10px 14px', background: '#0d1219', border: '1px solid #1e2a3d', borderRadius: 8, color: '#f0f4ff', fontSize: '0.82rem', fontFamily: "'Inter',sans-serif", outline: 'none' }
    const btnStyle = (bg) => ({ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter',sans-serif", background: bg, color: '#fff' })

    return (
        <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff' }}>🏢 Organizations</h1>
                    <p style={{ fontSize: '0.78rem', color: '#8896b3', marginTop: 4 }}>Manage tenant organizations.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={btnStyle(accent)}>{showForm ? 'Cancel' : '+ New Org'}</button>
            </div>

            {msg && <div style={{ padding: '8px 14px', borderRadius: 8, background: '#111622', border: '1px solid #1e2a3d', marginBottom: 12, fontSize: '0.78rem', color: '#ef4444' }}>{msg}</div>}

            {showForm && (
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Organization name" style={{ ...inputStyle, marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <select value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                            <option value="">Select plan</option>
                            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select value={form.subscription_status} onChange={e => setForm({ ...form, subscription_status: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                            {['active', 'trial', 'suspended', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <button onClick={handleCreate} style={btnStyle(accent)}>Create Organization</button>
                </div>
            )}

            {loading ? <p style={{ color: '#4a5568' }}>Loading...</p> : orgs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#4a5568' }}>No organizations yet.</div>
            ) : orgs.map(o => (
                <div key={o.id} style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 12, padding: '14px 18px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f0f4ff' }}>{o.name}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99, background: `${accent}15`, color: accent }}>{o.plans?.name || 'No plan'}</span>
                            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99, background: o.subscription_status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: o.subscription_status === 'active' ? '#22c55e' : '#ef4444' }}>{o.subscription_status}</span>
                        </div>
                    </div>
                    <button onClick={() => handleDelete(o.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer' }}>Delete</button>
                </div>
            ))}
            <ConfirmModal
                open={!!confirmDeleteId}
                title={t('confirm.deleteTitle')}
                message={t('confirm.deleteOrg')}
                confirmLabel={t('confirm.yes')}
                cancelLabel={t('confirm.cancel')}
                danger
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    )
}
