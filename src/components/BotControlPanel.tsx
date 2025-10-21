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
  CheckCircle2,
  Sliders,
  Bell
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BotSettings {
  maxDrawdown: number;
  dailyLossLimit: number;
  maxOpenPositions: number;
  riskLevel: string;
  autoTakeProfit: number;
  autoStopLoss: number;
  trailingStopEnabled: boolean;
  trailingStopPercent: number;
  maxTradesPerDay: number;
  minTimeBetweenTrades: number;
  notifyTradeOpened: boolean;
  notifyTradeClosed: boolean;
  notifyProfitLoss: boolean;
}

interface BotControlPanelProps {
  botStatus: 'active' | 'paused';
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  botTrades: any[];
  openBotTrades: any[];
  closedBotTrades: any[];
  onUpdateSettings?: (settings: BotSettings) => void;
}

export const BotControlPanel: React.FC<BotControlPanelProps> = ({
  botStatus,
  onPause,
  onResume,
  onDelete,
  botTrades,
  openBotTrades,
  closedBotTrades,
  onUpdateSettings,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isMobile = useIsMobile();
  
  // Bot settings state
  const [settings, setSettings] = useState<BotSettings>({
    maxDrawdown: 10,
    dailyLossLimit: 1000,
    maxOpenPositions: 3,
    riskLevel: 'moderate',
    autoTakeProfit: 5,
    autoStopLoss: 2,
    trailingStopEnabled: false,
    trailingStopPercent: 1.5,
    maxTradesPerDay: 10,
    minTimeBetweenTrades: 15,
    notifyTradeOpened: true,
    notifyTradeClosed: true,
    notifyProfitLoss: true,
  });

  const handleSettingChange = (key: keyof BotSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onUpdateSettings?.(newSettings);
  };

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
    <div className="space-y-4 md:space-y-6 w-full max-w-[100vw] min-w-0 overflow-x-hidden box-border">
      {/* Main Bot Status Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl shadow-xl w-full max-w-full box-border">
        <CardHeader className="pb-4 md:pb-6 p-3 md:p-6 w-full max-w-full box-border">
          <CardTitle className="flex items-center justify-between flex-wrap gap-2 md:gap-4 w-full max-w-full min-w-0">
            <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1 max-w-full overflow-hidden">
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
        <TabsList className={`grid w-full max-w-full ${isMobile ? 'grid-cols-5 gap-0 px-0' : 'grid-cols-5'} bg-card/50 backdrop-blur-sm box-border`}>
          <TabsTrigger value="overview" className={`flex items-center justify-center ${isMobile ? 'gap-0 px-0.5 py-2 min-w-0 text-xs' : 'gap-2 px-3 py-2'} box-border`}>
            <BarChart3 className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
            {!isMobile && <span className="truncate">Overview</span>}
            {isMobile && <span className="sr-only">Overview</span>}
          </TabsTrigger>
          <TabsTrigger value="controls" className={`flex items-center justify-center ${isMobile ? 'gap-0 px-0.5 py-2 min-w-0 text-xs' : 'gap-2 px-3 py-2'} box-border`}>
            <Settings className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
            {!isMobile && <span className="truncate">Controls</span>}
            {isMobile && <span className="sr-only">Controls</span>}
          </TabsTrigger>
          <TabsTrigger value="bot-settings" className={`flex items-center justify-center ${isMobile ? 'gap-0 px-0.5 py-2 min-w-0 text-xs' : 'gap-2 px-3 py-2'} box-border`}>
            <Sliders className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
            {!isMobile && <span className="truncate">Bot Settings</span>}
            {isMobile && <span className="sr-only">Bot Settings</span>}
          </TabsTrigger>
          <TabsTrigger value="performance" className={`flex items-center justify-center ${isMobile ? 'gap-0 px-0.5 py-2 min-w-0 text-xs' : 'gap-2 px-3 py-2'} box-border`}>
            <TrendingUp className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
            {!isMobile && <span className="truncate">Performance</span>}
            {isMobile && <span className="sr-only">Performance</span>}
          </TabsTrigger>
          <TabsTrigger value="system" className={`flex items-center justify-center ${isMobile ? 'gap-0 px-0.5 py-2 min-w-0 text-xs' : 'gap-2 px-3 py-2'} box-border`}>
            <Shield className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
            {!isMobile && <span className="truncate">System</span>}
            {isMobile && <span className="sr-only">System</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 md:space-y-4">
          {/* Quick Stats Grid */}
          <div className={`grid grid-cols-1 gap-2 w-full max-w-full`}>
            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-success/5 backdrop-blur-xl min-w-0 w-full max-w-full box-border">
              <CardContent className={`${isMobile ? 'p-2' : 'p-4'} w-full max-w-full box-border`}>
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2'} min-w-0 w-full max-w-full overflow-hidden`}>
                  <CheckCircle2 className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5'} text-trading-success flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground truncate`}>Total Trades</p>
                    <p className={`${isMobile ? 'text-xl' : 'text-xl'} font-bold truncate`}>{botTrades.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-accent/5 backdrop-blur-xl min-w-0 w-full max-w-full box-border">
              <CardContent className={`${isMobile ? 'p-2' : 'p-4'} w-full max-w-full box-border`}>
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2'} min-w-0 w-full max-w-full overflow-hidden`}>
                  <Activity className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5'} text-trading-accent flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground truncate`}>Active Trades</p>
                    <p className={`${isMobile ? 'text-xl' : 'text-xl'} font-bold truncate`}>{openBotTrades.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-success/5 backdrop-blur-xl min-w-0 w-full max-w-full box-border">
              <CardContent className={`${isMobile ? 'p-2' : 'p-4'} w-full max-w-full box-border`}>
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2'} min-w-0 w-full max-w-full overflow-hidden`}>
                  <TrendingUp className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5'} text-trading-success flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground truncate`}>Win Rate</p>
                    <p className={`${isMobile ? 'text-xl' : 'text-xl'} font-bold text-trading-success truncate`}>{winRate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl min-w-0 w-full max-w-full box-border">
              <CardContent className={`${isMobile ? 'p-2' : 'p-4'} w-full max-w-full box-border`}>
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2'} min-w-0 w-full max-w-full overflow-hidden`}>
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
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-secondary/5 backdrop-blur-xl w-full max-w-full box-border">
            <CardHeader className={`${isMobile ? 'pb-3' : 'pb-4'} w-full max-w-full box-border`}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                <Settings className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                Bot Control Center
              </CardTitle>
            </CardHeader>
            <CardContent className={`space-y-3 ${isMobile ? 'px-4 pb-4' : 'space-y-4'} w-full max-w-full box-border`}>
              <div className={`flex ${isMobile ? 'flex-col gap-2' : 'flex-col sm:flex-row gap-3'} w-full max-w-full`}>
                {botStatus === 'active' ? (
                  <Button 
                    onClick={onPause}
                    variant="outline"
                    className={`flex items-center justify-center gap-2 border-trading-accent/50 hover:bg-trading-accent/10 ${isMobile ? 'h-12 text-sm' : ''} w-full max-w-full`}
                  >
                    <Pause className="h-4 w-4" />
                    {isMobile ? "Pause Bot" : "Pause Trading Bot"}
                  </Button>
                ) : (
                  <Button 
                    onClick={onResume}
                    className={`flex items-center justify-center gap-2 bg-trading-success hover:bg-trading-success/90 ${isMobile ? 'h-12 text-sm' : ''} w-full max-w-full`}
                  >
                    <Play className="h-4 w-4" />
                    {isMobile ? "Resume Bot" : "Resume Trading Bot"}
                  </Button>
                )}
                
                {!confirmDelete ? (
                  <Button 
                    onClick={() => setConfirmDelete(true)}
                    variant="outline"
                    className={`flex items-center justify-center gap-2 border-destructive/50 hover:bg-destructive/10 text-destructive ${isMobile ? 'h-12 text-sm' : ''} w-full max-w-full`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isMobile ? "Disconnect" : "Disconnect Bot"}
                  </Button>
                ) : (
                  <div className={`flex ${isMobile ? 'flex-col gap-2' : 'gap-2'} w-full max-w-full`}>
                    <Button 
                      onClick={onDelete}
                      variant="destructive"
                      className={`flex items-center gap-2 ${isMobile ? 'h-12 text-sm' : ''} w-full max-w-full`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {isMobile ? "Confirm" : "Confirm Disconnect"}
                    </Button>
                    <Button 
                      onClick={() => setConfirmDelete(false)}
                      variant="outline"
                      className={`${isMobile ? 'h-12 text-sm' : ''} w-full max-w-full`}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              <div className={`${isMobile ? 'p-3' : 'p-4'} bg-muted/30 rounded-lg border border-border/50 w-full max-w-full box-border`}>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                  <strong>Note:</strong> {isMobile ? "Pausing stops new trades. Disconnecting closes all positions." : "Pausing the bot will stop new trade execution but keep existing positions open. Disconnecting will close all open positions and remove the bot license."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bot-settings" className="space-y-3 md:space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="h-5 w-5" />
                Bot Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Risk Management */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-trading-danger" />
                  Risk Management
                </h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Max Drawdown Limit</Label>
                    <span className="text-sm font-semibold text-primary">{settings.maxDrawdown}%</span>
                  </div>
                  <Slider 
                    value={[settings.maxDrawdown]} 
                    onValueChange={([value]) => handleSettingChange('maxDrawdown', value)}
                    min={5} 
                    max={50} 
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">Bot pauses when this loss threshold is reached</p>
                </div>

                <div className="space-y-2">
                  <Label>Daily Loss Limit ($)</Label>
                  <Input 
                    type="number" 
                    value={settings.dailyLossLimit}
                    onChange={(e) => handleSettingChange('dailyLossLimit', Number(e.target.value))}
                    min={100}
                    step={100}
                  />
                  <p className="text-xs text-muted-foreground">Maximum loss allowed per day</p>
                </div>

                <div className="space-y-2">
                  <Label>Max Open Positions</Label>
                  <Input 
                    type="number" 
                    value={settings.maxOpenPositions}
                    onChange={(e) => handleSettingChange('maxOpenPositions', Number(e.target.value))}
                    min={1}
                    max={10}
                  />
                  <p className="text-xs text-muted-foreground">Limit concurrent trades</p>
                </div>
              </div>

              {/* Trading Strategy */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-trading-accent" />
                  Trading Strategy
                </h3>
                
                <div className="space-y-2">
                  <Label>Risk Level</Label>
                  <Select value={settings.riskLevel} onValueChange={(value) => handleSettingChange('riskLevel', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                      <SelectItem value="very_aggressive">Very Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Adjust bot's trading aggression</p>
                </div>
              </div>

              {/* Position Management */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-trading-success" />
                  Position Settings
                </h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Auto Take-Profit</Label>
                    <span className="text-sm font-semibold text-trading-success">{settings.autoTakeProfit}%</span>
                  </div>
                  <Slider 
                    value={[settings.autoTakeProfit]} 
                    onValueChange={([value]) => handleSettingChange('autoTakeProfit', value)}
                    min={1} 
                    max={20} 
                    step={0.5}
                  />
                  <p className="text-xs text-muted-foreground">Default profit target for new trades</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Auto Stop-Loss</Label>
                    <span className="text-sm font-semibold text-trading-danger">{settings.autoStopLoss}%</span>
                  </div>
                  <Slider 
                    value={[settings.autoStopLoss]} 
                    onValueChange={([value]) => handleSettingChange('autoStopLoss', value)}
                    min={0.5} 
                    max={10} 
                    step={0.5}
                  />
                  <p className="text-xs text-muted-foreground">Default loss limit for new trades</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Trailing Stop</Label>
                    <Switch 
                      checked={settings.trailingStopEnabled}
                      onCheckedChange={(checked) => handleSettingChange('trailingStopEnabled', checked)}
                    />
                  </div>
                  {settings.trailingStopEnabled && (
                    <>
                      <Input 
                        type="number" 
                        value={settings.trailingStopPercent}
                        onChange={(e) => handleSettingChange('trailingStopPercent', Number(e.target.value))}
                        min={0.5}
                        max={5}
                        step={0.1}
                      />
                      <p className="text-xs text-muted-foreground">Distance from peak price (%)</p>
                    </>
                  )}
                </div>
              </div>

              {/* Frequency Controls */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Frequency Controls
                </h3>
                
                <div className="space-y-2">
                  <Label>Max Trades Per Day</Label>
                  <Input 
                    type="number" 
                    value={settings.maxTradesPerDay}
                    onChange={(e) => handleSettingChange('maxTradesPerDay', Number(e.target.value))}
                    min={1}
                    max={50}
                  />
                  <p className="text-xs text-muted-foreground">Limit daily trade count</p>
                </div>

                <div className="space-y-2">
                  <Label>Min Time Between Trades (minutes)</Label>
                  <Select 
                    value={settings.minTimeBetweenTrades.toString()} 
                    onValueChange={(value) => handleSettingChange('minTimeBetweenTrades', Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Cooling period between trades</p>
                </div>
              </div>

              {/* Notifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="h-5 w-5 text-trading-accent" />
                  Notifications
                </h3>

                {/* Permission Banner */}
                {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
                  <div className="bg-muted/50 border border-border rounded-lg p-3">
                    <p className="text-sm mb-2">Enable browser notifications to receive alerts even when the tab is inactive.</p>
                    <Button 
                      size="sm" 
                      onClick={async () => {
                        await Notification.requestPermission();
                        // Force re-render by triggering a state change
                        window.dispatchEvent(new Event('notification-permission-change'));
                      }}
                    >
                      Enable Browser Notifications
                    </Button>
                  </div>
                )}
                
                {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <p className="text-sm text-destructive">Browser notifications are blocked. Enable them in your browser settings.</p>
                  </div>
                )}
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Trade Opened</Label>
                    <Switch 
                      checked={settings.notifyTradeOpened}
                      onCheckedChange={(checked) => handleSettingChange('notifyTradeOpened', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Trade Closed</Label>
                    <Switch 
                      checked={settings.notifyTradeClosed}
                      onCheckedChange={(checked) => handleSettingChange('notifyTradeClosed', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Profit/Loss Alerts</Label>
                    <Switch 
                      checked={settings.notifyProfitLoss}
                      onCheckedChange={(checked) => handleSettingChange('notifyProfitLoss', checked)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button className="w-full" size="lg">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-3 md:space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl w-full max-w-full box-border">
            <CardHeader className={`${isMobile ? 'pb-2' : 'pb-4'} w-full max-w-full box-border`}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : 'text-xl'} truncate`}>
                <TrendingUp className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="w-full max-w-full box-border overflow-hidden">
              <div className={`grid grid-cols-1 gap-3 w-full max-w-full`}>
                <div className={`space-y-2 ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''} w-full max-w-full box-border`}>
                  <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-muted-foreground`}>Best Trade</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className={`font-semibold text-trading-success min-w-0 truncate ${getResponsiveTextSize(Math.max(...closedBotTrades.map(t => t.pnl), 0), isMobile ? 'text-xl' : 'text-lg')}`}>
                          {formatLargeNumber(Math.max(...closedBotTrades.map(t => t.pnl), 0)).display}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formatLargeNumber(Math.max(...closedBotTrades.map(t => t.pnl), 0)).full}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className={`space-y-2 ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''} w-full max-w-full box-border`}>
                  <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-muted-foreground`}>Worst Trade</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className={`font-semibold text-trading-danger min-w-0 truncate ${getResponsiveTextSize(Math.abs(Math.min(...closedBotTrades.map(t => t.pnl), 0)), isMobile ? 'text-xl' : 'text-lg')}`}>
                          {formatLargeNumber(Math.min(...closedBotTrades.map(t => t.pnl), 0)).display}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formatLargeNumber(Math.min(...closedBotTrades.map(t => t.pnl), 0)).full}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className={`space-y-2 ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''} w-full max-w-full box-border`}>
                  <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-muted-foreground`}>Avg Trade Size</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className={`font-semibold min-w-0 truncate ${getResponsiveTextSize(botTrades.reduce((sum, t) => sum + t.amount, 0) / (botTrades.length || 1), isMobile ? 'text-xl' : 'text-lg')}`}>
                          {formatLargeNumber(botTrades.reduce((sum, t) => sum + t.amount, 0) / (botTrades.length || 1)).display}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formatLargeNumber(botTrades.reduce((sum, t) => sum + t.amount, 0) / (botTrades.length || 1)).full}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className={`space-y-2 ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : ''} w-full max-w-full box-border`}>
                  <p className={`${isMobile ? 'text-sm' : 'text-sm'} text-muted-foreground`}>Success Streak</p>
                  <p className={`${isMobile ? 'text-xl' : 'text-lg'} font-semibold truncate`}>
                    {closedBotTrades.filter(t => t.pnl > 0).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-3 md:space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-secondary/5 backdrop-blur-xl w-full max-w-full box-border">
            <CardHeader className={`${isMobile ? 'pb-3' : 'pb-4'} w-full max-w-full box-border`}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'} truncate`}>
                <Shield className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="w-full max-w-full box-border overflow-hidden">
              <div className={`grid grid-cols-1 gap-3 w-full max-w-full`}>
                <div className={`flex items-center justify-between ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : 'p-3 rounded-lg border'} w-full max-w-full box-border`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <CheckCircle2 className="h-4 w-4 text-trading-success flex-shrink-0" />
                    <span className={`${isMobile ? 'text-sm' : 'text-sm'} truncate`}>{isMobile ? "API" : "API Connection"}</span>
                  </div>
                  <Badge variant="default" className={`${isMobile ? 'text-xs px-2 py-0.5' : 'text-sm'} bg-trading-success/20 text-trading-success flex-shrink-0`}>
                    Connected
                  </Badge>
                </div>

                <div className={`flex items-center justify-between ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : 'p-3 rounded-lg border'} w-full max-w-full box-border`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Shield className="h-4 w-4 text-trading-success flex-shrink-0" />
                    <span className={`${isMobile ? 'text-sm' : 'text-sm'} truncate`}>{isMobile ? "License" : "Bot License"}</span>
                  </div>
                  <Badge variant="default" className={`${isMobile ? 'text-xs px-2 py-0.5' : 'text-sm'} bg-trading-success/20 text-trading-success flex-shrink-0`}>
                    Active
                  </Badge>
                </div>

                <div className={`flex items-center justify-between ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : 'p-3 rounded-lg border'} w-full max-w-full box-border`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <AlertTriangle className="h-4 w-4 text-trading-accent flex-shrink-0" />
                    <span className={`${isMobile ? 'text-sm' : 'text-sm'} truncate`}>{isMobile ? "Risk Mgmt" : "Risk Management"}</span>
                  </div>
                  <Badge variant="secondary" className={`${isMobile ? 'text-xs px-2 py-0.5' : 'text-sm'} bg-trading-accent/20 text-trading-accent flex-shrink-0`}>
                    Monitoring
                  </Badge>
                </div>

                <div className={`flex items-center justify-between ${isMobile ? 'p-3 bg-muted/20 rounded-lg' : 'p-3 rounded-lg border'} w-full max-w-full box-border`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Activity className="h-4 w-4 text-trading-success flex-shrink-0" />
                    <span className={`${isMobile ? 'text-sm' : 'text-sm'} truncate`}>{isMobile ? "Market Data" : "Market Data Feed"}</span>
                  </div>
                  <Badge variant="default" className={`${isMobile ? 'text-xs px-2 py-0.5' : 'text-sm'} bg-trading-success/20 text-trading-success flex-shrink-0`}>
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