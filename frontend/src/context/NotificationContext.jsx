// ── NotificationContext — unread count polling + notification state ──────────
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../hooks/api'

const NotificationContext = createContext(null)

const POLL_INTERVAL = 30_000 // 30 seconds

export function NotificationProvider({ children }) {
    const { token } = useAuth()
    const [unreadCount, setUnreadCount] = useState(0)
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(false)
    const pollRef = useRef(null)

    const fetchUnreadCount = useCallback(async () => {
        if (!token) { setUnreadCount(0); return }
        try {
            const data = await api.getUnreadCount()
            setUnreadCount(data.unread || 0)
        } catch { /* ignore */ }
    }, [token])

    const fetchNotifications = useCallback(async (page = 1, unreadOnly = false) => {
        if (!token) return
        setLoading(true)
        try {
            const data = await api.listNotifications(page, 20, unreadOnly)
            setNotifications(data.notifications || [])
            return data
        } catch {
            return { notifications: [], total: 0 }
        } finally {
            setLoading(false)
        }
    }, [token])

    const markRead = useCallback(async (notifId) => {
        try {
            await api.markNotificationRead(notifId)
            setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch { /* ignore */ }
    }, [])

    const markAllRead = useCallback(async () => {
        try {
            await api.markAllNotificationsRead()
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            setUnreadCount(0)
        } catch { /* ignore */ }
    }, [])

    // Poll for unread count
    useEffect(() => {
        if (!token) return
        fetchUnreadCount()
        pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL)
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [token, fetchUnreadCount])

    return (
        <NotificationContext.Provider value={{
            unreadCount, notifications, loading,
            fetchNotifications, fetchUnreadCount, markRead, markAllRead,
        }}>
            {children}
        </NotificationContext.Provider>
    )
}

export const useNotifications = () => useContext(NotificationContext)
