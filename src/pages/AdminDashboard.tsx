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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BotLicenseManagement } from "@/components/BotLicenseManagement";
import { ManagePaymentSettingsDialog } from "@/components/admin/ManagePaymentSettingsDialog";
import { UserSearchSelect } from "@/components/admin/UserSearchSelect";
import { ModifyBalanceDialog } from "@/components/admin/ModifyBalanceDialog";
import { CreateTradeDialog } from "@/components/admin/CreateTradeDialog";
import { RejectRequestDialog } from "@/components/admin/RejectRequestDialog";
import { ViewWithdrawalDetailsDialog } from "@/components/admin/ViewWithdrawalDetailsDialog";
import { useAssets } from "@/hooks/useAssets";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { calculateRealTimePnL } from "@/utils/pnlCalculator";
import { Users, DollarSign, Settings, LogOut, Search, Filter, Activity, Plus, CreditCard, Eye, TrendingUp } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Logo } from "@/components/Logo";

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
  last_activity_at?: string;
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


const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading, isAdmin } = useUserRole();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [trades, setTrades] = useState<UserTrade[]>([]);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTradeForEdit, setSelectedTradeForEdit] = useState<UserTrade | null>(null);
  const [selectedTradeForClose, setSelectedTradeForClose] = useState<UserTrade | null>(null);
  const [closingTrade, setClosingTrade] = useState(false);
  
  // Dialog states
  const [modifyBalanceDialogOpen, setModifyBalanceDialogOpen] = useState(false);
  const [paymentSettingsDialogOpen, setPaymentSettingsDialogOpen] = useState(false);
  const [createTradeDialogOpen, setCreateTradeDialogOpen] = useState(false);
  const [selectedUserForAction, setSelectedUserForAction] = useState<UserProfile | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<{
    id: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    userName: string;
  } | null>(null);
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [selectedWithdrawalRequest, setSelectedWithdrawalRequest] = useState<any>(null);
  
  // Search and filter states
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedTradeUser, setSelectedTradeUser] = useState<string>("");
  const [tradesFilter, setTradesFilter] = useState<"all" | "active" | "closed">("all");
  const [tradesSymbolFilter, setTradesSymbolFilter] = useState<string>("");
  const [requestsSearchQuery, setRequestsSearchQuery] = useState("");
  const [requestsStatusFilter, setRequestsStatusFilter] = useState<string>("all");
  
  // Hooks for assets and prices
  const { assets, loading: assetsLoading } = useAssets();
  const { getPriceForAsset, isConnected } = useRealTimePrices();

  const fetchAdminData = useCallback(async () => {
    if (!user) {
      console.log('❌ AdminDashboard: No user found - skipping data fetch');
      setError('Please log in to access admin dashboard');
      setLoading(false);
      return;
    }

    console.log('🔍 AdminDashboard: Starting fetchAdminData for user:', user.id, 'email:', user.email);
    
    try {
      setLoading(true);
      setError(null);

      // Verify auth session is active
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 AdminDashboard: Session check - valid:', !!session, 'error:', sessionError);
      
      if (!session || sessionError) {
        console.error('❌ AdminDashboard: Session invalid:', sessionError);
        setError('Authentication session expired. Please sign out and sign back in.');
        setLoading(false);
        return;
      }

      // Role check is already done in useEffect before calling this function
      console.log('✅ AdminDashboard: Role verified, proceeding with data fetch...');

      console.log('✅ AdminDashboard: User authenticated as admin, fetching data...');
      console.log('AdminDashboard: Fetching users for admin:', user.id);
      
      // First get user IDs from admin_user_relationships
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from('admin_user_relationships')
        .select('user_id')
        .eq('admin_id', user.id);

      if (relationshipsError) {
        console.error('AdminDashboard: Error fetching user relationships:', relationshipsError);
        toast({
          title: "Error",
          description: `Failed to fetch user relationships: ${relationshipsError.message}`,
          variant: "destructive",
        });
        throw relationshipsError;
      }

      // Get user IDs and fetch their profiles
      const assignedUserIds = relationshipsData?.map(rel => rel.user_id) || [];
      console.log('AdminDashboard: Found assigned user IDs:', assignedUserIds);

      let usersData = [];
      if (assignedUserIds.length > 0) {
        const { data: profiles, error: usersError } = await supabase
          .from('user_profiles')
          .select('*')
          .in('user_id', assignedUserIds);

        if (usersError) {
          console.error('AdminDashboard: Error fetching users:', usersError);
          toast({
            title: "Error",
            description: `Failed to fetch user data: ${usersError.message}`,
            variant: "destructive",
          });
          throw usersError;
        }

        usersData = profiles || [];
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

      // Fetch deposit requests for these users with user profile information
      let depositRequestsData = [];
      if (userIds.length > 0) {
        console.log('AdminDashboard: Fetching deposit requests for user IDs:', userIds);
        const { data: deposits, error: depositsError } = await supabase
          .from('deposit_requests')
          .select(`
            *,
            user_profiles(first_name, surname, email, phone_number)
          `)
          .in('user_id', userIds);

        if (depositsError) {
          console.error('AdminDashboard: Error fetching deposit requests:', depositsError);
          throw depositsError;
        }
        
        depositRequestsData = deposits || [];
        console.log('AdminDashboard: Found deposit requests:', depositRequestsData.length);
      }

      // Fetch withdrawal requests for these users with user profile information
      let withdrawalRequestsData = [];
      if (userIds.length > 0) {
        console.log('AdminDashboard: Fetching withdrawal requests for user IDs:', userIds);
        const { data: withdrawals, error: withdrawalsError } = await supabase
          .from('withdrawal_requests')
          .select(`
            *,
            user_profiles(first_name, surname, email, phone_number)
          `)
          .in('user_id', userIds);

        if (withdrawalsError) {
          console.error('AdminDashboard: Error fetching withdrawal requests:', withdrawalsError);
          throw withdrawalsError;
        }
        
        withdrawalRequestsData = withdrawals || [];
        console.log('AdminDashboard: Found withdrawal requests:', withdrawalRequestsData.length);
      }

      // Update state with fetched data
      setUsers(usersData || []);
      setTrades(tradesData || []);
      setDepositRequests(depositRequestsData || []);
      setWithdrawalRequests(withdrawalRequestsData || []);
      
      console.log('AdminDashboard: Successfully updated state with data');
    } catch (error: any) {
      console.error('AdminDashboard: Error in fetchAdminData:', error);
      console.error('AdminDashboard: Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      
      let errorMessage = "Failed to load admin data";
      if (error?.message) {
        errorMessage = `${errorMessage}: ${error.message}`;
      }
      if (error?.code) {
        errorMessage += ` (Code: ${error.code})`;
      }
      if (error?.details) {
        errorMessage += ` - ${error.details}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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


  const handleModifyBalance = async (userId: string, amount: number, operation: "add" | "deduct", reason?: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('admin_modify_user_balance', {
        _admin_id: user.id,
        _user_id: userId,
        _amount: amount,
        _operation: operation,
        _reason: reason || null
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string; previous_balance?: number; new_balance?: number; created_deposit_id?: string | null; created_withdrawal_id?: string | null } | null;

      if (!result || result.success !== true) {
        toast({
          title: "Error",
          description: result?.error || "Failed to modify balance",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Success",
        description: result.message || `Balance ${operation === 'add' ? 'added' : operation === 'deduct' ? 'deducted' : 'updated'} successfully`
      });
      fetchAdminData();
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
      // Direct update with RLS policy enforcement
      const { data, error } = await supabase
        .from('trades')
        .update({ 
          open_price: newOpenPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId)
        .select();

      if (error) {
        console.error('Error updating trade:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to update trade price",
          variant: "destructive",
        });
        return;
      }

      if (!data || data.length === 0) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to edit this trade",
          variant: "destructive",
        });
        return;
      }

      // Update local state optimistically
      setTrades(prev => prev.map(trade => 
        trade.id === tradeId 
          ? { ...trade, open_price: newOpenPrice }
          : trade
      ));

      toast({
        title: "Success",
        description: `Trade open price updated to $${newOpenPrice}`,
      });

      setSelectedTradeForEdit(null);

      // Refetch to confirm
      fetchAdminData();

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
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

      if (error) {
        console.error('Error closing trade:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to close trade",
          variant: "destructive",
        });
        return;
      }

      // Handle JSON response from updated RPC
      const result = data as any;
      if (!result?.success) {
        toast({
          title: "Error",
          description: result?.error || "Failed to close trade",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: `Trade closed. P&L: $${result.pnl?.toFixed(2)}, New balance: $${result.new_balance?.toFixed(2)}`,
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

  const handleCreateTrade = async (params: {
    userId: string;
    assetId: string;
    symbol: string;
    tradeType: "BUY" | "SELL";
    amount: number;
    leverage: number;
    price: number;
  }) => {
    try {
      const { data, error } = await supabase.rpc('admin_create_trade', {
        _admin_id: user?.id,
        _user_id: params.userId,
        _asset_id: params.assetId,
        _symbol: params.symbol,
        _trade_type: params.tradeType,
        _amount: params.amount,
        _leverage: params.leverage,
        _open_price: params.price
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

      // Refresh data
      fetchAdminData();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to create trade",
        variant: "destructive",
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

  const handleRejectWithReason = async (reason: string) => {
    if (!requestToReject) return;
    
    await handleProcessRequest(
      requestToReject.id,
      'rejected',
      requestToReject.type,
      reason
    );
    
    setRejectDialogOpen(false);
    setRequestToReject(null);
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

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return users;
    
    const query = userSearchQuery.toLowerCase();
    return users.filter(user => {
      const name = `${user.first_name || ''} ${user.surname || ''}`.toLowerCase();
      const email = user.email?.toLowerCase() || '';
      const phone = user.phone_number?.toLowerCase() || '';
      const promo = user.promo_code_used?.toLowerCase() || '';
      
      return name.includes(query) || 
             email.includes(query) || 
             phone.includes(query) ||
             promo.includes(query);
    });
  }, [users, userSearchQuery]);

  // Filter trades for selected user or all trades
  const filteredTrades = useMemo(() => {
    let filtered = [...trades];
    
    // User filter - if a user is selected, show only their trades
    if (selectedTradeUser) {
      filtered = filtered.filter(trade => trade.user_id === selectedTradeUser);
    }
    
    // Status filter
    if (tradesFilter === "active") {
      filtered = filtered.filter(trade => trade.status === 'open');
    } else if (tradesFilter === "closed") {
      filtered = filtered.filter(trade => trade.status === 'closed');
    }
    
    // Symbol filter
    if (tradesSymbolFilter) {
      filtered = filtered.filter(trade => 
        trade.symbol.toLowerCase().includes(tradesSymbolFilter.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
  }, [trades, selectedTradeUser, tradesFilter, tradesSymbolFilter]);

  // Filter financial requests
  const filteredDepositRequests = useMemo(() => {
    let filtered = depositRequests;
    
    if (requestsSearchQuery) {
      const query = requestsSearchQuery.toLowerCase();
      filtered = filtered.filter(req => {
        const name = `${req.user_profiles?.first_name || ''} ${req.user_profiles?.surname || ''}`.toLowerCase();
        const email = req.user_profiles?.email?.toLowerCase() || '';
        return name.includes(query) || email.includes(query);
      });
    }
    
    if (requestsStatusFilter !== "all") {
      filtered = filtered.filter(req => req.status === requestsStatusFilter);
    }
    
    // Sort: pending first, then by date (newest first)
    return filtered.sort((a, b) => {
      // First, sort by status (pending comes before approved/rejected)
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      
      // Then, sort by created_at (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [depositRequests, requestsSearchQuery, requestsStatusFilter]);

  const filteredWithdrawalRequests = useMemo(() => {
    let filtered = withdrawalRequests;
    
    if (requestsSearchQuery) {
      const query = requestsSearchQuery.toLowerCase();
      filtered = filtered.filter(req => {
        const name = `${req.user_profiles?.first_name || ''} ${req.user_profiles?.surname || ''}`.toLowerCase();
        const email = req.user_profiles?.email?.toLowerCase() || '';
        return name.includes(query) || email.includes(query);
      });
    }
    
    if (requestsStatusFilter !== "all") {
      filtered = filtered.filter(req => req.status === requestsStatusFilter);
    }
    
    // Sort: pending first, then by date (newest first)
    return filtered.sort((a, b) => {
      // First, sort by status (pending comes before approved/rejected)
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      
      // Then, sort by created_at (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [withdrawalRequests, requestsSearchQuery, requestsStatusFilter]);

  // Trade summary stats - filtered by selected user if any
  const tradeStats = useMemo(() => {
    const relevantTrades = selectedTradeUser 
      ? trades.filter(t => t.user_id === selectedTradeUser)
      : trades;
      
    const activeTrades = relevantTrades.filter(t => t.status === 'open');
    const closedTrades = relevantTrades.filter(t => t.status === 'closed');
    
    const totalActivePnL = activeTrades.reduce((sum, trade) => {
      const { displayPnL } = getTradeDisplayData(trade);
      return sum + displayPnL;
    }, 0);
    
    const totalClosedPnL = closedTrades.reduce((sum, trade) => {
      return sum + (trade.pnl || 0);
    }, 0);
    
    return {
      activeTrades: activeTrades.length,
      closedTrades: closedTrades.length,
      totalPnL: totalActivePnL + totalClosedPnL,
      activeTradesPnL: totalActivePnL
    };
  }, [trades, selectedTradeUser, getTradeDisplayData]);

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
    <div className="min-h-screen bg-background dashboard-theme">
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
              <Activity className="h-4 w-4 text-muted-foreground" />
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
            <TabsTrigger value="users">Users & Accounts</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="financial-requests">Financial Requests</TabsTrigger>
            <TabsTrigger value="bot-licenses">Bot Management</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Users & Accounts</CardTitle>
                <CardDescription>Manage users and their account details with quick actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, phone, or promo code..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {userSearchQuery && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {filteredUsers.length} of {users.length} users
                    </p>
                  )}
                </div>

                {loading ? (
                  <div className="text-center py-8">Loading...</div>
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
                        <TableHead>Last Active</TableHead>
                        <TableHead>Promo Code</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell>
                              {user.first_name && user.surname 
                                ? `${user.first_name} ${user.surname}` 
                                : 'Not provided'}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.phone_number || 'Not provided'}</TableCell>
                            <TableCell className="font-medium">${user.balance?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell>${user.equity?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell>${user.available_margin?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {formatLastActive(user.last_activity_at)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.promo_code_used || 'None'}</Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedUserForAction(user);
                                    setModifyBalanceDialogOpen(true);
                                  }}
                                >
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Balance
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedUserForAction(user);
                                    setPaymentSettingsDialogOpen(true);
                                  }}
                                >
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Payment
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trades" className="space-y-6">
            {/* User Selection for Trade Management */}
            <Card>
              <CardHeader>
                <CardTitle>Select User to Manage Trades</CardTitle>
                <CardDescription>
                  Choose a user to view and manage their trades, or leave unselected to view all trades (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <UserSearchSelect
                      users={users}
                      selectedUserId={selectedTradeUser}
                      onSelectUser={setSelectedTradeUser}
                      label="User"
                      placeholder="Search by name, email, or phone..."
                      showBalance={true}
                    />
                  </div>
                  {selectedTradeUser && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSelectedTradeUser("");
                        setTradesFilter("all");
                        setTradesSymbolFilter("");
                      }}
                    >
                      Clear Selection
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Trade Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {selectedTradeUser ? "User's Active Trades" : "All Active Trades"}
                  </CardTitle>
                  <Activity className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{tradeStats.activeTrades}</div>
                  <p className="text-xs text-muted-foreground">
                    P&L: <span className={tradeStats.activeTradesPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${tradeStats.activeTradesPnL.toFixed(2)}
                    </span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {selectedTradeUser ? "User's Closed Trades" : "All Closed Trades"}
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{tradeStats.closedTrades}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${tradeStats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${tradeStats.totalPnL.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Filtered Trades</CardTitle>
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredTrades.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters and Actions */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>
                      {selectedTradeUser 
                        ? `Manage ${users.find(u => u.user_id === selectedTradeUser)?.first_name || 'User'}'s Trades` 
                        : "All Trades Overview (Read-Only)"}
                    </CardTitle>
                    <CardDescription>
                      {selectedTradeUser 
                        ? "Create, modify, and close trades for the selected user"
                        : "Select a user above to manage their trades"}
                    </CardDescription>
                  </div>
                  {selectedTradeUser && (
                    <Button onClick={() => {
                      const selectedUser = users.find(u => u.user_id === selectedTradeUser);
                      if (selectedUser) {
                        setSelectedUserForAction(selectedUser);
                        setCreateTradeDialogOpen(true);
                      }
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Trade
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Select value={tradesFilter} onValueChange={(value: "all" | "active" | "closed") => setTradesFilter(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Trades</SelectItem>
                        <SelectItem value="active">Active Only</SelectItem>
                        <SelectItem value="closed">Closed Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Symbol Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search symbol..."
                        value={tradesSymbolFilter}
                        onChange={(e) => setTradesSymbolFilter(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Clear Filters</Label>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setTradesFilter("all");
                        setTradesSymbolFilter("");
                      }}
                      className="w-full"
                    >
                      Reset Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trades Table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedTradeUser ? "User's Trades" : "All Trades"}
                </CardTitle>
                <CardDescription>
                  Showing {filteredTrades.length} of {selectedTradeUser ? filteredTrades.length : trades.length} total trades
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredTrades.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{selectedTradeUser ? "This user has no trades matching the filters" : "No trades found"}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {!selectedTradeUser && <TableHead>User</TableHead>}
                        <TableHead>Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Leverage</TableHead>
                        <TableHead>Open Price</TableHead>
                        <TableHead>Current Price</TableHead>
                        <TableHead>P&L</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Opened</TableHead>
                        {selectedTradeUser && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTrades.map((trade) => {
                        const { currentPrice, displayPnL, isRealTime, hasRealTimePrice } = getTradeDisplayData(trade);
                        const tradeUser = users.find(u => u.user_id === trade.user_id);
                        
                        return (
                          <TableRow key={trade.id} className={trade.status === 'open' ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                            {!selectedTradeUser && (
                              <TableCell>
                                <div>
                                  <div className="font-medium text-sm">
                                    {tradeUser?.first_name && tradeUser?.surname 
                                      ? `${tradeUser.first_name} ${tradeUser.surname}` 
                                      : trade.user_email || 'Unknown'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {trade.user_email}
                                  </div>
                                </div>
                              </TableCell>
                            )}
                            <TableCell className="font-medium">{trade.symbol}</TableCell>
                            <TableCell>
                              <Badge variant={trade.trade_type === 'BUY' ? 'default' : 'secondary'}>
                                {trade.trade_type}
                              </Badge>
                            </TableCell>
                            <TableCell>{trade.amount}</TableCell>
                            <TableCell>{trade.leverage}x</TableCell>
                            <TableCell>${trade.open_price?.toFixed(5)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                ${currentPrice?.toFixed(5) || 'N/A'}
                                {hasRealTimePrice && isConnected && (
                                  <span className="text-xs text-green-600">●</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={displayPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                              <div className="flex items-center gap-1 font-medium">
                                ${displayPnL.toFixed(2)}
                                {isRealTime && isConnected && (
                                  <span className="text-xs text-green-600">●</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={trade.status === 'open' ? 'default' : 'outline'}
                                className={trade.status === 'open' ? 'bg-green-600 hover:bg-green-700' : ''}
                              >
                                {trade.status.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(trade.opened_at).toLocaleDateString()}
                              <div className="text-xs text-muted-foreground">
                                {new Date(trade.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </TableCell>
                            {selectedTradeUser && (
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedTradeForEdit(trade)}
                                  >
                                    Edit
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
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial-requests" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Search & Filter</CardTitle>
                <CardDescription>Filter financial requests by user or status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Label className="text-sm font-medium">Search by User</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={requestsSearchQuery}
                        onChange={(e) => setRequestsSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Select value={requestsStatusFilter} onValueChange={setRequestsStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Deposit Requests</CardTitle>
                  <CardDescription>
                    Showing {filteredDepositRequests.length} of {depositRequests.length} requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredDepositRequests.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        {requestsSearchQuery || requestsStatusFilter !== "all" 
                          ? "No requests match your filters"
                          : "No deposit requests"}
                      </p>
                    ) : (
                      filteredDepositRequests.map((request) => (
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
                                onClick={() => {
                                  setRequestToReject({
                                    id: request.id,
                                    type: 'deposit',
                                    amount: request.amount,
                                    userName: `${request.user_profiles?.first_name || ''} ${request.user_profiles?.surname || ''}`.trim() || 'User'
                                  });
                                  setRejectDialogOpen(true);
                                }}
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
                  <CardDescription>
                    Showing {filteredWithdrawalRequests.length} of {withdrawalRequests.length} requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredWithdrawalRequests.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        {requestsSearchQuery || requestsStatusFilter !== "all"
                          ? "No requests match your filters"
                          : "No withdrawal requests"}
                      </p>
                    ) : (
                      filteredWithdrawalRequests.map((request) => (
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
                          <div className="text-sm space-y-2">
                            <p><span className="text-muted-foreground">Type:</span> {request.withdrawal_type.toUpperCase()}</p>
                            <p><span className="text-muted-foreground">Date:</span> {new Date(request.created_at).toLocaleDateString()}</p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                setSelectedWithdrawalRequest(request);
                                setViewDetailsDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Withdrawal Details
                            </Button>
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
                                onClick={() => {
                                  setRequestToReject({
                                    id: request.id,
                                    type: 'withdrawal',
                                    amount: request.amount,
                                    userName: `${request.user_profiles?.first_name || ''} ${request.user_profiles?.surname || ''}`.trim() || 'User'
                                  });
                                  setRejectDialogOpen(true);
                                }}
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

        </Tabs>
      </div>

      {/* Dialogs */}
      <ModifyBalanceDialog
        open={modifyBalanceDialogOpen}
        onOpenChange={setModifyBalanceDialogOpen}
        user={selectedUserForAction}
        onModifyBalance={handleModifyBalance}
      />

      <ManagePaymentSettingsDialog
        open={paymentSettingsDialogOpen}
        onOpenChange={setPaymentSettingsDialogOpen}
        user={selectedUserForAction}
        onSave={fetchAdminData}
      />

      <CreateTradeDialog
        open={createTradeDialogOpen}
        onOpenChange={setCreateTradeDialogOpen}
        user={selectedUserForAction}
        assets={assets}
        onCreateTrade={handleCreateTrade}
        getPriceForAsset={getPriceForAsset}
        isConnected={isConnected}
      />

      <RejectRequestDialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) setRequestToReject(null);
        }}
        requestType={requestToReject?.type || 'withdrawal'}
        requestAmount={requestToReject?.amount || 0}
        userName={requestToReject?.userName || 'User'}
        onConfirm={handleRejectWithReason}
      />

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

      {/* View Withdrawal Details Dialog */}
      <ViewWithdrawalDetailsDialog
        open={viewDetailsDialogOpen}
        onOpenChange={setViewDetailsDialogOpen}
        request={selectedWithdrawalRequest}
      />
    </div>
  );
};

export default AdminDashboard;