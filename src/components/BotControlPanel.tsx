import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatLargeNumber, getResponsiveTextSize, formatPnL } from "@/utils/numberFormatter";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();

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
    <div className="space-y-4 md:space-y-6 w-full min-w-0 overflow-x-hidden">
      {/* Main Bot Status Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl shadow-xl">
        <CardHeader className="pb-4 md:pb-6 p-3 md:p-6">
          <CardTitle className="flex items-center justify-between flex-wrap gap-2 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
              {/* Enhanced Bot Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-full bg-gradient-to-br from-trading-primary to-trading-accent flex items-center justify-center shadow-lg`}>
                  <Bot className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-white ${botStatus === 'active' ? 'animate-pulse' : ''}`} />
                </div>
                
                {/* Status indicator with glow effect */}
                <div className={`absolute -top-1 -right-1 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'} rounded-full ${
                  botStatus === 'active' ? 'bg-trading-success shadow-lg shadow-trading-success/50' : 'bg-trading-accent'
                } flex items-center justify-center animate-pulse`}>
                  {botStatus === 'active' ? (
                    <Zap className={`${isMobile ? 'h-2 w-2' : 'h-3 w-3'} text-white`} />
                  ) : (
                    <Pause className={`${isMobile ? 'h-2 w-2' : 'h-3 w-3'} text-white`} />
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

              <div className="min-w-0 flex-1">
                <h2 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold truncate`}>Neural Trading Bot</h2>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground truncate`}>AI-Powered Market Analysis</p>
              </div>
            </div>

            <Badge 
              variant={getStatusBadgeVariant()}
              className={`${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} font-semibold ${getStatusColor()} flex-shrink-0`}
            >
              <Activity className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
              {botStatus.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Control Tabs */}
      <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-4 gap-0' : 'grid-cols-4'} bg-card/50 backdrop-blur-sm`}>
          <TabsTrigger value="overview" className={`flex items-center justify-center ${isMobile ? 'gap-0 px-1 py-2 min-w-0' : 'gap-2 px-3 py-2'}`}>
            <BarChart3 className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
            {!isMobile && <span className="truncate">Overview</span>}
          </TabsTrigger>
          <TabsTrigger value="controls" className={`flex items-center justify-center ${isMobile ? 'gap-0 px-1 py-2 min-w-0' : 'gap-2 px-3 py-2'}`}>
            <Settings className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
            {!isMobile && <span className="truncate">Controls</span>}
          </TabsTrigger>
          <TabsTrigger value="performance" className={`flex items-center justify-center ${isMobile ? 'gap-0 px-1 py-2 min-w-0' : 'gap-2 px-3 py-2'}`}>
            <TrendingUp className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
            {!isMobile && <span className="truncate">Performance</span>}
          </TabsTrigger>
          <TabsTrigger value="system" className={`flex items-center justify-center ${isMobile ? 'gap-0 px-1 py-2 min-w-0' : 'gap-2 px-3 py-2'}`}>
            <Shield className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
            {!isMobile && <span className="truncate">System</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 md:space-y-4">
          {/* Quick Stats Grid */}
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 md:grid-cols-4 gap-3 md:gap-4'} w-full`}>
            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-success/5 backdrop-blur-xl min-w-0">
              <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2'} min-w-0`}>
                  <CheckCircle2 className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5'} text-trading-success flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground truncate`}>Total Trades</p>
                    <p className={`${isMobile ? 'text-xl' : 'text-xl'} font-bold truncate`}>{botTrades.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-accent/5 backdrop-blur-xl min-w-0">
              <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2'} min-w-0`}>
                  <Activity className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5'} text-trading-accent flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground truncate`}>Active Trades</p>
                    <p className={`${isMobile ? 'text-xl' : 'text-xl'} font-bold truncate`}>{openBotTrades.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-success/5 backdrop-blur-xl min-w-0">
              <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2'} min-w-0`}>
                  <TrendingUp className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5'} text-trading-success flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground truncate`}>Win Rate</p>
                    <p className={`${isMobile ? 'text-xl' : 'text-xl'} font-bold text-trading-success truncate`}>{winRate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl min-w-0">
              <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2'} min-w-0`}>
                  <BarChart3 className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5'} text-trading-primary flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground truncate`}>Total P&L</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className={`font-bold min-w-0 truncate ${getResponsiveTextSize(totalPnL, isMobile ? 'text-xl' : 'text-xl')} ${totalPnL >= 0 ? 'text-trading-success' : 'text-trading-danger'}`}>
                            {formatPnL(totalPnL).display}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{formatPnL(totalPnL).full}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="controls" className="space-y-3 md:space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-secondary/5 backdrop-blur-xl">
            <CardHeader className={`${isMobile ? 'pb-3' : 'pb-4'}`}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                <Settings className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                Bot Control Center
              </CardTitle>
            </CardHeader>
            <CardContent className={`space-y-3 ${isMobile ? 'px-4 pb-4' : 'space-y-4'}`}>
              <div className={`flex ${isMobile ? 'flex-col gap-2' : 'flex-col sm:flex-row gap-3'}`}>
                {botStatus === 'active' ? (
                  <Button 
                    onClick={onPause}
                    variant="outline"
                    className={`flex items-center justify-center gap-2 border-trading-accent/50 hover:bg-trading-accent/10 ${isMobile ? 'h-12 text-sm' : ''}`}
                  >
                    <Pause className="h-4 w-4" />
                    {isMobile ? "Pause Bot" : "Pause Trading Bot"}
                  </Button>
                ) : (
                  <Button 
                    onClick={onResume}
                    className={`flex items-center justify-center gap-2 bg-trading-success hover:bg-trading-success/90 ${isMobile ? 'h-12 text-sm' : ''}`}
                  >
                    <Play className="h-4 w-4" />
                    {isMobile ? "Resume Bot" : "Resume Trading Bot"}
                  </Button>
                )}
                
                {!confirmDelete ? (
                  <Button 
                    onClick={() => setConfirmDelete(true)}
                    variant="outline"
                    className={`flex items-center justify-center gap-2 border-destructive/50 hover:bg-destructive/10 text-destructive ${isMobile ? 'h-12 text-sm' : ''}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isMobile ? "Disconnect" : "Disconnect Bot"}
                  </Button>
                ) : (
                  <div className={`flex ${isMobile ? 'flex-col gap-2' : 'gap-2'}`}>
                    <Button 
                      onClick={onDelete}
                      variant="destructive"
                      className={`flex items-center gap-2 ${isMobile ? 'h-12 text-sm' : ''}`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {isMobile ? "Confirm" : "Confirm Disconnect"}
                    </Button>
                    <Button 
                      onClick={() => setConfirmDelete(false)}
                      variant="outline"
                      className={`${isMobile ? 'h-12 text-sm' : ''}`}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              <div className={`${isMobile ? 'p-3' : 'p-4'} bg-muted/30 rounded-lg border border-border/50`}>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                  <strong>Note:</strong> {isMobile ? "Pausing stops new trades. Disconnecting closes all positions." : "Pausing the bot will stop new trade execution but keep existing positions open. Disconnecting will close all open positions and remove the bot license."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-3 md:space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl">
            <CardHeader className={`${isMobile ? 'pb-3' : 'pb-4'}`}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                <TrendingUp className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-2 gap-4'}`}>
                <div className={`space-y-2 ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''}`}>
                  <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-muted-foreground`}>Best Trade</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className={`font-semibold text-trading-success min-w-0 ${getResponsiveTextSize(Math.max(...closedBotTrades.map(t => t.pnl), 0), isMobile ? 'text-xl' : 'text-lg')}`}>
                          {formatLargeNumber(Math.max(...closedBotTrades.map(t => t.pnl), 0)).display}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formatLargeNumber(Math.max(...closedBotTrades.map(t => t.pnl), 0)).full}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className={`space-y-2 ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''}`}>
                  <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-muted-foreground`}>Worst Trade</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className={`font-semibold text-trading-danger min-w-0 ${getResponsiveTextSize(Math.abs(Math.min(...closedBotTrades.map(t => t.pnl), 0)), isMobile ? 'text-xl' : 'text-lg')}`}>
                          {formatLargeNumber(Math.min(...closedBotTrades.map(t => t.pnl), 0)).display}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formatLargeNumber(Math.min(...closedBotTrades.map(t => t.pnl), 0)).full}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className={`space-y-2 ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''}`}>
                  <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-muted-foreground`}>Avg Trade Size</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className={`font-semibold min-w-0 ${getResponsiveTextSize(botTrades.reduce((sum, t) => sum + t.amount, 0) / (botTrades.length || 1), isMobile ? 'text-xl' : 'text-lg')}`}>
                          {formatLargeNumber(botTrades.reduce((sum, t) => sum + t.amount, 0) / (botTrades.length || 1)).display}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formatLargeNumber(botTrades.reduce((sum, t) => sum + t.amount, 0) / (botTrades.length || 1)).full}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className={`space-y-2 ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''}`}>
                  <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-muted-foreground`}>Success Streak</p>
                  <p className={`${isMobile ? 'text-xl' : 'text-lg'} font-semibold`}>
                    {closedBotTrades.filter(t => t.pnl > 0).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-3 md:space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-secondary/5 backdrop-blur-xl">
            <CardHeader className={`${isMobile ? 'pb-3' : 'pb-4'}`}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                <Shield className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`space-y-3 ${isMobile ? 'space-y-4' : 'space-y-4'}`}>
                <div className={`flex items-center justify-between ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''}`}>
                  <span className={`${isMobile ? 'text-sm font-medium' : 'text-sm'}`}>API Connection</span>
                  <Badge variant="default" className={`bg-trading-success ${isMobile ? 'px-3 py-1' : ''}`}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>
                <div className={`flex items-center justify-between ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''}`}>
                  <span className={`${isMobile ? 'text-sm font-medium' : 'text-sm'}`}>License Status</span>
                  <Badge variant="default" className={`bg-trading-success ${isMobile ? 'px-3 py-1' : ''}`}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className={`flex items-center justify-between ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''}`}>
                  <span className={`${isMobile ? 'text-sm font-medium' : 'text-sm'}`}>Risk Management</span>
                  <Badge variant="default" className={`bg-trading-success ${isMobile ? 'px-3 py-1' : ''}`}>
                    <Shield className="h-3 w-3 mr-1" />
                    Enabled
                  </Badge>
                </div>
                <div className={`flex items-center justify-between ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''}`}>
                  <span className={`${isMobile ? 'text-sm font-medium' : 'text-sm'}`}>Market Data</span>
                  <Badge variant="default" className={`bg-trading-success ${isMobile ? 'px-3 py-1' : ''}`}>
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