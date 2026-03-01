// Sidebar.jsx — Dynamic sidebar navigation based on permissions
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePermissions } from '../../../context/PermissionContext'
import { useTheme } from '../../../context/ThemeContext'
import { useNotifications } from '../../../context/NotificationContext'
import { useLanguage } from '../../../i18n'
import { APP_VERSION } from '../../../config/version'

export default function Sidebar({ collapsed, onToggle, onNavigate }) {
    const { menuItems, role, isSuperAdmin } = usePermissions()
    const { accent } = useTheme()
    const { unreadCount } = useNotifications()
    const { pathname } = useLocation()

    const width = collapsed ? 60 : 230

    return (
        <aside style={{
            width, minWidth: width, height: '100vh', position: 'sticky', top: 0,
            background: '#0d1117', borderRight: '1px solid #1e2a3d',
            display: 'flex', flexDirection: 'column', transition: 'width 0.25s ease',
            zIndex: 50, overflow: 'hidden',
        }}>
            {/* Logo / Toggle */}
            <div style={{
                padding: collapsed ? '16px 12px' : '16px 18px',
                borderBottom: '1px solid #1e2a3d',
                display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
            }}>
                {!collapsed && (
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f0f4ff', letterSpacing: '-0.01em' }}>
                        Archon
                    </span>
                )}
                <button onClick={onToggle} style={{
                    background: 'none', border: 'none', color: '#8896b3', cursor: 'pointer',
                    fontSize: '1rem', padding: 4, borderRadius: 6, lineHeight: 1,
                    transition: 'color 0.15s',
                }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f0f4ff'}
                    onMouseLeave={e => e.currentTarget.style.color = '#8896b3'}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                    {collapsed ? '☰' : '◀'}
                </button>
            </div>

            {/* Nav items */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {menuItems.map(item => {
                    if (item.divider) {
                        return (
                            <div key={item.key} style={{
                                padding: collapsed ? '10px 0 4px' : '14px 12px 6px',
                                fontSize: '0.68rem', fontWeight: 600, color: '#4a5568',
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                borderTop: '1px solid #1a2233', marginTop: 6,
                            }}>
                                {!collapsed && item.label}
                            </div>
                        )
                    }

                    const isActive = item.path === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.path)

                    const isDisabled = item.enabled === false

                    // Disabled items — visible but grayed out, not clickable
                    if (isDisabled) {
                        return (
                            <div key={item.key} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: collapsed ? '10px 0' : '9px 12px',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                borderRadius: 8, fontSize: '0.82rem', fontWeight: 500,
                                color: '#3a4255',
                                background: 'transparent',
                                border: '1px solid transparent',
                                cursor: 'not-allowed',
                                opacity: 0.5,
                                position: 'relative',
                                userSelect: 'none',
                            }}
                                title={collapsed ? `${item.label} (Locked)` : 'Contact admin to enable this feature'}
                            >
                                <span style={{ fontSize: '1rem', width: 22, textAlign: 'center', flexShrink: 0, filter: 'grayscale(1)' }}>
                                    {item.icon}
                                </span>
                                {!collapsed && (
                                    <>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                            {item.label}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', marginLeft: 'auto', opacity: 0.7 }}>🔒</span>
                                    </>
                                )}
                            </div>
                        )
                    }

                    // Enabled items — normal clickable nav links
                    return (
                        <NavLink key={item.key} to={item.path} onClick={() => onNavigate?.()} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: collapsed ? '10px 0' : '9px 12px',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            borderRadius: 8, fontSize: '0.82rem', fontWeight: 500,
                            color: isActive ? '#f0f4ff' : '#8896b3',
                            background: isActive ? `${accent}18` : 'transparent',
                            border: isActive ? `1px solid ${accent}33` : '1px solid transparent',
                            transition: 'all 0.15s', textDecoration: 'none',
                            position: 'relative',
                        }}
                            title={collapsed ? item.label : undefined}
                            onMouseEnter={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                                    e.currentTarget.style.color = '#f0f4ff'
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'transparent'
                                    e.currentTarget.style.color = '#8896b3'
                                }
                            }}>
                            <span style={{ fontSize: '1rem', width: 22, textAlign: 'center', flexShrink: 0 }}>
                                {item.icon}
                            </span>
                            {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                            {/* Notification badge on Feedback */}
                            {item.key === 'dashboard' && unreadCount > 0 && (
                                <span style={{
                                    position: collapsed ? 'absolute' : 'relative',
                                    top: collapsed ? 4 : 'auto',
                                    right: collapsed ? 4 : 'auto',
                                    marginLeft: collapsed ? 0 : 'auto',
                                    background: '#ef4444', color: '#fff',
                                    fontSize: '0.62rem', fontWeight: 700,
                                    padding: '1px 5px', borderRadius: 99, minWidth: 16, textAlign: 'center',
                                }}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </NavLink>
                    )
                })}
            </nav>

            {/* Role indicator + Version tag */}
            {!collapsed && (
                <div style={{
                    padding: '10px 16px', borderTop: '1px solid #1e2a3d',
                    display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                    {role && (
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px',
                            borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.04em',
                            alignSelf: 'flex-start',
                            background: isSuperAdmin ? 'rgba(239,68,68,0.12)' : `${accent}15`,
                            color: isSuperAdmin ? '#f87171' : accent,
                            border: isSuperAdmin ? '1px solid rgba(239,68,68,0.3)' : `1px solid ${accent}33`,
                        }}>
                            {role.name?.replace('_', ' ')}
                        </span>
                    )}
                    <span style={{ fontSize: '0.65rem', color: '#4a5568' }}>Archon v{APP_VERSION}</span>
                </div>
            )}
        </aside>
    )
}
