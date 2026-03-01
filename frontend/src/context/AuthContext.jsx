// ── AuthContext — manages Supabase session via JWT in localStorage ─────────────
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const AuthContext = createContext(null)

const TOKEN_KEY = 'da_access_token'
const REFRESH_KEY = 'da_refresh_token'
const USER_KEY = 'da_user'

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
    })
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null)
    const [loading, setLoading] = useState(false)
    const [authChecked, setAuthChecked] = useState(false)
    const refreshTimer = useRef(null)

    // Try to refresh session using stored refresh token
    const tryRefresh = async () => {
        const rt = localStorage.getItem(REFRESH_KEY)
        if (!rt) return null
        try {
            const res = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: rt }),
            })
            if (!res.ok) return null
            const data = await res.json()
            if (data.access_token) {
                localStorage.setItem(TOKEN_KEY, data.access_token)
                if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
                const u = {
                    user_id: data.user_id,
                    email: data.email,
                    display_name: data.display_name || '',
                    avatar_url: data.avatar_url || '',
                    theme_color: data.theme_color || '#3b6ef5',
                    github_url: data.github_url || '',
                    linkedin_url: data.linkedin_url || '',
                    phone: data.phone || '',
                    bio: data.bio || '',
                    request_quota: data.request_quota ?? 20,
                    requests_used: data.requests_used ?? 0,
                }
                setToken(data.access_token)
                setUser(u)
                localStorage.setItem(USER_KEY, JSON.stringify(u))
                scheduleRefresh()
                return data
            }
        } catch { }
        return null
    }

    // Schedule a token refresh 5 minutes before typical 1-hour expiry
    const scheduleRefresh = () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        // Refresh every 50 minutes (tokens usually expire in 60 min)
        refreshTimer.current = setTimeout(() => { tryRefresh() }, 50 * 60 * 1000)
    }

    // Validate stored token on mount
    useEffect(() => {
        const stored = localStorage.getItem(TOKEN_KEY)
        if (!stored) { setAuthChecked(true); return }
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
            .then(r => r.ok ? r.json() : null)
            .then(async (data) => {
                if (data) {
                    const u = {
                        user_id: data.user_id,
                        email: data.email,
                        display_name: data.display_name || '',
                        avatar_url: data.avatar_url || '',
                        theme_color: data.theme_color || '#3b6ef5',
                        github_url: data.github_url || '',
                        linkedin_url: data.linkedin_url || '',
                        phone: data.phone || '',
                        bio: data.bio || '',
                        request_quota: data.request_quota ?? 20,
                        requests_used: data.requests_used ?? 0,
                    }
                    setUser(u)
                    setToken(stored)
                    localStorage.setItem(USER_KEY, JSON.stringify(u))
                    scheduleRefresh()
                } else {
                    // Token expired — try refresh
                    const refreshed = await tryRefresh()
                    if (!refreshed) clearSession()
                }
            })
            .catch(async () => {
                const refreshed = await tryRefresh()
                if (!refreshed) clearSession()
            })
            .finally(() => setAuthChecked(true))

        return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }
    }, [])

    const clearSession = () => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(REFRESH_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }

    const saveSession = (data) => {
        localStorage.setItem(TOKEN_KEY, data.access_token)
        if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
        const u = {
            user_id: data.user_id,
            email: data.email,
            display_name: data.display_name || '',
            avatar_url: data.avatar_url || '',
            theme_color: data.theme_color || '#3b6ef5',
            github_url: data.github_url || '',
            linkedin_url: data.linkedin_url || '',
            phone: data.phone || '',
            bio: data.bio || '',
            request_quota: data.request_quota ?? 20,
            requests_used: data.requests_used ?? 0,
        }
        localStorage.setItem(USER_KEY, JSON.stringify(u))
        setToken(data.access_token)
        setUser(u)
    }

    const updateUser = useCallback((fields) => {
        setUser(prev => {
            const updated = { ...prev, ...fields }
            localStorage.setItem(USER_KEY, JSON.stringify(updated))
            return updated
        })
    }, [])

    const login = useCallback(async (email, password) => {
        setLoading(true)
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        const data = await res.json()
        setLoading(false)
        if (!res.ok) throw new Error(data.detail || 'Login failed')
        saveSession(data)
        scheduleRefresh()
        return data
    }, [])

    const signup = useCallback(async (email, password, username) => {
        setLoading(true)
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username }),
        })
        const data = await res.json()
        setLoading(false)
        if (!res.ok) throw new Error(data.detail || 'Signup failed')
        // Auto-login after successful signup
        const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        const loginData = await loginRes.json()
        if (loginRes.ok) {
            saveSession(loginData)
        }
        return { ...data, autoLoggedIn: loginRes.ok }
    }, [])

    const logout = useCallback(async () => {
        const t = localStorage.getItem(TOKEN_KEY)
        if (t) {
            fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => { })
        }
        clearSession()
    }, [])

    // Refresh quota from /me endpoint (call after LLM requests)
    const refreshQuota = useCallback(async () => {
        const t = localStorage.getItem(TOKEN_KEY)
        if (!t) return
        try {
            const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
            if (res.ok) {
                const data = await res.json()
                updateUser({
                    request_quota: data.request_quota ?? 20,
                    requests_used: data.requests_used ?? 0,
                })
            }
        } catch { }
    }, [updateUser])

    return (
        <AuthContext.Provider value={{ user, token, loading, authChecked, login, signup, logout, updateUser, refreshQuota }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)

// Helper — get token for api.js
export const getStoredToken = () => localStorage.getItem(TOKEN_KEY)
