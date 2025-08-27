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

  // ALL HOOKS MUST BE CALLED FIRST - before any conditional returns
  useEffect(() => {
    // Only redirect if we have role info and user is authenticated
    if (!loading && !roleLoading && user && role && window.location.pathname === '/dashboard') {
      if (role === 'super_admin') {
        window.location.href = '/super-admin';
      } else if (role === 'admin') {
        window.location.href = '/admin';
      }
    }
  }, [loading, roleLoading, user, role]);

  // Now we can have conditional returns
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

  return <>{children}</>;
};

export default ProtectedRoute;