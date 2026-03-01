// AdminPermissionsPage.jsx — Super Admin: Manage role-permission assignments
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'

export default function AdminPermissionsPage() {
    const { accent } = useTheme()
    const [roles, setRoles] = useState([])
    const [allPermissions, setAllPermissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [msg, setMsg] = useState('')
    const [editingRole, setEditingRole] = useState(null)
    const [editPerms, setEditPerms] = useState([])

    const load = async () => {
        setLoading(true)
        try {
            const data = await api.adminListPermissions()
            setRoles(data.roles || [])
            setAllPermissions(data.all_permissions || [])
        } catch (e) { setMsg(e.message) }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const startEdit = (role) => {
        setEditingRole(role.id)
        setEditPerms([...(role.assigned_permissions || [])])
        setMsg('')
    }

    const togglePerm = (code) => {
        setEditPerms(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        )
    }

    const savePermissions = async (roleId) => {
        setSaving(roleId)
        setMsg('')
        try {
            await api.adminUpdateRolePermissions(roleId, editPerms)
            setEditingRole(null)
            setMsg('✅ Permissions updated!')
            load()
        } catch (e) { setMsg(`❌ ${e.message}`) }
        setSaving(null)
    }

    const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', color: '#8896b3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #1e2a3d' }
    const tdStyle = { padding: '10px 14px', fontSize: '0.8rem', color: '#f0f4ff', borderBottom: '1px solid #1a2233', verticalAlign: 'top' }

    const ROLE_COLORS = {
        super_admin: '#f87171',
        org_admin: '#fbbf24',
        developer: '#60a5fa',
        viewer: '#9ca3af',
    }

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 4 }}>🛡️ Permission Management</h1>
            <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 20 }}>
                Manage which permissions are assigned to each role. Super admin bypasses all permission checks.
            </p>

            {msg && (
                <div style={{
                    padding: '8px 14px', borderRadius: 8, background: '#111622', border: '1px solid #1e2a3d',
                    marginBottom: 12, fontSize: '0.78rem',
                    color: msg.includes('✅') ? '#22c55e' : msg.includes('❌') ? '#ef4444' : accent,
                }}>
                    {msg}
                </div>
            )}

            {loading ? <p style={{ color: '#4a5568' }}>Loading...</p> : (
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Role</th>
                                    <th style={thStyle}>Permissions</th>
                                    <th style={{ ...thStyle, width: 120 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.map(role => {
                                    const isEditing = editingRole === role.id
                                    const roleColor = ROLE_COLORS[role.name] || accent
                                    const isSuperAdmin = role.name === 'super_admin'

                                    return (
                                        <tr key={role.id}>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <span style={{
                                                        fontSize: '0.82rem', fontWeight: 700, color: roleColor,
                                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    }}>
                                                        {role.name?.replace('_', ' ')}
                                                        {isSuperAdmin && (
                                                            <span style={{ fontSize: '0.6rem', color: '#4a5568', fontWeight: 400 }}>(all access)</span>
                                                        )}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: '#4a5568' }}>{role.description || ''}</span>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                {isSuperAdmin ? (
                                                    <span style={{ fontSize: '0.75rem', color: '#4a5568', fontStyle: 'italic' }}>
                                                        Bypasses all permission checks
                                                    </span>
                                                ) : isEditing ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {allPermissions.map(p => {
                                                            const active = editPerms.includes(p.code)
                                                            return (
                                                                <button key={p.code} onClick={() => togglePerm(p.code)} style={{
                                                                    padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                                                                    fontSize: '0.7rem', fontWeight: 600,
                                                                    fontFamily: "'Inter',sans-serif",
                                                                    background: active ? `${accent}20` : '#0d1219',
                                                                    color: active ? accent : '#4a5568',
                                                                    border: active ? `1px solid ${accent}55` : '1px solid #1e2a3d',
                                                                    transition: 'all 0.15s',
                                                                }} title={p.description || p.code}>
                                                                    {active ? '✓ ' : ''}{p.code}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                        {(role.assigned_permissions || []).length === 0 ? (
                                                            <span style={{ fontSize: '0.72rem', color: '#4a5568' }}>No permissions assigned</span>
                                                        ) : (role.assigned_permissions || []).map(code => (
                                                            <span key={code} style={{
                                                                padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem',
                                                                background: `${accent}12`, color: accent,
                                                                border: `1px solid ${accent}33`,
                                                            }}>
                                                                {code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={tdStyle}>
                                                {isSuperAdmin ? (
                                                    <span style={{ fontSize: '0.72rem', color: '#4a5568' }}>—</span>
                                                ) : isEditing ? (
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button onClick={() => savePermissions(role.id)} disabled={saving === role.id} style={{
                                                            padding: '5px 12px', borderRadius: 6, border: 'none',
                                                            background: accent, color: '#fff', fontSize: '0.72rem',
                                                            cursor: 'pointer', opacity: saving === role.id ? 0.6 : 1,
                                                            fontFamily: "'Inter',sans-serif",
                                                        }}>
                                                            {saving === role.id ? '...' : 'Save'}
                                                        </button>
                                                        <button onClick={() => setEditingRole(null)} style={{
                                                            padding: '5px 12px', borderRadius: 6, border: '1px solid #1e2a3d',
                                                            background: 'transparent', color: '#8896b3', fontSize: '0.72rem',
                                                            cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                                                        }}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => startEdit(role)} style={{
                                                        padding: '5px 12px', borderRadius: 6, border: '1px solid #1e2a3d',
                                                        background: 'transparent', color: '#8896b3', fontSize: '0.72rem',
                                                        cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                                                    }}>
                                                        Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Legend */}
            {!loading && allPermissions.length > 0 && (
                <div style={{ marginTop: 20, background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: '16px 20px' }}>
                    <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f0f4ff', marginBottom: 10 }}>Available Permissions</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                        {allPermissions.map(p => (
                            <div key={p.code} style={{ fontSize: '0.72rem', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                                <code style={{ color: accent, fontSize: '0.7rem', fontFamily: "'JetBrains Mono',monospace" }}>{p.code}</code>
                                <span style={{ color: '#4a5568' }}>{p.description || '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
