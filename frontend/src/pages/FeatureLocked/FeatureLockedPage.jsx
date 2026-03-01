// FeatureLockedPage.jsx — Shown when user navigates to a page they don't have permission for
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../i18n'

export default function FeatureLockedPage() {
    const navigate = useNavigate()
    const { accent } = useTheme()
    const { t } = useLanguage()

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '70vh', padding: '40px 24px', textAlign: 'center',
        }}>
            <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.08)', border: '2px solid rgba(239, 68, 68, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', marginBottom: 24,
            }}>
                🔒
            </div>

            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f0f4ff', marginBottom: 8 }}>
                {t('featureLocked.title')}
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#8896b3', maxWidth: 420, marginBottom: 8 }}>
                {t('featureLocked.description')}
            </p>
            <p style={{ fontSize: '0.78rem', color: '#4a5568', maxWidth: 420, marginBottom: 28 }}>
                {t('featureLocked.hint')}
            </p>

            <button
                onClick={() => navigate('/')}
                style={{
                    padding: '10px 28px', borderRadius: 8, border: 'none',
                    background: accent, color: '#fff', fontWeight: 600,
                    fontSize: '0.82rem', cursor: 'pointer',
                    transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 0.85}
                onMouseLeave={e => e.currentTarget.style.opacity = 1}
            >
                {t('featureLocked.goHome')}
            </button>
        </div>
    )
}
