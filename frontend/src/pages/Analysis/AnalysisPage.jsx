// AnalysisPage — Archon: Requirement-to-Architecture Blueprint Engine
// Tabs: Analysis (split doc/gaps) | Fields (section-grouped) | API Schema (editable + download)
import { useState, useEffect, useRef, useCallback } from 'react'
import TestCasesView from './TestCasesView'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'

// ── useIsMobile hook ─────────────────────────────────────────────────────────
function useIsMobile(bp = 768) {
    const [m, setM] = useState(window.innerWidth <= bp)
    useEffect(() => { const h = () => setM(window.innerWidth <= bp); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [bp])
    return m
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ns = (v) => !v || v === 'Not specified in the document' || (Array.isArray(v) && v.length === 0)
const FIELD_ICON = { text: '🔤', number: '🔢', dropdown: '📋', 'multi-select': '☑️', search: '🔍', date: '📅', datetime: '🕐', boolean: '🔘', currency: '💰', textarea: '📝', file: '📎', grid: '⊞', navigation: '🔗', badge: '🏷️', 'action-button': '⚡' }

function downloadJson(data, name) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
    a.click(); URL.revokeObjectURL(a.href)
}

// ── Cache Badge ───────────────────────────────────────────────────────────────
function CacheBadge({ size = 'sm' }) {
    const isSm = size === 'sm'
    return (
        <span title="Cached — instant load" style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: isSm ? '1px 6px' : '2px 8px',
            borderRadius: 999, fontSize: isSm ? '0.58rem' : '0.62rem',
            fontWeight: 600, letterSpacing: '0.02em',
            background: 'rgba(74,222,128,0.12)', color: '#4ade80',
            border: '1px solid rgba(74,222,128,0.25)',
            lineHeight: 1.4, flexShrink: 0
        }}>
            <span style={{ width: isSm ? 6 : 7, height: isSm ? 6 : 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px rgba(74,222,128,0.5)', flexShrink: 0 }} />
            cached
        </span>
    )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function ModuleSidebar({ modules, activeId, onSelect, accent, isMobile, open, onClose, cachedIds }) {
    if (isMobile) {
        // Mobile: horizontal scrollable module list
        return (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 12px', borderBottom: '1px solid #1e2a3d', background: '#0d1219', flexShrink: 0 }}>
                {modules.map(m => (
                    <button key={m.id} onClick={() => onSelect(m)}
                        style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: activeId === m.id ? `${accent}22` : '#111622', color: activeId === m.id ? '#f0f4ff' : '#8896b3', fontSize: '0.72rem', fontWeight: activeId === m.id ? 600 : 400, whiteSpace: 'nowrap', flexShrink: 0, borderBottom: `2px solid ${activeId === m.id ? accent : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {m.title}
                        {cachedIds?.has(m.id) && <CacheBadge size="sm" />}
                    </button>
                ))}
            </div>
        )
    }
    return (
        <aside style={{ width: 250, flexShrink: 0, background: '#0d1219', borderRight: '1px solid #1e2a3d', overflowY: 'auto', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4a5568', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 8px', marginBottom: 10 }}>Modules ({modules.length})</p>
            {modules.map(m => {
                const isCached = cachedIds?.has(m.id)
                return (
                    <button key={m.id} onClick={() => onSelect(m)}
                        style={{ width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeId === m.id ? `${accent}22` : 'transparent', color: activeId === m.id ? '#f0f4ff' : '#8896b3', fontSize: '0.8rem', fontWeight: activeId === m.id ? 600 : 400, borderLeft: `3px solid ${activeId === m.id ? accent : 'transparent'}`, transition: 'all 0.15s' }}
                        onMouseEnter={e => { if (activeId !== m.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#f0f4ff' } }}
                        onMouseLeave={e => { if (activeId !== m.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8896b3' } }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: '0.63rem', color: '#4a5568' }}>#{m.order + 1}</span>
                            {isCached && <CacheBadge size="sm" />}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {m.title}
                        </div>
                    </button>
                )
            })}
        </aside>
    )
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange, accent }) {
    return (
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2a3d', background: '#0d1219', overflowX: 'auto' }}>
            {tabs.map(t => (
                <button key={t.id} onClick={() => onChange(t.id)}
                    style={{ padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', color: active === t.id ? '#f0f4ff' : '#4a5568', fontWeight: active === t.id ? 700 : 400, fontSize: '0.78rem', borderBottom: `2px solid ${active === t.id ? accent : 'transparent'}`, transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {t.icon} {t.label}
                </button>
            ))}
        </div>
    )
}

// ── Fields Table View ─────────────────────────────────────────────────────────
const TYPE_COLOR = {
    text: '#8896b3', number: '#7ba4f8', dropdown: '#a78bfa', 'multi-select': '#c084fc',
    search: '#38bdf8', date: '#fb923c', datetime: '#fb923c', boolean: '#4ade80',
    currency: '#fbbf24', textarea: '#94a3b8', file: '#64748b', grid: '#34d399',
    navigation: '#60a5fa', badge: '#e879f9', 'action-button': '#f472b6'
}
const TYPE_BG = Object.fromEntries(Object.entries(TYPE_COLOR).map(([k, v]) => [k, v + '18']))

function EditBadge({ mode }) {
    if (!mode || mode === 'Not specified in the document') return null
    const cfg = mode === 'create-only' ? { label: 'Create Only', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
        : mode === 'view-only' ? { label: 'Read Only', color: '#f87171', bg: 'rgba(239,68,68,0.12)' }
            : { label: 'Editable', color: '#4ade80', bg: 'rgba(34,197,94,0.12)' }
    return <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 3, background: cfg.bg, color: cfg.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{cfg.label}</span>
}

function FieldDetailPanel({ field, onClose, isMobile }) {
    if (!field) return null
    const fi = FIELD_ICON[field.type] || '🔤'
    return (
        <div style={{
            width: isMobile ? '100%' : 320, flexShrink: 0,
            borderLeft: isMobile ? 'none' : '1px solid #1e2a3d',
            background: '#0d1219', display: 'flex', flexDirection: 'column', overflowY: 'auto',
            ...(isMobile ? { position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '60vh', zIndex: 70, borderTop: '1px solid #1e2a3d', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 30px rgba(0,0,0,0.5)' } : {})
        }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2a3d', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: '1.3rem', marginTop: 2 }}>{fi}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '0.9rem', lineHeight: 1.3 }}>{field.label || field.name}</p>
                    {field.name && field.label && field.name !== field.label && (
                        <p style={{ fontSize: '0.63rem', color: '#4a5568', fontFamily: 'monospace', marginTop: 3 }}>{field.name}</p>
                    )}
                    <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.63rem', padding: '2px 7px', borderRadius: 4, background: TYPE_BG[field.type] || '#1e2a3d', color: TYPE_COLOR[field.type] || '#8896b3', fontWeight: 600 }}>{field.type}</span>
                        {field.required === true && <span style={{ fontSize: '0.63rem', padding: '2px 7px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: 600 }}>Required</span>}
                        <EditBadge mode={field.editable_mode} />
                        {field.global && <span style={{ fontSize: '0.63rem', padding: '2px 7px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent-light)', fontWeight: 600 }}>Global</span>}
                    </div>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '1rem', padding: '0 2px', flexShrink: 0 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Description */}
                {field.description && (
                    <div>
                        <p style={{ fontSize: '0.62rem', color: '#4a5568', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Description</p>
                        <p style={{ fontSize: '0.8rem', color: '#c7d3e8', lineHeight: 1.7 }}>{field.description}</p>
                    </div>
                )}

                {/* Validation */}
                <div style={{ padding: '10px 12px', background: '#111622', borderRadius: 8, border: '1px solid #1e2a3d' }}>
                    <p style={{ fontSize: '0.62rem', color: '#4a5568', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Validation Rule</p>
                    <p style={{ fontSize: '0.8rem', color: ns(field.validation) ? '#4a5568' : '#f0f4ff', fontStyle: ns(field.validation) ? 'italic' : 'normal', lineHeight: 1.5 }}>
                        {ns(field.validation) ? 'Not specified in the document' : field.validation}
                    </p>
                </div>

                {/* Dropdown values */}
                {field.dropdown_values && field.dropdown_values.length > 0 && (
                    <div>
                        <p style={{ fontSize: '0.62rem', color: '#4a5568', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                            Dropdown Options <span style={{ color: 'var(--accent)' }}>({field.dropdown_values.length})</span>
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {field.dropdown_values.map(v => (
                                <span key={v} style={{ fontSize: '0.72rem', padding: '3px 9px', borderRadius: 5, background: 'var(--accent-soft)', color: 'var(--accent-light)', border: '1px solid var(--accent-soft)' }}>{v}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search behavior */}
                {field.search_behavior && (
                    <div style={{ padding: '10px 12px', background: '#111622', borderRadius: 8, border: '1px solid #1e2a3d' }}>
                        <p style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>🔍 Search Behavior</p>
                        <p style={{ fontSize: '0.8rem', color: '#c7d3e8', lineHeight: 1.5 }}>{field.search_behavior}</p>
                    </div>
                )}

                {/* Navigation */}
                {field.navigation_target && (
                    <div style={{ padding: '10px 12px', background: 'var(--accent-soft)', borderRadius: 8, border: '1px solid var(--accent-soft)' }}>
                        <p style={{ fontSize: '0.62rem', color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>🔗 Navigates To</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--accent-light)' }}>→ {field.navigation_target}</p>
                    </div>
                )}

                {/* Global usage */}
                {field.used_by_modules && field.used_by_modules.length > 0 && (
                    <div style={{ padding: '8px 12px', background: 'var(--accent-soft)', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
                        <p style={{ fontSize: '0.62rem', color: '#4a5568', marginBottom: 3 }}>Also used by</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--accent-light)' }}>{field.used_by_modules.join(', ')}</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Fields Tab ────────────────────────────────────────────────────────────────
function FieldsView({ blueprint }) {
    const fields = blueprint.documented?.fields || []
    const images = blueprint.documented?.images || []
    const [filter, setFilter] = useState('all')
    const [selectedField, setSelectedField] = useState(null)

    const types = ['all', ...new Set(fields.map(f => f.type).filter(Boolean))]
    const filtered = filter === 'all' ? fields : fields.filter(f => f.type === filter)

    // Group by section
    const sections = {}
    filtered.forEach(f => {
        const sec = f.section || 'General'
        if (!sections[sec]) sections[sec] = []
        sections[sec].push(f)
    })

    const TH = ({ children, w }) => (
        <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: '0.61rem', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em', width: w, whiteSpace: 'nowrap', border: 'none', background: 'transparent' }}>{children}</th>
    )

    const FieldRow = ({ field }) => {
        const tc = TYPE_COLOR[field.type] || '#8896b3'
        const tb = TYPE_BG[field.type] || '#1e2a3d'
        const isSelected = selectedField?.name === field.name && selectedField?.label === field.label
        return (
            <tr onClick={() => setSelectedField(isSelected ? null : field)}
                style={{ cursor: 'pointer', background: isSelected ? 'var(--accent-soft)' : 'transparent', transition: 'background 0.12s', borderBottom: '1px solid #141c29' }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                {/* Field name */}
                <td style={{ padding: '10px 12px', borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent' }}>
                    <div style={{ fontWeight: 600, color: '#f0f4ff', fontSize: '0.82rem' }}>{field.label || field.name}</div>
                    {field.name && field.label && field.name !== field.label && (
                        <div style={{ fontSize: '0.6rem', color: '#4a5568', fontFamily: 'monospace', marginTop: 2 }}>{field.name}</div>
                    )}
                </td>
                {/* Type */}
                <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: 5, background: tb, color: tc, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {FIELD_ICON[field.type] || ''} {field.type}
                    </span>
                </td>
                {/* Required */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {field.required === true
                        ? <span style={{ fontSize: '0.65rem', color: '#f87171' }}>●</span>
                        : field.required === false
                            ? <span style={{ fontSize: '0.65rem', color: '#2d3a4e' }}>○</span>
                            : <span style={{ fontSize: '0.62rem', color: '#2d3a4e', fontStyle: 'italic' }}>?</span>}
                </td>
                {/* Editable mode */}
                <td style={{ padding: '10px 12px' }}>
                    <EditBadge mode={field.editable_mode} />
                </td>
                {/* Validation (truncated) */}
                <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                    <p style={{ fontSize: '0.75rem', color: ns(field.validation) ? '#2d3a4e' : '#8896b3', fontStyle: ns(field.validation) ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        {ns(field.validation) ? '—' : field.validation}
                    </p>
                </td>
                {/* Extras indicator */}
                <td style={{ padding: '10px 12px', textAlign: 'right', paddingRight: 16 }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {field.dropdown_values?.length > 0 && <span title={`${field.dropdown_values.length} values`} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3, background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>{field.dropdown_values.length}v</span>}
                        {field.search_behavior && <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3, background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>🔍</span>}
                        {field.navigation_target && <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent-light)' }}>→</span>}
                        {field.global && <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent-light)' }}>G</span>}
                    </div>
                </td>
            </tr>
        )
    }

    const isMobile = useIsMobile()

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden', position: 'relative' }}>
            {/* Main table area */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: isMobile ? 'auto' : 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Toolbar */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2a3d', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: '#0d1219', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '0.88rem' }}>Fields & Controls</span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 5, background: '#1e2a3d', color: '#8896b3' }}>{fields.length} total</span>
                    <span style={{ fontSize: '0.7rem', color: '#4a5568' }}>{Object.keys(sections).length} sections</span>
                    {fields.filter(f => f.global).length > 0 && (
                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 5, background: 'var(--accent-soft)', color: 'var(--accent-light)' }}>{fields.filter(f => f.global).length} global</span>
                    )}
                    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
                        {types.map(t => (
                            <button key={t} onClick={() => { setFilter(t); setSelectedField(null) }}
                                style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid', borderColor: filter === t ? 'var(--accent)' : '#1e2a3d', background: filter === t ? 'var(--accent-soft)' : 'transparent', color: filter === t ? 'var(--accent-light)' : '#8896b3', fontSize: '0.68rem', cursor: 'pointer' }}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {fields.length === 0 ? (
                    <div style={{ textAlign: 'center', paddingTop: 60, color: '#4a5568' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                        <p>No fields detected — run Analysis first</p>
                    </div>
                ) : (
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {Object.entries(sections).map(([sec, sFields]) => (
                            <div key={sec}>
                                {/* Section row */}
                                <div style={{ padding: '7px 16px', background: 'var(--accent-soft)', borderBottom: '1px solid #141c29', borderTop: '1px solid #1e2a3d', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 1 }}>
                                    <div style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--accent)', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{sec}</span>
                                    <span style={{ fontSize: '0.63rem', color: '#2d3a4e' }}>{sFields.length} field{sFields.length !== 1 ? 's' : ''}</span>
                                </div>
                                {/* Fields table */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: '26%' }} />
                                        <col style={{ width: '13%' }} />
                                        <col style={{ width: '7%' }} />
                                        <col style={{ width: '11%' }} />
                                        <col style={{ width: 'auto' }} />
                                        <col style={{ width: '80px' }} />
                                    </colgroup>
                                    {/* Header only on first section */}
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #141c29' }}>
                                            <TH>Field</TH>
                                            <TH>Type</TH>
                                            <TH w="7%">Req.</TH>
                                            <TH>Mode</TH>
                                            <TH>Validation</TH>
                                            <TH></TH>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sFields.map((f, i) => <FieldRow key={i} field={f} />)}
                                    </tbody>
                                </table>
                            </div>
                        ))}

                        {/* Images section */}
                        {images.length > 0 && (
                            <div style={{ margin: '16px 16px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '5px 10px', background: 'rgba(245,158,11,0.06)', borderRadius: 6, borderLeft: '3px solid rgba(245,158,11,0.4)' }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🖼 Images in Document</span>
                                </div>
                                {images.map((img, i) => (
                                    <div key={i} style={{ padding: '7px 12px', background: '#111622', borderRadius: 6, border: '1px solid #1e2a3d', fontSize: '0.78rem', color: '#c7d3e8', marginBottom: 5 }}>🖼 {img}</div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Detail panel */}
            {selectedField && <FieldDetailPanel field={selectedField} onClose={() => setSelectedField(null)} isMobile={isMobile} />}
        </div>
    )
}


// ── Analysis Split View ───────────────────────────────────────────────────────
function AnalysisSplitView({ blueprint, isMobile }) {
    const doc = blueprint.documented || {}
    const gaps = blueprint.gaps || {}
    const conn = blueprint.connectivity || {}
    const hasConn = !ns(conn.depends_on) || !ns(conn.provides_to) || !ns(conn.shared_fields)

    const Section = ({ title, items, color = '#c7d3e8' }) => (
        <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{title}</p>
            {ns(items)
                ? <p style={{ fontSize: '0.78rem', color: '#4a5568', fontStyle: 'italic' }}>None specified</p>
                : Array.isArray(items)
                    ? <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {items.map((it, i) => <li key={i} style={{ fontSize: '0.81rem', color, lineHeight: 1.6 }}>• {it}</li>)}
                    </ul>
                    : <p style={{ fontSize: '0.81rem', color, lineHeight: 1.6 }}>{items}</p>
            }
        </div>
    )

    return (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: isMobile ? 'auto' : 'hidden' }}>
            {/* LEFT — What's documented */}
            <div style={{ flex: isMobile ? 'none' : '0 0 58%', overflowY: 'auto', padding: isMobile ? '16px 14px' : '20px 24px', borderRight: isMobile ? 'none' : '1px solid #1e2a3d', borderBottom: isMobile ? '1px solid #1e2a3d' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #1e2a3d' }}>
                    <span>📄</span>
                    <span style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '0.9rem' }}>What's in the Document</span>
                    <span style={{ fontSize: '0.63rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#4ade80', marginLeft: 'auto' }}>Factual only</span>
                </div>
                {doc.summary && !ns(doc.summary) && (
                    <div style={{ marginBottom: 18, padding: '12px 14px', background: 'var(--accent-soft)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
                        <p style={{ fontSize: '0.84rem', color: '#c7d3e8', lineHeight: 1.7 }}>{doc.summary}</p>
                    </div>
                )}
                <Section title="Business Goal" items={doc.business_goal} />
                <Section title="Business Flow" items={doc.business_flow} />
                <Section title="Functional Rules" items={doc.functional_rules} />
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                    <Section title="User Actions" items={doc.user_actions} />
                    <Section title="System Behaviors" items={doc.system_behaviors} />
                    <Section title="In Scope" items={doc.scope_in} color="#4ade80" />
                    <Section title="Out of Scope" items={doc.scope_out} color="#f87171" />
                    {!ns(doc.future_scope) && <Section title="🕒 Future Scope" items={doc.future_scope} color="#f59e0b" />}
                </div>

                {/* Data Entities — BRD schema definitions */}
                {!ns(doc.data_entities) && (
                    <div style={{ marginTop: 20, padding: '14px', background: '#0d1219', borderRadius: 10, border: '1px solid #1e2a3d' }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>🗃️ Data Entities / Schema Definitions</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {doc.data_entities.map((entity, i) => (
                                <div key={i} style={{ padding: '10px 12px', background: 'rgba(129,140,248,0.06)', borderRadius: 8, border: '1px solid rgba(129,140,248,0.15)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <span style={{ fontWeight: 700, color: '#c7d3e8', fontSize: '0.84rem' }}>{entity.entity_name}</span>
                                        {entity.description && <span style={{ fontSize: '0.72rem', color: '#4a5568' }}>— {entity.description}</span>}
                                    </div>
                                    {entity.attributes && entity.attributes.length > 0 && (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', fontSize: '0.74rem', borderCollapse: 'collapse' }}>
                                                <thead><tr style={{ borderBottom: '1px solid #1e2a3d' }}>
                                                    <th style={{ textAlign: 'left', padding: '4px 8px', color: '#4a5568', fontWeight: 600 }}>Attribute</th>
                                                    <th style={{ textAlign: 'left', padding: '4px 8px', color: '#4a5568', fontWeight: 600 }}>Type</th>
                                                    <th style={{ textAlign: 'left', padding: '4px 8px', color: '#4a5568', fontWeight: 600 }}>Constraints</th>
                                                    <th style={{ textAlign: 'left', padding: '4px 8px', color: '#4a5568', fontWeight: 600 }}>Description</th>
                                                </tr></thead>
                                                <tbody>{entity.attributes.map((attr, j) => (
                                                    <tr key={j} style={{ borderBottom: '1px solid rgba(30,42,61,0.5)' }}>
                                                        <td style={{ padding: '4px 8px', color: '#c7d3e8', fontFamily: 'monospace' }}>{attr.name}</td>
                                                        <td style={{ padding: '4px 8px', color: '#818cf8' }}>{attr.type}</td>
                                                        <td style={{ padding: '4px 8px', color: '#f59e0b', fontSize: '0.7rem' }}>{attr.constraints || '—'}</td>
                                                        <td style={{ padding: '4px 8px', color: '#8896b3' }}>{attr.description || '—'}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        </div>
                                    )}
                                    {entity.relationships && entity.relationships.length > 0 && (
                                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {entity.relationships.map((rel, k) => (
                                                <span key={k} style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>🔗 {rel}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Discussion Items — inline comments and unresolved questions */}
                {!ns(doc.discussion_items) && (
                    <div style={{ marginTop: 16, padding: '14px', background: 'rgba(245,158,11,0.03)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.15)' }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>💬 Discussion Items / Open Questions</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {doc.discussion_items.map((item, i) => (
                                <div key={i} style={{ padding: '7px 11px', background: 'rgba(245,158,11,0.06)', borderRadius: 7, borderLeft: '3px solid rgba(245,158,11,0.3)', fontSize: '0.79rem', color: '#c7d3e8', lineHeight: 1.5 }}>🗨️ {item}</div>
                            ))}
                        </div>
                    </div>
                )}
                {hasConn && (
                    <div style={{ marginTop: 20, padding: '14px', background: '#0d1219', borderRadius: 10, border: '1px solid #1e2a3d' }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>🔗 Module Connectivity</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {!ns(conn.depends_on) && conn.depends_on.map((d, i) => <div key={i} style={{ fontSize: '0.78rem', display: 'flex', gap: 8 }}><span style={{ color: '#f59e0b', flexShrink: 0 }}>← Depends on:</span><span style={{ color: '#c7d3e8' }}>{d}</span></div>)}
                            {!ns(conn.provides_to) && conn.provides_to.map((d, i) => <div key={i} style={{ fontSize: '0.78rem', display: 'flex', gap: 8 }}><span style={{ color: '#4ade80', flexShrink: 0 }}>→ Provides to:</span><span style={{ color: '#c7d3e8' }}>{d}</span></div>)}
                            {!ns(conn.shared_fields) && conn.shared_fields.map((d, i) => <div key={i} style={{ fontSize: '0.78rem', display: 'flex', gap: 8 }}><span style={{ color: 'var(--accent-light)', flexShrink: 0 }}>⇄ Shared:</span><span style={{ color: '#c7d3e8' }}>{d}</span></div>)}
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT — Developer Gaps */}
            <div style={{ flex: isMobile ? 'none' : '0 0 42%', overflowY: 'auto', padding: isMobile ? '16px 14px' : '20px 20px', background: 'rgba(239,68,68,0.015)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                    <span>🧠</span>
                    <span style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '0.9rem' }}>Developer Gap Analysis</span>
                    <span style={{ fontSize: '0.63rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#f87171', marginLeft: 'auto' }}>Senior Dev Mindset</span>
                </div>

                {ns(gaps.missing_specs) && ns(gaps.ambiguous) && ns(gaps.developer_recommendations) && ns(gaps.risk_flags) ? (
                    <div style={{ textAlign: 'center', paddingTop: 40, color: '#4a5568' }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                        <p style={{ fontSize: '0.85rem' }}>No significant gaps found.</p>
                    </div>
                ) : (
                    <>
                        {!ns(gaps.missing_specs) && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>⚠️ Missing Specifications</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {gaps.missing_specs.map((s, i) => <div key={i} style={{ padding: '7px 11px', background: 'rgba(239,68,68,0.06)', borderRadius: 7, borderLeft: '3px solid rgba(239,68,68,0.4)', fontSize: '0.79rem', color: '#c7d3e8', lineHeight: 1.5 }}>❌ {s}</div>)}
                                </div>
                            </div>
                        )}
                        {!ns(gaps.ambiguous) && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>🔶 Ambiguous</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {gaps.ambiguous.map((s, i) => <div key={i} style={{ padding: '7px 11px', background: 'rgba(245,158,11,0.06)', borderRadius: 7, borderLeft: '3px solid rgba(245,158,11,0.4)', fontSize: '0.79rem', color: '#c7d3e8', lineHeight: 1.5 }}>⚡ {s}</div>)}
                                </div>
                            </div>
                        )}
                        {!ns(gaps.developer_recommendations) && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>💡 Dev Recommendations</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {gaps.developer_recommendations.map((s, i) => <div key={i} style={{ padding: '7px 11px', background: 'rgba(34,197,94,0.06)', borderRadius: 7, borderLeft: '3px solid rgba(34,197,94,0.3)', fontSize: '0.79rem', color: '#c7d3e8', lineHeight: 1.5 }}>→ {s}</div>)}
                                </div>
                            </div>
                        )}
                        {!ns(gaps.risk_flags) && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>🚨 Risk Flags</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {gaps.risk_flags.map((s, i) => <div key={i} style={{ padding: '7px 11px', background: 'rgba(167,139,250,0.06)', borderRadius: 7, borderLeft: '3px solid rgba(167,139,250,0.3)', fontSize: '0.79rem', color: '#c7d3e8', lineHeight: 1.5 }}>⚑ {s}</div>)}
                                </div>
                            </div>
                        )}
                        {!ns(gaps.pending_decisions) && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>⏳ Pending Decisions</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {gaps.pending_decisions.map((s, i) => <div key={i} style={{ padding: '7px 11px', background: 'rgba(251,146,60,0.06)', borderRadius: 7, borderLeft: '3px solid rgba(251,146,60,0.4)', fontSize: '0.79rem', color: '#c7d3e8', lineHeight: 1.5 }}>⏳ {s}</div>)}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}


// ── API Schema Tab ────────────────────────────────────────────────────────────
function ApiSchemaView({ moduleId, blueprint }) {
    const schema = blueprint.api_schema || {}
    const [edited, setEdited] = useState(JSON.stringify(schema, null, 2))
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState('')
    const [activeMethod, setActiveMethod] = useState('GET')
    const methods = ['GET', 'POST', 'PUT', 'DELETE']
    const methodColor = { GET: '#4ade80', POST: '#3b6ef5', PUT: '#f59e0b', DELETE: '#f87171' }

    const getMethodSchema = useCallback((method) => {
        try { return JSON.stringify(JSON.parse(edited)[method] || {}, null, 2) } catch { return '{}' }
    }, [edited])

    const updateMethod = (method, val) => {
        try {
            const full = JSON.parse(edited)
            full[method] = JSON.parse(val)
            setEdited(JSON.stringify(full, null, 2))
            setSaveMsg('')
        } catch { }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const parsed = JSON.parse(edited)
            await api.saveApiSchema(moduleId, parsed)
            setSaveMsg('✓ Saved')
            setTimeout(() => setSaveMsg(''), 3000)
        } catch (e) { setSaveMsg(`Error: ${e.message}`) }
        finally { setSaving(false) }
    }

    const handleDownload = () => {
        try {
            const parsed = JSON.parse(edited)
            downloadJson({ resource: schema.resource, api_schema: parsed }, `${schema.resource || 'resource'}_api_schema.json`)
        } catch { alert('Fix JSON errors before downloading') }
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e2a3d', display: 'flex', alignItems: 'center', gap: 10, background: '#0d1219', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '0.88rem' }}>🔌 API Schema</span>
                <span style={{ fontSize: '0.72rem', color: '#4a5568', flexShrink: 0 }}>{schema.base_endpoint || '/api/v1/resource'}</span>
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
                    {saveMsg && <span style={{ fontSize: '0.75rem', color: saveMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{saveMsg}</span>}
                    <button onClick={handleSave} disabled={saving}
                        style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: saving ? '#1e2a3d' : 'var(--accent)', color: saving ? '#4a5568' : '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Saving…' : '💾 Save'}
                    </button>
                    <button onClick={handleDownload}
                        style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #22c55e', background: 'rgba(34,197,94,0.08)', color: '#4ade80', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                        ⬇ Download
                    </button>
                </div>
            </div>

            {/* Method tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e2a3d', background: '#111622' }}>
                {methods.map(m => (
                    <button key={m} onClick={() => setActiveMethod(m)}
                        style={{ padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', color: activeMethod === m ? methodColor[m] : '#4a5568', borderBottom: `2px solid ${activeMethod === m ? methodColor[m] : 'transparent'}`, transition: 'all 0.15s' }}>{m}</button>
                ))}
            </div>

            {/* Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 20px' }}>
                <p style={{ fontSize: '0.68rem', color: '#4a5568', marginBottom: 8 }}>
                    Edit the <strong style={{ color: methodColor[activeMethod] }}>{activeMethod}</strong> schema — click Save to persist
                </p>
                <textarea
                    value={getMethodSchema(activeMethod)}
                    onChange={e => updateMethod(activeMethod, e.target.value)}
                    spellCheck={false}
                    style={{ flex: 1, padding: '14px', background: '#0a0d14', border: '1px solid #1e2a3d', borderRadius: 10, color: '#a8c4f0', fontSize: '0.8rem', fontFamily: "'JetBrains Mono','Courier New',monospace", resize: 'none', outline: 'none', lineHeight: 1.7 }}
                    onFocus={e => e.target.style.border = `1px solid ${methodColor[activeMethod]}`}
                    onBlur={e => e.target.style.border = '1px solid #1e2a3d'}
                />
            </div>
        </div>
    )
}

// ── Connectivity Map View ─────────────────────────────────────────────────────
function ConnectivityMapView({ documentId }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [subTab, setSubTab] = useState('overview')
    const [llmLoading, setLlmLoading] = useState(false)
    const [llmResult, setLlmResult] = useState(null)

    useEffect(() => {
        setLoading(true); setError(null)
        api.getConnectivityMap(documentId)
            .then(r => setData(r))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [documentId])

    const runLlmAnalysis = async () => {
        setLlmLoading(true)
        try {
            const res = await api.generateConnectivityMap(documentId)
            setLlmResult(res)
        } catch (e) { setError(e.message) }
        finally { setLlmLoading(false) }
    }

    if (loading) return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
            <span style={{ color: '#8896b3', fontSize: '0.85rem' }}>Loading connectivity map…</span>
        </div>
    )
    if (error) return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: '0.85rem' }}>⚠ {error}</div>
    )
    if (!data) return null

    const source = llmResult || data
    const connections = source.connections || []
    const sharedFields = source.shared_field_map || []
    const modules = source.modules || []

    const subTabs = [
        { id: 'overview', label: '📊 Overview' },
        { id: 'connections', label: `🔗 Connections (${connections.length})` },
        { id: 'shared', label: `🔄 Shared Fields (${sharedFields.length})` },
    ]

    const strengthColor = { strong: '#4ade80', medium: '#fbbf24', weak: '#f87171' }
    const relIcon = { depends_on: '→', provides_to: '←', shares_data: '↔', references: '↗', lookup: '🔍' }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Sub-tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid #1e2a3d', background: '#0d1219', flexShrink: 0 }}>
                {subTabs.map(t => (
                    <button key={t.id} onClick={() => setSubTab(t.id)}
                        style={{ padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', color: subTab === t.id ? '#f0f4ff' : '#4a5568', fontWeight: subTab === t.id ? 700 : 400, fontSize: '0.74rem', borderBottom: `2px solid ${subTab === t.id ? 'var(--accent)' : 'transparent'}`, transition: 'all 0.15s' }}>
                        {t.label}
                    </button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={runLlmAnalysis} disabled={llmLoading}
                    style={{ margin: '0 12px', padding: '5px 14px', borderRadius: 6, border: '1px solid var(--accent)', background: llmLoading ? '#1e2a3d' : 'transparent', color: llmLoading ? '#4a5568' : 'var(--accent)', fontSize: '0.7rem', fontWeight: 600, cursor: llmLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {llmLoading ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Analysing…</> : '🤖 Deep LLM Analysis'}
                </button>
            </div>

            {/* Sub-tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
                {subTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Stats */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Modules', value: source.module_count || modules.length, icon: '📦', color: '#7ba4f8' },
                                { label: 'Analyzed', value: source.analyzed_count || modules.filter(m => m.has_analysis).length, icon: '✅', color: '#4ade80' },
                                { label: 'Connections', value: connections.length, icon: '🔗', color: '#a78bfa' },
                                { label: 'Shared Fields', value: sharedFields.length, icon: '🔄', color: '#fbbf24' },
                            ].map(s => (
                                <div key={s.label} style={{ padding: '14px 18px', borderRadius: 10, border: '1px solid #1e2a3d', background: '#0d1219', minWidth: 130, flex: 1 }}>
                                    <div style={{ fontSize: '1.1rem', marginBottom: 4 }}>{s.icon}</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#4a5568', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                        {/* Module list */}
                        <div>
                            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8896b3', marginBottom: 10, letterSpacing: '0.05em' }}>MODULE STATUS</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {modules.map(m => (
                                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#111622', border: '1px solid #1e2a3d' }}>
                                        <span style={{ fontSize: '0.66rem', color: '#4a5568', minWidth: 22 }}>#{m.order + 1}</span>
                                        <span style={{ flex: 1, fontSize: '0.82rem', color: '#c7d3e8', fontWeight: 500 }}>{m.title}</span>
                                        <span style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: 4, background: m.has_analysis ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: m.has_analysis ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                                            {m.has_analysis ? `${m.field_count} fields` : 'Not analyzed'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {llmResult && llmResult.dependency_groups && (
                            <div>
                                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8896b3', marginBottom: 10, letterSpacing: '0.05em' }}>DEPENDENCY GROUPS</p>
                                {llmResult.dependency_groups.map((g, i) => (
                                    <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: '#111622', border: '1px solid #1e2a3d', marginBottom: 6 }}>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f0f4ff' }}>{g.name || g.group || `Group ${i + 1}`}</p>
                                        <p style={{ fontSize: '0.72rem', color: '#8896b3', marginTop: 4 }}>{Array.isArray(g.modules) ? g.modules.join(' → ') : JSON.stringify(g)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {subTab === 'connections' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {connections.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#4a5568', padding: 40, fontSize: '0.85rem' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 10 }}>🔗</div>
                                No connections detected yet. Try "🤖 Deep LLM Analysis" for intelligent detection.
                            </div>
                        ) : connections.map((c, i) => (
                            <div key={i} style={{ padding: '12px 16px', borderRadius: 10, background: '#111622', border: '1px solid #1e2a3d', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#c7d3e8' }}>{c.from_module}</span>
                                    <span style={{ fontSize: '0.9rem', color: strengthColor[c.strength] || '#8896b3' }}>{relIcon[c.relationship] || '→'}</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#c7d3e8' }}>{c.to_module}</span>
                                    <span style={{ fontSize: '0.58rem', padding: '2px 7px', borderRadius: 4, background: (strengthColor[c.strength] || '#8896b3') + '18', color: strengthColor[c.strength] || '#8896b3', fontWeight: 600, marginLeft: 'auto' }}>{c.relationship?.replace(/_/g, ' ')}</span>
                                </div>
                                <p style={{ fontSize: '0.74rem', color: '#6b7a94', lineHeight: 1.5 }}>{c.reason}</p>
                                {c.shared_fields && c.shared_fields.length > 0 && (
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {c.shared_fields.map(f => (
                                            <span key={f} style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent-light)', fontFamily: 'monospace' }}>{f}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {subTab === 'shared' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {sharedFields.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#4a5568', padding: 40, fontSize: '0.85rem' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 10 }}>🔄</div>
                                No shared fields detected between modules.
                            </div>
                        ) : sharedFields.map((sf, i) => (
                            <div key={i} style={{ padding: '12px 16px', borderRadius: 10, background: '#111622', border: '1px solid #1e2a3d' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f0f4ff', fontFamily: 'monospace' }}>{sf.field_label || sf.field_name}</span>
                                    <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 4, background: TYPE_BG[sf.field_type] || '#1e2a3d', color: TYPE_COLOR[sf.field_type] || '#8896b3', fontWeight: 600 }}>{sf.field_type}</span>
                                    <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 4, background: 'rgba(168,196,240,0.1)', color: '#a8c4f0', fontWeight: 600, marginLeft: 'auto' }}>{sf.count} modules</span>
                                </div>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {sf.modules.map(mod => (
                                        <span key={mod} style={{ fontSize: '0.68rem', padding: '3px 9px', borderRadius: 5, background: '#0d1219', border: '1px solid #1e2a3d', color: '#8896b3' }}>📦 {mod}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Shared Chat Bubbles renderer ──────────────────────────────────────────────
function ChatBubbles({ messages, loading, scrollRef }) {
    return (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && !loading && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#2d3a4e', gap: 8 }}>
                    <span style={{ fontSize: '2.4rem', opacity: 0.3 }}>💬</span>
                    <p style={{ fontSize: '0.88rem', color: '#4a5568' }}>Ask anything about your document</p>
                    <p style={{ fontSize: '0.72rem', color: '#2d3a4e' }}>Answers are grounded in the uploaded document only</p>
                </div>
            )}
            {messages.map((msg, i) => (
                <div key={i} className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                        padding: '10px 16px',
                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.role === 'user' ? 'var(--accent)' : '#151b28',
                        border: msg.role === 'user' ? 'none' : '1px solid #1e2a3d',
                        color: msg.role === 'user' ? '#fff' : '#c7d3e8',
                        fontSize: '0.84rem', lineHeight: 1.65,
                    }}>
                        {msg.role === 'ai' ? <div style={{ lineHeight: 1.7 }}><ReactMarkdown>{msg.text}</ReactMarkdown></div> : msg.text}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 3, alignItems: 'center' }}>
                        {msg.role === 'ai' && msg.sourced !== undefined && (
                            msg.sourced
                                ? <span style={{ fontSize: '0.6rem', padding: '1px 7px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>✓ sourced</span>
                                : <span style={{ fontSize: '0.6rem', padding: '1px 7px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>⚠ not in doc</span>
                        )}
                        {msg.role === 'ai' && msg.sourceSection && msg.sourced && (
                            <span style={{ fontSize: '0.6rem', padding: '1px 7px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent-light)' }}>📍 {msg.sourceSection}</span>
                        )}
                        {msg.scopeLabel && <span style={{ fontSize: '0.58rem', color: '#2d3a4e' }}>{msg.scopeLabel}</span>}
                    </div>
                </div>
            ))}
            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '10px 16px', borderRadius: '16px 16px 16px 4px', background: '#151b28', border: '1px solid #1e2a3d' }}>
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                    <span style={{ fontSize: '0.78rem', color: '#4a5568' }}>Thinking…</span>
                </div>
            )}
        </div>
    )
}

// ── Shared Chat Input Bar ─────────────────────────────────────────────────────
function ChatInputBar({ question, setQuestion, handleAsk, loading, scope, setScope, activeModule, inputRef, size = 'normal' }) {
    const isSm = size === 'small'
    return (
        <div style={{ padding: isSm ? '8px 14px' : '12px 18px', borderTop: '1px solid #1e2a3d', display: 'flex', gap: 8, flexShrink: 0, background: '#0d1219', alignItems: 'center' }}>
            {/* Scope toggle */}
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #1e2a3d', flexShrink: 0 }}>
                {[{ v: 'document', l: '📄' }, { v: 'module', l: '📦', d: !activeModule }].map(btn => (
                    <button key={btn.v} onClick={() => !btn.d && setScope(btn.v)} disabled={btn.d} title={btn.v === 'document' ? 'Document scope' : 'Module scope'}
                        style={{ padding: isSm ? '4px 8px' : '5px 10px', border: 'none', cursor: btn.d ? 'not-allowed' : 'pointer', fontSize: isSm ? '0.7rem' : '0.78rem', background: scope === btn.v ? 'var(--accent)' : '#111622', color: scope === btn.v ? '#fff' : btn.d ? '#2d3a4e' : '#8896b3' }}>{btn.l}</button>
                ))}
            </div>
            {scope === 'module' && activeModule && (
                <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: 5, background: 'var(--accent-soft)', color: 'var(--accent-light)', flexShrink: 0, whiteSpace: 'nowrap' }}>{activeModule.title}</span>
            )}
            <input ref={inputRef} value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() } }}
                placeholder={scope === 'module' && activeModule ? `Ask about ${activeModule.title}…` : 'Ask about your document…'}
                disabled={loading}
                style={{ flex: 1, padding: isSm ? '8px 12px' : '10px 16px', background: '#111622', border: '1px solid #1e2a3d', borderRadius: 8, color: '#f0f4ff', fontSize: isSm ? '0.8rem' : '0.86rem', fontFamily: "'Inter',sans-serif", outline: 'none' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = '#1e2a3d'} />
            <button onClick={handleAsk} disabled={loading || !question.trim()}
                style={{ padding: isSm ? '8px 14px' : '10px 20px', borderRadius: 8, border: 'none', cursor: loading || !question.trim() ? 'not-allowed' : 'pointer', background: loading || !question.trim() ? '#1e2a3d' : 'var(--accent)', color: loading || !question.trim() ? '#4a5568' : '#fff', fontWeight: 600, fontSize: isSm ? '0.78rem' : '0.84rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                {loading ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />…</> : '⏎ Ask'}
            </button>
        </div>
    )
}

// ── Q&A Chat — Full Tab View (Conversation Flow) ─────────────────────────────
function QAChatFullView({ documentId, activeModule, isMobile }) {
    const [question, setQuestion] = useState('')
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(false)
    const [scope, setScope] = useState('document')
    const inputRef = useRef()
    const scrollRef = useRef()

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages.length, loading])

    const handleAsk = async () => {
        const q = question.trim()
        if (!q || loading) return
        const scopeLabel = scope === 'module' && activeModule ? activeModule.title : 'Document'
        setMessages(prev => [...prev, { role: 'user', text: q, scopeLabel }])
        setLoading(true); setQuestion('')
        try {
            const res = scope === 'module' && activeModule
                ? await api.askModuleQuestion(activeModule.id, q)
                : await api.askQuestion(documentId, q)
            setMessages(prev => [...prev, { role: 'ai', text: res.answer, sourced: res.sourced, sourceSection: res.source_section || '', scopeLabel }])
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}`, sourced: false, sourceSection: '' }])
        } finally { setLoading(false); inputRef.current?.focus() }
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0e15' }}>
            <ChatBubbles messages={messages} loading={loading} scrollRef={scrollRef} />
            <ChatInputBar question={question} setQuestion={setQuestion} handleAsk={handleAsk} loading={loading} scope={scope} setScope={setScope} activeModule={activeModule} inputRef={inputRef} size="normal" />
        </div>
    )
}

// ── Q&A Chat — Bottom Collapsible Panel (Conversation Flow) ───────────────────
function QAChatPanel({ documentId, activeModule, isMobile }) {
    const [open, setOpen] = useState(false)
    const [question, setQuestion] = useState('')
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(false)
    const [scope, setScope] = useState('document')
    const inputRef = useRef()
    const scrollRef = useRef()

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages.length, loading])

    const handleAsk = async () => {
        const q = question.trim()
        if (!q || loading) return
        const scopeLabel = scope === 'module' && activeModule ? activeModule.title : 'Document'
        setMessages(prev => [...prev, { role: 'user', text: q, scopeLabel }])
        setLoading(true); setQuestion('')
        try {
            const res = scope === 'module' && activeModule
                ? await api.askModuleQuestion(activeModule.id, q)
                : await api.askQuestion(documentId, q)
            setMessages(prev => [...prev, { role: 'ai', text: res.answer, sourced: res.sourced, sourceSection: res.source_section || '', scopeLabel }])
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}`, sourced: false, sourceSection: '' }])
        } finally { setLoading(false); inputRef.current?.focus() }
    }

    const PANEL_H = open ? (isMobile ? 340 : 380) : 44

    return (
        <div style={{ flexShrink: 0, borderTop: '1px solid #1e2a3d', background: '#0a0e15', transition: 'height 0.25s ease', height: PANEL_H, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header bar — always visible, click to toggle */}
            <div onClick={() => setOpen(p => !p)}
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#0d1219', flexShrink: 0, userSelect: 'none', borderBottom: open ? '1px solid #1e2a3d' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.82rem' }}>💬</span>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#8896b3', letterSpacing: '0.04em' }}>Chat</span>
                    {messages.length > 0 && <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 99, background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>{messages.filter(m => m.role === 'user').length}</span>}
                </div>
                <span style={{ color: '#4a5568', fontSize: '0.8rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▲</span>
            </div>

            <ChatBubbles messages={messages} loading={loading} scrollRef={scrollRef} />
            <ChatInputBar question={question} setQuestion={setQuestion} handleAsk={handleAsk} loading={loading} scope={scope} setScope={setScope} activeModule={activeModule} inputRef={inputRef} size="small" />
        </div>
    )
}

// ── History Tab ───────────────────────────────────────────────────────────────
function HistoryView({ moduleId, onRestore }) {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        api.getAnalysisHistory(moduleId)
            .then(r => setHistory(r.history || []))
            .catch(e => console.error(e))
            .finally(() => setLoading(false))
    }, [moduleId])

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}><div className="spinner" style={{ width: 30, height: 30 }} /></div>
    if (!history.length) return <div style={{ padding: 40, textAlign: 'center', color: '#4a5568' }}>No history found for this module.</div>

    return (
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
            <p style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '0.96rem', marginBottom: 16 }}>Analysis History</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #1e2a3d', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Date & Time</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Rev</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Score/Acc</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Fields/Gaps</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Action</th>
                    </tr>
                </thead>
                <tbody style={{ color: '#c7d3e8' }}>
                    {history.map(h => (
                        <tr key={h.analysis_id} style={{ borderBottom: '1px solid #141c29', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '12px 14px' }}>
                                <div>{new Date(h.created_at).toLocaleDateString()}</div>
                                <div style={{ fontSize: '0.7rem', color: '#8896b3', marginTop: 2 }}>{new Date(h.created_at).toLocaleTimeString()}</div>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>v{h.version}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    {h.confidence_score != null ? <span title="LLM Confidence Rating" style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: h.confidence_score >= 80 ? 'rgba(34,197,94,0.1)' : h.confidence_score >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: h.confidence_score >= 80 ? '#4ade80' : h.confidence_score >= 60 ? '#f59e0b' : '#f87171', fontWeight: 600 }}>C: {h.confidence_score}</span> : '-'}
                                    {h.accuracy_level != null ? <span title="Computed Accuracy Level" style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent-light)', fontWeight: 600 }}>A: {h.accuracy_level}%</span> : '-'}
                                </div>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                <div style={{ color: '#f0f4ff', fontWeight: 600 }}>{h.field_count}</div>
                                <div style={{ color: '#f87171', fontSize: '0.7rem', marginTop: 2 }}>{h.gap_count} gaps</div>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <button onClick={() => onRestore(h.analysis_id)}
                                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #1e2a3d', background: 'transparent', color: '#f0f4ff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#1e2a3d' }}>
                                    Restore
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
    const { id: documentId } = useParams()
    const { accent } = useTheme()
    const isMobile = useIsMobile()
    const [modules, setModules] = useState([])
    const [docName, setDocName] = useState('')
    const [activeModule, setActiveModule] = useState(null)
    const [blueprint, setBlueprint] = useState(null)
    const [analysisMeta, setAnalysisMeta] = useState(null)
    const [loading, setLoading] = useState(false)
    const [initLoading, setInitLoading] = useState(true)
    const [error, setError] = useState(null)
    const [activeTab, setActiveTab] = useState('analysis')

    // ── Client-side analysis cache — avoids re-fetching when switching modules ──
    const analysisCacheRef = useRef(new Map())
    const [cachedModuleIds, setCachedModuleIds] = useState(new Set())

    const addToCache = (moduleId, analysis, meta) => {
        analysisCacheRef.current.set(moduleId, { analysis, meta })
        setCachedModuleIds(prev => new Set([...prev, moduleId]))
    }

    useEffect(() => {
        api.listModules(documentId)
            .then(r => {
                const mods = r.modules || []
                setModules(mods)
                setDocName(r.file_name || '')
                if (mods.length > 0) {
                    // Auto-select first module
                    setActiveModule(mods[0])
                    // Pre-fetch analysis only for modules that already have one (avoids 404s)
                    mods.forEach((mod, idx) => {
                        if (!mod.has_analysis) return
                        api.getAnalysis(mod.id)
                            .then(a => {
                                if (a.analysis) {
                                    addToCache(mod.id, a.analysis, a)
                                    // Set blueprint for the first module
                                    if (idx === 0) { setBlueprint(a.analysis); setAnalysisMeta(a) }
                                }
                            })
                            .catch(() => { })
                    })
                }
            })
            .catch(e => setError(e.message))
            .finally(() => setInitLoading(false))
    }, [documentId])

    const selectModule = async (mod) => {
        setActiveModule(mod); setActiveTab('analysis')
        // Check client cache first — instant switch, zero cost
        const cached = analysisCacheRef.current.get(mod.id)
        if (cached) {
            setBlueprint(cached.analysis); setAnalysisMeta(cached.meta)
            return
        }
        // Not in cache — fetch from server
        setBlueprint(null); setAnalysisMeta(null)
        try {
            const r = await api.getAnalysis(mod.id)
            if (r.analysis) {
                setBlueprint(r.analysis); setAnalysisMeta(r)
                addToCache(mod.id, r.analysis, r)
            }
        } catch (e) { console.error('Failed to load analysis:', e) }
    }

    const runAnalysis = async () => {
        if (!activeModule) return
        setLoading(true); setBlueprint(null); setAnalysisMeta(null)
        try {
            await api.analyseModule(activeModule.id)
            const r = await api.getAnalysis(activeModule.id)
            setBlueprint(r.analysis); setAnalysisMeta(r)
            // Update cache with fresh analysis
            addToCache(activeModule.id, r.analysis, r)
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }

    const handleRestore = async (analysisId) => {
        if (!activeModule) return
        setLoading(true)
        try {
            const r = await api.restoreAnalysis(activeModule.id, analysisId)
            if (r.analysis) {
                setBlueprint(r.analysis); setAnalysisMeta(r); setActiveTab('analysis')
                addToCache(activeModule.id, r.analysis, r)
            }
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }

    const fieldCount = blueprint?.documented?.fields?.length || 0
    const gapCount = blueprint?.gaps?.missing_specs?.length || 0

    const tabs = [
        { id: 'analysis', icon: '📊', label: 'Analysis' },
        { id: 'fields', icon: '🔤', label: `Fields${fieldCount ? ` (${fieldCount})` : ''}` },
        { id: 'api', icon: '🔌', label: 'API Schema' },
        { id: 'connectivity', icon: '🔗', label: 'Connectivity' },
        { id: 'history', icon: '🕰', label: 'History' },
        { id: 'chat', icon: '💬', label: 'Chat' },
        { id: 'testcases', icon: '🧪', label: 'Test Cases' },
    ]

    if (initLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 70px)' }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>
    if (error) return <div style={{ padding: 40, color: '#f87171', fontSize: '0.9rem' }}>{error}</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)' }}>
            {/* Doc header */}
            <div style={{ padding: isMobile ? '8px 12px' : '10px 20px', borderBottom: '1px solid #1e2a3d', background: '#0d1219', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                <span>📄</span>
                <span style={{ fontWeight: 600, color: '#f0f4ff', fontSize: isMobile ? '0.8rem' : '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? 180 : 'none' }}>{docName}</span>
                <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4, background: `${accent}1a`, color: accent }}>{modules.length} modules</span>
            </div>

            {/* Mobile: horizontal module bar at top */}
            {isMobile && (
                <ModuleSidebar modules={modules} activeId={activeModule?.id} onSelect={selectModule} accent={accent} isMobile={true} cachedIds={cachedModuleIds} />
            )}

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Desktop: vertical module sidebar */}
                {!isMobile && (
                    <ModuleSidebar modules={modules} activeId={activeModule?.id} onSelect={selectModule} accent={accent} isMobile={false} cachedIds={cachedModuleIds} />
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {!activeModule ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#4a5568', gap: 12 }}>
                            <div style={{ fontSize: 56 }}>📋</div>
                            <p style={{ fontSize: '1rem' }}>Select a module to begin</p>
                            <p style={{ fontSize: '0.78rem', color: '#2d3a4e' }}>Each module gives full field extraction, gap analysis, and API schema</p>
                        </div>
                    ) : (
                        <>
                            {/* Module toolbar */}
                            <div style={{ padding: isMobile ? '8px 12px' : '10px 20px', borderBottom: '1px solid #1e2a3d', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', background: '#111622', gap: 8, flexShrink: 0 }}>
                                <div style={{ marginBottom: isMobile ? 4 : 0 }}>
                                    <p style={{ fontSize: '0.62rem', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Module</p>
                                    <p style={{ fontWeight: 700, color: '#f0f4ff', fontSize: isMobile ? '0.85rem' : '0.96rem', marginTop: 1 }}>{activeModule.title}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {blueprint && (
                                        <>
                                            {analysisMeta?.confidence_score != null && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 5, background: 'rgba(13,18,25,0.6)', border: '1px solid #1e2a3d' }}>
                                                    <span style={{ fontSize: '0.6rem', color: '#4a5568', textTransform: 'uppercase', fontWeight: 700 }}>LLM Confidence</span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: analysisMeta.confidence_score >= 80 ? '#4ade80' : analysisMeta.confidence_score >= 60 ? '#f59e0b' : '#f87171' }}>
                                                        {analysisMeta.confidence_score}/100
                                                    </span>
                                                </div>
                                            )}
                                            {analysisMeta?.accuracy_level != null && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 5, background: 'rgba(13,18,25,0.6)', border: '1px solid #1e2a3d' }}>
                                                    <span style={{ fontSize: '0.6rem', color: '#4a5568', textTransform: 'uppercase', fontWeight: 700 }}>Accuracy</span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>{analysisMeta.accuracy_level}%</span>
                                                </div>
                                            )}
                                            <span style={{ fontSize: '0.68rem', padding: '3px 9px', borderRadius: 5, background: 'rgba(34,197,94,0.1)', color: '#4ade80', marginLeft: 6 }}>✓ {fieldCount} fields</span>
                                            <span style={{ fontSize: '0.68rem', padding: '3px 9px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>⚠ {gapCount} gaps</span>
                                        </>
                                    )}
                                    <button onClick={runAnalysis} disabled={loading}
                                        style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? '#1e2a3d' : accent, color: loading ? '#4a5568' : '#fff', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                                        {loading ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />Analysing…</> : blueprint ? '↻ Re-analyse' : '▶ Run Analysis'}
                                    </button>
                                </div>
                            </div>

                            <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} accent={accent} />

                            {/* Content area */}

                            {activeTab === 'chat' ? (
                                <QAChatFullView documentId={documentId} activeModule={activeModule} isMobile={isMobile} />
                            ) : activeTab === 'connectivity' ? (
                                <ConnectivityMapView documentId={documentId} />
                            ) : activeTab === 'testcases' ? (
                                <TestCasesView testCases={blueprint?.test_cases || []} />
                            ) : loading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 14 }}>
                                    <div className="spinner" style={{ width: 38, height: 38 }} />
                                    <p style={{ color: '#8896b3', fontSize: '0.88rem' }}>Building complete engineering blueprint…</p>
                                    <p style={{ color: '#4a5568', fontSize: '0.76rem' }}>Extracting every field, detecting gaps, generating API schema</p>
                                </div>
                            ) : !blueprint ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#4a5568' }}>
                                    <div style={{ fontSize: 48, marginBottom: 14 }}>🧠</div>
                                    <p style={{ fontSize: '0.88rem' }}>Click ▶ Run Analysis to generate the full blueprint</p>
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    {activeTab === 'analysis' && <AnalysisSplitView blueprint={blueprint} isMobile={isMobile} />}
                                    {activeTab === 'fields' && <FieldsView blueprint={blueprint} />}
                                    {activeTab === 'api' && <ApiSchemaView moduleId={activeModule.id} blueprint={blueprint} />}
                                    {activeTab === 'history' && <HistoryView moduleId={activeModule.id} onRestore={handleRestore} />}
                                </div>
                            )}

                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
