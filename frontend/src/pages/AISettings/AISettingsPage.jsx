// AISettingsPage.jsx — BYOK: Manage AI provider API keys
import { useState, useEffect } from 'react'
import { api } from '../../hooks/api'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../i18n'
import ConfirmModal from '../../components/common/ConfirmModal'

const PROVIDERS = [
    { value: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
    { value: 'google', label: 'Google Gemini', placeholder: 'AIza...' },
    { value: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
    { value: 'azure_openai', label: 'Azure OpenAI', placeholder: 'your-azure-key' },
]

export default function AISettingsPage() {
    const { accent } = useTheme()
    const { t } = useLanguage()
    const [settings, setSettings] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ provider: 'openai', api_key: '', model_preference: '', base_url: '' })
    const [saving, setSaving] = useState(false)
    const [validating, setValidating] = useState(null)
    const [msg, setMsg] = useState('')
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    const load = async () => {
        setLoading(true)
        try {
            const d = await api.getAISettings()
            setSettings(d.settings || [])
        } catch { }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    const handleSave = async () => {
        if (!form.api_key) return
        setSaving(true); setMsg('')
        try {
            await api.saveAIKey(form)
            setMsg('Key saved!')
            setShowForm(false)
            setForm({ provider: 'openai', api_key: '', model_preference: '', base_url: '' })
            load()
        } catch (e) { setMsg(e.message) }
        setSaving(false)
    }

    const handleValidate = async (id) => {
        setValidating(id)
        try {
            const d = await api.validateAIKey(id)
            setMsg(d.is_valid ? '✅ Key is valid!' : `❌ Invalid: ${d.error || 'check key'}`)
            load()
        } catch (e) { setMsg(e.message) }
        setValidating(null)
    }

    const handleDelete = async (id) => {
        setConfirmDeleteId(id)
    }

    const confirmDelete = async () => {
        const id = confirmDeleteId
        setConfirmDeleteId(null)
        try { await api.deleteAIKey(id); load() } catch { }
    }

    const inputStyle = {
        width: '100%', padding: '10px 14px', background: '#0d1219', border: '1px solid #1e2a3d',
        borderRadius: 8, color: '#f0f4ff', fontSize: '0.82rem', fontFamily: "'Inter',sans-serif",
        outline: 'none', transition: 'border 0.15s',
    }
    const btnStyle = (bg) => ({
        padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter',sans-serif",
        background: bg, color: '#fff', transition: 'opacity 0.15s',
    })

    return (
        <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f0f4ff' }}>🔑 AI Settings</h1>
                    <p style={{ fontSize: '0.78rem', color: '#8896b3', marginTop: 4 }}>Bring Your Own Key — manage your AI provider API keys.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={btnStyle(accent)}>
                    {showForm ? 'Cancel' : '+ Add Key'}
                </button>
            </div>

            {msg && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#111622', border: '1px solid #1e2a3d', marginBottom: 16, fontSize: '0.8rem', color: msg.includes('✅') ? '#22c55e' : msg.includes('❌') ? '#ef4444' : accent }}>{msg}</div>}

            {showForm && (
                <div style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 6 }}>Provider</label>
                            <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 6 }}>Model (optional)</label>
                            <input value={form.model_preference} onChange={e => setForm({ ...form, model_preference: e.target.value })} placeholder="gpt-4o, gemini-pro..." style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 6 }}>API Key</label>
                        <input type="password" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })}
                            placeholder={PROVIDERS.find(p => p.value === form.provider)?.placeholder} style={inputStyle} />
                    </div>
                    {form.provider === 'azure_openai' && (
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: '0.72rem', color: '#8896b3', display: 'block', marginBottom: 6 }}>Base URL</label>
                            <input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} placeholder="https://your-resource.openai.azure.com/" style={inputStyle} />
                        </div>
                    )}
                    <button onClick={handleSave} disabled={saving || !form.api_key} style={{ ...btnStyle(accent), opacity: saving ? 0.6 : 1 }}>
                        {saving ? 'Saving...' : 'Save Key'}
                    </button>
                </div>
            )}

            {loading ? <p style={{ color: '#4a5568', fontSize: '0.8rem' }}>Loading...</p> : settings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#4a5568', fontSize: '0.85rem' }}>
                    No API keys configured. Add one to use your own AI provider.
                </div>
            ) : settings.map(s => (
                <div key={s.id} style={{ background: '#111622', border: '1px solid #1e2a3d', borderRadius: 12, padding: '16px 20px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f4ff', marginBottom: 4 }}>
                            {PROVIDERS.find(p => p.value === s.provider)?.label || s.provider}
                            <span style={{ fontSize: '0.7rem', marginLeft: 8, padding: '2px 8px', borderRadius: 99, background: s.is_valid ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: s.is_valid ? '#22c55e' : '#ef4444' }}>
                                {s.is_valid ? 'Valid' : 'Unverified'}
                            </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#4a5568', fontFamily: "'JetBrains Mono',monospace" }}>{s.masked_key}</div>
                        {s.model_preference && <div style={{ fontSize: '0.72rem', color: '#8896b3', marginTop: 2 }}>Model: {s.model_preference}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleValidate(s.id)} disabled={validating === s.id} style={{ ...btnStyle('#1e2a3d'), color: '#8896b3', fontSize: '0.72rem' }}>
                            {validating === s.id ? '...' : 'Validate'}
                        </button>
                        <button onClick={() => handleDelete(s.id)} style={{ ...btnStyle('transparent'), color: '#ef4444', fontSize: '0.72rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                            Delete
                        </button>
                    </div>
                </div>
            ))}
            <ConfirmModal
                open={!!confirmDeleteId}
                title={t('confirm.deleteTitle')}
                message={t('confirm.removeApiKey')}
                confirmLabel={t('confirm.yes')}
                cancelLabel={t('confirm.cancel')}
                danger
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    )
}
