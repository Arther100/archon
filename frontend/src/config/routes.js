// All route constants — never use raw strings in components
export const ROUTES = {
    HOME: '/',
    DASHBOARD: '/dashboard',
    DOCUMENTS: '/documents',
    PROJECTS: '/projects',
    PROJECT_DETAIL: '/projects/:id',
    ANALYSIS: '/documents/:id',
    AI_SETTINGS: '/ai-settings',
    FEEDBACK: '/feedback',
    PLANS: '/plans',
    PLAN_DETAIL: '/plans/:id',
    USAGE: '/usage',
    // Admin routes
    ADMIN_USERS: '/admin/users',
    ADMIN_ORGS: '/admin/organizations',
    ADMIN_FEEDBACK: '/admin/feedback',
    ADMIN_BROADCASTS: '/admin/broadcasts',
    ADMIN_FEATURES: '/admin/features',
    ADMIN_USAGE: '/admin/usage',
    ADMIN_AUDIT: '/admin/audit',
    ADMIN_PLANS: '/admin/plans',
    ADMIN_PERMISSIONS: '/admin/permissions',
    ADMIN_BATCH: '/admin/batch',
    // Auth
    AUTH: '/auth',
    NOT_FOUND: '*',
}

export const analysisRoute = (id) => `/documents/${id}`
export const planDetailRoute = (id) => `/plans/${id}`
export const projectRoute = (id) => `/projects/${id}`
