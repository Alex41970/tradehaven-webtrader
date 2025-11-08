import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, TrendingUp, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface PromoCode {
  id: string;
  code: string;
  admin_email: string;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  created_at: string;
  assigned_users_count: number;
}

interface ValidationAttempt {
  id: string;
  promo_code: string;
  attempted_at: string;
  was_valid: boolean;
  error_reason: string | null;
  resulted_in_signup: boolean;
}

interface Stats {
  totalAttempts: number;
  validAttempts: number;
  invalidAttempts: number;
  conversionRate: number;
}

export default function PromoCodeAnalytics() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<ValidationAttempt[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalAttempts: 0,
    validAttempts: 0,
    invalidAttempts: 0,
    conversionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch promo codes with stats
      const { data: codesData, error: codesError } = await supabase
        .rpc('get_promo_code_stats');

      if (codesError) throw codesError;

      // Fetch recent validation attempts (last 50)
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('promo_validation_attempts')
        .select('*')
        .order('attempted_at', { ascending: false })
        .limit(50);

      if (attemptsError) throw attemptsError;

      // Calculate stats
      const totalAttempts = attemptsData?.length || 0;
      const validAttempts = attemptsData?.filter(a => a.was_valid).length || 0;
      const invalidAttempts = totalAttempts - validAttempts;
      const signups = attemptsData?.filter(a => a.resulted_in_signup).length || 0;
      const conversionRate = validAttempts > 0 ? (signups / validAttempts) * 100 : 0;

      setPromoCodes(codesData || []);
      setRecentAttempts(attemptsData || []);
      setStats({
        totalAttempts,
        validAttempts,
        invalidAttempts,
        conversionRate
      });

    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Promo Code Analytics</h1>
              <p className="text-muted-foreground">Monitor validation attempts and conversion rates</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAttempts}</div>
              <p className="text-xs text-muted-foreground">All validation attempts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valid Attempts</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.validAttempts}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalAttempts > 0 ? ((stats.validAttempts / stats.totalAttempts) * 100).toFixed(1) : 0}% success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invalid Attempts</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.invalidAttempts}</div>
              <p className="text-xs text-muted-foreground">Failed validations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Valid to signup ratio</p>
            </CardContent>
          </Card>
        </div>

        {/* Promo Codes Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Promo Codes Performance
            </CardTitle>
            <CardDescription>Usage statistics for all promo codes</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Assigned Users</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No promo codes found
                    </TableCell>
                  </TableRow>
                ) : (
                  promoCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-medium">{code.code}</TableCell>
                      <TableCell>{code.admin_email}</TableCell>
                      <TableCell>
                        <Badge variant={code.is_active ? "default" : "secondary"}>
                          {code.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {code.current_uses} / {code.max_uses || "∞"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{code.assigned_users_count} users</Badge>
                      </TableCell>
                      <TableCell>
                        {code.expires_at
                          ? format(new Date(code.expires_at), "MMM dd, yyyy")
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Validation Attempts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Validation Attempts
            </CardTitle>
            <CardDescription>Last 50 promo code validation attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Promo Code</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Signup</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAttempts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No validation attempts yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recentAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="text-sm">
                        {format(new Date(attempt.attempted_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono">{attempt.promo_code}</TableCell>
                      <TableCell>
                        {attempt.was_valid ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Invalid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {attempt.error_reason || "—"}
                      </TableCell>
                      <TableCell>
                        {attempt.resulted_in_signup ? (
                          <Badge variant="default">✓ Signed Up</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
