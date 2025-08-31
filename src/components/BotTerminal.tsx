import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Terminal, Maximize2, Minimize2, Filter } from "lucide-react";

interface BotTerminalProps {
  botStatus: 'active' | 'paused';
  botTrades: any[];
}

export const BotTerminal: React.FC<BotTerminalProps> = ({ botStatus, botTrades }) => {
  const [terminalLines, setTerminalLines] = useState<Array<{id: string, timestamp: string, type: 'info' | 'success' | 'warning' | 'error' | 'trade', message: string}>>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'trades' | 'system'>('all');
  const terminalRef = useRef<HTMLDivElement>(null);

  const generateSystemMessage = () => {
    const systemMessages = [
      { type: 'info' as const, message: "ANALYZING MARKET SENTIMENT..." },
      { type: 'info' as const, message: "PROCESSING RSI INDICATORS..." }, 
      { type: 'info' as const, message: "CALCULATING FIBONACCI LEVELS..." },
      { type: 'info' as const, message: "MONITORING SUPPORT/RESISTANCE..." },
      { type: 'warning' as const, message: "HIGH VOLATILITY DETECTED" },
      { type: 'success' as const, message: "OPTIMAL ENTRY POINT IDENTIFIED" },
      { type: 'info' as const, message: "UPDATING POSITION SIZES..." },
      { type: 'info' as const, message: "SCANNING VOLUME PATTERNS..." },
      { type: 'success' as const, message: "TREND CONFIRMATION RECEIVED" },
      { type: 'info' as const, message: "RISK PARAMETERS VALIDATED" },
    ];
    
    return systemMessages[Math.floor(Math.random() * systemMessages.length)];
  };

  const addTerminalLine = (type: 'info' | 'success' | 'warning' | 'error' | 'trade', message: string) => {
    const newLine = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    
    setTerminalLines(prev => {
      const updated = [...prev, newLine].slice(-50); // Keep last 50 lines
      return updated;
    });
  };

  // Add bot trades to terminal
  useEffect(() => {
    const latestTrade = botTrades[botTrades.length - 1];
    if (latestTrade) {
      const tradeMessage = latestTrade.status === 'closed' 
        ? `TRADE CLOSED: ${latestTrade.trade_type} ${latestTrade.symbol} @ ${latestTrade.close_price} | P&L: $${latestTrade.pnl.toFixed(2)}`
        : `TRADE OPENED: ${latestTrade.trade_type} ${latestTrade.symbol} @ ${latestTrade.open_price}`;
      
      addTerminalLine('trade', tradeMessage);
    }
  }, [botTrades.length]);

  // Generate system messages
  useEffect(() => {
    const interval = setInterval(() => {
      const { type, message } = generateSystemMessage();
      addTerminalLine(type, message);
    }, botStatus === 'active' ? 2000 + Math.random() * 3000 : 8000);

    return () => clearInterval(interval);
  }, [botStatus]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  const filteredLines = terminalLines.filter(line => {
    if (filter === 'all') return true;
    if (filter === 'trades') return line.type === 'trade';
    if (filter === 'system') return line.type !== 'trade';
    return true;
  });

  const getLineColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-trading-success';
      case 'warning': return 'text-trading-accent';
      case 'error': return 'text-trading-danger';
      case 'trade': return 'text-trading-primary';
      default: return 'text-green-400';
    }
  };

  const getLinePrefix = (type: string) => {
    switch (type) {
      case 'success': return '[SUCCESS]';
      case 'warning': return '[WARNING]';
      case 'error': return '[ERROR]';
      case 'trade': return '[TRADE]';
      default: return '[INFO]';
    }
  };

  return (
    <Card className="border-primary/20 bg-black/95 backdrop-blur-xl shadow-2xl">
      {/* Matrix rain background */}
      <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-xs text-green-400 font-mono"
            style={{
              left: `${i * 3.33}%`,
              animation: `matrix-rain ${4 + Math.random() * 3}s linear infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          >
            {Array.from({ length: 80 }).map((_, j) => (
              <div key={j} className="mb-1">
                {Math.random() > 0.5 ? Math.floor(Math.random() * 10) : String.fromCharCode(65 + Math.floor(Math.random() * 26))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <CardHeader className="bg-gradient-to-r from-trading-primary/20 to-transparent border-b border-primary/20 relative z-10">
        <CardTitle className="flex items-center justify-between text-green-400 font-mono text-sm max-w-full overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink">
            <Terminal className="h-4 w-4 flex-shrink-0" />
            <span className="truncate text-xs sm:text-sm">BOT_NEURAL_NETWORK.EXE</span>
            <Badge variant="outline" className="ml-1 sm:ml-2 bg-black/50 flex-shrink-0">
              <Activity className="h-3 w-3 mr-1" />
              <span className="hidden xs:inline">{botStatus.toUpperCase()}</span>
              <span className="xs:hidden">{botStatus.charAt(0).toUpperCase()}</span>
            </Badge>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter(filter === 'all' ? 'trades' : filter === 'trades' ? 'system' : 'all')}
              className="h-6 px-1 sm:px-2 text-xs text-green-400 hover:bg-green-400/10 min-w-0"
            >
              <Filter className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="hidden sm:inline">{filter.toUpperCase()}</span>
              <span className="sm:hidden">
                {filter === 'all' ? 'A' : filter === 'trades' ? 'T' : 'S'}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-1 sm:px-2 text-green-400 hover:bg-green-400/10 flex-shrink-0"
            >
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 relative z-10">
        <div 
          ref={terminalRef}
          className={`${isExpanded ? 'h-96' : 'h-64'} overflow-y-auto bg-black/90 text-green-400 font-mono text-xs p-4 transition-all duration-300`}
        >
          <div className="space-y-1">
            {filteredLines.map((line) => (
              <div key={line.id} className={`${getLineColor(line.type)} animate-fade-in flex items-start gap-2`}>
                <span className="text-green-500 opacity-70">[{line.timestamp}]</span>
                <span className={`${getLineColor(line.type)} font-semibold`}>{getLinePrefix(line.type)}</span>
                <span className="flex-1">{line.message}</span>
              </div>
            ))}
            
            {/* Cursor */}
            <div className="flex items-center mt-4">
              <span className="text-green-500">root@tradingbot:~$</span>
              <span className="ml-2 animate-pulse bg-green-400 w-2 h-4 inline-block"></span>
            </div>
          </div>
        </div>
      </CardContent>

      <style>{`
        @keyframes matrix-rain {
          0% { transform: translateY(-100vh); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
      `}</style>
    </Card>
  );
};