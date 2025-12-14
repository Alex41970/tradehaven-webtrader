import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Calculator, Target, Shield, Clock, AlertTriangle } from 'lucide-react';
import { Asset } from '@/hooks/useAssets';
import { usePrices } from '@/contexts/PriceContext';

interface EnhancedTradingPanelProps {
  selectedAsset: Asset;
  amount: number;
  leverage: number;
  onAmountChange: (amount: number) => void;
  onLeverageChange: (leverage: number) => void;
  onTrade: (orderData: {
    orderType: 'market' | 'limit' | 'stop';
    tradeType: 'BUY' | 'SELL';
    triggerPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    expiresAt?: Date;
  }) => void;
  userProfile: any;
  isExecuting: boolean;
}

export const EnhancedTradingPanel: React.FC<EnhancedTradingPanelProps> = ({
  selectedAsset,
  amount,
  leverage,
  onAmountChange,
  onLeverageChange,
  onTrade,
  userProfile,
  isExecuting,
}) => {
  // Get market closed status from PriceContext
  const { isMarketClosed, canTrade } = usePrices();

  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [triggerPrice, setTriggerPrice] = useState<number>(selectedAsset.price);
  const [useStopLoss, setUseStopLoss] = useState(false);
  const [useTakeProfit, setUseTakeProfit] = useState(false);
  const [stopLoss, setStopLoss] = useState<number>(selectedAsset.price * 0.98);
  const [takeProfit, setTakeProfit] = useState<number>(selectedAsset.price * 1.03);
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [riskManagementOpen, setRiskManagementOpen] = useState(false);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);

  // Update price-dependent state when selectedAsset changes
  useEffect(() => {
    setTriggerPrice(selectedAsset.price);
    setStopLoss(selectedAsset.price * 0.98);
    setTakeProfit(selectedAsset.price * 1.03);
  }, [selectedAsset.id, selectedAsset.price]);

  // Risk calculations (crypto-only, simplified)
  const calculations = useMemo(() => {
    const positionSize = amount * selectedAsset.price * leverage;
    const marginRequired = (amount * selectedAsset.price) / leverage;

    const availableAfterTrade = userProfile ? userProfile.available_margin - marginRequired : 0;
    
    const stopLossRisk = useStopLoss ? Math.abs((stopLoss - selectedAsset.price) / selectedAsset.price) * 100 : 0;
    const takeProfitReward = useTakeProfit ? Math.abs((takeProfit - selectedAsset.price) / selectedAsset.price) * 100 : 0;
    
    const riskRewardRatio = stopLossRisk > 0 ? takeProfitReward / stopLossRisk : 0;

    return {
      positionSize,
      marginRequired,
      availableAfterTrade,
      stopLossRisk,
      takeProfitReward,
      riskRewardRatio,
    };
  }, [selectedAsset, amount, leverage, useStopLoss, useTakeProfit, stopLoss, takeProfit, userProfile]);

  const handleQuickRiskSetup = (type: 'conservative' | 'balanced' | 'aggressive') => {
    const configs = {
      conservative: { stopLoss: 0.5, takeProfit: 1.0 },
      balanced: { stopLoss: 1.0, takeProfit: 2.0 },
      aggressive: { stopLoss: 2.0, takeProfit: 5.0 },
    };
    
    const config = configs[type];
    setStopLoss(selectedAsset.price * (1 - config.stopLoss / 100));
    setTakeProfit(selectedAsset.price * (1 + config.takeProfit / 100));
    setUseStopLoss(true);
    setUseTakeProfit(true);
  };

  const handleTrade = (tradeType: 'BUY' | 'SELL') => {
    const orderData = {
      orderType,
      tradeType,
      triggerPrice: orderType !== 'market' ? triggerPrice : undefined,
      stopLoss: useStopLoss ? stopLoss : undefined,
      takeProfit: useTakeProfit ? takeProfit : undefined,
      expiresAt: orderType !== 'market' ? new Date(Date.now() + expiryHours * 60 * 60 * 1000) : undefined,
      idempotencyKey: crypto.randomUUID(),
    };
    
    onTrade(orderData);
  };

  const getRiskColor = (percentage: number) => {
    if (percentage <= 1) return 'text-trading-success';
    if (percentage <= 2) return 'text-trading-accent';
    return 'text-trading-danger';
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-trading-secondary/20">
      <CardContent className="space-y-4">
        {/* Market Closed Warning */}
        {isMarketClosed && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Market Closed</p>
              <p className="text-xs text-muted-foreground">Trading is currently unavailable</p>
            </div>
          </div>
        )}
        {/* Order Type Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Order Type</Label>
          <Select value={orderType} onValueChange={(value: any) => setOrderType(value)}>
            <SelectTrigger className="bg-trading-secondary/20 border-trading-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="market">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-trading-success" />
                  Market Order (Instant)
                </div>
              </SelectItem>
              <SelectItem value="limit">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-trading-accent" />
                  Limit Order (At Price)
                </div>
              </SelectItem>
              <SelectItem value="stop">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-trading-danger" />
                  Stop Order (When Hit)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Trigger Price for Limit/Stop Orders */}
        {orderType !== 'market' && (
          <div className="space-y-2">
            <Label htmlFor="triggerPrice">
              {orderType === 'limit' ? 'Limit Price' : 'Stop Price'}
            </Label>
            <Input
              id="triggerPrice"
              type="number"
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(parseFloat(e.target.value) || 0)}
              className="bg-trading-secondary/20 border-trading-secondary/30"
              step="0.00001"
            />
          </div>
        )}

        {/* Leverage */}
        <div className="space-y-2">
          <Label htmlFor="leverage">
            <span>Leverage: {leverage}x</span>
          </Label>
          <Select value={leverage.toString()} onValueChange={(value) => onLeverageChange(parseInt(value))}>
            <SelectTrigger className="bg-trading-secondary/20 border-trading-secondary/30">
              <SelectValue placeholder={`${leverage}x`} />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 5, 10, 20, 50, 100].map((lev) => (
                <SelectItem key={lev} value={lev.toString()}>
                  {lev}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            className="bg-trading-secondary/20 border-trading-secondary/30"
            min={selectedAsset.min_trade_size}
            step="0.01"
          />
        </div>

        {/* Risk Management */}
        <Collapsible open={riskManagementOpen} onOpenChange={setRiskManagementOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-3 h-auto bg-trading-secondary/10 hover:bg-trading-secondary/20"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-trading-success" />
                <span>Risk Management</span>
              </div>
              {riskManagementOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Quick Setup Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickRiskSetup('conservative')}
                className="text-xs"
              >
                Conservative
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickRiskSetup('balanced')}
                className="text-xs"
              >
                Balanced
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickRiskSetup('aggressive')}
                className="text-xs"
              >
                Aggressive
              </Button>
            </div>

            {/* Stop Loss */}
            <div className="flex items-center space-x-2">
              <Switch
                id="useStopLoss"
                checked={useStopLoss}
                onCheckedChange={setUseStopLoss}
              />
              <Label htmlFor="useStopLoss" className="flex-1">Stop Loss</Label>
            </div>
            {useStopLoss && (
              <div className="space-y-2">
                <Input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                  className="bg-trading-secondary/20 border-trading-secondary/30"
                  step="0.00001"
                />
                <div className="text-xs text-muted-foreground">
                  Risk: <span className={getRiskColor(calculations.stopLossRisk)}>
                    {calculations.stopLossRisk.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Take Profit */}
            <div className="flex items-center space-x-2">
              <Switch
                id="useTakeProfit"
                checked={useTakeProfit}
                onCheckedChange={setUseTakeProfit}
              />
              <Label htmlFor="useTakeProfit" className="flex-1">Take Profit</Label>
            </div>
            {useTakeProfit && (
              <div className="space-y-2">
                <Input
                  type="number"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                  className="bg-trading-secondary/20 border-trading-secondary/30"
                  step="0.00001"
                />
                <div className="text-xs text-muted-foreground">
                  Reward: <span className="text-trading-success">
                    {calculations.takeProfitReward.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Risk/Reward Ratio */}
            {useStopLoss && useTakeProfit && (
              <div className="p-3 bg-trading-secondary/10 rounded-lg">
                <div className="text-sm font-medium">Risk/Reward Ratio</div>
                <div className={`text-lg font-bold ${
                  calculations.riskRewardRatio >= 2 ? 'text-trading-success' : 
                  calculations.riskRewardRatio >= 1 ? 'text-trading-accent' : 'text-trading-danger'
                }`}>
                  1:{calculations.riskRewardRatio.toFixed(2)}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Order Details */}
        {orderType !== 'market' && (
          <Collapsible open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-3 h-auto bg-trading-secondary/10 hover:bg-trading-secondary/20"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-trading-accent" />
                  <span>Order Settings</span>
                </div>
                {orderDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="expiryHours">Expires In (Hours)</Label>
                <Select value={expiryHours.toString()} onValueChange={(value) => setExpiryHours(parseInt(value))}>
                  <SelectTrigger className="bg-trading-secondary/20 border-trading-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Hour</SelectItem>
                    <SelectItem value="4">4 Hours</SelectItem>
                    <SelectItem value="24">24 Hours</SelectItem>
                    <SelectItem value="72">3 Days</SelectItem>
                    <SelectItem value="168">1 Week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Trading Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            onClick={() => handleTrade('BUY')}
            disabled={isExecuting || calculations.availableAfterTrade < 0 || !canTrade}
            className="bg-trading-success hover:bg-trading-success/90 text-white font-medium h-12"
          >
            {orderType === 'market' ? 'BUY' : `BUY ${orderType.toUpperCase()}`}
          </Button>
          <Button
            onClick={() => handleTrade('SELL')}
            disabled={isExecuting || calculations.availableAfterTrade < 0 || !canTrade}
            className="bg-trading-danger hover:bg-trading-danger/90 text-white font-medium h-12"
          >
            {orderType === 'market' ? 'SELL' : `SELL ${orderType.toUpperCase()}`}
          </Button>
        </div>

        {/* Position Summary */}
        <div className="p-3 bg-trading-secondary/10 rounded-lg space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="h-4 w-4 text-trading-accent" />
            <span className="text-sm font-medium">Position Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Position Size: <span className="font-medium">${calculations.positionSize.toFixed(2)}</span></div>
            <div>Margin Required: <span className="font-medium">${calculations.marginRequired.toFixed(2)}</span></div>
            <div>Available After: <span className="font-medium">${calculations.availableAfterTrade.toFixed(2)}</span></div>
            <div>Max Leverage: <span className="font-medium">{selectedAsset.max_leverage}x</span></div>
          </div>
        </div>

        {calculations.availableAfterTrade < 0 && (
          <div className="text-xs text-trading-danger text-center">
            Insufficient margin available for this trade
          </div>
        )}
      </CardContent>
    </Card>
  );
};