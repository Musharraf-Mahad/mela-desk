import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

/**
 * Client-side Route Guard for UX navigation.
 * NOTE: Real authorization is independently verified by backend sessions.
 */
export interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Unauthorized navigation attempt -> Redirect to Access Denied (403)
    return <Navigate to="/access-denied" replace />;
  }

  return <Outlet />;
}
