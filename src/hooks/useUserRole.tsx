import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type UserRole = 'user' | 'admin' | 'super_admin';

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('get_user_role', {
          _user_id: user.id
        });

        if (error) throw error;
        setRole(data as UserRole);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('user'); // Default to user role
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  const hasRole = (requiredRole: UserRole | UserRole[]) => {
    if (!role) return false;
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(role);
    }
    
    // Super admin has access to everything
    if (role === 'super_admin') return true;
    
    // Admin has access to admin and user
    if (role === 'admin' && ['admin', 'user'].includes(requiredRole)) return true;
    
    // User only has access to user
    return role === requiredRole;
  };

  const isAdmin = () => hasRole(['admin', 'super_admin']);
  const isSuperAdmin = () => hasRole('super_admin');

  return {
    role,
    loading,
    hasRole,
    isAdmin,
    isSuperAdmin
  };
};