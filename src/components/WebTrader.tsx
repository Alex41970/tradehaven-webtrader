import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TradingChart } from "./TradingChart";
import { toast } from "@/components/ui/use-toast";

const DEMO_ASSETS = [
  { symbol: "EURUSD", name: "Euro/US Dollar", price: 1.0845, change: +0.0012, changePercent: +0.11 },
  { symbol: "GBPUSD", name: "British Pound/US Dollar", price: 1.2654, change: -0.0023, changePercent: -0.18 },
  { symbol: "USDJPY", name: "US Dollar/Japanese Yen", price: 148.75, change: +0.35, changePercent: +0.24 },
  { symbol: "AAPL", name: "Apple Inc.", price: 173.45, change: +2.15, changePercent: +1.26 },
  { symbol: "TSLA", name: "Tesla Inc.", price: 248.87, change: -5.23, changePercent: -2.06 },
  { symbol: "BTCUSD", name: "Bitcoin/US Dollar", price: 43250.00, change: +1250.00, changePercent: +2.98 },
];

export const WebTrader = () => {
  const [selectedAsset, setSelectedAsset] = useState(DEMO_ASSETS[0]);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState("1");

  const handleTrade = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Trade Placed",
      description: `${tradeType.toUpperCase()} $${amount} ${selectedAsset.symbol} with ${leverage}x leverage`,
    });

    setAmount("");
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Asset List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Market Watch</CardTitle>
            <CardDescription>Select an asset to trade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_ASSETS.map((asset) => (
              <div
                key={asset.symbol}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedAsset.symbol === asset.symbol
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setSelectedAsset(asset)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{asset.symbol}</div>
                    <div className="text-xs text-muted-foreground">{asset.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{asset.price}</div>
                    <Badge
                      variant={asset.change >= 0 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {asset.change >= 0 ? "+" : ""}{asset.changePercent.toFixed(2)}%
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Chart and Trading */}
      <div className="lg:col-span-2 space-y-6">
        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{selectedAsset.symbol} - {selectedAsset.name}</CardTitle>
            <CardDescription>Current Price: {selectedAsset.price}</CardDescription>
          </CardHeader>
          <CardContent>
            <TradingChart symbol={selectedAsset.symbol} />
          </CardContent>
        </Card>

        {/* Trading Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Place Trade</CardTitle>
            <CardDescription>Enter your trade details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={tradeType === "buy" ? "default" : "outline"}
                onClick={() => setTradeType("buy")}
                className="h-12"
              >
                BUY
              </Button>
              <Button
                variant={tradeType === "sell" ? "destructive" : "outline"}
                onClick={() => setTradeType("sell")}
                className="h-12"
              >
                SELL
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leverage">Leverage</Label>
                <Select value={leverage} onValueChange={setLeverage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1:1</SelectItem>
                    <SelectItem value="5">1:5</SelectItem>
                    <SelectItem value="10">1:10</SelectItem>
                    <SelectItem value="20">1:20</SelectItem>
                    <SelectItem value="50">1:50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Position Size: </span>
                <span className="font-medium">
                  ${amount && !isNaN(parseFloat(amount)) ? (parseFloat(amount) * parseFloat(leverage)).toLocaleString() : "0"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Margin Required: </span>
                <span className="font-medium">${amount || "0"}</span>
              </div>
            </div>

            <Button
              onClick={handleTrade}
              className="w-full h-12 text-lg"
              variant={tradeType === "buy" ? "default" : "destructive"}
            >
              {tradeType === "buy" ? "BUY" : "SELL"} {selectedAsset.symbol}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};