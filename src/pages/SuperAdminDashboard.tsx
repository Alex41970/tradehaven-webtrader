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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, UserCheck, Settings, Crown, LogOut } from "lucide-react";
import { Navigate } from "react-router-dom";

interface UserWithRole {
  user_id: string;
  email: string;
  balance: number;
  equity: number;
  admin_id: string | null;
  admin_email: string | null;
  role: string;
  created_at: string;
}

interface AdminUser {
  user_id: string;
  email: string;
  role: string;
  user_count: number;
  created_at: string;
}

const SuperAdminDashboard = () => {
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading, isSuperAdmin } = useUserRole();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Form states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("admin");

  useEffect(() => {
    if (user && !roleLoading && role === 'super_admin') {
      console.log('SuperAdminDashboard: Initiating data fetch for user:', user.id, 'role:', role);
      fetchSuperAdminData();
    } else {
      console.log('SuperAdminDashboard: Not fetching data. User:', !!user, 'roleLoading:', roleLoading, 'role:', role);
    }
  }, [user, roleLoading, role, retryCount]);

  const fetchSuperAdminData = async () => {
    if (!user) {
      console.log('SuperAdminDashboard: No user found, aborting fetch');
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('SuperAdminDashboard: Starting data fetch attempt', retryCount + 1);
      
      // Check if user has session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('SuperAdminDashboard: Session check - session exists:', !!session, 'error:', sessionError);
      
      if (!session) {
        console.error('SuperAdminDashboard: No session found, user may not be authenticated');
        setError('Authentication session not found');
        setLoading(false);
        return;
      }

      console.log('SuperAdminDashboard: Fetching user profiles...');
      // Fetch user profiles separately
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select(`
          user_id,
          email,
          balance,
          equity,
          admin_id,
          created_at
        `);

      if (usersError) {
        console.error('SuperAdminDashboard: Error fetching user profiles:', usersError);
        throw new Error(`User profiles error: ${usersError.message} (Code: ${usersError.code})`);
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
      const rolesMap = new Map();
      rolesData?.forEach((roleItem: any) => {
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
        balance: user.balance,
        equity: user.equity,
        admin_id: user.admin_id,
        admin_email: user.admin_id ? emailMap.get(user.admin_id) || null : null,
        role: rolesMap.get(user.user_id) || 'user',
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
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('SuperAdminDashboard: Error fetching data:', error);
      const errorMessage = error.message || 'Failed to load data';
      setError(errorMessage);
      
      // Retry logic - if it's an auth issue and we haven't retried too many times
      if (retryCount < 3 && (errorMessage.includes('auth') || errorMessage.includes('session'))) {
        console.log('SuperAdminDashboard: Retrying in 2 seconds...');
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          fetchSuperAdminData();
        }, 2000);
      } else {
        toast({
          title: "Error Loading Data",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
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
      // Update user's admin_id
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ admin_id: newAdminId })
        .eq('user_id', selectedUserId);

      if (profileError) throw profileError;

      // Update admin_user_relationships
      const { error: relationshipError } = await supabase
        .from('admin_user_relationships')
        .upsert({
          admin_id: newAdminId,
          user_id: selectedUserId
        });

      if (relationshipError) throw relationshipError;

      toast({
        title: "Success",
        description: "User transferred successfully"
      });
      fetchSuperAdminData();
      setSelectedUserId("");
      setNewAdminId("");
    } catch (error) {
      console.error('Error transferring user:', error);
      toast({
        title: "Error",
        description: "Failed to transfer user",
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

  const handleSignOut = async () => {
    await signOut();
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
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
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
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Assigned Admin</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={
                              user.role === 'super_admin' ? 'default' : 
                              user.role === 'admin' ? 'secondary' : 'outline'
                            }>
                              {user.role.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>${user.balance?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>
                            {user.admin_email ? (
                              <Badge variant="outline">{user.admin_email}</Badge>
                            ) : (
                              <span className="text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
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
                            {user.email} {user.admin_email ? `(${user.admin_email})` : '(Unassigned)'}
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
      </div>
    </div>
  );
};

export default SuperAdminDashboard;