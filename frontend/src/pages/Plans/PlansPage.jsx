// PlansPage.jsx — View available plans + choose plan
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'
import { usePermissions } from '../../context/PermissionContext'

export default function PlansPage() {
    const { accent } = useTheme()
    const { organization, refreshProfile } = usePermissions()
    const [plans, setPlans] = useState([])
    const [loading, setLoading] = useState(true)
    const [choosing, setChoosing] = useState(null)
    const [msg, setMsg] = useState('')

    useEffect(() => {
        api.listPlans().then(d => setPlans(d.plans || [])).catch(() => {}).finally(() => setLoading(false))
    }, [])

    const handleChoose = async (planId) => {
        setChoosing(planId); setMsg('')
        try {
            const d = await api.choosePlan(planId)
            setMsg(`✅ ${d.message} — ${d.plan}`)
            refreshProfile()
        } catch (e) { setMsg(`❌ ${e.message}`) }
        setChoosing(null)
    }

    const currentPlanId = organization?.plan_id

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>💎 Plans</h1>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 20 }}>Choose the plan that fits your needs. Payment integration coming soon.</p>

            {msg && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#111622', border: '1px solid #1e2a3d', marginBottom: 16, fontSize: '0.8rem', color: msg.includes('✅') ? '#22c55e' : '#ef4444' }}>{msg}</div>}

            {loading ? <p style={{ color: '#4a5568' }}>Loading plans...</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
                    {plans.map(plan => {
                        const isCurrent = plan.id === currentPlanId
                        const features = plan.features || {}
                        return (
                            <div key={plan.id} style={{
                                background: '#111622', borderRadius: 16, padding: '24px 20px',
                                border: isCurrent ? `2px solid ${accent}` : '1px solid #1e2a3d',
                                display: 'flex', flexDirection: 'column', gap: 12,
                                boxShadow: isCurrent ? `0 0 20px ${accent}22` : 'none',
                                position: 'relative',
                            }}>
                                {isCurrent && (
                                    <span style={{
                                        position: 'absolute', top: -10, right: 16,
                                        padding: '3px 10px', borderRadius: 99, fontSize: '0.68rem',
                                        background: accent, color: '#fff', fontWeight: 700,
                                    }}>Current Plan</span>
                                )}
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f0f4ff' }}>{plan.name}</h3>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: accent }}>
                                    ${plan.price_monthly}<span style={{ fontSize: '0.75rem', color: '#8896b3', fontWeight: 400 }}>/mo</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#8896b3', lineHeight: 1.7 }}>
                                    <div>📊 {plan.token_limit?.toLocaleString() || '∞'} tokens/mo</div>
                                    <div>👥 Up to {plan.max_users} users</div>
                                    {Object.entries(features).filter(([, v]) => v).map(([k]) => (
                                        <div key={k}>✅ {k.replace(/_/g, ' ')}</div>
                                    ))}
                                    {Object.entries(features).filter(([, v]) => !v).map(([k]) => (
                                        <div key={k} style={{ color: '#4a5568' }}>❌ {k.replace(/_/g, ' ')}</div>
                                    ))}
                                </div>
                                <button onClick={() => handleChoose(plan.id)} disabled={isCurrent || choosing === plan.id} style={{
                                    marginTop: 'auto', padding: '10px', borderRadius: 8, border: 'none', cursor: isCurrent ? 'default' : 'pointer',
                                    background: isCurrent ? '#1e2a3d' : accent, color: isCurrent ? '#8896b3' : '#fff',
                                    fontSize: '0.82rem', fontWeight: 600, fontFamily: "'Inter',sans-serif",
                                    opacity: choosing === plan.id ? 0.6 : 1,
                                }}>
                                    {isCurrent ? 'Current' : choosing === plan.id ? 'Processing...' : plan.price_monthly === 0 ? 'Select Free' : 'Choose Plan'}
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
