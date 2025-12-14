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
      const timer = setTimeout(() => {
        fetchSuperAdminData();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, roleLoading, role, retryCount]);

  const fetchSuperAdminData = async () => {
    if (!user) {
      setError('Please log in to access super admin dashboard');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.user || session.user.id !== user.id) {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession) {
          setError('Authentication session expired. Please sign out and sign back in.');
          setLoading(false);
          return;
        }
      }

      if (role !== 'super_admin') {
        setError('Access denied. Super admin role required.');
        setLoading(false);
        return;
      }

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
        throw new Error(`User profiles error: ${usersError.message} (Code: ${usersError.code}) - Details: ${usersError.details || 'None'}`);
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        throw new Error(`User roles error: ${rolesError.message} (Code: ${rolesError.code})`);
      }

      const rolesMap = new Map();
      rolesData?.forEach((roleItem: any) => {
        rolesMap.set(roleItem.user_id, roleItem.role);
      });

      const emailMap = new Map();
      usersData?.forEach((user: any) => {
        emailMap.set(user.user_id, user.email);
      });

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

      const adminIds = Array.from(rolesMap.entries())
        .filter(([_, role]) => role === 'admin')
        .map(([userId, _]) => userId);

      const adminMap = new Map();
      
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

      transformedUsers.forEach(user => {
        if (user.admin_id && adminMap.has(user.admin_id) && user.role === 'user') {
          const adminData = adminMap.get(user.admin_id);
          if (adminData) {
            adminData.user_count++;
          }
        }
      });

      setUsers(transformedUsers);
      setAdmins(Array.from(adminMap.values()));
      
      const { data: promoCodesData, error: promoError } = await supabase.rpc('get_promo_code_stats');
      
      if (promoError) {
        setPromoCodes([]);
      } else {
        setPromoCodes(promoCodesData || []);
      }
      
      setRetryCount(0);
    } catch (error: any) {
      let errorMessage = error?.message || 'Failed to load data';
      
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
      
      if (retryCount < 2 && (errorMessage.includes('auth') || errorMessage.includes('session') || errorMessage.includes('JWT') || error?.code === 'PGRST301')) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          fetchSuperAdminData();
        }, 1500);
      } else {
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

  const formatLastActive = (lastActivityAt: string | null | undefined) => {
    if (!lastActivityAt) return 'Never';
    
    const lastActivity = new Date(lastActivityAt);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastActivity.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}h ago`;
    }
    const days = Math.floor(diffMinutes / 1440);
    return `${days}d ago`;
  };

  const handleCreateAdmin = async () => {
    if (!newAdminEmail) return;

    try {
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

      if (currentRole?.role === 'admin') {
        toast({
          title: "Info",
          description: "User is already an admin",
          variant: "default"
        });
        setNewAdminEmail("");
        return;
      }

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
      
      setPromoCodeValue("");
      setPromoAdminId("");
      setPromoMaxUses("");
      setPromoExpiresAt("");
      
      fetchSuperAdminData();
    } catch (error: any) {
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
      toast({
        title: "Error",
        description: error.message || "Failed to update promo code",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeletingUser(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete.user_id }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `User ${userToDelete.email} deleted successfully`
      });
      
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchSuperAdminData();
    } catch (error: any) {
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
    } catch {
      setSigningOut(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || role !== 'super_admin') {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage admins, users, and platform settings</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut} disabled={signingOut}>
            <LogOut className="h-4 w-4 mr-2" />
            {signingOut ? "Signing Out..." : "Sign Out"}
          </Button>
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => {
                  setRetryCount(0);
                  fetchSuperAdminData();
                }}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users ({users.length})
              </TabsTrigger>
              <TabsTrigger value="admins" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Admins ({admins.length})
              </TabsTrigger>
              <TabsTrigger value="promo" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Promo Codes ({promoCodes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>View and manage all platform users</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.first_name && user.surname 
                              ? `${user.first_name} ${user.surname}`
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.admin_email || '-'}</TableCell>
                          <TableCell>${user.balance.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserToDelete(user);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admins">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Admin List</CardTitle>
                    <CardDescription>Platform administrators</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Users</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {admins.map((admin) => (
                          <TableRow key={admin.user_id}>
                            <TableCell>{admin.email}</TableCell>
                            <TableCell>{admin.user_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Create Admin</CardTitle>
                    <CardDescription>Promote a user to admin</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="adminEmail">User Email</Label>
                      <Input
                        id="adminEmail"
                        placeholder="user@example.com"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleCreateAdmin} disabled={!newAdminEmail}>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Promote to Admin
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="promo">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Promo Codes</CardTitle>
                    <CardDescription>Manage promotional codes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Admin</TableHead>
                          <TableHead>Uses</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {promoCodes.map((promo) => (
                          <TableRow key={promo.id}>
                            <TableCell className="font-mono">{promo.code}</TableCell>
                            <TableCell>{promo.admin_email}</TableCell>
                            <TableCell>
                              {promo.current_uses}{promo.max_uses ? `/${promo.max_uses}` : ''}
                            </TableCell>
                            <TableCell>
                              <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                                {promo.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Create Promo Code</CardTitle>
                    <CardDescription>Generate a new promotional code</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="promoCode">Code</Label>
                      <Input
                        id="promoCode"
                        placeholder="PROMO2024"
                        value={promoCodeValue}
                        onChange={(e) => setPromoCodeValue(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <Label htmlFor="promoAdmin">Assign to Admin</Label>
                      <Select value={promoAdminId} onValueChange={setPromoAdminId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select admin" />
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
                      <Label htmlFor="maxUses">Max Uses (optional)</Label>
                      <Input
                        id="maxUses"
                        type="number"
                        placeholder="Unlimited"
                        value={promoMaxUses}
                        onChange={(e) => setPromoMaxUses(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={handleCreatePromoCode} 
                      disabled={!promoCodeValue || !promoAdminId}
                    >
                      Create Promo Code
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.email}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingUser ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperAdminDashboard;
