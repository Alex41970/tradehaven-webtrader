import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();

  // Handle role-based redirects from /dashboard after role is loaded
  useEffect(() => {
    if (!loading && !roleLoading && user && role && location.pathname === '/dashboard') {
      if (role === 'super_admin') {
        navigate('/super-admin', { replace: true });
      } else if (role === 'admin') {
        navigate('/admin', { replace: true });
      }
    }
  }, [loading, roleLoading, user, role, location.pathname, navigate]);

  // Handle loading states
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Handle unauthenticated users
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;