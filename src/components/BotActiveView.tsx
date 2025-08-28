import React, { useState, useEffect } from "react";
import { Bot, Pause, Play, Trash2, Activity, Cpu, Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  const generateRandomCode = () => {
    const commands = [
      "ANALYZING MARKET SENTIMENT...",
      "PROCESSING RSI INDICATORS...", 
      "CALCULATING FIBONACCI LEVELS...",
      "MONITORING SUPPORT/RESISTANCE...",
      "EVALUATING TRADE OPPORTUNITIES...",
      "UPDATING POSITION SIZES...",
      "SCANNING VOLUME PATTERNS...",
      "CHECKING CORRELATION MATRIX...",
      "OPTIMIZING ENTRY POINTS...",
      "MANAGING RISK PARAMETERS...",
    ];
    
    const values = [
      "BUY_SIGNAL_DETECTED",
      "SELL_PRESSURE_LOW", 
      "VOLATILITY_NORMAL",
      "TREND_BULLISH",
      "SUPPORT_LEVEL_0.618",
      "RESISTANCE_1.272",
      "VOLUME_INCREASING",
      "MOMENTUM_POSITIVE",
    ];

    return Math.random() < 0.7 
      ? `${commands[Math.floor(Math.random() * commands.length)]}`
      : `${values[Math.floor(Math.random() * values.length)]}: ${(Math.random() * 100).toFixed(4)}`;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTerminalLines(prev => {
        const newLine = `[${new Date().toLocaleTimeString()}] ${generateRandomCode()}`;
        const updated = [...prev, newLine].slice(-15); // Keep last 15 lines
        return updated;
      });
    }, botStatus === 'active' ? 800 + Math.random() * 1200 : 3000); // Slower when paused

    return () => clearInterval(interval);
  }, [botStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-6">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-primary/3 rounded-full blur-2xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bot className="h-8 w-8 text-primary" />
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                    botStatus === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                  } animate-pulse`}></div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Trading Bot Active</h1>
                  <p className="text-sm text-muted-foreground">
                    AI-powered automated trading system
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={onBackToDashboard}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
                <Badge 
                  variant={botStatus === 'active' ? 'default' : 'secondary'}
                  className="px-3 py-1"
                >
                  <Activity className="h-3 w-3 mr-1" />
                  {botStatus === 'active' ? 'ACTIVE' : 'PAUSED'}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Robot Avatar */}
        <div className="flex justify-center">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl">
              <Bot className={`h-16 w-16 text-white ${botStatus === 'active' ? 'animate-pulse' : ''}`} />
            </div>
            {botStatus === 'active' && (
              <>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full animate-ping"></div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Zap className="h-3 w-3 text-white" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Control Panel */}
        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Bot Control Panel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 justify-center">
              {botStatus === 'active' ? (
                <Button 
                  onClick={onPause}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Pause Bot
                </Button>
              ) : (
                <Button 
                  onClick={onResume}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Resume Bot
                </Button>
              )}
              
              <Button 
                onClick={onDelete}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Disconnect Bot
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Terminal */}
        <Card className="border-primary/20 bg-black/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-primary/20 to-transparent">
            <CardTitle className="text-green-400 font-mono text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              BOT_NEURAL_NETWORK.EXE
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-64 overflow-hidden bg-black text-green-400 font-mono text-xs p-4 relative">
              {/* Matrix rain effect */}
              <div className="absolute inset-0 opacity-20">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute text-xs opacity-60"
                    style={{
                      left: `${i * 5}%`,
                      animation: `matrix-rain ${3 + Math.random() * 2}s linear infinite`,
                      animationDelay: `${Math.random() * 2}s`,
                    }}
                  >
                    {Array.from({ length: 50 }).map((_, j) => (
                      <div key={j} style={{ marginTop: '0.5em' }}>
                        {Math.random() > 0.5 ? Math.floor(Math.random() * 10) : String.fromCharCode(65 + Math.floor(Math.random() * 26))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Terminal output */}
              <div className="relative z-10 space-y-1">
                {terminalLines.map((line, index) => (
                  <div key={index} className="opacity-80 animate-fade-in">
                    <span className="text-green-500">$</span> {line}
                  </div>
                ))}
                <div className="flex items-center">
                  <span className="text-green-500">$</span>
                  <span className="ml-2 animate-pulse">|</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style>{`
        @keyframes matrix-rain {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
};