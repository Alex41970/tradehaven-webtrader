import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: number;
}

interface UserProfile {
  user_id: string;
  email: string;
  first_name?: string;
  surname?: string;
}

interface CreateTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  assets: Asset[];
  onCreateTrade: (params: {
    userId: string;
    assetId: string;
    symbol: string;
    tradeType: "BUY" | "SELL";
    amount: number;
    leverage: number;
    price: number;
  }) => Promise<void>;
  getPriceForAsset?: (symbol: string) => { price: number } | null;
  isConnected?: boolean;
}

export const CreateTradeDialog = ({ 
  open, 
  onOpenChange, 
  user,
  assets,
  onCreateTrade,
  getPriceForAsset,
  isConnected = false
}: CreateTradeDialogProps) => {
  const [selectedAsset, setSelectedAsset] = useState("");
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  // Update price when asset changes
  useEffect(() => {
    if (selectedAsset && assets.length > 0) {
      const asset = assets.find(a => a.id === selectedAsset);
      if (asset) {
        const priceUpdate = getPriceForAsset?.(asset.symbol);
        setPrice((priceUpdate?.price || asset.price).toString());
      }
    }
  }, [selectedAsset, assets, getPriceForAsset]);

  const handleSubmit = async () => {
    if (!user || !selectedAsset || !amount || !price) return;
    
    const asset = assets.find(a => a.id === selectedAsset);
    if (!asset) return;
    
    setLoading(true);
    try {
      await onCreateTrade({
        userId: user.user_id,
        assetId: selectedAsset,
        symbol: asset.symbol,
        tradeType,
        amount: parseFloat(amount),
        leverage,
        price: parseFloat(price)
      });
      
      // Reset form
      setSelectedAsset("");
      setAmount("");
      setPrice("");
      setLeverage(1);
      setTradeType("BUY");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const userName = user?.first_name && user?.surname 
    ? `${user.first_name} ${user.surname}`
    : user?.email || 'User';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Trade</DialogTitle>
          <DialogDescription>
            Creating trade for {userName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Asset</Label>
              <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Asset" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.symbol} - {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Trade Type</Label>
              <Select value={tradeType} onValueChange={(value: "BUY" | "SELL") => setTradeType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">BUY</SelectItem>
                  <SelectItem value="SELL">SELL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            
            <div>
              <Label>Leverage</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div>
              <Label>
                Entry Price
                {isConnected && <span className="text-xs text-green-600 ml-1">(Live)</span>}
              </Label>
              <Input
                type="number"
                step="0.00001"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00000"
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedAsset || !amount || !price || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Trade"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
