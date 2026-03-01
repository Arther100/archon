// ProfileModal — full-featured profile settings panel
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme, ACCENT_COLORS } from '../../context/ThemeContext'
import { api } from '../../hooks/api'

const TABS = [
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'password', label: 'Password', icon: '🔒' },
    { key: 'theme', label: 'Theme', icon: '🎨' },
]

export default function ProfileModal({ open, onClose, initialTab = 'profile' }) {
    const { user, updateUser } = useAuth()
    const { accent, changeAccent } = useTheme()
    const [tab, setTab] = useState(initialTab)
    const overlayRef = useRef()

    // Sync tab when opened from different menu items
    useEffect(() => {
        if (open) setTab(initialTab)
    }, [open, initialTab])

    // Profile state
    const [displayName, setDisplayName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [githubUrl, setGithubUrl] = useState('')
    const [linkedinUrl, setLinkedinUrl] = useState('')
    const [phone, setPhone] = useState('')
    const [bio, setBio] = useState('')
    const [profileMsg, setProfileMsg] = useState(null)
    const [profileSaving, setProfileSaving] = useState(false)
    const [avatarUploading, setAvatarUploading] = useState(false)
    const fileInputRef = useRef()

    // Password state
    const [currentPw, setCurrentPw] = useState('')
    const [newPw, setNewPw] = useState('')
    const [confirmPw, setConfirmPw] = useState('')
    const [pwMsg, setPwMsg] = useState(null)
    const [pwSaving, setPwSaving] = useState(false)

    // Theme state
    const [themeMsg, setThemeMsg] = useState(null)

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || '')
            setAvatarUrl(user.avatar_url || '')
            setGithubUrl(user.github_url || '')
            setLinkedinUrl(user.linkedin_url || '')
            setPhone(user.phone || '')
            setBio(user.bio || '')
        }
    }, [user, open])

    useEffect(() => {
        if (open) {
            setProfileMsg(null); setPwMsg(null); setThemeMsg(null)
            setCurrentPw(''); setNewPw(''); setConfirmPw('')
        }
    }, [open, tab])

    if (!open) return null

    const handleOverlay = (e) => {
        if (e.target === overlayRef.current) onClose()
    }

    // ── Profile save ──
    const saveProfile = async () => {
        setProfileSaving(true); setProfileMsg(null)
        try {
            const res = await api.updateProfile({
                display_name: displayName.trim(),
                github_url: githubUrl.trim(),
                linkedin_url: linkedinUrl.trim(),
                phone: phone.trim(),
                bio: bio.trim(),
            })
            updateUser({
                display_name: res.display_name,
                github_url: res.github_url,
                linkedin_url: res.linkedin_url,
                phone: res.phone,
                bio: res.bio,
            })
            setProfileMsg({ type: 'success', text: 'Profile updated!' })
            setTimeout(() => onClose(), 800)
        } catch (err) {
            setProfileMsg({ type: 'error', text: err.message })
        } finally {
            setProfileSaving(false)
        }
    }

    // ── Avatar upload from gallery ──
    const handleAvatarSelect = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        // Validate client-side
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
        if (!allowed.includes(file.type)) {
            setProfileMsg({ type: 'error', text: 'Only JPEG, PNG, GIF, WebP, or SVG images are allowed.' })
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setProfileMsg({ type: 'error', text: 'Image must be smaller than 2 MB.' })
            return
        }
        setAvatarUploading(true); setProfileMsg(null)
        try {
            const res = await api.uploadAvatar(file)
            setAvatarUrl(res.avatar_url)
            updateUser({ avatar_url: res.avatar_url })
            setProfileMsg({ type: 'success', text: 'Avatar uploaded!' })
        } catch (err) {
            setProfileMsg({ type: 'error', text: err.message })
        } finally {
            setAvatarUploading(false)
        }
    }

    // ── Password save ──
    const savePassword = async () => {
        setPwMsg(null)
        if (newPw.length < 6) { setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return }
        if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return }
        setPwSaving(true)
        try {
            await api.changePassword(currentPw, newPw)
            setPwMsg({ type: 'success', text: 'Password changed successfully!' })
            setCurrentPw(''); setNewPw(''); setConfirmPw('')
        } catch (err) {
            setPwMsg({ type: 'error', text: err.message })
        } finally {
            setPwSaving(false)
        }
    }

    // ── Theme save ──
    const saveTheme = async (color) => {
        changeAccent(color)
        setThemeMsg(null)
        try {
            await api.updateProfile({ theme_color: color })
            updateUser({ theme_color: color })
            setThemeMsg({ type: 'success', text: 'Theme updated!' })
        } catch {
            setThemeMsg({ type: 'success', text: 'Theme applied locally.' })
        }
    }

    const inputStyle = {
        width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f0f4ff',
        fontSize: '0.85rem', fontFamily: "'Inter',sans-serif", outline: 'none',
        transition: 'border 0.2s', boxSizing: 'border-box',
    }

    const labelStyle = {
        fontSize: '0.7rem', color: '#4a5568', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.07em', display: 'block', marginBottom: 6,
    }

    const btnPrimary = (disabled) => ({
        padding: '10px 20px', borderRadius: 10, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#1e2a3d' : `linear-gradient(135deg, ${accent}, ${accent}dd)`,
        color: disabled ? '#4a5568' : '#fff', fontSize: '0.85rem', fontWeight: 700,
        fontFamily: "'Inter',sans-serif", transition: 'opacity 0.2s', width: '100%',
    })

    const msgBox = (msg) => msg && (
        <div style={{
            padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', marginTop: 10,
            background: msg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: msg.type === 'success' ? '#4ade80' : '#f87171',
        }}>
            {msg.type === 'success' ? '✓' : '⚠'} {msg.text}
        </div>
    )

    // Avatar display
    const avatarSize = 72
    const avatarInitial = (displayName || user?.email || '?')[0]?.toUpperCase()

    return (
        <div ref={overlayRef} onClick={handleOverlay} style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.15s ease',
        }}>
            <div style={{
                width: '100%', maxWidth: 480,
                background: 'rgba(13,18,25,0.95)', backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18,
                padding: 0, boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>Settings</h2>
                    <button onClick={onClose} style={{
                        width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                        background: 'transparent', color: '#4a5568', cursor: 'pointer', fontSize: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex', gap: 4, padding: '16px 24px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            padding: '8px 16px', border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
                            fontWeight: 600, fontSize: '0.8rem', fontFamily: "'Inter',sans-serif",
                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                            background: tab === t.key ? `${accent}22` : 'transparent',
                            color: tab === t.key ? '#f0f4ff' : '#4a5568',
                            borderBottom: tab === t.key ? `2px solid ${accent}` : '2px solid transparent',
                        }}>
                            <span style={{ fontSize: '0.9rem' }}>{t.icon}</span> {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ padding: '24px', minHeight: 280 }}>

                    {/* ── Profile Tab ── */}
                    {tab === 'profile' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Avatar preview */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
                                <div style={{
                                    width: avatarSize, height: avatarSize, borderRadius: '50%',
                                    background: avatarUrl ? `url(${avatarUrl}) center/cover` : `${accent}33`,
                                    border: `2px solid ${accent}55`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.6rem', color: accent, fontWeight: 700, flexShrink: 0,
                                    overflow: 'hidden',
                                }}>
                                    {avatarUrl
                                        ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { e.target.style.display = 'none' }} />
                                        : avatarInitial}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0f4ff' }}>
                                        {displayName || user?.email}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#4a5568', marginTop: 2 }}>{user?.email}</div>
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Display Name</label>
                                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                                    placeholder="Your name" style={inputStyle}
                                    onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                    onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                            </div>

                            <div>
                                <label style={labelStyle}>Profile Picture</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                                    style={{ display: 'none' }}
                                    onChange={handleAvatarSelect}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={avatarUploading}
                                    style={{
                                        width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
                                        border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10,
                                        color: avatarUploading ? '#4a5568' : '#8896b3', fontSize: '0.82rem',
                                        cursor: avatarUploading ? 'not-allowed' : 'pointer',
                                        fontFamily: "'Inter',sans-serif", transition: 'border 0.2s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    }}
                                    onMouseEnter={e => { if (!avatarUploading) e.currentTarget.style.border = `1px dashed ${accent}` }}
                                    onMouseLeave={e => { e.currentTarget.style.border = '1px dashed rgba(255,255,255,0.15)' }}
                                >
                                    {avatarUploading
                                        ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Uploading…</>
                                        : <>📷 Choose from Gallery</>}
                                </button>
                                <div style={{ fontSize: '0.68rem', color: '#4a5568', marginTop: 4 }}>
                                    JPEG, PNG, GIF, WebP or SVG · Max 2 MB
                                </div>
                            </div>

                            {/* Bio */}
                            <div>
                                <label style={labelStyle}>Bio</label>
                                <textarea value={bio} onChange={e => setBio(e.target.value)}
                                    placeholder="Tell us about yourself" rows={2}
                                    style={{ ...inputStyle, resize: 'vertical', fontFamily: "'Inter',sans-serif" }}
                                    onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                    onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                            </div>

                            {/* Phone */}
                            <div>
                                <label style={labelStyle}>Phone</label>
                                <input value={phone} onChange={e => setPhone(e.target.value)}
                                    placeholder="+1 234 567 8900" style={inputStyle}
                                    onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                    onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                            </div>

                            {/* GitHub URL */}
                            <div>
                                <label style={labelStyle}>GitHub Profile</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '1rem' }}>🐙</span>
                                    <input value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
                                        placeholder="https://github.com/username" style={{ ...inputStyle, flex: 1 }}
                                        onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                        onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                                </div>
                            </div>

                            {/* LinkedIn URL */}
                            <div>
                                <label style={labelStyle}>LinkedIn Profile</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '1rem' }}>💼</span>
                                    <input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
                                        placeholder="https://linkedin.com/in/username" style={{ ...inputStyle, flex: 1 }}
                                        onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                        onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                                </div>
                            </div>

                            <button onClick={saveProfile} disabled={profileSaving} style={btnPrimary(profileSaving)}>
                                {profileSaving ? 'Saving…' : 'Save Profile'}
                            </button>
                            {msgBox(profileMsg)}
                        </div>
                    )}

                    {/* ── Password Tab ── */}
                    {tab === 'password' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={labelStyle}>Current Password</label>
                                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                                    placeholder="Enter current password" style={inputStyle}
                                    onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                    onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                            </div>
                            <div>
                                <label style={labelStyle}>New Password</label>
                                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                                    placeholder="Min. 6 characters" style={inputStyle}
                                    onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                    onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                            </div>
                            <div>
                                <label style={labelStyle}>Confirm New Password</label>
                                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                                    placeholder="Repeat new password" style={inputStyle}
                                    onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                    onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                            </div>
                            <button onClick={savePassword} disabled={pwSaving} style={btnPrimary(pwSaving)}>
                                {pwSaving ? 'Changing…' : 'Change Password'}
                            </button>
                            {msgBox(pwMsg)}
                        </div>
                    )}

                    {/* ── Theme Tab ── */}
                    {tab === 'theme' && (
                        <div>
                            <p style={{ fontSize: '0.82rem', color: '#8896b3', marginBottom: 20 }}>
                                Choose an accent color for the interface
                            </p>
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
                            }}>
                                {ACCENT_COLORS.map(c => (
                                    <button key={c.value} onClick={() => saveTheme(c.value)} style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                        padding: 14, borderRadius: 12, cursor: 'pointer',
                                        border: accent === c.value ? `2px solid ${c.value}` : '2px solid rgba(255,255,255,0.06)',
                                        background: accent === c.value ? `${c.value}15` : 'rgba(255,255,255,0.02)',
                                        transition: 'all 0.2s',
                                    }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: '50%', background: c.value,
                                            boxShadow: accent === c.value ? `0 0 16px ${c.value}55` : 'none',
                                            transition: 'box-shadow 0.2s',
                                        }} />
                                        <span style={{
                                            fontSize: '0.7rem', fontWeight: 600,
                                            color: accent === c.value ? '#f0f4ff' : '#4a5568',
                                        }}>{c.name}</span>
                                    </button>
                                ))}
                            </div>
                            {msgBox(themeMsg)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
