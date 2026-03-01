// Upload Page — Drag & Drop with optional Architecture Standards context
import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { analysisRoute } from '../../config/routes'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../i18n'
import { api } from '../../hooks/api'

function useIsMobile(bp = 768) {
    const [m, setM] = useState(window.innerWidth <= bp)
    useEffect(() => { const h = () => setM(window.innerWidth <= bp); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [bp])
    return m
}

export default function UploadPage() {
    const navigate = useNavigate()
    const { accent } = useTheme()
    const { t } = useLanguage()
    const isMobile = useIsMobile()
    const [state, setState] = useState({ status: 'idle', error: null, result: null })
    const [standards, setStandards] = useState('')

    const onDrop = useCallback(async (accepted, rejected) => {
        if (rejected.length > 0) {
            const err = rejected[0].errors[0]
            const msg = err.code === 'file-too-large' ? t('upload.fileTooLarge') : t('upload.unsupportedType')
            setState({ status: 'error', error: msg, result: null })
            return
        }
        if (!accepted.length) return

        setState({ status: 'uploading', error: null, result: null })
        try {
            // Enhancement 5 — pass standards text as form field
            const form = new FormData()
            form.append('file', accepted[0])
            if (standards.trim()) form.append('standards', standards.trim())

            const result = await fetch('/api/upload', { method: 'POST', body: form })
            if (!result.ok) {
                const err = await result.json().catch(() => ({ detail: 'Upload failed' }))
                throw new Error(err.detail || `HTTP ${result.status}`)
            }
            const data = await result.json()
            setState({ status: 'done', error: null, result: data })
            setTimeout(() => navigate(analysisRoute(data.document_id)), 1200)
        } catch (e) {
            setState({ status: 'error', error: e.message || t('upload.error'), result: null })
        }
    }, [navigate, standards])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
        maxSize: 20 * 1024 * 1024,
        multiple: false,
        disabled: state.status === 'uploading',
    })

    const isUploading = state.status === 'uploading'
    const isDone = state.status === 'done'
    const isError = state.status === 'error'

    return (
        <main style={{ minHeight: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '20px 14px' : '32px 24px' }}>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: isMobile ? 24 : 40 }} className="fade-in">
                <h1 style={{ fontSize: isMobile ? '1.4rem' : '2.25rem', fontWeight: 700, color: '#f0f4ff', letterSpacing: '-0.03em', marginBottom: isMobile ? 8 : 12 }}>
                    {t('upload.title')}
                </h1>
                <p style={{ fontSize: isMobile ? '0.85rem' : '1rem', color: '#8896b3' }}>{t('upload.subtitle')}</p>
            </div>

            {/* Drop Zone */}
            <div
                {...getRootProps()}
                style={{
                    width: '100%', maxWidth: 560,
                    padding: isMobile ? '32px 20px' : '64px 40px',
                    border: `2px dashed ${isDragActive ? accent : isError ? '#ef4444' : isDone ? '#22c55e' : '#1e2a3d'}`,
                    borderRadius: '20px',
                    background: isDragActive ? `${accent}11` : isDone ? 'rgba(34,197,94,0.05)' : '#111622',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: isDragActive ? `0 0 32px ${accent}33` : isDone ? '0 0 32px rgba(34,197,94,0.15)' : '0 4px 24px rgba(0,0,0,0.4)',
                }}
                className="fade-in"
            >
                <input {...getInputProps()} />
                <div style={{ fontSize: 48, marginBottom: 16 }}>
                    {isUploading ? '⏳' : isDone ? '✅' : isError ? '❌' : isDragActive ? '📂' : '📄'}
                </div>

                {isUploading && (
                    <>
                        <div className="spinner" style={{ margin: '0 auto 16px' }} />
                        <p style={{ color: '#8896b3', fontSize: '0.95rem' }}>{t('upload.uploading')}</p>
                    </>
                )}
                {isDone && (
                    <>
                        <p style={{ color: '#4ade80', fontWeight: 600, fontSize: '1rem', marginBottom: 8 }}>{t('upload.success')}</p>
                        <p style={{ color: '#8896b3', fontSize: '0.875rem' }}>{t('upload.moduleDetected', state.result?.module_count)}</p>
                        <p style={{ color: '#4a5568', fontSize: '0.8rem', marginTop: 8 }}>Redirecting to analysis…</p>
                    </>
                )}
                {isError && (
                    <>
                        <p style={{ color: '#f87171', fontWeight: 500, fontSize: '0.95rem', marginBottom: 12 }}>{state.error}</p>
                        <p style={{ color: '#8896b3', fontSize: '0.875rem' }}>{t('upload.dragDrop')}</p>
                    </>
                )}
                {state.status === 'idle' && (
                    <>
                        <p style={{ color: '#f0f4ff', fontWeight: 500, fontSize: '1rem', marginBottom: 8 }}>{t('upload.dragDrop')}</p>
                        <p style={{ color: '#8896b3', fontSize: '0.875rem', marginBottom: 20 }}>{t('upload.orClick')}</p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                            {['PDF', 'DOCX'].map(t => (
                                <span key={t} className="badge badge-blue">{t}</span>
                            ))}
                            <span className="badge badge-amber">Max 20MB</span>
                        </div>
                    </>
                )}
            </div>

            {/* Enhancement 5 — Architecture Standards textarea */}
            <div style={{ width: '100%', maxWidth: 560, marginTop: 24 }} className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {t('upload.standardsLabel')}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#2d3a4e', background: '#111622', padding: '2px 8px', borderRadius: 4 }}>{t('upload.standardsOptional')}</span>
                </div>
                <textarea
                    value={standards}
                    onChange={e => setStandards(e.target.value)}
                    placeholder={t('upload.standardsPlaceholder')}
                    style={{
                        width: '100%', minHeight: 120, padding: '12px 16px',
                        background: '#0d1219', border: '1px solid #1e2a3d', borderRadius: 12,
                        color: '#8896b3', fontSize: '0.82rem', fontFamily: "'Inter', sans-serif",
                        resize: 'vertical', outline: 'none', lineHeight: 1.6,
                        transition: 'border 0.2s',
                        boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.border = `1px solid ${accent}`}
                    onBlur={e => e.target.style.border = '1px solid #1e2a3d'}
                />
                {standards.trim() && (
                    <p style={{ fontSize: '0.72rem', color: '#4ade80', marginTop: 6 }}>
                        {t('upload.standardsActive')}
                    </p>
                )}
            </div>

            {/* Info cards */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 16, marginTop: isMobile ? 20 : 32, maxWidth: 560, width: '100%' }} className="fade-in">
                {[
                    { icon: '🎯', label: t('upload.card1Label'), desc: t('upload.card1Desc') },
                    { icon: '🔗', label: t('upload.card2Label'), desc: t('upload.card2Desc') },
                    { icon: '💬', label: t('upload.card3Label'), desc: t('upload.card3Desc') },
                ].map((c) => (
                    <div key={c.label} className="card" style={{ flex: 1, padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f0f4ff', marginBottom: 4 }}>{c.label}</p>
                        <p style={{ fontSize: '0.73rem', color: '#8896b3' }}>{c.desc}</p>
                    </div>
                ))}
            </div>
        </main>
    )
}
