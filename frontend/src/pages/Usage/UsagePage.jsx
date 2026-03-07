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

    const totalTokens = usage.total_tokens || 0
    const totalRequests = usage.total_requests || 0
    const totalCost = usage.total_cost_usd || 0

    return (
        <div style={{ padding: '28px 32px', maxWidth: 700, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>📈 My Usage</h1>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 24 }}>Monitor your token consumption.</p>

            {/* Main usage card */}
            <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 16, padding: 28, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 24 }}>
                    <div style={{
                        width: 100, height: 100, borderRadius: '50%',
                        background: `conic-gradient(${accent} 360deg, #1e2a3d 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#111622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f0f4ff' }}>{totalRequests}</span>
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: '#8896b3', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total Tokens</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f0f4ff' }}>{totalTokens.toLocaleString()}</div>
                        <div style={{ fontSize: '0.78rem', color: '#4a5568', marginTop: 2 }}>across {totalRequests} requests</div>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ padding: '12px 16px', background: '#0d1219', borderRadius: 10 }}>
                        <div style={{ fontSize: '0.68rem', color: '#8896b3', marginBottom: 4 }}>Total Requests</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: accent }}>{totalRequests.toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '12px 16px', background: '#0d1219', borderRadius: 10 }}>
                        <div style={{ fontSize: '0.68rem', color: '#8896b3', marginBottom: 4 }}>Est. Cost</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22c55e' }}>${totalCost.toFixed(4)}</div>
                    </div>
                </div>

                {usage.last_active && (
                    <div style={{ marginTop: 16, fontSize: '0.75rem', color: '#4a5568' }}>
                        Last active: {new Date(usage.last_active).toLocaleString()}
                    </div>
                )}
            </div>
        </div>
    )
}
