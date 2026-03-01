// ── PermissionContext — fetches user role, permissions, org info from backend ──
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { useLanguage } from '../i18n'
import { api } from '../hooks/api'

const PermissionContext = createContext(null)

export function PermissionProvider({ children }) {
    const { user, token } = useAuth()
    const { t } = useLanguage()
    const [profile, setProfile] = useState(null)
    const [permissions, setPermissions] = useState([])
    const [role, setRole] = useState(null)
    const [organization, setOrganization] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = useCallback(async () => {
        if (!token) {
            setProfile(null)
            setPermissions([])
            setRole(null)
            setOrganization(null)
            setLoading(false)
            return
        }
        try {
            setLoading(true)
            const data = await api.getMyProfile()
            setProfile(data.profile || null)
            setRole(data.profile?.roles || null)
            setOrganization(data.profile?.organizations || null)
            setPermissions(data.permissions || [])
        } catch {
            setProfile(null)
            setPermissions([])
            setRole(null)
            setOrganization(null)
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        fetchProfile()
    }, [fetchProfile])

    const hasPermission = useCallback((code) => {
        if (!role) return false
        if (role.name === 'super_admin') return true
        return permissions.includes(code)
    }, [role, permissions])

    const hasRole = useCallback((roleName) => {
        if (!role) return false
        if (role.name === 'super_admin') return true
        return role.name === roleName
    }, [role])

    const isSuperAdmin = role?.name === 'super_admin'
    const isOrgAdmin = role?.name === 'org_admin' || isSuperAdmin
    const isAdmin = isSuperAdmin || isOrgAdmin

    // Build menu items based on permissions
    // enabled = true means fully clickable, enabled = false means visible but grayed/locked
    // show = true means visible, show = false means hidden entirely
    const menuItems = [
        // ── User menus — always visible, enabled based on permission ──
        { key: 'upload', label: t('sidebar.upload'), icon: '📤', path: '/', show: true, enabled: hasPermission('upload_doc') || true },
        { key: 'documents', label: t('sidebar.documents'), icon: '📄', path: '/documents', show: true, enabled: hasPermission('view_analysis') || true },
        { key: 'dashboard', label: t('sidebar.dashboard'), icon: '📊', path: '/dashboard', show: true, enabled: hasPermission('view_dashboard') },
        { key: 'ai-settings', label: t('sidebar.aiSettings'), icon: '🔑', path: '/ai-settings', show: true, enabled: hasPermission('change_model') },
        { key: 'feedback', label: t('sidebar.feedback'), icon: '💬', path: '/feedback', show: true, enabled: hasPermission('submit_feedback') },
        { key: 'plans', label: t('sidebar.plans'), icon: '💎', path: '/plans', show: true, enabled: hasPermission('view_plans') },
        { key: 'usage', label: t('sidebar.myUsage'), icon: '📈', path: '/usage', show: true, enabled: hasPermission('view_my_usage') },
        // ── Admin section — hidden entirely if no permission ──
        { key: 'admin-divider', label: t('sidebar.admin'), divider: true, show: hasPermission('admin_panel'), enabled: true },
        { key: 'admin-users', label: t('sidebar.users'), icon: '👥', path: '/admin/users', show: hasPermission('manage_users'), enabled: true },
        { key: 'admin-orgs', label: t('sidebar.organizations'), icon: '🏢', path: '/admin/organizations', show: hasPermission('manage_org'), enabled: true },
        { key: 'admin-feedback', label: t('sidebar.feedbackMgmt'), icon: '📋', path: '/admin/feedback', show: hasPermission('manage_feedback'), enabled: true },
        { key: 'admin-broadcasts', label: t('sidebar.broadcasts'), icon: '📢', path: '/admin/broadcasts', show: hasPermission('send_broadcast'), enabled: true },
        { key: 'admin-features', label: t('sidebar.featureFlags'), icon: '🚩', path: '/admin/features', show: hasPermission('manage_features'), enabled: true },
        { key: 'admin-usage', label: t('sidebar.usageMonitor'), icon: '📊', path: '/admin/usage', show: hasPermission('view_usage'), enabled: true },
        { key: 'admin-audit', label: t('sidebar.auditLog'), icon: '🔍', path: '/admin/audit', show: hasPermission('view_audit_log'), enabled: true },
        { key: 'admin-plans', label: t('sidebar.managePlans'), icon: '⚙️', path: '/admin/plans', show: hasPermission('manage_plans'), enabled: true },
        { key: 'admin-batch', label: t('sidebar.batchCosts'), icon: '⚡', path: '/admin/batch', show: hasPermission('manage_batch'), enabled: true },
        { key: 'admin-email', label: t('sidebar.emailConfig'), icon: '📧', path: '/admin/email', show: hasPermission('manage_email'), enabled: true },
        // Only super admin can edit who has which permissions
        { key: 'admin-permissions', label: t('sidebar.permissions'), icon: '🛡️', path: '/admin/permissions', show: isSuperAdmin, enabled: true },
    ]

    const visibleMenuItems = menuItems.filter(m => m.show)

    // Map path → required permission code for route guarding
    const routePermissionMap = {
        '/dashboard': 'view_dashboard',
        '/ai-settings': 'change_model',
        '/feedback': 'submit_feedback',
        '/plans': 'view_plans',
        '/usage': 'view_my_usage',
    }

    return (
        <PermissionContext.Provider value={{
            profile, role, organization, permissions, loading,
            hasPermission, hasRole, isSuperAdmin, isOrgAdmin, isAdmin,
            menuItems: visibleMenuItems, allMenuItems: menuItems,
            routePermissionMap, refreshProfile: fetchProfile,
        }}>
            {children}
        </PermissionContext.Provider>
    )
}

export const usePermissions = () => useContext(PermissionContext)
