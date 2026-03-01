// AdminFeaturesPage.jsx — Admin: Manage feature flags per plan and org overrides
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'

export default function AdminFeaturesPage() {
    const { accent } = useTheme()
    const [plans, setPlans] = useState([])
    const [overrides, setOverrides] = useState([])
    const [orgs, setOrgs] = useState([])
    const [loading, setLoading] = useState(true)
    const [showOverrideForm, setShowOverrideForm] = useState(false)
    const [overrideForm, setOverrideForm] = useState({ organization_id: '', feature_name: '', enabled: true })
    const [msg, setMsg] = useState('')

    const load = async () => {
        setLoading(true)
        try {
            const [p, ov, o] = await Promise.all([api.adminListPlanFeatures(), api.adminListOverrides(), api.adminListOrgs()])
            setPlans(p.plans || [])
            setOverrides(ov.overrides || [])
            setOrgs(o.organizations || [])
        } catch { }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const handleAddOverride = async () => {
        if (!overrideForm.organization_id || !overrideForm.feature_name) return
        try {
            await api.adminCreateOverride(overrideForm)
            setMsg('Override saved!')
            setShowOverrideForm(false)
            load()
        } catch (e) { setMsg(e.message) }
    }

    const handleDeleteOverride = async (id) => {
        try { await api.adminDeleteOverride(id); load() } catch { }
    }

    const inputStyle = { padding: '10px 14px', background: '#0d1219', border: '1px solid #1e2a3d', borderRadius: 8, color: '#f0f4ff', fontSize: '0.82rem', fontFamily: "'Inter',sans-serif", outline: 'none' }
    const btnStyle = (bg) => ({ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter',sans-serif", background: bg, color: '#fff' })

    return (
        <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>🚩 Feature Flags</h1>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 20 }}>Manage features per plan and org-level overrides.</p>

            {msg && <div style={{ padding: '8px 14px', borderRadius: 8, background: '#111622', border: '1px solid #1e2a3d', marginBottom: 12, fontSize: '0.78rem', color: accent }}>{msg}</div>}

            {/* Plan features */}
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f0f4ff', marginBottom: 10 }}>Plan Features</h2>
            {loading ? <p style={{ color: '#4a5568' }}>Loading...</p> : plans.map(p => (
                <div key={p.id} style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 12, padding: '14px 18px', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f0f4ff', marginBottom: 8 }}>{p.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(p.features || {}).map(([k, v]) => (
                            <span key={k} style={{
                                padding: '3px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 500,
                                background: v ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                color: v ? '#22c55e' : '#ef4444',
                            }}>
                                {v ? '✅' : '❌'} {k.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            ))}

            {/* Org overrides */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f0f4ff' }}>Organization Overrides</h2>
                <button onClick={() => setShowOverrideForm(!showOverrideForm)} style={btnStyle(accent)}>{showOverrideForm ? 'Cancel' : '+ Add Override'}</button>
            </div>

            {showOverrideForm && (
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: 20, marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <select value={overrideForm.organization_id} onChange={e => setOverrideForm({ ...overrideForm, organization_id: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                            <option value="">Select org</option>
                            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        <input value={overrideForm.feature_name} onChange={e => setOverrideForm({ ...overrideForm, feature_name: e.target.value })} placeholder="Feature name (e.g. api_schema)" style={{ ...inputStyle, flex: 1 }} />
                        <select value={overrideForm.enabled} onChange={e => setOverrideForm({ ...overrideForm, enabled: e.target.value === 'true' })} style={{ ...inputStyle, width: 110 }}>
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                        </select>
                    </div>
                    <button onClick={handleAddOverride} style={btnStyle(accent)}>Save Override</button>
                </div>
            )}

            {overrides.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#4a5568', fontSize: '0.82rem' }}>No overrides configured.</div>
            ) : overrides.map(o => (
                <div key={o.id} style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 10, padding: '10px 16px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontSize: '0.8rem', color: '#f0f4ff', fontWeight: 500 }}>{o.organizations?.name || o.organization_id?.slice(0, 8)}</span>
                        <span style={{ fontSize: '0.75rem', color: '#8896b3', marginLeft: 10 }}>{o.feature_name}</span>
                        <span style={{ fontSize: '0.72rem', marginLeft: 8, color: o.enabled ? '#22c55e' : '#ef4444' }}>{o.enabled ? 'ON' : 'OFF'}</span>
                    </div>
                    <button onClick={() => handleDeleteOverride(o.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer' }}>Remove</button>
                </div>
            ))}
        </div>
    )
}
