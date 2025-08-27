import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect admins and super admins to their respective dashboards
  useEffect(() => {
    if (role && window.location.pathname === '/dashboard') {
      if (role === 'super_admin') {
        window.location.href = '/super-admin';
      } else if (role === 'admin') {
        window.location.href = '/admin';
      }
    }
  }, [role]);

  return <>{children}</>;
};

export default ProtectedRoute;