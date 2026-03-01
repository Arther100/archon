// Documents List Page
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { analysisRoute } from '../../config/routes'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../i18n'
import { api } from '../../hooks/api'
import ConfirmModal from '../../components/common/ConfirmModal'

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function useIsMobile(bp = 768) {
    const [m, setM] = useState(window.innerWidth <= bp)
    useEffect(() => { const h = () => setM(window.innerWidth <= bp); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [bp])
    return m
}

export default function DocumentsPage() {
    const navigate = useNavigate()
    const { accent } = useTheme()
    const { t } = useLanguage()
    const isMobile = useIsMobile()
    const [docs, setDocs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [deletingId, setDeletingId] = useState(null)
    const [hoveredId, setHoveredId] = useState(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    const loadDocs = () => {
        setLoading(true)
        api.listDocuments()
            .then(r => setDocs(r.documents || []))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadDocs() }, [])

    const handleDelete = async (e, docId) => {
        e.stopPropagation()
        setConfirmDeleteId(docId)
    }

    const confirmDelete = async () => {
        const docId = confirmDeleteId
        setConfirmDeleteId(null)
        setDeletingId(docId)
        try {
            await api.deleteDocument(docId)
            setDocs(prev => prev.filter(d => d.id !== docId))
        } catch (err) {
            alert(t('documents.deleteFailed') + err.message)
        } finally {
            setDeletingId(null)
        }
    }

    const FILE_ICONS = {
        pdf: { icon: '📕', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.03))' },
        docx: { icon: '📘', gradient: 'linear-gradient(135deg, rgba(59,110,245,0.12), rgba(59,110,245,0.03))' },
        doc: { icon: '📘', gradient: 'linear-gradient(135deg, rgba(59,110,245,0.12), rgba(59,110,245,0.03))' },
        txt: { icon: '📝', gradient: 'linear-gradient(135deg, rgba(156,163,175,0.12), rgba(156,163,175,0.03))' },
    }

    return (
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 14px' : '36px 28px' }}>
            {/* Header */}
            <div style={{ marginBottom: isMobile ? 20 : 28 }}>
                <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 6, letterSpacing: '-0.02em' }}>
                    {t('documents.title')}
                </h1>
                <p style={{ color: '#8896b3', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                    {t('documents.subtitle')}
                </p>
            </div>

            {/* Stats bar */}
            {!loading && !error && docs.length > 0 && (
                <div style={{
                    display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
                }}>
                    {[
                        { label: t('documents.total'), value: docs.length, color: accent },
                        { label: 'PDF', value: docs.filter(d => d.file_type === 'pdf').length, color: '#ef4444' },
                        { label: 'DOCX', value: docs.filter(d => d.file_type !== 'pdf').length, color: '#3b82f6' },
                    ].map(s => (
                        <div key={s.label} style={{
                            padding: '8px 16px', borderRadius: 10,
                            background: '#111622', border: '1px solid #1e2a3d',
                            display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: '0.78rem', color: '#8896b3',
                        }}>
                            <span style={{ fontWeight: 700, color: s.color, fontSize: '1rem' }}>{s.value}</span>
                            {s.label}
                        </div>
                    ))}
                </div>
            )}

            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <div className="spinner" style={{ width: 32, height: 32 }} />
                </div>
            )}

            {error && (
                <div style={{ padding: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#f87171' }}>
                    {error}
                </div>
            )}

            {!loading && !error && docs.length === 0 && (
                <div style={{
                    textAlign: 'center', padding: '60px 20px', color: '#4a5568',
                    background: '#111622', borderRadius: 16, border: '1px dashed #1e2a3d',
                }}>
                    <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.6 }}>📂</div>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: '#8896b3', marginBottom: 6 }}>{t('documents.noDocsTitle')}</p>
                    <p style={{ fontSize: '0.82rem', color: '#4a5568' }}>{t('documents.empty')}</p>
                </div>
            )}

            {/* Grid layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: isMobile ? 12 : 16,
            }}>
                {docs.map(doc => {
                    const ft = FILE_ICONS[doc.file_type] || FILE_ICONS.txt
                    const isHovered = hoveredId === doc.id

                    return (
                        <div
                            key={doc.id}
                            className="fade-in"
                            onClick={() => navigate(analysisRoute(doc.id))}
                            onMouseEnter={() => setHoveredId(doc.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            style={{
                                background: isHovered ? '#161d2e' : '#111622',
                                border: isHovered ? `1px solid ${accent}66` : '1px solid #1e2a3d',
                                borderRadius: 14,
                                padding: 0,
                                cursor: 'pointer',
                                transition: 'all 0.25s ease',
                                transform: isHovered ? 'translateY(-2px)' : 'none',
                                boxShadow: isHovered ? `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${accent}22` : '0 2px 8px rgba(0,0,0,0.2)',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {/* Card top — file icon area */}
                            <div style={{
                                padding: '24px 20px 16px',
                                background: ft.gradient,
                                borderBottom: '1px solid #1a2233',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                            }}>
                                <div style={{ fontSize: 40, lineHeight: 1 }}>{ft.icon}</div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                                        background: doc.file_type === 'pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(59,110,245,0.15)',
                                        color: doc.file_type === 'pdf' ? '#f87171' : '#60a5fa',
                                        border: doc.file_type === 'pdf' ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(59,110,245,0.25)',
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                    }}>
                                        {doc.file_type}
                                    </span>
                                    <button
                                        onClick={(e) => handleDelete(e, doc.id)}
                                        disabled={deletingId === doc.id}
                                        style={{
                                            width: 28, height: 28, borderRadius: 7, fontSize: '0.75rem',
                                            background: isHovered ? 'rgba(239,68,68,0.12)' : 'transparent',
                                            color: '#f87171', border: '1px solid transparent',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.15s', opacity: isHovered ? 1 : 0,
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.border = '1px solid rgba(239,68,68,0.3)' }}
                                        onMouseLeave={e => { e.currentTarget.style.background = isHovered ? 'rgba(239,68,68,0.12)' : 'transparent'; e.currentTarget.style.border = '1px solid transparent' }}
                                    >
                                        {deletingId === doc.id ? '…' : '🗑'}
                                    </button>
                                </div>
                            </div>

                            {/* Card body — file info */}
                            <div style={{ padding: '14px 20px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <p style={{
                                    fontWeight: 600, color: '#f0f4ff', fontSize: '0.88rem',
                                    marginBottom: 6, lineHeight: 1.35,
                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                }}>
                                    {doc.file_name}
                                </p>
                                <p style={{ fontSize: '0.72rem', color: '#5a6a85', marginBottom: 14 }}>
                                    {formatDate(doc.created_at)}
                                </p>

                                {/* Action button */}
                                <div style={{ marginTop: 'auto' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                                        background: isHovered ? accent : `${accent}15`,
                                        color: isHovered ? '#fff' : accent,
                                        border: `1px solid ${isHovered ? accent : accent + '40'}`,
                                        transition: 'all 0.2s ease',
                                    }}>
                                        {t('documents.viewAnalysis')}
                                        <span style={{ fontSize: '0.9rem', transition: 'transform 0.2s', transform: isHovered ? 'translateX(3px)' : 'none' }}>→</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <ConfirmModal
                open={!!confirmDeleteId}
                title={t('confirm.deleteTitle')}
                message={t('documents.deleteConfirm')}
                confirmLabel={t('confirm.yes')}
                cancelLabel={t('confirm.cancel')}
                danger
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </main>
    )
}
