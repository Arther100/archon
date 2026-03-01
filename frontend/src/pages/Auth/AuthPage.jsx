// AuthPage — Premium dark glassmorphism login/signup
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../i18n'

function useIsMobile(bp = 768) {
    const [m, setM] = useState(window.innerWidth <= bp)
    useEffect(() => { const h = () => setM(window.innerWidth <= bp); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [bp])
    return m
}

export default function AuthPage() {
    const { login, signup, loading } = useAuth()
    const { accent } = useTheme()
    const { t, lang, setLanguage, locales } = useLanguage()
    const navigate = useNavigate()
    const isMobile = useIsMobile()
    const [mode, setMode] = useState('login') // 'login' | 'signup'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [username, setUsername] = useState('')
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    const isLogin = mode === 'login'

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null); setSuccess(null)
        if (!email.trim() || !password.trim()) { setError(t('auth.emailRequired')); return }
        if (!EMAIL_REGEX.test(email.trim())) { setError('Please enter a valid email address.'); return }
        if (!isLogin && !username.trim()) { setError('Username is required.'); return }
        if (!isLogin && password !== confirmPassword) { setError(t('auth.passwordMismatch')); return }
        if (password.length < 6) { setError(t('auth.passwordTooShort')); return }

        setSubmitting(true)
        try {
            if (isLogin) {
                await login(email.trim(), password)
                navigate('/', { replace: true })
            } else {
                const result = await signup(email.trim(), password, username.trim())
                if (result.autoLoggedIn) {
                    navigate('/', { replace: true })
                } else {
                    setSuccess(t('auth.accountCreated'))
                    setMode('login')
                }
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const inputStyle = {
        width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f0f4ff',
        fontSize: '0.88rem', fontFamily: "'Inter',sans-serif", outline: 'none',
        transition: 'border 0.2s', boxSizing: 'border-box',
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `radial-gradient(ellipse 120% 100% at 50% -10%, ${accent}2e 0%, #080b14 55%)`,
            fontFamily: "'Inter',sans-serif",
        }}>
            {/* Background orbs — hidden on mobile for performance */}
            {!isMobile && (
                <>
                    <div style={{ position: 'fixed', top: '10%', right: '5%', width: 320, height: 320, borderRadius: '50%', background: `${accent}12`, filter: 'blur(80px)', pointerEvents: 'none' }} />
                    <div style={{ position: 'fixed', bottom: '15%', left: '5%', width: 250, height: 250, borderRadius: '50%', background: 'rgba(167,139,250,0.06)', filter: 'blur(60px)', pointerEvents: 'none' }} />
                </>
            )}

            <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 420, padding: isMobile ? '0 12px' : '0 20px' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🏛️</div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f0f4ff', margin: 0, letterSpacing: '-0.02em' }}>{t('app.name')}</h1>
                    <p style={{ fontSize: '0.78rem', color: '#4a5568', marginTop: 6 }}>{t('app.tagline')}</p>
                </div>

                {/* Card */}
                <div style={{
                    background: 'rgba(13,18,25,0.8)', backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18,
                    padding: isMobile ? '24px 18px' : '32px 30px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                }}>
                    {/* Mode toggle */}
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, marginBottom: 28 }}>
                        {['login', 'signup'].map(m => (
                            <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                                style={{ flex: 1, padding: '8px', border: 'none', cursor: 'pointer', borderRadius: 8, fontWeight: 600, fontSize: '0.82rem', fontFamily: "'Inter',sans-serif", transition: 'all 0.2s', background: mode === m ? accent : 'transparent', color: mode === m ? '#fff' : '#4a5568' }}>
                                {m === 'login' ? t('auth.signIn') : t('auth.signUp')}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Email */}
                        <div>
                            <label style={{ fontSize: '0.7rem', color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>{t('auth.email')}</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder={t('auth.emailPlaceholder')} autoComplete="email"
                                style={inputStyle}
                                onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                        </div>

                        {/* Username — sign up only */}
                        {!isLogin && (
                            <div>
                                <label style={{ fontSize: '0.7rem', color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Username</label>
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                                    placeholder="Enter your username" autoComplete="username"
                                    style={inputStyle}
                                    onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                    onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                            </div>
                        )}

                        {/* Password */}
                        <div>
                            <label style={{ fontSize: '0.7rem', color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>{t('auth.password')}</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                placeholder={t('auth.passwordPlaceholder')} autoComplete={isLogin ? 'current-password' : 'new-password'}
                                style={inputStyle}
                                onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                        </div>

                        {/* Confirm password — sign up only */}
                        {!isLogin && (
                            <div style={{ overflow: 'hidden', transition: 'max-height 0.2s' }}>
                                <label style={{ fontSize: '0.7rem', color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>{t('auth.confirmPassword')}</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder={t('auth.repeatPassword')} autoComplete="new-password"
                                    style={inputStyle}
                                    onFocus={e => e.target.style.border = `1px solid ${accent}`}
                                    onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'} />
                            </div>
                        )}

                        {/* Error / Success */}
                        {error && (
                            <div style={{ padding: '9px 13px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: '0.81rem', color: '#f87171' }}>
                                ⚠ {error}
                            </div>
                        )}
                        {success && (
                            <div style={{ padding: '9px 13px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: '0.81rem', color: '#4ade80' }}>
                                ✓ {success}
                            </div>
                        )}

                        {/* Submit */}
                        <button type="submit" disabled={submitting || loading}
                            style={{ padding: '12px', borderRadius: 10, border: 'none', cursor: submitting || loading ? 'not-allowed' : 'pointer', background: submitting || loading ? '#1e2a3d' : `linear-gradient(135deg, ${accent}, ${accent}dd)`, color: submitting || loading ? '#4a5568' : '#fff', fontSize: '0.88rem', fontWeight: 700, fontFamily: "'Inter',sans-serif", marginTop: 4, transition: 'opacity 0.2s' }}>
                            {submitting ? (isLogin ? t('auth.signingIn') : t('auth.creatingAccount')) : isLogin ? t('auth.btnSignIn') : t('auth.btnSignUp')}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#2d3a4e', marginTop: 20 }}>
                    {t('auth.footer')}
                </p>

                {/* Language switcher on auth page */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                    {locales.map(loc => (
                        <button key={loc.code} onClick={() => setLanguage(loc.code)}
                            style={{
                                background: lang === loc.code ? `${accent}22` : 'transparent',
                                border: lang === loc.code ? `1px solid ${accent}44` : '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                                fontSize: '0.72rem', color: lang === loc.code ? '#f0f4ff' : '#4a5568',
                                transition: 'all 0.15s',
                            }}>
                            {loc.flag} {loc.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
