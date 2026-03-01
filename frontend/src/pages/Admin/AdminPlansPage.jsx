// AdminPlansPage.jsx — Admin: Create/edit plans
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'

const DEFAULT_FEATURES = {
    document_upload: true,
    module_detection: true,
    analysis: true,
    qa: true,
    api_schema: false,
    dependencies: false,
    export: false,
    byok: false,
}

export default function AdminPlansPage() {
    const { accent } = useTheme()
    const [plans, setPlans] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ name: '', price_monthly: 0, token_limit: 1000000, max_users: 3, features: { ...DEFAULT_FEATURES }, is_active: true })
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')

    const load = async () => {
        setLoading(true)
        try { const d = await api.listPlans(); setPlans(d.plans || []) } catch { }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const handleSave = async () => {
        if (!form.name) return
        setSaving(true)
        try {
            await api.adminCreatePlan(form)
            setMsg('Plan created!')
            setShowForm(false)
            setForm({ name: '', price_monthly: 0, token_limit: 1000000, max_users: 3, features: { ...DEFAULT_FEATURES }, is_active: true })
            load()
        } catch (e) { setMsg(e.message) }
        setSaving(false)
    }

    const toggleFeature = (key) => {
        setForm(f => ({ ...f, features: { ...f.features, [key]: !f.features[key] } }))
    }

    const inputStyle = { width: '100%', padding: '10px 14px', background: '#0d1219', border: '1px solid #1e2a3d', borderRadius: 8, color: '#f0f4ff', fontSize: '0.82rem', fontFamily: "'Inter',sans-serif", outline: 'none' }
    const btnStyle = (bg) => ({ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter',sans-serif", background: bg, color: '#fff' })

    return (
        <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff' }}>⚙️ Manage Plans</h1>
                    <p style={{ fontSize: '0.78rem', color: '#8896b3', marginTop: 4 }}>Create and configure subscription plans.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={btnStyle(accent)}>{showForm ? 'Cancel' : '+ New Plan'}</button>
            </div>

            {msg && <div style={{ padding: '8px 14px', borderRadius: 8, background: '#111622', border: '1px solid #1e2a3d', marginBottom: 12, fontSize: '0.78rem', color: accent }}>{msg}</div>}

            {showForm && (
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Plan name" style={{ ...inputStyle, marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 4 }}>Price/mo ($)</label>
                            <input type="number" value={form.price_monthly} onChange={e => setForm({ ...form, price_monthly: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 4 }}>Token Limit</label>
                            <input type="number" value={form.token_limit} onChange={e => setForm({ ...form, token_limit: parseInt(e.target.value) || 0 })} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 4 }}>Max Users</label>
                            <input type="number" value={form.max_users} onChange={e => setForm({ ...form, max_users: parseInt(e.target.value) || 1 })} style={inputStyle} />
                        </div>
                    </div>
                    <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 8 }}>Features</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {Object.entries(form.features).map(([key, val]) => (
                            <button key={key} onClick={() => toggleFeature(key)} style={{
                                padding: '5px 12px', borderRadius: 99, fontSize: '0.75rem', cursor: 'pointer',
                                border: 'none', fontFamily: "'Inter',sans-serif",
                                background: val ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                                color: val ? '#22c55e' : '#ef4444', fontWeight: 500,
                            }}>
                                {val ? '✅' : '❌'} {key.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleSave} disabled={saving} style={{ ...btnStyle(accent), opacity: saving ? 0.6 : 1 }}>{saving ? 'Creating...' : 'Create Plan'}</button>
                </div>
            )}

            {loading ? <p style={{ color: '#4a5568' }}>Loading...</p> : plans.map(p => (
                <div key={p.id} style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 12, padding: '16px 20px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f0f4ff' }}>{p.name}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: accent }}>${p.price_monthly}/mo</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: '0.75rem', color: '#8896b3', marginBottom: 8 }}>
                        <span>Tokens: {p.token_limit?.toLocaleString()}</span>
                        <span>·</span>
                        <span>Max Users: {p.max_users}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {Object.entries(p.features || {}).map(([k, v]) => (
                            <span key={k} style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem', background: v ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)', color: v ? '#22c55e' : '#ef4444' }}>
                                {k.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
