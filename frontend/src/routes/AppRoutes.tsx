import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

// Layouts
import { AuthLayout } from '../components/layout/AuthLayout';
import { AppLayout } from '../components/layout/AppLayout';
import { UtilityLayout } from '../components/layout/UtilityLayout';

// Auth Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { CustomerRegistrationPage } from '../pages/auth/CustomerRegistrationPage';

// Customer Pages
import { CustomerDashboardPage } from '../pages/customer/CustomerDashboardPage';
import { MyTicketsPage } from '../pages/customer/MyTicketsPage';
import { CreateTicketPage } from '../pages/customer/CreateTicketPage';
import { CustomerProfilePage } from '../pages/customer/CustomerProfilePage';

// Agent Pages
import { SupportDashboardPage } from '../pages/agent/SupportDashboardPage';
import { SupportQueuePage } from '../pages/agent/SupportQueuePage';
import { AssignedTicketsPage } from '../pages/agent/AssignedTicketsPage';
import { TicketWorkspacePage } from '../pages/agent/TicketWorkspacePage';
import { AgentProfilePage } from '../pages/agent/AgentProfilePage';

// Admin Pages
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { UserAgentManagementPage } from '../pages/admin/UserAgentManagementPage';
import { ReportsAnalyticsPage } from '../pages/admin/ReportsAnalyticsPage';
import { SystemSettingsPage } from '../pages/admin/SystemSettingsPage';

// Shared & Utility Pages
import { TicketDetailsPage } from '../pages/shared/TicketDetailsPage';
import { AccessDeniedPage } from '../pages/utility/AccessDeniedPage';
import { NotFoundPage } from '../pages/utility/NotFoundPage';

export function AppRoutes() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const { t } = useTranslation();

  // Root redirect helper based on authenticated role
  const getRootRedirect = () => {
    if (!isAuthenticated) return '/login';
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'agent') return '/agent/dashboard';
    return '/customer/dashboard';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">{t('app.loadingSession', 'Loading session...')}</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to={getRootRedirect()} replace />} />

      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to={getRootRedirect()} replace /> : <LoginPage />}
        />
        <Route
          path="/customer-registration"
          element={isAuthenticated ? <Navigate to={getRootRedirect()} replace /> : <CustomerRegistrationPage />}
        />
        <Route path="/register" element={<Navigate to="/customer-registration" replace />} />
      </Route>

      {/* Utility Screens */}
      <Route element={<UtilityLayout />}>
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route path="/not-found-(404)" element={<NotFoundPage />} />
        <Route path="/404" element={<Navigate to="/not-found-(404)" replace />} />
      </Route>

      {/* Authenticated Application Shell */}
      <Route element={<AppLayout />}>
        {/* Customer Role Routes */}
        <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
          <Route path="/customer/dashboard" element={<CustomerDashboardPage />} />
          <Route path="/customer/tickets" element={<MyTicketsPage />} />
          <Route path="/customer/create-ticket" element={<CreateTicketPage />} />
          <Route path="/customer/profile" element={<CustomerProfilePage />} />

          {/* Screenshot concept URL aliases */}
          <Route path="/customer-dashboard" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/my-tickets" element={<Navigate to="/customer/tickets" replace />} />
          <Route path="/create-ticket" element={<Navigate to="/customer/create-ticket" replace />} />
          <Route path="/customer-profile-&-settings" element={<Navigate to="/customer/profile" replace />} />
        </Route>

        {/* Support Agent Role Routes */}
        <Route element={<ProtectedRoute allowedRoles={['agent']} />}>
          <Route path="/agent/dashboard" element={<SupportDashboardPage />} />
          <Route path="/agent/queue" element={<SupportQueuePage />} />
          <Route path="/agent/assigned" element={<AssignedTicketsPage />} />
          <Route path="/agent/tickets/:id" element={<TicketWorkspacePage />} />
          <Route path="/agent/profile" element={<AgentProfilePage />} />

          {/* Screenshot concept URL aliases */}
          <Route path="/support-dashboard" element={<Navigate to="/agent/dashboard" replace />} />
          <Route path="/support-queue" element={<Navigate to="/agent/queue" replace />} />
          <Route path="/assigned-tickets" element={<Navigate to="/agent/assigned" replace />} />
          <Route path="/agent-profile-&-settings" element={<Navigate to="/agent/profile" replace />} />
        </Route>

        {/* Administrator Role Routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/tickets" element={<SupportQueuePage />} />
          <Route path="/admin/users" element={<UserAgentManagementPage />} />
          <Route path="/admin/reports" element={<ReportsAnalyticsPage />} />
          <Route path="/admin/settings" element={<SystemSettingsPage />} />

          {/* Screenshot concept URL aliases */}
          <Route path="/admin-dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/all-tickets" element={<Navigate to="/admin/tickets" replace />} />
          <Route path="/user-&-agent-management" element={<Navigate to="/admin/users" replace />} />
          <Route path="/reports-&-analytics" element={<Navigate to="/admin/reports" replace />} />
          <Route path="/system-settings-&-categories" element={<Navigate to="/admin/settings" replace />} />
        </Route>

        {/* Shared Authenticated Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Route>
      </Route>

      {/* Global 404 Fallback */}
      <Route element={<UtilityLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
