// ProjectsPage.jsx — Project grouping for multi-document AI analysis
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'
import { projectRoute, analysisRoute } from '../../config/routes'
import ConfirmModal from '../../components/common/ConfirmModal'

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function useIsMobile(bp = 768) {
    const [m, setM] = useState(window.innerWidth <= bp)
    useEffect(() => { const h = () => setM(window.innerWidth <= bp); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [bp])
    return m
}

export default function ProjectsPage() {
    const navigate = useNavigate()
    const { accent } = useTheme()
    const isMobile = useIsMobile()
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Create modal
    const [showCreate, setShowCreate] = useState(false)
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [creating, setCreating] = useState(false)

    // Delete
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)
    const [hoveredId, setHoveredId] = useState(null)

    // Detail view
    const [activeProject, setActiveProject] = useState(null)
    const [projectDocs, setProjectDocs] = useState([])
    const [loadingDetail, setLoadingDetail] = useState(false)

    // Assign docs modal
    const [showAssign, setShowAssign] = useState(false)
    const [allDocs, setAllDocs] = useState([])
    const [selectedDocs, setSelectedDocs] = useState([])
    const [assigning, setAssigning] = useState(false)

    // Compare documents
    const [showCompare, setShowCompare] = useState(false)
    const [compareOldId, setCompareOldId] = useState('')
    const [compareNewId, setCompareNewId] = useState('')
    const [comparing, setComparing] = useState(false)
    const [compareResult, setCompareResult] = useState(null)
    const [expandedDiffs, setExpandedDiffs] = useState({})
    const [diffFilter, setDiffFilter] = useState('all') // 'all' | 'changes'
    const [expandAll, setExpandAll] = useState(false)

    const loadProjects = useCallback(() => {
        setLoading(true)
        api.listProjects()
            .then(r => setProjects(r.projects || []))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { loadProjects() }, [loadProjects])

    const handleCreate = async () => {
        if (!newName.trim()) return
        setCreating(true)
        try {
            await api.createProject(newName.trim(), newDesc.trim())
            setNewName('')
            setNewDesc('')
            setShowCreate(false)
            loadProjects()
        } catch (e) { alert('Failed: ' + e.message) }
        finally { setCreating(false) }
    }

    const handleDelete = async () => {
        const id = confirmDeleteId
        setConfirmDeleteId(null)
        try {
            await api.deleteProject(id)
            setProjects(prev => prev.filter(p => p.id !== id))
            if (activeProject?.id === id) { setActiveProject(null); setProjectDocs([]) }
        } catch (e) { alert('Failed: ' + e.message) }
    }

    const openProject = async (project) => {
        setActiveProject(project)
        setLoadingDetail(true)
        try {
            const res = await api.getProject(project.id)
            setProjectDocs(res.documents || [])
        } catch (e) { alert('Error: ' + e.message) }
        finally { setLoadingDetail(false) }
    }

    const openAssignModal = async () => {
        setShowAssign(true)
        try {
            const res = await api.listDocuments()
            // Show unassigned docs + docs already in this project
            setAllDocs((res.documents || []).filter(d => !d.project_id || d.project_id === activeProject.id))
            setSelectedDocs(projectDocs.map(d => d.id))
        } catch (e) { alert('Error: ' + e.message) }
    }

    const handleAssign = async () => {
        setAssigning(true)
        try {
            // Docs to add (selected but not currently in project)
            const currentIds = new Set(projectDocs.map(d => d.id))
            const toAdd = selectedDocs.filter(id => !currentIds.has(id))
            // Docs to remove (currently in project but not selected)
            const selectedSet = new Set(selectedDocs)
            const toRemove = projectDocs.filter(d => !selectedSet.has(d.id)).map(d => d.id)

            if (toAdd.length > 0) await api.assignDocuments(activeProject.id, toAdd)
            for (const docId of toRemove) await api.removeDocFromProject(activeProject.id, docId)

            setShowAssign(false)
            openProject(activeProject)
            loadProjects()
        } catch (e) { alert('Error: ' + e.message) }
        finally { setAssigning(false) }
    }

    const toggleDoc = (docId) => {
        setSelectedDocs(prev =>
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        )
    }

    const handleCompare = async () => {
        if (!compareOldId || !compareNewId || compareOldId === compareNewId) return
        setComparing(true)
        setCompareResult(null)
        try {
            const res = await api.compareDocuments(compareOldId, compareNewId)
            setCompareResult(res)
            setExpandedDiffs({})
            setDiffFilter('all')
            setExpandAll(false)
        } catch (e) { alert('Compare failed: ' + e.message) }
        finally { setComparing(false) }
    }

    const toggleDiffExpand = (idx) => {
        setExpandedDiffs(prev => ({ ...prev, [idx]: !prev[idx] }))
    }

    const handleExpandAll = () => {
        if (expandAll) {
            setExpandedDiffs({})
        } else {
            const all = {}
            compareResult?.modified_modules?.forEach((_, i) => { all[i] = true })
            setExpandedDiffs(all)
        }
        setExpandAll(!expandAll)
    }

    const closeCompare = () => {
        setShowCompare(false)
        setCompareResult(null)
        setCompareOldId('')
        setCompareNewId('')
        setExpandedDiffs({})
        setDiffFilter('all')
        setExpandAll(false)
    }

    const inputStyle = {
        width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #1e2a3d',
        background: '#0d1219', color: '#f0f4ff', fontSize: '0.84rem', outline: 'none',
    }

    // ── Detail View ───────────────────────────────────────
    if (activeProject) {
        return (
            <main style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '20px 14px' : '36px 28px' }}>
                <button onClick={() => { setActiveProject(null); setProjectDocs([]) }}
                    style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ← Back to Projects
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.6rem' }}>📁</span>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>{activeProject.name}</h1>
                    <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 6, background: `${accent}15`, color: accent, fontWeight: 600 }}>
                        {projectDocs.length} document{projectDocs.length !== 1 ? 's' : ''}
                    </span>
                </div>
                {activeProject.description && (
                    <p style={{ color: '#8896b3', fontSize: '0.84rem', marginBottom: 20 }}>{activeProject.description}</p>
                )}

                {/* Action bar */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                    <button onClick={openAssignModal} style={{
                        padding: '8px 18px', borderRadius: 8, border: `1px solid ${accent}`,
                        background: `${accent}15`, color: accent, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    }}>+ Add / Remove Documents</button>
                    {projectDocs.length >= 2 && (
                        <button onClick={() => setShowCompare(true)} style={{
                            padding: '8px 18px', borderRadius: 8, border: '1px solid #f59e0b',
                            background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        }}>🔍 Compare Versions</button>
                    )}
                </div>

                {/* AI Context Info */}
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.1rem' }}>🧠</span>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600, marginBottom: 2 }}>AI Cross-Document Context</p>
                        <p style={{ fontSize: '0.74rem', color: '#8896b3', lineHeight: 1.5 }}>
                            When you analyse any module within this project, the AI automatically sees summaries of ALL other modules across all documents — enabling accurate connectivity mapping and full-flow understanding.
                        </p>
                    </div>
                </div>

                {loadingDetail ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                        <div className="spinner" style={{ width: 28, height: 28 }} />
                    </div>
                ) : projectDocs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '50px 20px', color: '#4a5568', background: '#111622', borderRadius: 14, border: '1px dashed #1e2a3d' }}>
                        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.6 }}>📂</div>
                        <p style={{ fontSize: '0.92rem', fontWeight: 600, color: '#8896b3', marginBottom: 4 }}>No documents in this project</p>
                        <p style={{ fontSize: '0.78rem', color: '#4a5568' }}>Click "Add / Remove Documents" to link your uploaded documents here.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                        {projectDocs.map(doc => (
                            <div key={doc.id} onClick={() => navigate(analysisRoute(doc.id))}
                                style={{
                                    background: '#111622', border: '1px solid #1e2a3d', borderRadius: 12,
                                    padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}66`; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2a3d'; e.currentTarget.style.transform = 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: '1.2rem' }}>{doc.file_type === 'pdf' ? '📕' : '📘'}</span>
                                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                                        background: doc.file_type === 'pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(59,110,245,0.15)',
                                        color: doc.file_type === 'pdf' ? '#f87171' : '#60a5fa' }}>
                                        {doc.file_type}
                                    </span>
                                    {doc.module_count > 0 && (
                                        <span style={{ fontSize: '0.66rem', color: '#4ade80', marginLeft: 'auto' }}>{doc.module_count} modules</span>
                                    )}
                                </div>
                                <p style={{ fontWeight: 600, color: '#f0f4ff', fontSize: '0.84rem', lineHeight: 1.35, marginBottom: 4,
                                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                    {doc.file_name}
                                </p>
                                <p style={{ fontSize: '0.68rem', color: '#5a6a85' }}>{formatDate(doc.created_at)}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Assign Documents Modal */}
                {showAssign && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(4px)' }}
                        onClick={() => setShowAssign(false)}>
                        <div onClick={e => e.stopPropagation()} style={{
                            background: '#111622', border: '1px solid #1e2a3d', borderRadius: 16,
                            padding: '24px 28px', width: '90vw', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                        }}>
                            <h3 style={{ color: '#f0f4ff', fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Select Documents for "{activeProject.name}"</h3>
                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                                {allDocs.length === 0 ? (
                                    <p style={{ color: '#4a5568', fontSize: '0.82rem', textAlign: 'center', padding: 20 }}>No documents available. Upload documents first.</p>
                                ) : allDocs.map(doc => (
                                    <label key={doc.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                        borderRadius: 8, cursor: 'pointer',
                                        background: selectedDocs.includes(doc.id) ? `${accent}12` : '#0d1219',
                                        border: `1px solid ${selectedDocs.includes(doc.id) ? accent + '40' : '#1e2a3d'}`,
                                    }}>
                                        <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => toggleDoc(doc.id)}
                                            style={{ accentColor: accent, width: 16, height: 16 }} />
                                        <span style={{ fontSize: '1rem' }}>{doc.file_type === 'pdf' ? '📕' : '📘'}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: '0.8rem', color: '#f0f4ff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {doc.file_name}
                                            </p>
                                            <p style={{ fontSize: '0.66rem', color: '#4a5568' }}>{formatDate(doc.created_at)}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowAssign(false)} style={{
                                    padding: '8px 18px', borderRadius: 8, border: '1px solid #1e2a3d',
                                    background: 'transparent', color: '#8896b3', fontSize: '0.8rem', cursor: 'pointer',
                                }}>Cancel</button>
                                <button onClick={handleAssign} disabled={assigning} style={{
                                    padding: '8px 18px', borderRadius: 8, border: 'none',
                                    background: accent, color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                    opacity: assigning ? 0.6 : 1,
                                }}>{assigning ? 'Saving...' : `Save (${selectedDocs.length} selected)`}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Compare Documents Modal */}
                {showCompare && !compareResult && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(4px)' }}
                        onClick={closeCompare}>
                        <div onClick={e => e.stopPropagation()} style={{
                            background: '#111622', border: '1px solid #1e2a3d', borderRadius: 16,
                            padding: '28px', width: '90vw', maxWidth: 500,
                        }}>
                            <h3 style={{ color: '#f0f4ff', fontSize: '1.05rem', fontWeight: 700, marginBottom: 6 }}>Compare Document Versions</h3>
                            <p style={{ color: '#8896b3', fontSize: '0.78rem', marginBottom: 20, lineHeight: 1.5 }}>
                                Select the old version and the new version. The system will compare every section module-by-module and highlight exactly what changed.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f87171', marginBottom: 6, display: 'block' }}>Old Version (v1)</label>
                                    <select value={compareOldId} onChange={e => setCompareOldId(e.target.value)} style={{
                                        width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #1e2a3d',
                                        background: '#0d1219', color: '#f0f4ff', fontSize: '0.84rem', outline: 'none',
                                    }}>
                                        <option value="">Select old document...</option>
                                        {projectDocs.map(d => (
                                            <option key={d.id} value={d.id} disabled={d.id === compareNewId}>
                                                {d.file_name} ({formatDate(d.created_at)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#4ade80', marginBottom: 6, display: 'block' }}>New Version (v2)</label>
                                    <select value={compareNewId} onChange={e => setCompareNewId(e.target.value)} style={{
                                        width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #1e2a3d',
                                        background: '#0d1219', color: '#f0f4ff', fontSize: '0.84rem', outline: 'none',
                                    }}>
                                        <option value="">Select new document...</option>
                                        {projectDocs.map(d => (
                                            <option key={d.id} value={d.id} disabled={d.id === compareOldId}>
                                                {d.file_name} ({formatDate(d.created_at)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                                <button onClick={closeCompare} style={{
                                    padding: '9px 20px', borderRadius: 8, border: '1px solid #1e2a3d',
                                    background: 'transparent', color: '#8896b3', fontSize: '0.82rem', cursor: 'pointer',
                                }}>Cancel</button>
                                <button onClick={handleCompare} disabled={!compareOldId || !compareNewId || compareOldId === compareNewId || comparing} style={{
                                    padding: '9px 20px', borderRadius: 8, border: 'none',
                                    background: '#f59e0b', color: '#000', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                                    opacity: (!compareOldId || !compareNewId || compareOldId === compareNewId || comparing) ? 0.5 : 1,
                                }}>{comparing ? 'Comparing...' : '🔍 Compare'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Compare Results View — Full-screen diff viewer */}
                {compareResult && (
                    <div style={{ position: 'fixed', inset: 0, background: '#080b14', zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                        {/* Top toolbar */}
                        <div style={{ padding: '14px 24px', background: '#0d1219', borderBottom: '1px solid #1e2a3d', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
                            <h3 style={{ color: '#f0f4ff', fontSize: '1rem', fontWeight: 700, margin: 0, marginRight: 8 }}>Version Comparison</h3>

                            {/* File badges */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 5, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                                    ◀ {compareResult.old_document.file_name}
                                </span>
                                <span style={{ color: '#4a5568', fontSize: '0.8rem' }}>→</span>
                                <span style={{ padding: '3px 10px', borderRadius: 5, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                                    ▶ {compareResult.new_document.file_name}
                                </span>
                            </div>

                            {/* Controls */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button onClick={handleExpandAll} style={{
                                    padding: '5px 12px', borderRadius: 6, border: '1px solid #1e2a3d',
                                    background: '#111622', color: '#8896b3', fontSize: '0.72rem', cursor: 'pointer',
                                }}>{expandAll ? 'Collapse All' : 'Expand All'}</button>
                                <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)} style={{
                                    padding: '5px 10px', borderRadius: 6, border: '1px solid #1e2a3d',
                                    background: '#111622', color: '#8896b3', fontSize: '0.72rem', outline: 'none',
                                }}>
                                    <option value="all">Show All Sections</option>
                                    <option value="changes">Changes Only</option>
                                </select>
                                <button onClick={closeCompare} style={{
                                    padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)',
                                    background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                                }}>✕ Close</button>
                            </div>
                        </div>

                        {/* Summary bar */}
                        <div style={{ padding: '10px 24px', background: '#0a0e17', borderBottom: '1px solid #151c2a', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                            {compareResult.summary.added > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} />
                                    <span style={{ color: '#4ade80', fontWeight: 700 }}>+{compareResult.summary.added}</span>
                                    <span style={{ color: '#5a6a85' }}>new</span>
                                </span>
                            )}
                            {compareResult.summary.removed > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f87171', display: 'inline-block' }} />
                                    <span style={{ color: '#f87171', fontWeight: 700 }}>-{compareResult.summary.removed}</span>
                                    <span style={{ color: '#5a6a85' }}>removed</span>
                                </span>
                            )}
                            {compareResult.summary.modified > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} />
                                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>~{compareResult.summary.modified}</span>
                                    <span style={{ color: '#5a6a85' }}>modified</span>
                                </span>
                            )}
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem' }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#334155', display: 'inline-block' }} />
                                <span style={{ color: '#64748b', fontWeight: 700 }}>{compareResult.summary.unchanged}</span>
                                <span style={{ color: '#5a6a85' }}>unchanged</span>
                            </span>
                            <span style={{ marginLeft: 'auto', color: '#4a5568', fontSize: '0.7rem' }}>
                                {compareResult.summary.total_modules_old} → {compareResult.summary.total_modules_new} sections
                            </span>
                        </div>

                        {/* Scrollable diff body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

                            {/* No changes */}
                            {compareResult.summary.added === 0 && compareResult.summary.removed === 0 && compareResult.summary.modified === 0 && (
                                <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                                    <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                                    <p style={{ color: '#4ade80', fontSize: '1rem', fontWeight: 700 }}>Documents are identical</p>
                                    <p style={{ color: '#5a6a85', fontSize: '0.82rem' }}>No changes detected between versions.</p>
                                </div>
                            )}

                            {/* Added Sections */}
                            {compareResult.added_modules.map((m, i) => (
                                <div key={`add-${i}`} style={{ marginBottom: 12, borderRadius: 10, border: '1px solid rgba(74,222,128,0.25)', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 16px', background: 'rgba(74,222,128,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ padding: '2px 8px', borderRadius: 4, background: '#4ade80', color: '#000', fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0.5 }}>NEW SECTION</span>
                                        <span style={{ color: '#f0f4ff', fontSize: '0.86rem', fontWeight: 600 }}>{m.title}</span>
                                        <span style={{ color: '#4ade80', fontSize: '0.7rem', marginLeft: 'auto', fontWeight: 600 }}>+{m.line_count} lines added</span>
                                    </div>
                                </div>
                            ))}

                            {/* Removed Sections */}
                            {compareResult.removed_modules.map((m, i) => (
                                <div key={`rem-${i}`} style={{ marginBottom: 12, borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ padding: '2px 8px', borderRadius: 4, background: '#f87171', color: '#000', fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0.5 }}>REMOVED</span>
                                        <span style={{ color: '#f0f4ff', fontSize: '0.86rem', fontWeight: 600, textDecoration: 'line-through', opacity: 0.6 }}>{m.title}</span>
                                        <span style={{ color: '#f87171', fontSize: '0.7rem', marginLeft: 'auto', fontWeight: 600 }}>-{m.line_count} lines removed</span>
                                    </div>
                                </div>
                            ))}

                            {/* Modified Sections — each with expandable hunk diff */}
                            {compareResult.modified_modules.map((m, i) => (
                                <div key={`mod-${i}`} style={{ marginBottom: 12, borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)', overflow: 'hidden', background: '#0d1117' }}>

                                    {/* Section header — click to expand */}
                                    <div onClick={() => toggleDiffExpand(i)} style={{
                                        padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                                        background: expandedDiffs[i] ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.04)',
                                        borderBottom: expandedDiffs[i] ? '1px solid rgba(245,158,11,0.15)' : 'none',
                                        transition: 'background 0.15s',
                                    }}>
                                        <span style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600, transition: 'transform 0.2s', transform: expandedDiffs[i] ? 'rotate(90deg)' : 'none' }}>▶</span>
                                        <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0.5 }}>MODIFIED</span>
                                        <span style={{ color: '#f0f4ff', fontSize: '0.86rem', fontWeight: 600 }}>{m.new_title}</span>
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <span style={{ color: '#4ade80', fontSize: '0.72rem', fontWeight: 600 }}>+{m.lines_added}</span>
                                            <span style={{ color: '#f87171', fontSize: '0.72rem', fontWeight: 600 }}>-{m.lines_removed}</span>
                                            <span style={{ padding: '2px 7px', borderRadius: 4, background: '#1a2233', color: '#8896b3', fontSize: '0.64rem' }}>
                                                {m.changed_hunks} change{m.changed_hunks !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded diff hunks */}
                                    {expandedDiffs[i] && (
                                        <div style={{ overflowX: 'auto' }}>
                                            {m.hunks.map((hunk, hi) => (
                                                <div key={hi}>
                                                    {/* Hunk header */}
                                                    <div style={{ padding: '4px 16px', background: 'rgba(59,130,246,0.06)', borderTop: hi > 0 ? '1px solid #1a2233' : 'none', borderBottom: '1px solid #151c2a' }}>
                                                        <span style={{ color: '#60a5fa', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                                                            @@ Line {hunk.old_start} (old) → Line {hunk.new_start} (new) @@
                                                        </span>
                                                    </div>
                                                    {/* Diff lines */}
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '0.74rem', lineHeight: 1.65 }}>
                                                        <tbody>
                                                            {hunk.lines.map((line, li) => {
                                                                const isChanged = line.type !== 'unchanged'
                                                                if (diffFilter === 'changes' && !isChanged) return null
                                                                return (
                                                                    <tr key={li} style={{
                                                                        background: line.type === 'added' ? 'rgba(74,222,128,0.08)'
                                                                            : line.type === 'removed' ? 'rgba(239,68,68,0.08)'
                                                                            : 'transparent',
                                                                    }}>
                                                                        {/* Old line number */}
                                                                        <td style={{
                                                                            width: 48, minWidth: 48, padding: '0 8px', textAlign: 'right',
                                                                            color: line.type === 'removed' ? '#f8717188' : '#334155',
                                                                            fontSize: '0.65rem', userSelect: 'none', borderRight: '1px solid #1a2233',
                                                                            verticalAlign: 'top',
                                                                        }}>
                                                                            {line.old_no || ''}
                                                                        </td>
                                                                        {/* New line number */}
                                                                        <td style={{
                                                                            width: 48, minWidth: 48, padding: '0 8px', textAlign: 'right',
                                                                            color: line.type === 'added' ? '#4ade8088' : '#334155',
                                                                            fontSize: '0.65rem', userSelect: 'none', borderRight: '1px solid #1a2233',
                                                                            verticalAlign: 'top',
                                                                        }}>
                                                                            {line.new_no || ''}
                                                                        </td>
                                                                        {/* Sign */}
                                                                        <td style={{
                                                                            width: 20, minWidth: 20, padding: '0 4px', textAlign: 'center',
                                                                            color: line.type === 'added' ? '#4ade80' : line.type === 'removed' ? '#f87171' : 'transparent',
                                                                            fontWeight: 700, userSelect: 'none', verticalAlign: 'top',
                                                                        }}>
                                                                            {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                                                                        </td>
                                                                        {/* Content */}
                                                                        <td style={{
                                                                            padding: '0 12px',
                                                                            color: line.type === 'added' ? '#bbf7d0'
                                                                                : line.type === 'removed' ? '#fca5a5'
                                                                                : '#64748b',
                                                                            whiteSpace: 'pre-wrap',
                                                                            wordBreak: 'break-word',
                                                                            borderLeft: line.type === 'added' ? '3px solid #4ade80'
                                                                                : line.type === 'removed' ? '3px solid #f87171'
                                                                                : '3px solid transparent',
                                                                        }}>
                                                                            {line.text || '\u00A0'}
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Unchanged Sections (collapsible list) */}
                            {diffFilter === 'all' && compareResult.unchanged_modules.length > 0 && (
                                <div style={{ marginTop: 8, padding: '12px 16px', borderRadius: 10, background: '#0d1117', border: '1px solid #1a2233' }}>
                                    <p style={{ color: '#64748b', fontSize: '0.76rem', fontWeight: 600, marginBottom: 8 }}>
                                        ✓ Unchanged Sections ({compareResult.unchanged_modules.length})
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {compareResult.unchanged_modules.map((m, i) => (
                                            <span key={i} style={{ padding: '4px 10px', borderRadius: 5, background: '#111622', color: '#475569', fontSize: '0.7rem', border: '1px solid #1a2233' }}>
                                                {m.title}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        )
    }

    // ── List View ─────────────────────────────────────────
    return (
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 14px' : '36px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 20 : 28, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 6 }}>Projects</h1>
                    <p style={{ color: '#8896b3', fontSize: '0.84rem' }}>Group documents into projects so the AI understands the full system flow.</p>
                </div>
                <button onClick={() => setShowCreate(true)} style={{
                    padding: '10px 22px', borderRadius: 10, border: 'none',
                    background: accent, color: '#fff', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer',
                    boxShadow: `0 4px 12px ${accent}40`,
                }}>+ New Project</button>
            </div>

            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <div className="spinner" style={{ width: 32, height: 32 }} />
                </div>
            )}

            {error && (
                <div style={{ padding: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#f87171' }}>{error}</div>
            )}

            {!loading && !error && projects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a5568', background: '#111622', borderRadius: 16, border: '1px dashed #1e2a3d' }}>
                    <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.6 }}>📁</div>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: '#8896b3', marginBottom: 6 }}>No projects yet</p>
                    <p style={{ fontSize: '0.82rem', color: '#4a5568', maxWidth: 400, margin: '0 auto' }}>
                        Create a project to group related documents (e.g. 10 modules of a booking system). The AI will use all modules as context when analysing each one.
                    </p>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {projects.map(p => {
                    const isHovered = hoveredId === p.id
                    return (
                        <div key={p.id} onClick={() => openProject(p)}
                            onMouseEnter={() => setHoveredId(p.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            style={{
                                background: isHovered ? '#161d2e' : '#111622',
                                border: isHovered ? `1px solid ${accent}66` : '1px solid #1e2a3d',
                                borderRadius: 14, padding: 0, cursor: 'pointer',
                                transition: 'all 0.25s ease',
                                transform: isHovered ? 'translateY(-2px)' : 'none',
                                boxShadow: isHovered ? `0 8px 32px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.2)',
                                overflow: 'hidden',
                            }}>
                            {/* Header */}
                            <div style={{
                                padding: '20px 20px 14px',
                                background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
                                borderBottom: '1px solid #1a2233',
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 32 }}>📁</span>
                                    <div>
                                        <p style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '0.95rem', marginBottom: 2 }}>{p.name}</p>
                                        <p style={{ fontSize: '0.68rem', color: '#5a6a85' }}>{formatDate(p.created_at)}</p>
                                    </div>
                                </div>
                                <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(p.id) }}
                                    style={{
                                        width: 28, height: 28, borderRadius: 7, fontSize: '0.75rem',
                                        background: isHovered ? 'rgba(239,68,68,0.12)' : 'transparent',
                                        color: '#f87171', border: '1px solid transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s',
                                    }}>🗑</button>
                            </div>
                            {/* Body */}
                            <div style={{ padding: '14px 20px 18px' }}>
                                {p.description && (
                                    <p style={{ fontSize: '0.78rem', color: '#8896b3', marginBottom: 10, lineHeight: 1.4,
                                        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                        {p.description}
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.76rem', color: '#60a5fa', fontWeight: 600 }}>
                                        📄 {p.document_count} document{p.document_count !== 1 ? 's' : ''}
                                    </span>
                                    <span style={{
                                        marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
                                        fontSize: '0.74rem', color: isHovered ? accent : '#4a5568',
                                        fontWeight: 600, transition: 'color 0.15s',
                                    }}>
                                        Open →
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Create Project Modal */}
            {showCreate && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowCreate(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#111622', border: '1px solid #1e2a3d', borderRadius: 16,
                        padding: '28px', width: '90vw', maxWidth: 440,
                    }}>
                        <h3 style={{ color: '#f0f4ff', fontSize: '1.05rem', fontWeight: 700, marginBottom: 20 }}>Create New Project</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8896b3', marginBottom: 6, display: 'block' }}>Project Name *</label>
                                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Booking Management System"
                                    style={inputStyle} autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8896b3', marginBottom: 6, display: 'block' }}>Description (optional)</label>
                                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description of the project scope..."
                                    rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button onClick={() => setShowCreate(false)} style={{
                                padding: '9px 20px', borderRadius: 8, border: '1px solid #1e2a3d',
                                background: 'transparent', color: '#8896b3', fontSize: '0.82rem', cursor: 'pointer',
                            }}>Cancel</button>
                            <button onClick={handleCreate} disabled={!newName.trim() || creating} style={{
                                padding: '9px 20px', borderRadius: 8, border: 'none',
                                background: accent, color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                                opacity: !newName.trim() || creating ? 0.5 : 1,
                            }}>{creating ? 'Creating...' : 'Create Project'}</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!confirmDeleteId}
                title="Delete Project?"
                message="This will unlink all documents from the project (documents won't be deleted). Continue?"
                confirmLabel="Delete"
                cancelLabel="Cancel"
                danger
                onConfirm={handleDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </main>
    )
}
