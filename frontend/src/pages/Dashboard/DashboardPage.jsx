// DashboardPage.jsx — Main dashboard with overview cards
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'
import { usePermissions } from '../../context/PermissionContext'
import { useNotifications } from '../../context/NotificationContext'

export default function DashboardPage() {
    const { accent } = useTheme()
    const { role, organization, isAdmin, isSuperAdmin } = usePermissions()
    const { unreadCount, notifications, fetchNotifications, markRead, markAllRead } = useNotifications()
    const navigate = useNavigate()
    const [usage, setUsage] = useState(null)
    const [docs, setDocs] = useState([])
    const [showNotifs, setShowNotifs] = useState(false)

    useEffect(() => {
        api.myUsage().then(d => setUsage(d.usage)).catch(() => {})
        api.listDocuments().then(d => setDocs(d.documents || [])).catch(() => {})
        fetchNotifications(1, false)
    }, [])

    const cardStyle = {
        background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14,
        padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8,
    }
    const labelStyle = { fontSize: '0.72rem', color: '#8896b3', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }
    const valueStyle = { fontSize: '1.5rem', fontWeight: 700, color: '#f0f4ff' }

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>Dashboard</h1>
                <p style={{ fontSize: '0.82rem', color: '#8896b3' }}>
                    Welcome back! Role: <span style={{ color: accent, fontWeight: 600 }}>{role?.name || 'loading...'}</span>
                    {organization && <> · Org: <span style={{ color: accent }}>{organization.name}</span></>}
                </p>
            </div>

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
                <div style={cardStyle}>
                    <span style={labelStyle}>Documents</span>
                    <span style={valueStyle}>{docs.length}</span>
                </div>
                <div style={cardStyle}>
                    <span style={labelStyle}>Tokens Used</span>
                    <span style={valueStyle}>{usage ? (usage.total_tokens || 0).toLocaleString() : '—'}</span>
                </div>
                <div style={cardStyle}>
                    <span style={labelStyle}>Total Requests</span>
                    <span style={valueStyle}>{usage ? (usage.total_requests || 0).toLocaleString() : '—'}</span>
                </div>
                <div style={cardStyle}>
                    <span style={labelStyle}>Notifications</span>
                    <span style={{ ...valueStyle, color: unreadCount > 0 ? '#f59e0b' : '#f0f4ff' }}>{unreadCount}</span>
                </div>
            </div>

            {/* Usage summary */}
            {usage && (
                <div style={{ ...cardStyle, marginBottom: 28 }}>
                    <span style={labelStyle}>Usage Summary</span>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: '#8896b3' }}>Total Tokens: </span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f0f4ff' }}>{(usage.total_tokens || 0).toLocaleString()}</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: '#8896b3' }}>Total Requests: </span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f0f4ff' }}>{(usage.total_requests || 0).toLocaleString()}</span>
                        </div>
                        {usage.last_active && (
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#8896b3' }}>Last Active: </span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#8896b3' }}>{new Date(usage.last_active).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
                {[
                    { label: 'Upload Document', icon: '📤', path: '/' },
                    { label: 'AI Settings', icon: '🔑', path: '/ai-settings' },
                    { label: 'Submit Feedback', icon: '💬', path: '/feedback' },
                    { label: 'View Plans', icon: '💎', path: '/plans' },
                ].map(a => (
                    <button key={a.path} onClick={() => navigate(a.path)} style={{
                        background: '#111622', border: '1px solid #1e2a3d', borderRadius: 10,
                        padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 10,
                        color: '#f0f4ff', fontSize: '0.82rem', fontWeight: 500,
                        transition: 'all 0.15s',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = '#161d2e' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2a3d'; e.currentTarget.style.background = '#111622' }}>
                        <span style={{ fontSize: '1.1rem' }}>{a.icon}</span> {a.label}
                    </button>
                ))}
            </div>

            {/* Recent notifications */}
            <div style={{ ...cardStyle }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={labelStyle}>Recent Notifications</span>
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} style={{
                            background: 'none', border: 'none', color: accent, fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600,
                        }}>Mark all read</button>
                    )}
                </div>
                {notifications.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#4a5568' }}>No notifications yet.</p>
                ) : notifications.slice(0, 5).map(n => (
                    <div key={n.id} onClick={() => !n.is_read && markRead(n.id)} style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        background: n.is_read ? 'transparent' : `${accent}08`,
                        borderLeft: n.is_read ? '3px solid transparent' : `3px solid ${accent}`,
                        transition: 'all 0.15s',
                    }}>
                        <div style={{ fontSize: '0.8rem', color: '#f0f4ff', fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                        <div style={{ fontSize: '0.72rem', color: '#4a5568', marginTop: 2 }}>{n.message?.slice(0, 80)}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}
