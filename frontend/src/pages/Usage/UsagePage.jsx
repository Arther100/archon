// UsagePage.jsx — User's own usage dashboard
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'

export default function UsagePage() {
    const { accent } = useTheme()
    const [usage, setUsage] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.myUsage().then(d => setUsage(d.usage)).catch(() => {}).finally(() => setLoading(false))
    }, [])

    if (loading) return <div style={{ padding: 32, color: '#4a5568' }}>Loading...</div>
    if (!usage) return <div style={{ padding: 32, color: '#4a5568' }}>No usage data available.</div>

    const pct = usage.percentage || 0

    return (
        <div style={{ padding: '28px 32px', maxWidth: 700, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>📈 My Usage</h1>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 24 }}>Monitor your monthly token consumption.</p>

            {/* Main usage card */}
            <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 16, padding: 28, marginBottom: 20 }}>
                {/* Circular progress (CSS approach) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 24 }}>
                    <div style={{
                        width: 100, height: 100, borderRadius: '50%',
                        background: `conic-gradient(${pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : accent} ${pct * 3.6}deg, #1e2a3d ${pct * 3.6}deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#111622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f0f4ff' }}>{pct}%</span>
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: '#8896b3', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Tokens Used</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f0f4ff' }}>{usage.tokens_used?.toLocaleString()}</div>
                        <div style={{ fontSize: '0.78rem', color: '#4a5568', marginTop: 2 }}>of {usage.monthly_limit?.toLocaleString()} monthly limit</div>
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ background: '#0d1219', borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{
                        width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 99,
                        background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : accent,
                        transition: 'width 0.8s ease',
                    }} />
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ padding: '12px 16px', background: '#0d1219', borderRadius: 10 }}>
                        <div style={{ fontSize: '0.68rem', color: '#8896b3', marginBottom: 4 }}>Remaining</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22c55e' }}>{(usage.remaining_tokens || (usage.monthly_limit - usage.tokens_used))?.toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '12px 16px', background: '#0d1219', borderRadius: 10 }}>
                        <div style={{ fontSize: '0.68rem', color: '#8896b3', marginBottom: 4 }}>Status</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: usage.warning ? '#f59e0b' : '#22c55e' }}>
                            {usage.warning ? '⚠️ Near Limit' : '✅ Good'}
                        </div>
                    </div>
                </div>

                {usage.warning && (
                    <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <p style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 500 }}>
                            ⚠️ You've used over 90% of your monthly quota. Consider upgrading your plan.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
