// api.js — centralized API client with Authorization header support
import { getStoredToken } from '../context/AuthContext'

const BASE = '/api'

async function request(path, options = {}) {
    const token = getStoredToken()
    const headers = {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    const res = await fetch(`${BASE}${path}`, { ...options, headers })
    if (!res.ok) {
        // Token expired — try refresh before giving up
        if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
            const rt = localStorage.getItem('da_refresh_token')
            if (rt) {
                try {
                    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refresh_token: rt }),
                    })
                    if (refreshRes.ok) {
                        const refreshData = await refreshRes.json()
                        localStorage.setItem('da_access_token', refreshData.access_token)
                        if (refreshData.refresh_token) localStorage.setItem('da_refresh_token', refreshData.refresh_token)
                        // Retry the original request with new token
                        const retryHeaders = {
                            ...(options.headers || {}),
                            Authorization: `Bearer ${refreshData.access_token}`,
                        }
                        const retryRes = await fetch(`${BASE}${path}`, { ...options, headers: retryHeaders })
                        if (retryRes.ok) return retryRes.json()
                    }
                } catch { }
            }
            // Refresh failed — clear and redirect
            localStorage.removeItem('da_access_token')
            localStorage.removeItem('da_refresh_token')
            localStorage.removeItem('da_user')
            window.location.href = '/auth'
        }
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
}

export const api = {
    // ── Auth ──────────────────────────────────────────────────────────────────
    login: (email, password) => request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }),
    signup: (email, password, username) => request('/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, username }) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
    changePassword: (current_password, new_password) => request('/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password, new_password }) }),
    updateProfile: (data) => request('/auth/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    uploadAvatar: (file) => {
        const formData = new FormData()
        formData.append('file', file)
        return request('/auth/avatar', { method: 'POST', body: formData })
    },

    // ── Permission/Profile (RBAC) ─────────────────────────────────────────────
    getMyProfile: () => request('/auth/me/profile'),

    // ── Documents ─────────────────────────────────────────────────────────────
    upload: (formData) => request('/upload', { method: 'POST', body: formData }),
    listDocuments: () => request('/documents'),
    listModules: (documentId) => request(`/documents/${documentId}/modules`),
    deleteDocument: (documentId) => request(`/documents/${documentId}`, { method: 'DELETE' }),

    // ── Analysis ──────────────────────────────────────────────────────────────
    analyseModule: (moduleId) => request(`/modules/${moduleId}/analyse`, { method: 'POST' }),
    getAnalysis: (moduleId) => request(`/modules/${moduleId}/analysis`),
    getAnalysisHistory: (moduleId) => request(`/modules/${moduleId}/analyses`),
    restoreAnalysis: (moduleId, analysisId) => request(`/modules/${moduleId}/analyses/${analysisId}`),

    // ── API Schema ────────────────────────────────────────────────────────────
    getApiSchema: (moduleId) => request(`/modules/${moduleId}/api-schema`),
    saveApiSchema: (moduleId, api_schema) =>
        request(`/modules/${moduleId}/api-schema`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_schema }),
        }),

    // ── Q&A ───────────────────────────────────────────────────────────────────
    askQuestion: (documentId, question) =>
        request(`/documents/${documentId}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question }),
        }),

    // ── Cross-Module Connectivity ─────────────────────────────────────────────
    getConnectivityMap: (documentId) => request(`/documents/${documentId}/connectivity-map`),
    generateConnectivityMap: (documentId) => request(`/documents/${documentId}/connectivity-map`, { method: 'POST' }),

    askModuleQuestion: (moduleId, question) =>
        request(`/modules/${moduleId}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question }),
        }),

    // ── Dependencies ──────────────────────────────────────────────────────────
    getDependencies: (documentId) => request(`/documents/${documentId}/dependencies`),

    // ── Feedback ──────────────────────────────────────────────────────────────
    submitFeedback: (data) => request('/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    myFeedback: () => request('/feedback/mine'),
    getFeedback: (id) => request(`/feedback/${id}`),
    listAllFeedback: (page = 1, per_page = 20, filters = {}) => {
        const params = new URLSearchParams({ page, per_page, ...filters })
        return request(`/feedback?${params}`)
    },
    updateFeedbackStatus: (id, status) => request(`/feedback/${id}/status?status=${status}`, { method: 'PUT' }),
    replyToFeedback: (id, content) => request(`/feedback/${id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }),

    // ── Notifications ─────────────────────────────────────────────────────────
    listNotifications: (page = 1, per_page = 20, unread_only = false) =>
        request(`/notifications?page=${page}&per_page=${per_page}&unread_only=${unread_only}`),
    getUnreadCount: () => request('/notifications/unread-count'),
    markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PUT' }),

    // ── AI Settings (BYOK) ───────────────────────────────────────────────────
    getAISettings: () => request('/ai-settings'),
    saveAIKey: (data) => request('/ai-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    validateAIKey: (id) => request(`/ai-settings/${id}/validate`, { method: 'POST' }),
    deleteAIKey: (id) => request(`/ai-settings/${id}`, { method: 'DELETE' }),

    // ── Plans ─────────────────────────────────────────────────────────────────
    listPlans: () => request('/plans'),
    getPlan: (id) => request(`/plans/${id}`),
    choosePlan: (id) => request(`/plans/${id}/choose`, { method: 'POST' }),

    // ── Usage ─────────────────────────────────────────────────────────────────
    myUsage: () => request('/admin/usage/me'),

    // ── Admin: Organizations ──────────────────────────────────────────────────
    adminListOrgs: () => request('/admin/organizations'),
    adminCreateOrg: (data) => request('/admin/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    adminUpdateOrg: (id, data) => request(`/admin/organizations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    adminDeleteOrg: (id) => request(`/admin/organizations/${id}`, { method: 'DELETE' }),

    // ── Admin: Users ──────────────────────────────────────────────────────────
    adminListUsers: () => request('/admin/users'),
    adminUpdateUser: (id, data) => request(`/admin/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    adminSendMessage: (userId, data) => request(`/admin/users/${userId}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    adminUpdateUserQuota: (userId, request_quota, reset_used = false) => request(`/admin/users/${userId}/quota`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_quota, reset_used }) }),
    adminListRoles: () => request('/admin/users/roles'),

    // ── Admin: Permissions ────────────────────────────────────────────────────
    adminListPermissions: () => request('/admin/users/permissions'),
    adminUpdateRolePermissions: (roleId, permissions) => request(`/admin/users/permissions/${roleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(permissions) }),

    // ── Admin: Plans ──────────────────────────────────────────────────────────
    adminCreatePlan: (data) => request('/plans/admin/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    adminUpdatePlan: (id, data) => request(`/plans/admin/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

    // ── Admin: Features ───────────────────────────────────────────────────────
    adminListPlanFeatures: () => request('/admin/features/plan-features'),
    adminUpdatePlanFeatures: (planId, features) => request(`/admin/features/plan-features/${planId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(features) }),
    adminListOverrides: (orgId) => request(`/admin/features/overrides${orgId ? '?organization_id=' + orgId : ''}`),
    adminCreateOverride: (data) => request('/admin/features/overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    adminDeleteOverride: (id) => request(`/admin/features/overrides/${id}`, { method: 'DELETE' }),

    // ── Admin: Usage ──────────────────────────────────────────────────────────
    adminUsageSummary: () => request('/admin/usage/summary'),
    adminUsageByUsers: (page = 1, per_page = 50) => request(`/admin/usage/users?page=${page}&per_page=${per_page}`),
    adminUsageLogs: (page = 1) => request(`/admin/usage/logs?page=${page}`),

    // ── Admin: Audit ──────────────────────────────────────────────────────────
    adminListAuditLogs: (page = 1, per_page = 50, filters = {}) => {
        const params = new URLSearchParams({ page, per_page, ...filters })
        return request(`/admin/audit?${params}`)
    },
    adminAuditActions: () => request('/admin/audit/actions'),

    // ── Admin: Broadcasts ─────────────────────────────────────────────────────
    adminListBroadcasts: (page = 1) => request(`/admin/broadcasts?page=${page}`),
    adminCreateBroadcast: (data) => request('/admin/broadcasts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    adminDeleteBroadcast: (id) => request(`/admin/broadcasts/${id}`, { method: 'DELETE' }),

    // ── Admin: Batch Processing ───────────────────────────────────────────────
    batchCreateJob: (data) => request('/admin/batch/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    batchListJobs: (page = 1, status = '', docId = '') => {
        const params = new URLSearchParams({ page })
        if (status) params.append('status', status)
        if (docId) params.append('document_id', docId)
        return request(`/admin/batch/jobs?${params}`)
    },
    batchGetJob: (id) => request(`/admin/batch/jobs/${id}`),
    batchExecuteJob: (id, mode = 'concurrent') => request(`/admin/batch/jobs/${id}/execute?mode=${mode}`, { method: 'POST' }),
    batchSubmitOpenAI: (id) => request(`/admin/batch/jobs/${id}/submit`, { method: 'POST' }),
    batchPollJob: (id) => request(`/admin/batch/jobs/${id}/poll`, { method: 'POST' }),
    batchCancelJob: (id) => request(`/admin/batch/jobs/${id}/cancel`, { method: 'POST' }),
    batchStats: () => request('/admin/batch/stats'),
    batchCacheStats: () => request('/admin/batch/cache'),
    batchClearCache: () => request('/admin/batch/cache/clear', { method: 'POST' }),
    batchTokenUsage: (days = 30) => request(`/admin/batch/usage?days=${days}`),
    batchCostSettings: () => request('/admin/batch/costs'),
    batchUpdateCost: (id, data) => request(`/admin/batch/costs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
}
