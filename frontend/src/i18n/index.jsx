import { createContext, useContext, useState, useEffect, useCallback } from 'react'

import en from './en'
import ta from './ta'
import hi from './hi'
import fr from './fr'

/* ─── Supported locales ─── */
export const LOCALES = { en, ta, hi, fr }
export const LOCALE_LIST = Object.values(LOCALES).map((l) => l._meta)

const STORAGE_KEY = 'archon_language'
const DEFAULT_LANG = 'en'

/* ─── Deep-get helper: t('upload.title') → locale.upload.title ─── */
function resolve(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

/* ─── Context ─── */
const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
    const [lang, setLangState] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG
        } catch {
            return DEFAULT_LANG
        }
    })

    const locale = LOCALES[lang] || LOCALES[DEFAULT_LANG]

    /* Persist on change */
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, lang)
        } catch { /* noop */ }
    }, [lang])

    /* Set language */
    const setLanguage = useCallback((code) => {
        if (LOCALES[code]) setLangState(code)
    }, [])

    /**
     * Translate helper
     * t('upload.title')        → string
     * t('upload.moduleDetected', 5) → calls function with arg
     */
    const t = useCallback(
        (path, ...args) => {
            const val = resolve(locale, path)
            if (val === undefined) {
                // Fallback to English
                const fb = resolve(LOCALES[DEFAULT_LANG], path)
                if (typeof fb === 'function') return fb(...args)
                return fb ?? path
            }
            if (typeof val === 'function') return val(...args)
            return val
        },
        [locale],
    )

    return (
        <LanguageContext.Provider value={{ lang, setLanguage, t, locale, locales: LOCALE_LIST }}>
            {children}
        </LanguageContext.Provider>
    )
}

/* ─── Hook ─── */
export function useLanguage() {
    const ctx = useContext(LanguageContext)
    if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
    return ctx
}

export default LanguageContext
