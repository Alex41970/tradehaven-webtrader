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
import { BotLicenseManagement } from "@/components/BotLicenseManagement";
import { AdminPaymentSettings } from "@/components/AdminPaymentSettings";
import { useAssets } from "@/hooks/useAssets";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { calculateRealTimePnL } from "@/utils/pnlCalculator";
import { Users, DollarSign, TrendingUp, Settings, LogOut, Bot, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface UserProfile {
  user_id: string;
  email: string;
  first_name?: string;
  surname?: string;
  phone_number?: string;
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
  user_email?: string; // Optional user email for display
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
  const [signingOut, setSigningOut] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [trades, setTrades] = useState<UserTrade[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTradeForEdit, setSelectedTradeForEdit] = useState<UserTrade | null>(null);
  const [selectedTradeForClose, setSelectedTradeForClose] = useState<UserTrade | null>(null);
  const [closingTrade, setClosingTrade] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Form states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceOperation, setBalanceOperation] = useState<"add" | "deduct">("add");
  const [selectedTradeId, setSelectedTradeId] = useState("");
  const [newOpenPrice, setNewOpenPrice] = useState("");
  const [newPromoCode, setNewPromoCode] = useState("");
  
  // Trade creation states
  const [showCreateTrade, setShowCreateTrade] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeLeverage, setTradeLeverage] = useState(1);
  const [tradePrice, setTradePrice] = useState("");
  const [creatingTrade, setCreatingTrade] = useState(false);
  
  // Hooks for assets and prices
  const { assets, loading: assetsLoading } = useAssets();
  const { getPriceForAsset, isConnected } = useRealTimePrices();

  const fetchAdminData = useCallback(async () => {
    if (!user) {
      console.log('AdminDashboard: Skipping fetchAdminData - no user');
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
        
        // Add user email to trades for easier display
        tradesData = (trades || []).map(trade => ({
          ...trade,
          user_email: usersData?.find(u => u.user_id === trade.user_id)?.email || 'Unknown'
        }));
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
  }, [user, toast]);

  useEffect(() => {
    console.log('AdminDashboard: useEffect triggered - user:', !!user, 'roleLoading:', roleLoading, 'role:', role);
    
    if (user && !roleLoading && (role === 'admin' || role === 'super_admin')) {
      console.log('AdminDashboard: Conditions met, calling fetchAdminData');
      fetchAdminData();
    } else {
      console.log('AdminDashboard: Conditions not met - user:', !!user, 'roleLoading:', roleLoading, 'role:', role);
    }
  }, [user, roleLoading, role, fetchAdminData]);


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

  const handleModifyTradePrice = async (tradeId: string, newOpenPrice: number) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.rpc('admin_modify_trade_open_price', {
        _admin_id: user.id,
        _trade_id: tradeId,
        _new_open_price: newOpenPrice
      });

      if (error) {
        console.error('Error modifying trade price:', error);
        toast({
          title: "Error",
          description: "Failed to modify trade price",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Trade price updated successfully",
      });

      // Refresh data
      fetchAdminData();
      setSelectedTradeForEdit(null);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to modify trade price",
        variant: "destructive",
      });
    }
  };

  const handleCloseTrade = async (tradeId: string, closePrice: number) => {
    if (!user?.id) return;

    setClosingTrade(true);
    try {
      const { data, error } = await supabase.rpc('admin_close_trade', {
        _admin_id: user.id,
        _trade_id: tradeId,
        _close_price: closePrice
      });

      if (error || !data) {
        console.error('Error closing trade:', error);
        toast({
          title: "Error",
          description: "Failed to close trade",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Trade closed successfully",
      });

      // Refresh data
      fetchAdminData();
      setSelectedTradeForClose(null);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to close trade",
        variant: "destructive",
      });
    } finally {
      setClosingTrade(false);
    }
  };

  const handleCreateTrade = async () => {
    if (!selectedUser || !selectedAsset || !tradeAmount || !tradePrice) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setCreatingTrade(true);
    
    try {
      const asset = assets.find(a => a.id === selectedAsset);
      if (!asset) {
        toast({
          title: "Error",
          description: "Selected asset not found",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.rpc('admin_create_trade', {
        _admin_id: user?.id,
        _user_id: selectedUser.user_id,
        _asset_id: selectedAsset,
        _symbol: asset.symbol,
        _trade_type: tradeType,
        _amount: parseFloat(tradeAmount),
        _leverage: tradeLeverage,
        _open_price: parseFloat(tradePrice)
      });

      if (error) {
        console.error('Error creating trade:', error);
        toast({
          title: "Error",
          description: "Failed to create trade",
          variant: "destructive",
        });
        return;
      }

      if (!data || typeof data !== 'object' || !(data as any).success) {
        toast({
          title: "Error",
          description: (data as any)?.error || "Failed to create trade",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Trade created successfully",
      });

      // Reset form
      setShowCreateTrade(false);
      setSelectedAsset("");
      setTradeAmount("");
      setTradePrice("");
      setTradeLeverage(1);
      
      // Refresh data
      fetchAdminData();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to create trade",
        variant: "destructive",
      });
    } finally {
      setCreatingTrade(false);
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

  const handleProcessRequest = async (requestId: string, action: 'approved' | 'rejected', type: 'deposit' | 'withdrawal', adminNotes?: string) => {
    if (!user) return;

    try {
      const functionName = type === 'deposit' ? 'process_deposit_request' : 'process_withdrawal_request';
      const { data, error } = await supabase.rpc(functionName, {
        _admin_id: user.id,
        _request_id: requestId,
        _action: action,
        _admin_notes: adminNotes || null
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'success' in data) {
        const result = data as { success: boolean; error?: string };
        if (result.success) {
          toast({
            title: "Success",
            description: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} request ${action} successfully`
          });
          fetchAdminData();
        } else {
          toast({
            title: "Error",
            description: result.error || `Failed to process ${type} request`,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error(`Error processing ${type} request:`, error);
      toast({
        title: "Error",
        description: `Failed to process ${type} request`,
        variant: "destructive"
      });
    }
  };

  // Update trade price when asset changes
  useEffect(() => {
    if (selectedAsset && assets.length > 0) {
      const asset = assets.find(a => a.id === selectedAsset);
      if (asset) {
        const priceUpdate = getPriceForAsset(asset.symbol);
        setTradePrice((priceUpdate?.price || asset.price).toString());
      }
    }
  }, [selectedAsset, assets, getPriceForAsset]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      setSigningOut(false);
    }
  };

  // Memoize calculated stats to prevent unnecessary recalculations
  // MUST be before any conditional returns to maintain hook order
  const stats = useMemo(() => ({
    totalBalance: users.reduce((sum, user) => sum + (user.balance || 0), 0),
    totalUsers: users.length,
    totalTrades: trades.length,
    activeTrades: trades.filter(t => t.status === 'open').length
  }), [users, trades]);

  // Helper function to get real-time P&L and current price
  const getTradeDisplayData = useCallback((trade: UserTrade) => {
    const priceUpdate = getPriceForAsset(trade.symbol);
    const currentPrice = priceUpdate?.price || trade.current_price || trade.open_price;
    
    // Calculate real-time P&L if stored P&L is 0 or we have a newer price
    let displayPnL = trade.pnl || 0;
    let isRealTime = false;
    
    if (trade.status === 'open' && currentPrice && trade.open_price) {
      const calculatedPnL = calculateRealTimePnL({
        trade_type: trade.trade_type as 'BUY' | 'SELL',
        amount: trade.amount,
        open_price: trade.open_price,
        leverage: trade.leverage
      }, currentPrice);
      
      // Use calculated P&L if stored P&L is 0 or if we have real-time data
      if (trade.pnl === 0 || priceUpdate) {
        displayPnL = calculatedPnL;
        isRealTime = !!priceUpdate;
      }
    }
    
    return {
      currentPrice,
      displayPnL,
      isRealTime,
      hasRealTimePrice: !!priceUpdate
    };
  }, [getPriceForAsset]);

  // Filter trades for selected user
  const selectedUserTrades = useMemo(() => {
    if (!selectedUser) return [];
    return trades.filter(trade => trade.user_id === selectedUser.user_id);
  }, [trades, selectedUser]);

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

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
            <TabsTrigger value="trade-management">Trade Management</TabsTrigger>
            <TabsTrigger value="deposits">Deposits & Withdrawals</TabsTrigger>
            <TabsTrigger value="promos">Promo Codes</TabsTrigger>
            <TabsTrigger value="bot-licenses">Bot Licenses</TabsTrigger>
            <TabsTrigger value="payment-settings">Payment Settings</TabsTrigger>
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
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
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
                            <TableCell>
                              {user.first_name && user.surname 
                                ? `${user.first_name} ${user.surname}` 
                                : 'Not provided'}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.phone_number || 'Not provided'}</TableCell>
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

          <TabsContent value="trade-management" className="space-y-4">
            {/* User Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select User</CardTitle>
                <CardDescription>Choose a user to manage their trades and account</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedUser?.user_id || ""} onValueChange={(userId) => {
                  const user = users.find(u => u.user_id === userId);
                  setSelectedUser(user || null);
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a user to manage" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.first_name && user.surname 
                          ? `${user.first_name} ${user.surname} (${user.email})` 
                          : user.email} - ${user.balance?.toFixed(2) || '0.00'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedUser && (
              <>
                {/* User Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>User Account Details</CardTitle>
                    <CardDescription>{selectedUser.email}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Balance</Label>
                        <p className="text-2xl font-bold">${selectedUser.balance?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Equity</Label>
                        <p className="text-2xl font-bold">${selectedUser.equity?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Available Margin</Label>
                        <p className="text-2xl font-bold">${selectedUser.available_margin?.toFixed(2) || '0.00'}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Used: ${selectedUser.used_margin?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Account Management Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Account Management</CardTitle>
                    <CardDescription>Modify user account balance and create trades</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Balance Management */}
                      <div>
                        <h4 className="font-medium mb-3">Balance Management</h4>
                        <div className="flex gap-4 items-end">
                          <div className="flex-1">
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
                          <div className="flex-1">
                            <Label htmlFor="amount">Amount</Label>
                            <Input
                              id="amount"
                              type="number"
                              placeholder="0.00"
                              value={balanceAmount}
                              onChange={(e) => setBalanceAmount(e.target.value)}
                            />
                          </div>
                          <Button onClick={() => {
                            if (selectedUser && balanceAmount) {
                              setSelectedUserId(selectedUser.user_id);
                              handleModifyBalance();
                            }
                          }}>
                            {balanceOperation === 'add' ? 'Add' : 'Deduct'} Funds
                          </Button>
                        </div>
                      </div>

                      {/* Trade Creation */}
                      <div className="pt-4 border-t">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium">Create New Trade</h4>
                          <Button 
                            onClick={() => setShowCreateTrade(!showCreateTrade)}
                            variant="outline"
                            size="sm"
                          >
                            {showCreateTrade ? "Cancel" : "New Trade"}
                          </Button>
                        </div>
                        
                        {showCreateTrade && (
                          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-sm font-medium">Asset</Label>
                                <Select value={selectedAsset} onValueChange={setSelectedAsset} disabled={assetsLoading}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Asset" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {assets.map((asset) => (
                                      <SelectItem key={asset.id} value={asset.id}>
                                        {asset.symbol} - {asset.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label className="text-sm font-medium">Trade Type</Label>
                                <Select value={tradeType} onValueChange={(value: "BUY" | "SELL") => setTradeType(value)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="BUY">BUY</SelectItem>
                                    <SelectItem value="SELL">SELL</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-sm font-medium">Amount</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={tradeAmount}
                                  onChange={(e) => setTradeAmount(e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                              
                              <div>
                                <Label className="text-sm font-medium">Leverage</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={tradeLeverage}
                                  onChange={(e) => setTradeLeverage(parseInt(e.target.value) || 1)}
                                />
                              </div>
                              
                              <div>
                                <Label className="text-sm font-medium">
                                  Entry Price
                                  {isConnected && <span className="text-xs text-green-600 ml-1">(Live)</span>}
                                </Label>
                                <Input
                                  type="number"
                                  step="0.00001"
                                  value={tradePrice}
                                  onChange={(e) => setTradePrice(e.target.value)}
                                  placeholder="0.00000"
                                />
                              </div>
                            </div>
                            
                            <Button 
                              onClick={handleCreateTrade}
                              disabled={creatingTrade || !selectedAsset || !tradeAmount || !tradePrice}
                              className="w-full"
                            >
                              {creatingTrade ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Creating Trade...
                                </>
                              ) : (
                                "Create Trade"
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* User Trades */}
                <Card>
                  <CardHeader>
                    <CardTitle>User Trades</CardTitle>
                    <CardDescription>
                      Trading activity for {selectedUser.email} ({selectedUserTrades.length} trades)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedUserTrades.length === 0 ? (
                      <div className="text-center text-muted-foreground py-6">
                        No trades found for this user
                      </div>
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
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedUserTrades.map((trade) => {
                            const { currentPrice, displayPnL, isRealTime, hasRealTimePrice } = getTradeDisplayData(trade);
                            
                            return (
                              <TableRow key={trade.id}>
                                <TableCell>{trade.symbol}</TableCell>
                                <TableCell>
                                  <Badge variant={trade.trade_type === 'BUY' ? 'default' : 'secondary'}>
                                    {trade.trade_type}
                                  </Badge>
                                </TableCell>
                                <TableCell>{trade.amount}</TableCell>
                                <TableCell>${trade.open_price?.toFixed(4)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    ${currentPrice?.toFixed(4) || 'N/A'}
                                    {hasRealTimePrice && isConnected && (
                                      <span className="text-xs text-green-600">●</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className={displayPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  <div className="flex items-center gap-1">
                                    ${displayPnL.toFixed(2)}
                                    {isRealTime && isConnected && (
                                      <span className="text-xs text-green-600">●</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={trade.status === 'open' ? 'default' : 'outline'}>
                                    {trade.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {new Date(trade.opened_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedTradeForEdit(trade)}
                                    >
                                      Edit Price
                                    </Button>
                                    {trade.status === 'open' && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => setSelectedTradeForClose(trade)}
                                      >
                                        Close
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
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

          <TabsContent value="deposits" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Deposit Requests</CardTitle>
                  <CardDescription>Review and process deposit requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {depositRequests.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No deposit requests</p>
                    ) : (
                      depositRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">
                                {request.user_profiles?.first_name} {request.user_profiles?.surname}
                              </p>
                              <p className="text-sm text-muted-foreground">{request.user_profiles?.email}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">${request.amount.toLocaleString()}</p>
                              <Badge variant={request.status === 'pending' ? 'secondary' : 
                                          request.status === 'approved' ? 'default' : 'destructive'}>
                                {request.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Type:</span> {request.deposit_type.toUpperCase()}</p>
                            <p><span className="text-muted-foreground">Date:</span> {new Date(request.created_at).toLocaleDateString()}</p>
                          </div>
                          {request.status === 'pending' && (
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleProcessRequest(request.id, 'approved', 'deposit')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleProcessRequest(request.id, 'rejected', 'deposit')}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Withdrawal Requests</CardTitle>
                  <CardDescription>Review and process withdrawal requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {withdrawalRequests.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No withdrawal requests</p>
                    ) : (
                      withdrawalRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">
                                {request.user_profiles?.first_name} {request.user_profiles?.surname}
                              </p>
                              <p className="text-sm text-muted-foreground">{request.user_profiles?.email}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">${request.amount.toLocaleString()}</p>
                              <Badge variant={request.status === 'pending' ? 'secondary' : 
                                          request.status === 'approved' ? 'default' : 'destructive'}>
                                {request.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Type:</span> {request.withdrawal_type.toUpperCase()}</p>
                            <p><span className="text-muted-foreground">Date:</span> {new Date(request.created_at).toLocaleDateString()}</p>
                            {request.crypto_wallet_address && (
                              <p><span className="text-muted-foreground">Wallet:</span> <code className="text-xs">{request.crypto_wallet_address}</code></p>
                            )}
                            {request.bank_details && (
                              <p><span className="text-muted-foreground">Bank:</span> {request.bank_details.bankName || 'Bank details provided'}</p>
                            )}
                          </div>
                          {request.status === 'pending' && (
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleProcessRequest(request.id, 'approved', 'withdrawal')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleProcessRequest(request.id, 'rejected', 'withdrawal')}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="bot-licenses" className="space-y-4">
            <BotLicenseManagement />
          </TabsContent>

          <TabsContent value="payment-settings" className="space-y-4">
            <AdminPaymentSettings />
          </TabsContent>

        </Tabs>
      </div>

      {/* Edit Trade Price Dialog */}
      {selectedTradeForEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Trade Open Price</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const newOpenPrice = parseFloat(formData.get('newOpenPrice') as string);
              
              if (newOpenPrice) {
                handleModifyTradePrice(selectedTradeForEdit.id, newOpenPrice);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <Label>Trade Details</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedTradeForEdit.user_email} - {selectedTradeForEdit.symbol} ({selectedTradeForEdit.trade_type})
                  </p>
                </div>
                <div>
                  <Label htmlFor="newOpenPrice">New Open Price</Label>
                  <Input
                    name="newOpenPrice"
                    type="number"
                    step="0.0001"
                    defaultValue={selectedTradeForEdit.open_price}
                    placeholder="Enter new open price"
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setSelectedTradeForEdit(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    Update Price
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Trade Dialog */}
      {selectedTradeForClose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Close Trade</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const closePrice = parseFloat(formData.get('closePrice') as string);
              
              if (closePrice) {
                handleCloseTrade(selectedTradeForClose.id, closePrice);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <Label>Trade Details</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedTradeForClose.user_email} - {selectedTradeForClose.symbol} ({selectedTradeForClose.trade_type})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Open Price: ${selectedTradeForClose.open_price}
                  </p>
                                  <p className="text-sm text-muted-foreground">
                    Current P&L: <span className={(() => {
                      const { displayPnL } = getTradeDisplayData(selectedTradeForClose);
                      return displayPnL >= 0 ? 'text-green-600' : 'text-red-600';
                    })()}>
                      ${(() => {
                        const { displayPnL } = getTradeDisplayData(selectedTradeForClose);
                        return displayPnL.toFixed(2);
                      })()}
                    </span>
                  </p>
                </div>
                <div>
                  <Label htmlFor="closePrice">Close Price</Label>
                  <Input
                    name="closePrice"
                    type="number"
                    step="0.0001"
                    defaultValue={selectedTradeForClose.current_price || selectedTradeForClose.open_price}
                    placeholder="Enter close price"
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setSelectedTradeForClose(null)}
                    disabled={closingTrade}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="destructive"
                    disabled={closingTrade}
                  >
                    {closingTrade ? 'Closing...' : 'Close Trade'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;