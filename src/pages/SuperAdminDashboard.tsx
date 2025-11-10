import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, UserCheck, Settings, Crown, LogOut, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface UserWithRole {
  user_id: string;
  email: string;
  first_name?: string;
  surname?: string;
  phone_number?: string;
  balance: number;
  equity: number;
  admin_id: string | null;
  admin_email: string | null;
  role: string;
  assignment_method?: string;  
  promo_code_used?: string | null;
  created_at: string;
  last_activity_at?: string;
}

interface AdminUser {
  user_id: string;
  email: string;
  role: string;
  user_count: number;
  created_at: string;
}

interface PromoCode {
  id: string;
  code: string;
  admin_id: string;
  admin_email: string;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  created_at: string;
  assigned_users_count: number;
}

const SuperAdminDashboard = () => {
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading, isSuperAdmin } = useUserRole();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = useState(false);
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Form states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("admin");
  
  // Promo code form states
  const [promoCodeValue, setPromoCodeValue] = useState("");
  const [promoAdminId, setPromoAdminId] = useState("");
  const [promoMaxUses, setPromoMaxUses] = useState("");
  const [promoExpiresAt, setPromoExpiresAt] = useState("");
  
  // Delete user states
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  useEffect(() => {
    if (user && !roleLoading && role === 'super_admin') {
      console.log('SuperAdminDashboard: Initiating data fetch for user:', user.id, 'role:', role);
      // Add a small delay to ensure auth context is established
      const timer = setTimeout(() => {
        fetchSuperAdminData();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      console.log('SuperAdminDashboard: Not fetching data. User:', !!user, 'roleLoading:', roleLoading, 'role:', role);
    }
  }, [user, roleLoading, role, retryCount]);

  const fetchSuperAdminData = async () => {
    if (!user) {
      console.log('❌ SuperAdminDashboard: No user found - aborting fetch');
      setError('Please log in to access super admin dashboard');
      setLoading(false);
      return;
    }

    console.log('🔍 SuperAdminDashboard: Starting data fetch for user:', user.id, 'email:', user.email);

    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 SuperAdminDashboard: Fetch attempt', retryCount + 1);
      
      // Verify auth session is active and valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 SuperAdminDashboard: Session check - valid:', !!session, 'user match:', session?.user?.id === user.id);
      
      if (!session || !session.user || session.user.id !== user.id) {
        console.error('❌ SuperAdminDashboard: Invalid session');
        // Try to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession) {
          setError('Authentication session expired. Please sign out and sign back in.');
          setLoading(false);
          return;
        }
        console.log('✅ SuperAdminDashboard: Session refreshed successfully');
      }

      // Check if user has super admin role before proceeding
      if (role !== 'super_admin') {
        console.error('❌ SuperAdminDashboard: User does not have super admin role, current role:', role);
        setError('Access denied. Super admin role required.');
        setLoading(false);
        return;
      }

      console.log('✅ SuperAdminDashboard: User authenticated as super admin, fetching data...');

      console.log('SuperAdminDashboard: Fetching user profiles...');
      // Fetch user profiles separately
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select(`
          user_id,
          email,
          first_name,
          surname,
          phone_number,
          balance,
          equity,
          admin_id,
          assignment_method,
          promo_code_used,
          created_at
        `);

      if (usersError) {
        console.error('SuperAdminDashboard: Error fetching user profiles:', usersError);
        console.error('SuperAdminDashboard: Error details:', {
          message: usersError.message,
          code: usersError.code,
          details: usersError.details,
          hint: usersError.hint
        });
        throw new Error(`User profiles error: ${usersError.message} (Code: ${usersError.code}) - Details: ${usersError.details || 'None'}`);
      }

      console.log('SuperAdminDashboard: User profiles fetched successfully. Count:', usersData?.length || 0);

      console.log('SuperAdminDashboard: Fetching user roles...');
      // Fetch user roles separately
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error('SuperAdminDashboard: Error fetching user roles:', rolesError);
        throw new Error(`User roles error: ${rolesError.message} (Code: ${rolesError.code})`);
      }

      console.log('SuperAdminDashboard: User roles fetched successfully. Count:', rolesData?.length || 0);

      // Create a map of user roles for quick lookup
      // Since we now enforce unique roles per user, each user should have exactly one role
      const rolesMap = new Map();
      rolesData?.forEach((roleItem: any) => {
        if (rolesMap.has(roleItem.user_id)) {
          console.warn('SuperAdminDashboard: Multiple roles detected for user:', roleItem.user_id, 'existing:', rolesMap.get(roleItem.user_id), 'new:', roleItem.role);
        }
        rolesMap.set(roleItem.user_id, roleItem.role);
      });

      // Create a map of user emails for admin lookup
      const emailMap = new Map();
      usersData?.forEach((user: any) => {
        emailMap.set(user.user_id, user.email);
      });

      // Transform and combine the data
      const transformedUsers = usersData?.map((user: any) => ({
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        surname: user.surname,
        phone_number: user.phone_number,
        balance: user.balance,
        equity: user.equity,
        admin_id: user.admin_id,
        admin_email: user.admin_id ? emailMap.get(user.admin_id) || null : null,
        role: rolesMap.get(user.user_id) || 'user',
        assignment_method: user.assignment_method || 'manual',
        promo_code_used: user.promo_code_used,
        created_at: user.created_at
      })) || [];

      // Get admin data by finding users who have admin role
      const adminIds = Array.from(rolesMap.entries())
        .filter(([_, role]) => role === 'admin')
        .map(([userId, _]) => userId);

      console.log('SuperAdminDashboard: Found admin IDs:', adminIds);

      // Count users for each admin
      const adminMap = new Map();
      
      // Initialize admin map with admin users
      transformedUsers.forEach(user => {
        if (adminIds.includes(user.user_id)) {
          adminMap.set(user.user_id, {
            user_id: user.user_id,
            email: user.email,
            role: 'admin' as const,
            user_count: 0,
            created_at: user.created_at
          });
        }
      });

      // Count users assigned to each admin
      transformedUsers.forEach(user => {
        if (user.admin_id && adminMap.has(user.admin_id) && user.role === 'user') {
          const adminData = adminMap.get(user.admin_id);
          if (adminData) {
            adminData.user_count++;
          }
        }
      });

      console.log('SuperAdminDashboard: Data processing complete. Users:', transformedUsers.length, 'Admins:', adminMap.size);

      setUsers(transformedUsers);
      setAdmins(Array.from(adminMap.values()));
      
      // Fetch promo codes with statistics
      const { data: promoCodesData, error: promoError } = await supabase.rpc('get_promo_code_stats');
      
      if (promoError) {
        console.error('SuperAdminDashboard: Error fetching promo codes:', promoError);
        // Don't throw error for promo codes, just log it
        setPromoCodes([]);
      } else {
        console.log('SuperAdminDashboard: Promo codes fetched successfully. Count:', promoCodesData?.length || 0);
        setPromoCodes(promoCodesData || []);
      }
      
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('SuperAdminDashboard: Error fetching data:', error);
      console.error('SuperAdminDashboard: Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack
      });
      
      let errorMessage = error?.message || 'Failed to load data';
      
      // Add more specific error context
      if (error?.code) {
        errorMessage += ` (Code: ${error.code})`;
      }
      if (error?.details) {
        errorMessage += ` - ${error.details}`;
      }
      if (error?.hint) {
        errorMessage += ` Hint: ${error.hint}`;
      }
      
      setError(errorMessage);
      
      // Retry logic - if it's an auth issue and we haven't retried too many times
      if (retryCount < 2 && (errorMessage.includes('auth') || errorMessage.includes('session') || errorMessage.includes('JWT') || error?.code === 'PGRST301')) {
        console.log('SuperAdminDashboard: Auth/Permission error detected, retrying in 1.5 seconds...', errorMessage);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          fetchSuperAdminData();
        }, 1500);
      } else {
        console.error('SuperAdminDashboard: Max retries reached or non-auth error:', errorMessage);
        toast({
          title: "Error Loading Data", 
          description: retryCount >= 2 ? `Authentication/Permission error after ${retryCount + 1} attempts. Please sign out and sign back in.` : errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format last activity time
  const formatLastActive = (lastActivityAt: string | null | undefined) => {
    if (!lastActivityAt) return 'Never';
    
    const lastActivity = new Date(lastActivityAt);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastActivity.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) { // 24 hours
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}h ago`;
    }
    const days = Math.floor(diffMinutes / 1440);
    return `${days}d ago`;
  };

  const handleCreateAdmin = async () => {
    if (!newAdminEmail) return;

    try {
      // Find user in profiles table by email
      const { data: userProfiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', newAdminEmail)
        .single();

      if (profileError || !userProfiles) {
        toast({
          title: "Error",
          description: "User not found with that email",
          variant: "destructive"
        });
        return;
      }

      // Check current user role
      const { data: currentRole, error: roleCheckError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userProfiles.user_id)
        .single();

      if (roleCheckError) {
        toast({
          title: "Error",
          description: "Could not verify user's current role",
          variant: "destructive"
        });
        return;
      }

      // Check if user is already an admin
      if (currentRole?.role === 'admin') {
        toast({
          title: "Info",
          description: "User is already an admin",
          variant: "default"
        });
        setNewAdminEmail("");
        return;
      }

      // Update the user's role to admin (replace existing role)
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: 'admin' })
        .eq('user_id', userProfiles.user_id);

      if (roleError) throw roleError;

      toast({
        title: "Success",
        description: "User promoted to admin successfully"
      });
      fetchSuperAdminData();
      setNewAdminEmail("");
    } catch (error: any) {
      console.error('Error creating admin:', error);
      const errorMessage = error.message?.includes('duplicate key') 
        ? "User role conflict. Please try again." 
        : "Failed to create admin";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleTransferUser = async () => {
    if (!selectedUserId || !newAdminId) return;

    try {
      // Use the database function for atomic transfer
      const { data, error } = await supabase.rpc('transfer_user_to_admin', {
        _user_id: selectedUserId,
        _new_admin_id: newAdminId
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User transferred successfully"
      });
      fetchSuperAdminData();
      setSelectedUserId("");
      setNewAdminId("");
    } catch (error: any) {
      console.error('Error transferring user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to transfer user",
        variant: "destructive"
      });
    }
  };

  const handleCreatePromoCode = async () => {
    if (!promoCodeValue || !promoAdminId) return;

    try {
      const { error } = await supabase
        .from('promo_codes')
        .insert({
          code: promoCodeValue,
          admin_id: promoAdminId,
          max_uses: promoMaxUses ? parseInt(promoMaxUses) : null,
          expires_at: promoExpiresAt ? new Date(promoExpiresAt).toISOString() : null,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Promo code created successfully"
      });
      
      // Reset form
      setPromoCodeValue("");
      setPromoAdminId("");
      setPromoMaxUses("");
      setPromoExpiresAt("");
      
      // Refresh data
      fetchSuperAdminData();
    } catch (error: any) {
      console.error('Error creating promo code:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create promo code",
        variant: "destructive"
      });
    }
  };

  const handleTogglePromoCode = async (promoId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: !currentStatus })
        .eq('id', promoId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Promo code ${!currentStatus ? 'activated' : 'deactivated'} successfully`
      });
      
      fetchSuperAdminData();
    } catch (error: any) {
      console.error('Error toggling promo code:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update promo code",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    try {
      // Remove admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', adminId)
        .eq('role', 'admin');

      if (roleError) throw roleError;

      // Add back user role if they don't have one
      const { error: userRoleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: adminId,
          role: 'user'
        });

      if (userRoleError) throw userRoleError;

      // Update all their users to have no admin
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ admin_id: null })
        .eq('admin_id', adminId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Admin deleted successfully"
      });
      fetchSuperAdminData();
    } catch (error) {
      console.error('Error deleting admin:', error);
      toast({
        title: "Error",
        description: "Failed to delete admin",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || deletingUser) return;

    setDeletingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userToDelete.user_id }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete user');
      }

      toast({
        title: "Success",
        description: `User ${userToDelete.email} has been permanently deleted`
      });

      // Close dialog and refresh data
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchSuperAdminData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive"
      });
    } finally {
      setDeletingUser(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      setSigningOut(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const totalUsers = users.length;
  const totalAdmins = admins.length;
  const usersWithoutAdmin = users.filter(u => !u.admin_id && u.role === 'user').length;
  const totalBalance = users.reduce((sum, user) => sum + (user.balance || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
            <p className="text-muted-foreground">Complete system management and oversight</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-lg px-4 py-2">
              <Crown className="w-4 h-4 mr-2" />
              Super Admin
            </Badge>
            <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut}>
              <LogOut className="h-4 w-4 mr-2" />
              {signingOut ? "Signing Out..." : "Sign Out"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Admins</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAdmins}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unassigned Users</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usersWithoutAdmin}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Platform Balance</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalBalance.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">All Users</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="promo-codes">Promo Codes</TabsTrigger>
            <TabsTrigger value="management">Management</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All System Users</CardTitle>
                <CardDescription>Complete overview of all users in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-center">
                      <div className="text-lg">Loading users...</div>
                      {retryCount > 0 && (
                        <div className="text-sm text-muted-foreground mt-2">
                          Retry attempt {retryCount}/3
                        </div>
                      )}
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="text-lg text-destructive mb-2">Failed to load users</div>
                    <div className="text-sm text-muted-foreground mb-4">{error}</div>
                    <Button onClick={fetchSuperAdminData} variant="outline">
                      Try Again
                    </Button>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Assigned Admin</TableHead>
                        <TableHead>Assignment Method</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((userRow) => {
                        const isSelf = userRow.user_id === user?.id;
                        const isSuperAdmin = userRow.role === 'super_admin';
                        const canDelete = !isSelf && !isSuperAdmin;

                        return (
                          <TableRow key={userRow.user_id}>
                            <TableCell>
                              {userRow.first_name && userRow.surname 
                                ? `${userRow.first_name} ${userRow.surname}` 
                                : 'Not provided'}
                            </TableCell>
                            <TableCell>{userRow.email}</TableCell>
                            <TableCell>{userRow.phone_number || 'Not provided'}</TableCell>
                            <TableCell>
                              <Badge variant={
                                userRow.role === 'super_admin' ? 'default' : 
                                userRow.role === 'admin' ? 'secondary' : 'outline'
                              }>
                                {userRow.role.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>${userRow.balance?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {formatLastActive(userRow.last_activity_at)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {userRow.admin_email ? (
                                <Badge variant="outline">{userRow.admin_email}</Badge>
                              ) : (
                                <span className="text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {userRow.assignment_method === 'promo_code' ? (
                                <div className="flex flex-col gap-1">
                                  <Badge variant="secondary">Promo Code</Badge>
                                  {userRow.promo_code_used && (
                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                      {userRow.promo_code_used}
                                    </code>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline">Manual</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(userRow.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {canDelete ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setUserToDelete(userRow);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {isSelf ? 'You' : 'Protected'}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Admin Accounts</CardTitle>
                <CardDescription>Manage admin accounts and their user assignments</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-center">
                      <div className="text-lg">Loading admins...</div>
                      {retryCount > 0 && (
                        <div className="text-sm text-muted-foreground mt-2">
                          Retry attempt {retryCount}/3
                        </div>
                      )}
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="text-lg text-destructive mb-2">Failed to load admins</div>
                    <div className="text-sm text-muted-foreground mb-4">{error}</div>
                    <Button onClick={fetchSuperAdminData} variant="outline">
                      Try Again
                    </Button>
                  </div>
                ) : admins.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    No admins found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Assigned Users</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admins.map((admin) => (
                        <TableRow key={admin.user_id}>
                          <TableCell>{admin.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{admin.user_count} users</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteAdmin(admin.user_id)}
                            >
                              Delete Admin
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="promo-codes" className="space-y-4">
            <div className="grid gap-6">
              {/* Create Promo Code Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Create Promo Code</CardTitle>
                  <CardDescription>Generate promo codes for automatic user assignment to admins</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="promo-code">Promo Code</Label>
                      <Input
                        id="promo-code"
                        placeholder="Enter code"
                        value={promoCodeValue}
                        onChange={(e) => setPromoCodeValue(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="promo-admin">Assign to Admin</Label>
                      <Select value={promoAdminId} onValueChange={setPromoAdminId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose admin" />
                        </SelectTrigger>
                        <SelectContent>
                          {admins.map((admin) => (
                            <SelectItem key={admin.user_id} value={admin.user_id}>
                              {admin.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="max-uses">Max Uses (Optional)</Label>
                      <Input
                        id="max-uses"
                        type="number"
                        placeholder="Unlimited"
                        value={promoMaxUses}
                        onChange={(e) => setPromoMaxUses(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="expires-at">Expires At (Optional)</Label>
                      <Input
                        id="expires-at"
                        type="datetime-local"
                        value={promoExpiresAt}
                        onChange={(e) => setPromoExpiresAt(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button onClick={handleCreatePromoCode} className="w-full md:w-auto">
                      Create Promo Code
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Promo Codes Table */}
              <Card>
                <CardHeader>
                  <CardTitle>All Promo Codes</CardTitle>
                  <CardDescription>Manage existing promo codes and track their usage</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <div className="text-lg">Loading promo codes...</div>
                      </div>
                    </div>
                  ) : promoCodes.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      No promo codes found
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Admin</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Usage</TableHead>
                          <TableHead>Assigned Users</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {promoCodes.map((promo) => (
                          <TableRow key={promo.id}>
                            <TableCell>
                              <code className="bg-muted px-2 py-1 rounded text-sm">
                                {promo.code}
                              </code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{promo.admin_email}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                                {promo.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {promo.current_uses}
                              {promo.max_uses ? ` / ${promo.max_uses}` : ' / ∞'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {promo.assigned_users_count} users
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {promo.expires_at ? 
                                new Date(promo.expires_at).toLocaleDateString() : 
                                'Never'
                              }
                            </TableCell>
                            <TableCell>
                              <Button
                                variant={promo.is_active ? "outline" : "default"}
                                size="sm"
                                onClick={() => handleTogglePromoCode(promo.id, promo.is_active)}
                              >
                                {promo.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="management" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create Admin</CardTitle>
                  <CardDescription>Promote an existing user to admin status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="admin-email">User Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="user@example.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleCreateAdmin} className="w-full">
                    Create Admin
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transfer User</CardTitle>
                  <CardDescription>Reassign user to a different admin</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="user-select">Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.filter(u => u.role === 'user').map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.first_name && user.surname 
                              ? `${user.first_name} ${user.surname} (${user.email})` 
                              : user.email} {user.admin_email ? `(${user.admin_email})` : '(Unassigned)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="admin-select">New Admin</Label>
                    <Select value={newAdminId} onValueChange={setNewAdminId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an admin" />
                      </SelectTrigger>
                      <SelectContent>
                        {admins.map((admin) => (
                          <SelectItem key={admin.user_id} value={admin.user_id}>
                            {admin.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleTransferUser} className="w-full">
                    Transfer User
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete User Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Are you sure you want to delete{' '}
                  <strong>
                    {userToDelete?.first_name && userToDelete?.surname 
                      ? `${userToDelete.first_name} ${userToDelete.surname}` 
                      : userToDelete?.email}
                  </strong>{' '}
                  ({userToDelete?.email})?
                </p>
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="font-semibold text-destructive mb-2">⚠️ This action cannot be undone</p>
                  <p className="text-sm text-foreground">All user data will be permanently deleted including:</p>
                  <ul className="text-sm text-foreground list-disc list-inside mt-2 space-y-1">
                    <li>Account profile and authentication</li>
                    <li>Trading history (all {userToDelete?.role === 'user' ? 'trades' : 'activity'})</li>
                    <li>Open positions and pending orders</li>
                    <li>Deposit and withdrawal requests</li>
                    <li>User settings and preferences</li>
                  </ul>
                </div>
                {userToDelete && userToDelete.balance > 0 && (
                  <div className="bg-warning/10 border border-warning/20 rounded-md p-3">
                    <p className="text-sm text-foreground">
                      ⚠️ <strong>Warning:</strong> User has a balance of <strong>${userToDelete.balance.toFixed(2)}</strong>
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingUser}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingUser ? 'Deleting...' : 'Delete User'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;