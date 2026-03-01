// ConfirmModal — Common reusable delete/action confirmation popup
import { useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'

export default function ConfirmModal({
    open,
    title = 'Confirm',
    message = 'Are you sure?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onCancel,
}) {
    const { accent } = useTheme()
    const backdropRef = useRef()

    useEffect(() => {
        if (!open) return
        const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open, onCancel])

    if (!open) return null

    const confirmColor = danger ? '#ef4444' : accent
    const confirmBg = danger ? 'rgba(239,68,68,0.9)' : accent

    return (
        <div
            ref={backdropRef}
            onClick={(e) => { if (e.target === backdropRef.current) onCancel?.() }}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fadeIn 0.15s ease',
            }}
        >
            <div style={{
                background: 'rgba(13,18,25,0.98)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, width: '90%', maxWidth: 400,
                boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
                overflow: 'hidden', animation: 'fadeIn 0.15s ease',
            }}>
                {/* Header */}
                <div style={{
                    padding: '18px 22px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <span style={{ fontSize: '1.2rem' }}>{danger ? '⚠️' : '❓'}</span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>{title}</h3>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 22px 20px' }}>
                    <p style={{ fontSize: '0.84rem', color: '#8896b3', lineHeight: 1.6 }}>{message}</p>
                </div>

                {/* Actions */}
                <div style={{
                    padding: '12px 22px 18px',
                    display: 'flex', justifyContent: 'flex-end', gap: 10,
                }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 20px', borderRadius: 8, border: '1px solid #1e2a3d',
                            background: 'transparent', color: '#8896b3', fontWeight: 600,
                            fontSize: '0.82rem', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#f0f4ff' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8896b3' }}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '8px 20px', borderRadius: 8, border: 'none',
                            background: confirmBg, color: '#fff', fontWeight: 600,
                            fontSize: '0.82rem', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
