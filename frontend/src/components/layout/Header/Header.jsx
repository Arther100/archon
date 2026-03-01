// Header — app-wide navigation bar with profile dropdown + language switcher
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../../config/routes'
import { useAuth } from '../../../context/AuthContext'
import { useTheme } from '../../../context/ThemeContext'
import { usePermissions } from '../../../context/PermissionContext'
import { useLanguage } from '../../../i18n'
import ProfileModal from '../../ProfileModal/ProfileModal'

const ROLE_BADGES = {
    super_admin: { label: 'Super Admin', bg: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'rgba(239,68,68,0.3)' },
    org_admin: { label: 'Org Admin', bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
    developer: { label: 'Developer', bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
    viewer: { label: 'Viewer', bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
}

export function Header({ isMobile = false, onMenuToggle, mobileMenuOpen = false }) {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const { accent } = useTheme()
    const { role, isSuperAdmin } = usePermissions()
    const { t, lang, setLanguage, locales } = useLanguage()
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const [langOpen, setLangOpen] = useState(false)
    const dropRef = useRef()
    const langRef = useRef()

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false)
            if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const navStyle = (path) => ({
        padding: '6px 14px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500,
        color: pathname === path ? '#f0f4ff' : '#8896b3',
        background: pathname === path ? `${accent}22` : 'transparent',
        transition: 'all 0.2s ease',
        border: pathname === path ? `1px solid ${accent}44` : '1px solid transparent',
    })

    const handleLogout = async () => {
        setDropdownOpen(false)
        await logout()
        navigate('/auth', { replace: true })
    }

    const avatarUrl = user?.avatar_url
    const displayName = user?.display_name || user?.email || '?'
    const initial = displayName[0]?.toUpperCase() || '?'

    return (
        <>
            <header style={{
                position: 'sticky', top: 0, zIndex: 80,
                background: 'rgba(10,13,20,0.9)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #1e2a3d',
                padding: isMobile ? '10px 16px' : '12px 28px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Hamburger menu for mobile */}
                    {isMobile && (
                        <button onClick={onMenuToggle} style={{
                            background: 'none', border: 'none', color: '#8896b3', cursor: 'pointer',
                            fontSize: '1.3rem', padding: '4px 6px', borderRadius: 6, lineHeight: 1,
                            display: 'flex', alignItems: 'center',
                        }}>
                            {mobileMenuOpen ? '✕' : '☰'}
                        </button>
                    )}
                    <Link to={ROUTES.HOME} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: isMobile ? '0.9rem' : '1.05rem', fontWeight: 700, color: '#f0f4ff', letterSpacing: '-0.02em' }}>{t('app.name')}</span>
                        {!isMobile && (
                            <span style={{ fontSize: '0.7rem', color: accent, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t('app.tagline')}</span>
                        )}
                    </Link>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
                    {/* Desktop nav links */}
                    {!isMobile && (
                        <nav style={{ display: 'flex', gap: 6 }}>
                            <Link to={ROUTES.HOME} style={navStyle(ROUTES.HOME)}>{t('nav.upload')}</Link>
                            <Link to={ROUTES.DOCUMENTS} style={navStyle(ROUTES.DOCUMENTS)}>{t('nav.documents')}</Link>
                        </nav>
                    )}

                    {/* Language switcher */}
                    <div ref={langRef} style={{ position: 'relative' }}>
                        <button onClick={() => setLangOpen(o => !o)} style={{
                            background: langOpen ? 'rgba(255,255,255,0.06)' : 'transparent',
                            border: '1px solid transparent', borderRadius: 8,
                            padding: '5px 8px', cursor: 'pointer', color: '#8896b3',
                            fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4,
                            transition: 'all 0.15s',
                        }}
                            onMouseEnter={e => e.currentTarget.style.color = '#f0f4ff'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8896b3'}
                            title={t('common.language')}>
                            🌐{!isMobile && <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>{locales.find(l => l.code === lang)?.flag}</span>}
                        </button>
                        {langOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                                background: 'rgba(13,18,25,0.98)', backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                                boxShadow: '0 12px 36px rgba(0,0,0,0.5)', overflow: 'hidden',
                                minWidth: 150, zIndex: 100,
                            }}>
                                {locales.map(loc => (
                                    <button key={loc.code} onClick={() => { setLanguage(loc.code); setLangOpen(false) }}
                                        style={{
                                            width: '100%', padding: '9px 14px', border: 'none', cursor: 'pointer',
                                            background: lang === loc.code ? `${accent}18` : 'transparent',
                                            color: lang === loc.code ? '#f0f4ff' : '#8896b3',
                                            fontSize: '0.82rem', fontFamily: "'Inter',sans-serif",
                                            display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                                            transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { if (lang !== loc.code) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#f0f4ff' } }}
                                        onMouseLeave={e => { if (lang !== loc.code) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8896b3' } }}>
                                        <span>{loc.flag}</span>
                                        <span>{loc.label}</span>
                                        {lang === loc.code && <span style={{ marginLeft: 'auto', color: accent, fontSize: '0.9rem' }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {user && (
                        <div ref={dropRef} style={{
                            position: 'relative',
                            paddingLeft: isMobile ? 0 : 12,
                            borderLeft: isMobile ? 'none' : '1px solid #1e2a3d',
                            display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10,
                        }}>
                            {/* Role badge next to avatar — hide label on small mobile */}
                            {role && !isMobile && (() => {
                                const badge = ROLE_BADGES[role.name] || ROLE_BADGES.viewer
                                return (
                                    <span style={{
                                        fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px',
                                        borderRadius: 99, background: badge.bg, color: badge.color,
                                        border: `1px solid ${badge.border}`, letterSpacing: '0.03em',
                                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                                    }}>
                                        {badge.label}
                                    </span>
                                )
                            })()}
                            {/* Quota badge */}
                            {user && !isMobile && (() => {
                                const quota = user.request_quota ?? 20
                                const used = user.requests_used ?? 0
                                const remaining = Math.max(0, quota - used)
                                const pct = quota > 0 ? (used / quota) * 100 : 100
                                const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#fbbf24' : '#22c55e'
                                return (
                                    <div title={`${remaining} of ${quota} requests remaining`} style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '3px 10px', borderRadius: 99,
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                    }}>
                                        <span style={{ fontSize: '0.68rem', color: barColor, fontWeight: 700 }}>⚡</span>
                                        <div style={{ width: 40, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 4, background: barColor, transition: 'width 0.3s' }} />
                                        </div>
                                        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#8896b3', whiteSpace: 'nowrap' }}>
                                            {remaining}/{quota}
                                        </span>
                                    </div>
                                )
                            })()}
                            {/* Profile icon button */}
                            <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: avatarUrl ? `url(${avatarUrl}) center/cover` : `${accent}33`,
                                border: `2px solid ${dropdownOpen ? accent : accent + '44'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.85rem', color: accent, fontWeight: 700, cursor: 'pointer',
                                transition: 'all 0.2s', overflow: 'hidden', padding: 0,
                                boxShadow: dropdownOpen ? `0 0 12px ${accent}33` : 'none',
                            }}>
                                {avatarUrl
                                    ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = initial }} />
                                    : initial}
                            </button>

                            {/* Dropdown menu */}
                            {dropdownOpen && (
                                <div style={{
                                    position: isMobile ? 'fixed' : 'absolute',
                                    top: isMobile ? 56 : 'calc(100% + 8px)',
                                    right: isMobile ? 8 : 0,
                                    left: isMobile ? 8 : 'auto',
                                    width: isMobile ? 'auto' : 240,
                                    background: 'rgba(13,18,25,0.98)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                                    overflow: 'hidden', animation: 'fadeIn 0.12s ease',
                                }}>
                                    {/* User info */}
                                    <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f0f4ff' }}>
                                                {user.display_name || 'User'}
                                            </span>
                                            {role && (() => {
                                                const badge = ROLE_BADGES[role.name] || ROLE_BADGES.viewer
                                                return (
                                                    <span style={{
                                                        fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px',
                                                        borderRadius: 99, background: badge.bg, color: badge.color,
                                                        border: `1px solid ${badge.border}`, letterSpacing: '0.03em',
                                                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                                                    }}>
                                                        {badge.label}
                                                    </span>
                                                )
                                            })()}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {user.email}
                                        </div>
                                    </div>

                                    {/* Menu items */}
                                    <div style={{ padding: '6px' }}>
                                        {[
                                            { icon: '👤', label: t('common.profile'), tab: 'profile' },
                                            { icon: '🔒', label: t('common.changePassword'), tab: 'password' },
                                            { icon: '🎨', label: t('common.theme'), tab: 'theme' },
                                        ].map(item => (
                                            <button key={item.tab} onClick={() => {
                                                setDropdownOpen(false)
                                                setProfileOpen(item.tab)
                                            }} style={{
                                                width: '100%', padding: '9px 12px', border: 'none', cursor: 'pointer',
                                                borderRadius: 8, background: 'transparent', color: '#8896b3',
                                                fontSize: '0.82rem', fontFamily: "'Inter',sans-serif",
                                                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                                                transition: 'all 0.15s',
                                            }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#f0f4ff' }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8896b3' }}>
                                                <span style={{ fontSize: '0.9rem', width: 20, textAlign: 'center' }}>{item.icon}</span>
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Logout */}
                                    <div style={{ padding: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                        <button onClick={handleLogout} style={{
                                            width: '100%', padding: '9px 12px', border: 'none', cursor: 'pointer',
                                            borderRadius: 8, background: 'transparent', color: '#4a5568',
                                            fontSize: '0.82rem', fontFamily: "'Inter',sans-serif",
                                            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                                            transition: 'all 0.15s',
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#f87171' }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4a5568' }}>
                                            <span style={{ fontSize: '0.9rem', width: 20, textAlign: 'center' }}>🚪</span>
                                            {t('common.logout')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Profile settings modal */}
            <ProfileModal
                open={!!profileOpen}
                onClose={() => setProfileOpen(false)}
                initialTab={profileOpen || 'profile'}
            />
        </>
    )
}


