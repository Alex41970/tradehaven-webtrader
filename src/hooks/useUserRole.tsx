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
      console.log('🔍 fetchUserRole called, user:', user ? { id: user.id, email: user.email } : 'null');
      
      if (!user) {
        console.log('❌ No user found, setting role to null');
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        console.log('🚀 Calling get_user_role RPC for user:', user.id);
        const { data, error } = await supabase.rpc('get_user_role', {
          _user_id: user.id
        });

        console.log('📊 get_user_role response:', { data, error });

        if (error) {
          console.error('❌ RPC Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          throw error;
        }
        
        console.log('✅ Successfully fetched user role:', data);
        setRole(data as UserRole);
      } catch (error) {
        console.error('❌ Error fetching user role:', error);
        console.log('🔄 Defaulting to user role due to error');
        setRole('user'); // Default to user role
      } finally {
        setLoading(false);
        console.log('🏁 fetchUserRole completed');
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