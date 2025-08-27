import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

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

  // Handle role-based redirects from /dashboard
  if (role && window.location.pathname === '/dashboard') {
    if (role === 'super_admin') {
      return <Navigate to="/super-admin" replace />;
    }
    if (role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;