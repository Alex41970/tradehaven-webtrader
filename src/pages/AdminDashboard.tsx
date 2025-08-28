import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Users, DollarSign, TrendingUp, Settings, LogOut } from "lucide-react";
import { Navigate } from "react-router-dom";

interface UserProfile {
  user_id: string;
  email: string;
  balance: number;
  equity: number;
  available_margin: number;
  used_margin: number;
  promo_code_used: string;
  created_at: string;
}

interface UserTrade {
  id: string;
  symbol: string;
  trade_type: string;
  amount: number;
  leverage: number;
  open_price: number;
  current_price: number;
  pnl: number;
  status: string;
  opened_at: string;
  user_id: string;
}

interface PromoCode {
  id: string;
  code: string;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  created_at: string;
  expires_at: string | null;
}

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading, isAdmin } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [trades, setTrades] = useState<UserTrade[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceOperation, setBalanceOperation] = useState<"add" | "deduct">("add");
  const [selectedTradeId, setSelectedTradeId] = useState("");
  const [newOpenPrice, setNewOpenPrice] = useState("");
  const [newPromoCode, setNewPromoCode] = useState("");

  // Memoize admin status to prevent unnecessary re-renders
  const isUserAdmin = useMemo(() => isAdmin(), [role]);

  const fetchAdminData = useCallback(async () => {
    if (!user || !isUserAdmin) {
      console.log('AdminDashboard: Skipping fetchAdminData - user:', !!user, 'isAdmin:', isUserAdmin);
      return;
    }

    console.log('AdminDashboard: Starting fetchAdminData for admin:', user.id);
    
    try {
      setLoading(true);

      // Fetch users under this admin
      console.log('AdminDashboard: Fetching users for admin:', user.id);
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('admin_id', user.id);

      if (usersError) {
        console.error('AdminDashboard: Error fetching users:', usersError);
        throw usersError;
      }

      console.log('AdminDashboard: Found users:', usersData?.length || 0);

      // Fetch trades for these users
      const userIds = usersData?.map(u => u.user_id) || [];
      let tradesData = [];
      
      if (userIds.length > 0) {
        console.log('AdminDashboard: Fetching trades for user IDs:', userIds);
        const { data: trades, error: tradesError } = await supabase
          .from('trades')
          .select('*')
          .in('user_id', userIds);

        if (tradesError) {
          console.error('AdminDashboard: Error fetching trades:', tradesError);
          throw tradesError;
        }
        
        tradesData = trades || [];
        console.log('AdminDashboard: Found trades:', tradesData.length);
      }

      // Fetch promo codes
      console.log('AdminDashboard: Fetching promo codes for admin:', user.id);
      const { data: promoData, error: promoError } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('admin_id', user.id);

      if (promoError) {
        console.error('AdminDashboard: Error fetching promo codes:', promoError);
        throw promoError;
      }

      console.log('AdminDashboard: Found promo codes:', promoData?.length || 0);

      // Update state with fetched data
      setUsers(usersData || []);
      setTrades(tradesData || []);
      setPromoCodes(promoData || []);
      
      console.log('AdminDashboard: Successfully updated state with data');
    } catch (error) {
      console.error('AdminDashboard: Error in fetchAdminData:', error);
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      console.log('AdminDashboard: fetchAdminData completed');
    }
  }, [user, isUserAdmin, toast]);

  useEffect(() => {
    console.log('AdminDashboard: useEffect triggered - user:', !!user, 'roleLoading:', roleLoading, 'isAdmin:', isUserAdmin);
    
    if (user && !roleLoading && isUserAdmin) {
      console.log('AdminDashboard: Conditions met, calling fetchAdminData');
      fetchAdminData();
    } else {
      console.log('AdminDashboard: Conditions not met - user:', !!user, 'roleLoading:', roleLoading, 'isAdmin:', isUserAdmin);
    }
  }, [user, roleLoading, isUserAdmin, fetchAdminData]);


  const handleModifyBalance = async () => {
    if (!user || !selectedUserId || !balanceAmount) return;

    try {
      const { data, error } = await supabase.rpc('admin_modify_user_balance', {
        _admin_id: user.id,
        _user_id: selectedUserId,
        _amount: parseFloat(balanceAmount),
        _operation: balanceOperation
      });

      if (error) throw error;

      if (data) {
        toast({
          title: "Success",
          description: `Balance ${balanceOperation === 'add' ? 'added' : 'deducted'} successfully`
        });
        fetchAdminData();
        setSelectedUserId("");
        setBalanceAmount("");
      } else {
        toast({
          title: "Error",
          description: "Unauthorized or user not found",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error modifying balance:', error);
      toast({
        title: "Error",
        description: "Failed to modify balance",
        variant: "destructive"
      });
    }
  };

  const handleModifyTradePrice = async () => {
    if (!user || !selectedTradeId || !newOpenPrice) return;

    try {
      const { data, error } = await supabase.rpc('admin_modify_trade_open_price', {
        _admin_id: user.id,
        _trade_id: selectedTradeId,
        _new_open_price: parseFloat(newOpenPrice)
      });

      if (error) throw error;

      if (data) {
        toast({
          title: "Success",
          description: "Trade open price updated successfully"
        });
        fetchAdminData();
        setSelectedTradeId("");
        setNewOpenPrice("");
      } else {
        toast({
          title: "Error",
          description: "Unauthorized or trade not found",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error modifying trade price:', error);
      toast({
        title: "Error",
        description: "Failed to modify trade price",
        variant: "destructive"
      });
    }
  };

  const handleCreatePromoCode = async () => {
    if (!user || !newPromoCode) return;

    try {
      const { error } = await supabase
        .from('promo_codes')
        .insert({
          code: newPromoCode,
          admin_id: user.id,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Promo code created successfully"
      });
      fetchAdminData();
      setNewPromoCode("");
    } catch (error) {
      console.error('Error creating promo code:', error);
      toast({
        title: "Error",
        description: "Failed to create promo code",
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

  if (!isUserAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Memoize calculated stats to prevent unnecessary recalculations
  const stats = useMemo(() => ({
    totalBalance: users.reduce((sum, user) => sum + (user.balance || 0), 0),
    totalUsers: users.length,
    totalTrades: trades.length,
    activeTrades: trades.filter(t => t.status === 'open').length
  }), [users, trades]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage your users and their trading activities</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {role === 'super_admin' ? 'Super Admin' : 'Admin'}
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
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalBalance.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trades</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTrades}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTrades}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="promos">Promo Codes</TabsTrigger>
            <TabsTrigger value="actions">Admin Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Users</CardTitle>
                <CardDescription>Manage users assigned to your admin account</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div>Loading...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Equity</TableHead>
                        <TableHead>Available Margin</TableHead>
                        <TableHead>Promo Code</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>${user.balance?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>${user.equity?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>${user.available_margin?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.promo_code_used || 'None'}</Badge>
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

          <TabsContent value="trades" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Trades</CardTitle>
                <CardDescription>Monitor and manage your users' trading activities</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div>Loading...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Open Price</TableHead>
                        <TableHead>Current Price</TableHead>
                        <TableHead>P&L</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Opened</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trades.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell>{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge variant={trade.trade_type === 'BUY' ? 'default' : 'secondary'}>
                              {trade.trade_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{trade.amount}</TableCell>
                          <TableCell>${trade.open_price?.toFixed(4)}</TableCell>
                          <TableCell>${trade.current_price?.toFixed(4) || 'N/A'}</TableCell>
                          <TableCell className={trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                            ${trade.pnl?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={trade.status === 'open' ? 'default' : 'outline'}>
                              {trade.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(trade.opened_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="promos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Promo Codes</CardTitle>
                <CardDescription>Manage promo codes for user registration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter new promo code"
                      value={newPromoCode}
                      onChange={(e) => setNewPromoCode(e.target.value)}
                    />
                    <Button onClick={handleCreatePromoCode}>Create</Button>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Uses</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promoCodes.map((promo) => (
                        <TableRow key={promo.id}>
                          <TableCell className="font-mono">{promo.code}</TableCell>
                          <TableCell>
                            {promo.current_uses} / {promo.max_uses || '∞'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                              {promo.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(promo.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Modify User Balance</CardTitle>
                  <CardDescription>Add or deduct funds from user accounts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="user-select">Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="operation">Operation</Label>
                    <Select value={balanceOperation} onValueChange={(value: "add" | "deduct") => setBalanceOperation(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add">Add Funds</SelectItem>
                        <SelectItem value="deduct">Deduct Funds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleModifyBalance} className="w-full">
                    {balanceOperation === 'add' ? 'Add' : 'Deduct'} Funds
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Modify Trade Open Price</CardTitle>
                  <CardDescription>Adjust open prices for user trades</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="trade-select">Select Trade</Label>
                    <Select value={selectedTradeId} onValueChange={setSelectedTradeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a trade" />
                      </SelectTrigger>
                      <SelectContent>
                        {trades.filter(t => t.status === 'open').map((trade) => (
                          <SelectItem key={trade.id} value={trade.id}>
                            {trade.symbol} - {trade.trade_type} - ${trade.open_price?.toFixed(4)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="new-price">New Open Price</Label>
                    <Input
                      id="new-price"
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      value={newOpenPrice}
                      onChange={(e) => setNewOpenPrice(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleModifyTradePrice} className="w-full">
                    Update Open Price
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

export default AdminDashboard;