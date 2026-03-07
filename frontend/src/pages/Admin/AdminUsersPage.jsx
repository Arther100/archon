// AdminUsersPage.jsx — Admin: Manage users, roles, orgs, delete + send message
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import ConfirmModal from '../../components/common/ConfirmModal'

const ROLE_COLORS = {
    super_admin: { color: '#f87171', bg: 'rgba(239,68,68,0.12)',    label: 'Super Admin' },
    org_admin:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   label: 'Org Admin' },
    developer:   { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',   label: 'Developer' },
    viewer:      { color: '#9ca3af', bg: 'rgba(107,114,128,0.12)',  label: 'Viewer' },
}

function UserAvatar({ name, email, size = 36 }) {
    const initial = (name || email || '?')[0].toUpperCase()
    const palette = ['#3b6ef5','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444']
    const c = palette[(name || email || '').charCodeAt(0) % palette.length]
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            background: c + '28', border: `1.5px solid ${c}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.38, fontWeight: 700, color: c,
        }}>{initial}</div>
    )
}

export default function AdminUsersPage() {
    const { accent } = useTheme()
    const { refreshQuota } = useAuth()
    const [users, setUsers]   = useState([])
    const [roles, setRoles]   = useState([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded]   = useState(null)
    const [editing, setEditing]     = useState(null)
    const [editForm, setEditForm]   = useState({})
    const [savingEdit, setSavingEdit] = useState(false)
    const [quotaEdit, setQuotaEdit]   = useState(null)
    const [quotaValue, setQuotaValue] = useState(20)
    const [savingQuota, setSavingQuota] = useState(false)
    const [msgUser, setMsgUser] = useState(null)
    const [msgForm, setMsgForm] = useState({ title: '', message: '' })
    const [sending, setSending] = useState(false)
    const [confirmDeleteUser, setConfirmDeleteUser] = useState(null)
    const [toast, setToast] = useState(null)
    const [search, setSearch] = useState('')

    const showToast = (text, ok = true) => {
        setToast({ text, ok })
        setTimeout(() => setToast(null), 3000)
    }

    const load = async () => {
        setLoading(true)
        try {
            const [u, r] = await Promise.all([api.adminListUsers(), api.adminListRoles()])
            setUsers(u.users || [])
            setRoles(r.roles || [])
        } catch { }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const startEdit = (u, e) => {
        e.stopPropagation()
        setEditing(u.user_id)
        setEditForm({ role_id: u.role_id || '', is_active: u.is_active !== false, location_country: u.location_country || '', location_city: u.location_city || '' })
        setExpanded(u.user_id)
    }

    const saveEdit = async (userId) => {
        setSavingEdit(true)
        try {
            await api.adminUpdateUser(userId, editForm)
            setEditing(null)
            showToast('User updated successfully!')
            load()
        } catch (e) { showToast(e.message, false) }
        setSavingEdit(false)
    }

    const confirmDelete = async () => {
        const u = confirmDeleteUser
        setConfirmDeleteUser(null)
        try {
            await api.adminDeleteUser(u.user_id)
            showToast(`User "${u.email || u.user_id?.slice(0, 8)}" deleted.`)
            load()
        } catch (e) { showToast(e.message, false) }
    }

    const sendMessage = async () => {
        if (!msgForm.title || !msgForm.message) return
        setSending(true)
        try {
            await api.adminSendMessage(msgUser.user_id, msgForm)
            showToast(`Message sent to ${msgUser.email || 'user'}!`)
            setMsgUser(null)
        } catch (e) { showToast(e.message, false) }
        setSending(false)
    }

    const saveQuota = async (userId, resetUsed = false) => {
        setSavingQuota(true)
        try {
            await api.adminUpdateUserQuota(userId, quotaValue, resetUsed)
            setQuotaEdit(null)
            showToast('Quota updated!')
            load()
            refreshQuota()
        } catch (e) { showToast(e.message, false) }
        setSavingQuota(false)
    }

    const filtered = users.filter(u => {
        if (!search) return true
        const q = search.toLowerCase()
        return (u.email || '').toLowerCase().includes(q)
            || (u.display_name || '').toLowerCase().includes(q)
            || (u.roles?.name || '').toLowerCase().includes(q)
    })

    const inputStyle = {
        padding: '7px 11px', background: '#0a0d14', border: '1px solid #1e2a3d',
        borderRadius: 7, color: '#f0f4ff', fontSize: '0.8rem',
        fontFamily: "'Inter',sans-serif", outline: 'none', width: '100%', boxSizing: 'border-box',
    }
    const btn = (bg, color, border = 'none') => ({
        padding: '6px 14px', borderRadius: 7, border,
        background: bg, color, fontSize: '0.75rem', fontWeight: 600,
        cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
    })
    const iconBtn = (color) => ({
        background: 'none', border: 'none', cursor: 'pointer',
        color, fontSize: '0.9rem', padding: '4px 6px', borderRadius: 6,
        transition: 'all 0.15s', lineHeight: 1, display: 'flex', alignItems: 'center',
    })

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>👥 User Management</h1>
                    <p style={{ fontSize: '0.78rem', color: '#4a5568', marginTop: 4, marginBottom: 0 }}>
                        {users.length} total users · Assign roles, manage quotas, send messages
                    </p>
                </div>
                <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍  Search by name, email or role…"
                    style={{ ...inputStyle, width: 260, padding: '8px 14px' }}
                />
            </div>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 24, zIndex: 9999,
                    padding: '10px 18px', borderRadius: 10,
                    background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${toast.ok ? '#22c55e' : '#ef4444'}55`,
                    color: toast.ok ? '#22c55e' : '#f87171',
                    fontSize: '0.82rem', fontWeight: 600,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                    {toast.ok ? '✅' : '❌'} {toast.text}
                </div>
            )}

            {loading ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#4a5568', fontSize: '0.85rem' }}>Loading users…</div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#4a5568', fontSize: '0.85rem' }}>No users found.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.map(u => {
                        const roleName  = u.roles?.name || ''
                        const roleInfo  = ROLE_COLORS[roleName] || { color: '#8896b3', bg: 'rgba(136,150,179,0.1)', label: roleName || 'No Role' }
                        const isExpanded  = expanded === u.user_id
                        const isEditing   = editing === u.user_id
                        const isQuotaEdit = quotaEdit === u.user_id
                        const quota     = u.request_quota ?? 20
                        const used      = u.requests_used ?? 0
                        const remaining = Math.max(0, quota - used)
                        const pct       = quota > 0 ? (used / quota) * 100 : 100
                        const quotaColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#fbbf24' : '#22c55e'

                        return (
                            <div key={u.user_id} style={{
                                background: '#111622',
                                border: `1px solid ${isExpanded ? accent + '55' : '#1e2a3d'}`,
                                borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
                            }}>
                                {/* ── Summary row ── */}
                                <div
                                    onClick={() => setExpanded(isExpanded ? null : u.user_id)}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto auto auto auto auto',
                                        alignItems: 'center',
                                        padding: '13px 16px',
                                        cursor: 'pointer', gap: 14,
                                    }}
                                >
                                    {/* Identity */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                        <UserAvatar name={u.display_name} email={u.email} />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f0f4ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {u.display_name || <span style={{ color: '#4a5568', fontWeight: 400, fontStyle: 'italic' }}>No display name</span>}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {u.email}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Role */}
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700,
                                        background: roleInfo.bg, color: roleInfo.color,
                                        border: `1px solid ${roleInfo.color}33`,
                                        textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                                    }}>{roleInfo.label}</span>

                                    {/* Org */}
                                    <span style={{ fontSize: '0.75rem', color: '#6b7a99', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {u.organizations?.name || <span style={{ color: '#2a3547' }}>—</span>}
                                    </span>

                                    {/* Status */}
                                    <span style={{
                                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                                        background: u.is_active !== false ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: u.is_active !== false ? '#22c55e' : '#ef4444',
                                        border: `1px solid ${u.is_active !== false ? '#22c55e33' : '#ef444433'}`,
                                    }}>{u.is_active !== false ? 'Active' : 'Inactive'}</span>

                                    {/* Quota pill */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                        <span style={{ fontSize: '0.7rem', color: quotaColor }}>⚡</span>
                                        <div style={{ width: 44, height: 5, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: quotaColor, borderRadius: 4 }} />
                                        </div>
                                        <span style={{ fontSize: '0.7rem', color: quotaColor, fontWeight: 700 }}>{remaining}/{quota}</span>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                        <button onClick={e => startEdit(u, e)} title="Edit user" style={iconBtn('#6b7a99')}
                                            onMouseEnter={e => e.currentTarget.style.color='#f0f4ff'}
                                            onMouseLeave={e => e.currentTarget.style.color='#6b7a99'}>✏️</button>
                                        <button onClick={() => { setMsgUser(u); setMsgForm({ title: '', message: '' }) }}
                                            title="Send message" style={iconBtn(accent)}>✉️</button>
                                        {roleName !== 'super_admin' && (
                                            <button onClick={() => setConfirmDeleteUser(u)} title="Delete user" style={iconBtn('#4a5568')}
                                                onMouseEnter={e => e.currentTarget.style.color='#ef4444'}
                                                onMouseLeave={e => e.currentTarget.style.color='#4a5568'}>🗑️</button>
                                        )}
                                        <span style={{ color: '#2a3547', fontSize: '0.7rem', marginLeft: 4, userSelect: 'none' }}>
                                            {isExpanded ? '▲' : '▼'}
                                        </span>
                                    </div>
                                </div>

                                {/* ── Expanded panel ── */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid #1a2233', padding: '20px 20px 18px', background: 'rgba(255,255,255,0.015)' }}>

                                        {/* Edit form */}
                                        {isEditing && (
                                            <div style={{ marginBottom: 20, padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${accent}22` }}>
                                                <div style={{ fontSize: '0.68rem', color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                                                    ✏️ Editing User
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
                                                    <div>
                                                        <label style={{ fontSize: '0.68rem', color: '#8896b3', display: 'block', marginBottom: 5 }}>Role</label>
                                                        <select value={editForm.role_id} onChange={e => setEditForm({ ...editForm, role_id: e.target.value })} style={inputStyle}>
                                                            <option value="">None</option>
                                                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.68rem', color: '#8896b3', display: 'block', marginBottom: 5 }}>Country</label>
                                                        <input value={editForm.location_country} onChange={e => setEditForm({ ...editForm, location_country: e.target.value })} placeholder="e.g. India" style={inputStyle} />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.68rem', color: '#8896b3', display: 'block', marginBottom: 5 }}>City</label>
                                                        <input value={editForm.location_city} onChange={e => setEditForm({ ...editForm, location_city: e.target.value })} placeholder="e.g. Chennai" style={inputStyle} />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.68rem', color: '#8896b3', display: 'block', marginBottom: 8 }}>Account Status</label>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                                            <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} style={{ width: 15, height: 15, accentColor: accent, cursor: 'pointer' }} />
                                                            <span style={{ fontSize: '0.78rem', color: editForm.is_active ? '#22c55e' : '#ef4444' }}>
                                                                {editForm.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button onClick={() => saveEdit(u.user_id)} disabled={savingEdit} style={btn(accent, '#fff')}>
                                                        {savingEdit ? 'Saving…' : '✓ Save Changes'}
                                                    </button>
                                                    <button onClick={() => setEditing(null)} style={btn('transparent', '#8896b3', '1px solid #1e2a3d')}>Cancel</button>
                                                </div>
                                            </div>
                                        )}

                                        {/* User details grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 18 }}>
                                            <InfoField label="User ID" value={u.user_id} mono />
                                            <InfoField label="Joined" value={u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
                                            <InfoField label="Organization" value={u.organizations?.name} />
                                            <InfoField label="Location" value={[u.location_city, u.location_country].filter(Boolean).join(', ')} />
                                            <InfoField label="Phone" value={u.phone} />
                                            <InfoField label="GitHub" value={u.github_url} link accent={accent} />
                                            <InfoField label="LinkedIn" value={u.linkedin_url} link accent={accent} />
                                            <InfoField label="Bio" value={u.bio} />
                                        </div>

                                        {/* Quota section */}
                                        <div style={{ borderTop: '1px solid #1a2233', paddingTop: 14 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.68rem', color: '#6b7a99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚡ Request Quota</span>
                                                {isQuotaEdit ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <input type="number" min={0} value={quotaValue}
                                                            onChange={e => setQuotaValue(parseInt(e.target.value) || 0)}
                                                            style={{ ...inputStyle, width: 80, textAlign: 'center', padding: '5px 8px' }} />
                                                        <button onClick={() => saveQuota(u.user_id, false)} disabled={savingQuota} style={btn(accent, '#fff')}>
                                                            {savingQuota ? '…' : 'Save'}
                                                        </button>
                                                        <button onClick={() => saveQuota(u.user_id, true)} disabled={savingQuota} style={btn('#22c55e', '#fff')} title="Save quota and reset used count to 0">
                                                            Save & Reset Used
                                                        </button>
                                                        <button onClick={() => setQuotaEdit(null)} style={btn('transparent', '#8896b3', '1px solid #1e2a3d')}>Cancel</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{ width: 90, height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: quotaColor, borderRadius: 6 }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: quotaColor }}>{used} / {quota} used</span>
                                                        <span style={{ fontSize: '0.72rem', color: '#4a5568' }}>({remaining} remaining)</span>
                                                        <button
                                                            onClick={() => { setQuotaEdit(u.user_id); setQuotaValue(quota) }}
                                                            style={{ ...btn('transparent', accent, `1px solid ${accent}44`), padding: '4px 12px', fontSize: '0.7rem' }}>
                                                            Edit Quota
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ── Send Message Modal ── */}
            {msgUser && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={() => setMsgUser(null)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#111622', border: '1px solid #1e2a3d', borderRadius: 16,
                        width: 460, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                    }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>✉️ Send Message</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                            <UserAvatar name={msgUser.display_name} email={msgUser.email} size={30} />
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f0f4ff' }}>{msgUser.display_name || msgUser.email}</div>
                                {msgUser.display_name && <div style={{ fontSize: '0.7rem', color: '#4a5568' }}>{msgUser.email}</div>}
                            </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 6 }}>Title</label>
                            <input value={msgForm.title} onChange={e => setMsgForm({ ...msgForm, title: e.target.value })}
                                placeholder="Message title" style={inputStyle} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 6 }}>Message</label>
                            <textarea value={msgForm.message} onChange={e => setMsgForm({ ...msgForm, message: e.target.value })}
                                placeholder="Type your message…" rows={4}
                                style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setMsgUser(null)} style={btn('transparent', '#8896b3', '1px solid #1e2a3d')}>Cancel</button>
                            <button onClick={sendMessage} disabled={sending || !msgForm.title || !msgForm.message}
                                style={{ ...btn(accent, '#fff'), opacity: (sending || !msgForm.title || !msgForm.message) ? 0.5 : 1 }}>
                                {sending ? 'Sending…' : 'Send Message'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!confirmDeleteUser}
                title="Delete User"
                message={`Permanently delete "${confirmDeleteUser?.email || confirmDeleteUser?.display_name}"? This cannot be undone.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                danger
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteUser(null)}
            />
        </div>
    )
}

function InfoField({ label, value, link, mono, accent }) {
    return (
        <div>
            <div style={{ fontSize: '0.6rem', color: '#4a5568', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                {label}
            </div>
            {link && value ? (
                <a href={value} target="_blank" rel="noreferrer"
                    style={{ fontSize: '0.75rem', color: accent || '#60a5fa', textDecoration: 'none', wordBreak: 'break-all' }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration='underline'}
                    onMouseLeave={e => e.currentTarget.style.textDecoration='none'}>
                    {value}
                </a>
            ) : (
                <div style={{
                    fontSize: mono ? '0.65rem' : '0.78rem',
                    color: value ? '#c4cee0' : '#2a3547',
                    fontFamily: mono ? 'monospace' : 'inherit',
                    wordBreak: 'break-all', lineHeight: 1.55,
                }}>
                    {value || '—'}
                </div>
            )}        </div>
    )
}