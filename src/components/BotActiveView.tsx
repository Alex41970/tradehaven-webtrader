import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTrades } from "@/hooks/useTrades";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { BotMetricsChart } from "./BotMetricsChart";
import { BotTerminal } from "./BotTerminal";
import { BotControlPanel } from "./BotControlPanel";

interface BotActiveViewProps {
  botStatus: 'active' | 'paused';
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onBackToDashboard: () => void;
}

export const BotActiveView: React.FC<BotActiveViewProps> = ({
  botStatus,
  onPause,
  onResume,
  onDelete,
  onBackToDashboard,
}) => {
  const { botTrades, openBotTrades, closedBotTrades, loading } = useTrades();
  const { getUpdatedAsset } = useRealTimePrices();

  return (
    <div className="min-h-screen bg-trading-pattern p-6 relative overflow-hidden">
      {/* Enhanced animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Floating orbs with trading colors */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-trading-primary/10 to-trading-accent/10 rounded-full blur-3xl animate-pulse-subtle"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gradient-to-r from-trading-success/10 to-trading-accent/10 rounded-full blur-2xl animate-pulse-subtle delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-trading-accent/5 rounded-full blur-xl animate-pulse-subtle delay-2000"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">
        {/* Enhanced Header */}
        <Card className="border-primary/20 bg-gradient-to-br from-card/90 via-card/95 to-trading-primary/5 backdrop-blur-xl shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-trading-primary to-trading-accent bg-clip-text text-transparent">
                  Neural Trading Bot Dashboard
                </h1>
                <div className="h-8 w-px bg-border"></div>
                <p className="text-muted-foreground">
                  Advanced AI Market Analysis System
                </p>
              </div>
              <Button 
                onClick={onBackToDashboard}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-trading-primary/10 border-trading-primary/30"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Control Panel */}
          <div className="lg:col-span-1">
            <BotControlPanel
              botStatus={botStatus}
              onPause={onPause}
              onResume={onResume}
              onDelete={onDelete}
              botTrades={botTrades}
              openBotTrades={openBotTrades}
              closedBotTrades={closedBotTrades}
            />
          </div>

          {/* Right Column - Charts and Terminal */}
          <div className="lg:col-span-2 space-y-8">
            {/* Performance Charts */}
            <BotMetricsChart
              trades={closedBotTrades}
              balance={10000} // Base balance
            />

            {/* Enhanced Terminal */}
            <BotTerminal
              botStatus={botStatus}
              botTrades={botTrades}
            />
          </div>
        </div>
      </div>
    </div>
  );
};