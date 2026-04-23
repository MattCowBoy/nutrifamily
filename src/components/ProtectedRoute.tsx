import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  children: ReactNode;
  requireProfile?: boolean;
}

export default function ProtectedRoute({ children, requireProfile = false }: Props) {
  const { isAuthenticated, currentProfile } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireProfile && !currentProfile) {
    return <Navigate to="/profiles" replace />;
  }

  return <>{children}</>;
}
