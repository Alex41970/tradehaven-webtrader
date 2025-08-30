import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useSystemHealth } from '@/hooks/useRealtimeData';
import { Activity, AlertTriangle, CheckCircle, RefreshCw, Wrench } from 'lucide-react';

interface HealthIssue {
  type: string;
  user_id?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  [key: string]: any;
}

interface HealthReport {
  timestamp: string;
  status: 'healthy' | 'issues_detected';
  summary: {
    total_users: number;
    total_issues: number;
    margin_issues: number;
    balance_issues: number;
    orphaned_trades: number;
    invalid_orders: number;
  };
  issues: HealthIssue[];
  recommendations: string[];
}

const SystemHealthDashboard: React.FC = () => {
  const { toast } = useToast();
  const { runHealthCheck, autoFixIssues } = useSystemHealth();
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);

  const handleHealthCheck = async () => {
    setLoading(true);
    try {
      const report = await runHealthCheck();
      setHealthReport(report as unknown as HealthReport);
      
      if ((report as unknown as HealthReport).status === 'healthy') {
        toast({
          title: "System Healthy",
          description: "No issues detected in the system",
        });
      } else {
        toast({
          title: "Issues Detected",
          description: `Found ${(report as unknown as HealthReport).summary.total_issues} issues across the system`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: "Unable to run system health check",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFix = async () => {
    setFixing(true);
    try {
      const fixResult = await autoFixIssues();
      
      toast({
        title: "Auto-Fix Completed",
        description: `Applied fixes for ${(fixResult as any).fixes_applied?.users_recalculated || 0} users`,
      });
      
      // Re-run health check after fixes
      setTimeout(() => {
        handleHealthCheck();
      }, 1000);
      
    } catch (error) {
      console.error('Auto-fix failed:', error);
      toast({
        title: "Auto-Fix Failed",
        description: "Unable to automatically fix issues",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Health</h2>
          <p className="text-muted-foreground">
            Monitor and maintain system integrity
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleHealthCheck}
            disabled={loading || fixing}
            variant="outline"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Activity className="h-4 w-4 mr-2" />
            )}
            Run Health Check
          </Button>
          {healthReport && healthReport.summary.total_issues > 0 && (
            <Button
              onClick={handleAutoFix}
              disabled={loading || fixing}
            >
              {fixing ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wrench className="h-4 w-4 mr-2" />
              )}
              Auto-Fix Issues
            </Button>
          )}
        </div>
      </div>

      {!healthReport && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Run a health check to analyze system integrity
            </p>
          </CardContent>
        </Card>
      )}

      {healthReport && (
        <>
          {/* System Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  {healthReport.status === 'healthy' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="text-2xl font-bold">{healthReport.summary.total_users}</p>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  <div>
                    <p className="text-2xl font-bold">{healthReport.summary.total_issues}</p>
                    <p className="text-sm text-muted-foreground">Total Issues</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div>
                  <p className="text-2xl font-bold">{healthReport.summary.margin_issues}</p>
                  <p className="text-sm text-muted-foreground">Margin Issues</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div>
                  <p className="text-2xl font-bold">{healthReport.summary.balance_issues}</p>
                  <p className="text-sm text-muted-foreground">Balance Issues</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Issues List */}
          {healthReport.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detected Issues</CardTitle>
                <CardDescription>
                  Issues found during the last health check
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {healthReport.issues.map((issue, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 border rounded-lg"
                    >
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{issue.type}</p>
                          <Badge variant={getSeverityColor(issue.severity)}>
                            {issue.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {issue.user_id && `User: ${issue.user_id}`}
                          {issue.count && `Count: ${issue.count}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {healthReport.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>
                  Suggested actions to improve system health
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {healthReport.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Last Updated */}
          <div className="text-sm text-muted-foreground text-center">
            Last checked: {new Date(healthReport.timestamp).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
};

export default SystemHealthDashboard;