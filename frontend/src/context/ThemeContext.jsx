// ── ThemeContext — accent color theming with persistence via user profile ──────
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)
const THEME_KEY = 'da_theme_color'

// Predefined accent palette
export const ACCENT_COLORS = [
    { name: 'Blue',    value: '#3b6ef5' },
    { name: 'Purple',  value: '#8b5cf6' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Rose',    value: '#f43f5e' },
    { name: 'Amber',   value: '#f59e0b' },
    { name: 'Cyan',    value: '#06b6d4' },
    { name: 'Pink',    value: '#ec4899' },
    { name: 'Indigo',  value: '#6366f1' },
]

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

function lighten(hex, amount = 0.3) {
    let r = parseInt(hex.slice(1, 3), 16)
    let g = parseInt(hex.slice(3, 5), 16)
    let b = parseInt(hex.slice(5, 7), 16)
    r = Math.min(255, Math.round(r + (255 - r) * amount))
    g = Math.min(255, Math.round(g + (255 - g) * amount))
    b = Math.min(255, Math.round(b + (255 - b) * amount))
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

function darken(hex, amount = 0.2) {
    let r = parseInt(hex.slice(1, 3), 16)
    let g = parseInt(hex.slice(3, 5), 16)
    let b = parseInt(hex.slice(5, 7), 16)
    r = Math.max(0, Math.round(r * (1 - amount)))
    g = Math.max(0, Math.round(g * (1 - amount)))
    b = Math.max(0, Math.round(b * (1 - amount)))
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

export function ThemeProvider({ children }) {
    const { user } = useAuth()
    const [accent, setAccent] = useState(() => {
        return localStorage.getItem(THEME_KEY) || '#3b6ef5'
    })

    // Sync from user profile on login
    useEffect(() => {
        if (user?.theme_color) {
            setAccent(user.theme_color)
            localStorage.setItem(THEME_KEY, user.theme_color)
        }
    }, [user?.theme_color])

    // Apply comprehensive CSS variables when accent changes
    useEffect(() => {
        const root = document.documentElement
        root.style.setProperty('--accent', accent)
        root.style.setProperty('--accent-hover', darken(accent, 0.15))
        root.style.setProperty('--accent-glow', hexToRgba(accent, 0.15))
        root.style.setProperty('--accent-soft', hexToRgba(accent, 0.08))
        root.style.setProperty('--accent-light', lighten(accent, 0.3))
        root.style.setProperty('--border-active', accent)
        // Spinner & scrollbar
        root.style.setProperty('--spinner-color', accent)
    }, [accent])

    const changeAccent = useCallback((color) => {
        setAccent(color)
        localStorage.setItem(THEME_KEY, color)
    }, [])

    return (
        <ThemeContext.Provider value={{ accent, changeAccent, ACCENT_COLORS }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)
