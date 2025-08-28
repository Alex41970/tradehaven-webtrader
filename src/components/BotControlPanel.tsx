import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot, 
  Pause, 
  Play, 
  Trash2, 
  Activity, 
  Settings, 
  BarChart3, 
  Terminal,
  Zap,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

interface BotControlPanelProps {
  botStatus: 'active' | 'paused';
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  botTrades: any[];
  openBotTrades: any[];
  closedBotTrades: any[];
}

export const BotControlPanel: React.FC<BotControlPanelProps> = ({
  botStatus,
  onPause,
  onResume,
  onDelete,
  botTrades,
  openBotTrades,
  closedBotTrades,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totalPnL = closedBotTrades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = closedBotTrades.length > 0 
    ? (closedBotTrades.filter(t => t.pnl > 0).length / closedBotTrades.length) * 100 
    : 0;

  const getStatusColor = () => {
    if (botStatus === 'active') return 'text-trading-success';
    return 'text-trading-accent';
  };

  const getStatusBadgeVariant = () => {
    if (botStatus === 'active') return 'default';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Main Bot Status Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Enhanced Bot Avatar */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-trading-primary to-trading-accent flex items-center justify-center shadow-lg">
                  <Bot className={`h-8 w-8 text-white ${botStatus === 'active' ? 'animate-pulse' : ''}`} />
                </div>
                
                {/* Status indicator with glow effect */}
                <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${
                  botStatus === 'active' ? 'bg-trading-success shadow-lg shadow-trading-success/50' : 'bg-trading-accent'
                } flex items-center justify-center animate-pulse`}>
                  {botStatus === 'active' ? (
                    <Zap className="h-3 w-3 text-white" />
                  ) : (
                    <Pause className="h-3 w-3 text-white" />
                  )}
                </div>

                {/* Energy rings for active bot */}
                {botStatus === 'active' && (
                  <>
                    <div className="absolute inset-0 rounded-full border-2 border-trading-success/30 animate-ping"></div>
                    <div className="absolute -inset-2 rounded-full border border-trading-success/20 animate-pulse"></div>
                  </>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold">Neural Trading Bot</h2>
                <p className="text-muted-foreground">AI-Powered Market Analysis</p>
              </div>
            </div>

            <Badge 
              variant={getStatusBadgeVariant()}
              className={`px-4 py-2 text-sm font-semibold ${getStatusColor()}`}
            >
              <Activity className="h-4 w-4 mr-2" />
              {botStatus.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Control Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-card/50 backdrop-blur-sm">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="controls" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Controls
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-success/5 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-trading-success" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Trades</p>
                    <p className="text-xl font-bold">{botTrades.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-accent/5 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-trading-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Active Trades</p>
                    <p className="text-xl font-bold">{openBotTrades.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-success/5 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-trading-success" />
                  <div>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                    <p className="text-xl font-bold text-trading-success">{winRate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-trading-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total P&L</p>
                    <p className={`text-xl font-bold ${totalPnL >= 0 ? 'text-trading-success' : 'text-trading-danger'}`}>
                      ${totalPnL.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-secondary/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Bot Control Center
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {botStatus === 'active' ? (
                  <Button 
                    onClick={onPause}
                    variant="outline"
                    className="flex items-center justify-center gap-2 border-trading-accent/50 hover:bg-trading-accent/10"
                  >
                    <Pause className="h-4 w-4" />
                    Pause Trading Bot
                  </Button>
                ) : (
                  <Button 
                    onClick={onResume}
                    className="flex items-center justify-center gap-2 bg-trading-success hover:bg-trading-success/90"
                  >
                    <Play className="h-4 w-4" />
                    Resume Trading Bot
                  </Button>
                )}
                
                {!confirmDelete ? (
                  <Button 
                    onClick={() => setConfirmDelete(true)}
                    variant="outline"
                    className="flex items-center justify-center gap-2 border-destructive/50 hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Disconnect Bot
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      onClick={onDelete}
                      variant="destructive"
                      className="flex items-center gap-2"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Confirm Disconnect
                    </Button>
                    <Button 
                      onClick={() => setConfirmDelete(false)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Pausing the bot will stop new trade execution but keep existing positions open. 
                  Disconnecting will close all open positions and remove the bot license.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Best Trade</p>
                  <p className="text-lg font-semibold text-trading-success">
                    ${Math.max(...closedBotTrades.map(t => t.pnl), 0).toFixed(2)}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Worst Trade</p>
                  <p className="text-lg font-semibold text-trading-danger">
                    ${Math.min(...closedBotTrades.map(t => t.pnl), 0).toFixed(2)}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Avg Trade Size</p>
                  <p className="text-lg font-semibold">
                    ${(botTrades.reduce((sum, t) => sum + t.amount, 0) / (botTrades.length || 1)).toFixed(2)}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Success Streak</p>
                  <p className="text-lg font-semibold">
                    {closedBotTrades.filter(t => t.pnl > 0).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-secondary/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Connection</span>
                  <Badge variant="default" className="bg-trading-success">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">License Status</span>
                  <Badge variant="default" className="bg-trading-success">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Risk Management</span>
                  <Badge variant="default" className="bg-trading-success">
                    <Shield className="h-3 w-3 mr-1" />
                    Enabled
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Market Data</span>
                  <Badge variant="default" className="bg-trading-success">
                    <Activity className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};