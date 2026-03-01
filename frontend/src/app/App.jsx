// App.jsx — Router configuration with Sidebar + Auth protection + Mobile Responsive
import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '../config/routes'
import { Header } from '../components/layout/Header/Header'
import Sidebar from '../components/layout/Sidebar/Sidebar'
import { useAuth } from '../context/AuthContext'
import { PermissionProvider, usePermissions } from '../context/PermissionContext'
import { NotificationProvider } from '../context/NotificationContext'

// ── Page imports ────────────────────────────────────────────────────────────
import UploadPage from '../pages/Upload/UploadPage'
import DocumentsPage from '../pages/Documents/DocumentsPage'
import AnalysisPage from '../pages/Analysis/AnalysisPage'
import NotFoundPage from '../pages/NotFound/NotFoundPage'
import AuthPage from '../pages/Auth/AuthPage'
import DashboardPage from '../pages/Dashboard/DashboardPage'
import AISettingsPage from '../pages/AISettings/AISettingsPage'
import FeedbackPage from '../pages/Feedback/FeedbackPage'
import PlansPage from '../pages/Plans/PlansPage'
import UsagePage from '../pages/Usage/UsagePage'
import FeatureLockedPage from '../pages/FeatureLocked/FeatureLockedPage'
// Admin pages
import AdminUsersPage from '../pages/Admin/AdminUsersPage'
import AdminOrgsPage from '../pages/Admin/AdminOrgsPage'
import AdminFeedbackPage from '../pages/Admin/AdminFeedbackPage'
import AdminBroadcastsPage from '../pages/Admin/AdminBroadcastsPage'
import AdminFeaturesPage from '../pages/Admin/AdminFeaturesPage'
import AdminUsagePage from '../pages/Admin/AdminUsagePage'
import AdminAuditPage from '../pages/Admin/AdminAuditPage'
import AdminPlansPage from '../pages/Admin/AdminPlansPage'
import AdminPermissionsPage from '../pages/Admin/AdminPermissionsPage'
import AdminBatchPage from '../pages/Admin/AdminBatchPage'

// Protected route — redirects to /auth if not logged in
function ProtectedRoute({ children }) {
    const { user, authChecked } = useAuth()
    if (!authChecked) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080b14' }}>
                <div className="spinner" style={{ width: 36, height: 36 }} />
            </div>
        )
    }
    if (!user) return <Navigate to="/auth" replace />
    return children
}

// Permission-gated route — shows FeatureLockedPage if user lacks required permission
function PermissionRoute({ permissionCode, children }) {
    const ctx = usePermissions()
    if (!ctx || ctx.loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', background: '#0a0d14' }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
            </div>
        )
    }
    if (!ctx.hasPermission(permissionCode)) {
        return <FeatureLockedPage />
    }
    return children
}

// Hook to detect mobile viewport
function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint)
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth <= breakpoint)
        window.addEventListener('resize', handler)
        return () => window.removeEventListener('resize', handler)
    }, [breakpoint])
    return isMobile
}

// Main layout with sidebar + header + content area (mobile-responsive)
function AppLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const isMobile = useIsMobile()

    // Auto-collapse sidebar on mobile
    useEffect(() => {
        if (isMobile) {
            setSidebarCollapsed(true)
        }
    }, [isMobile])

    // Close mobile menu on route change
    const closeMobileMenu = () => setMobileMenuOpen(false)

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0d14' }}>
            {/* Mobile overlay */}
            {isMobile && mobileMenuOpen && (
                <div
                    className="sidebar-overlay active"
                    onClick={closeMobileMenu}
                    style={{
                        display: 'block', position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.6)', zIndex: 90,
                        backdropFilter: 'blur(4px)',
                    }}
                />
            )}

            {/* Sidebar — mobile: overlay slide-in; desktop: normal */}
            {isMobile ? (
                <div style={{
                    position: 'fixed', top: 0, left: mobileMenuOpen ? 0 : -280,
                    height: '100vh', width: 260, zIndex: 100,
                    transition: 'left 0.3s ease',
                    boxShadow: mobileMenuOpen ? '4px 0 20px rgba(0,0,0,0.5)' : 'none',
                }}>
                    <Sidebar
                        collapsed={false}
                        onToggle={closeMobileMenu}
                        onNavigate={closeMobileMenu}
                    />
                </div>
            ) : (
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(c => !c)}
                />
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Header
                    isMobile={isMobile}
                    onMenuToggle={() => setMobileMenuOpen(o => !o)}
                    mobileMenuOpen={mobileMenuOpen}
                />
                <main style={{ flex: 1, overflow: 'auto' }}>
                    <Routes>
                        <Route path={ROUTES.HOME} element={<UploadPage />} />
                        <Route path={ROUTES.DOCUMENTS} element={<DocumentsPage />} />
                        <Route path={ROUTES.ANALYSIS} element={<AnalysisPage />} />
                        {/* Permission-gated user pages */}
                        <Route path={ROUTES.DASHBOARD} element={<PermissionRoute permissionCode="view_dashboard"><DashboardPage /></PermissionRoute>} />
                        <Route path={ROUTES.AI_SETTINGS} element={<PermissionRoute permissionCode="change_model"><AISettingsPage /></PermissionRoute>} />
                        <Route path={ROUTES.FEEDBACK} element={<PermissionRoute permissionCode="submit_feedback"><FeedbackPage /></PermissionRoute>} />
                        <Route path={ROUTES.PLANS} element={<PermissionRoute permissionCode="view_plans"><PlansPage /></PermissionRoute>} />
                        <Route path={ROUTES.USAGE} element={<PermissionRoute permissionCode="view_my_usage"><UsagePage /></PermissionRoute>} />
                        {/* Admin */}
                        <Route path={ROUTES.ADMIN_USERS} element={<AdminUsersPage />} />
                        <Route path={ROUTES.ADMIN_ORGS} element={<AdminOrgsPage />} />
                        <Route path={ROUTES.ADMIN_FEEDBACK} element={<AdminFeedbackPage />} />
                        <Route path={ROUTES.ADMIN_BROADCASTS} element={<AdminBroadcastsPage />} />
                        <Route path={ROUTES.ADMIN_FEATURES} element={<AdminFeaturesPage />} />
                        <Route path={ROUTES.ADMIN_USAGE} element={<AdminUsagePage />} />
                        <Route path={ROUTES.ADMIN_AUDIT} element={<AdminAuditPage />} />
                        <Route path={ROUTES.ADMIN_PLANS} element={<AdminPlansPage />} />
                        <Route path={ROUTES.ADMIN_PERMISSIONS} element={<AdminPermissionsPage />} />
                        <Route path={ROUTES.ADMIN_BATCH} element={<AdminBatchPage />} />
                        <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
                    </Routes>
                </main>
            </div>
        </div>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Auth — no sidebar/header */}
                <Route path="/auth" element={<AuthPage />} />

                {/* All protected routes — sidebar layout */}
                <Route path="*" element={
                    <ProtectedRoute>
                        <PermissionProvider>
                            <NotificationProvider>
                                <AppLayout />
                            </NotificationProvider>
                        </PermissionProvider>
                    </ProtectedRoute>
                } />
            </Routes>
        </BrowserRouter>
    )
}
