import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTrades } from "@/hooks/useTrades";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { BotMetricsChart } from "./BotMetricsChart";
import { BotTerminal } from "./BotTerminal";
import { BotControlPanel } from "./BotControlPanel";
import { useBotStatus } from "@/hooks/useBotStatus";

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
  const { updateBotSettings } = useBotStatus();

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Automation</p>
            <h1 className="flex items-center gap-3 text-2xl font-semibold md:text-3xl">
              Trading Bot
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${botStatus === "active" ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${botStatus === "active" ? "animate-pulse bg-success" : "bg-primary"}`} />
                {botStatus === "active" ? "Running" : "Paused"}
              </span>
            </h1>
          </div>
          <Button onClick={onBackToDashboard} variant="outline" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />Overview
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid 2xl:grid-cols-3 gap-4 w-full min-w-0">
          {/* Left Column - Control Panel */}
          <div className="2xl:col-span-1">
            <BotControlPanel
              botStatus={botStatus}
              onPause={onPause}
              onResume={onResume}
              onDelete={onDelete}
              botTrades={botTrades}
              openBotTrades={openBotTrades}
              closedBotTrades={closedBotTrades}
              onUpdateSettings={updateBotSettings}
            />
          </div>

          {/* Right Column - Charts and Terminal */}
          <div className="2xl:col-span-2 space-y-4 min-w-0">
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
  );
};