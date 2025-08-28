import React, { useState } from "react";
import { Bot, Key, CheckCircle, XCircle, Shield, TrendingUp, BarChart3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface TradingBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: (licenseKey: string) => Promise<boolean>;
  onAcceptPermissions: () => void;
  showPermissions: boolean;
}

export const TradingBotModal: React.FC<TradingBotModalProps> = ({
  isOpen,
  onClose,
  onActivate,
  onAcceptPermissions,
  showPermissions,
}) => {
  const [licenseKey, setLicenseKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;

    setIsValidating(true);
    const success = await onActivate(licenseKey.trim());
    setIsValidating(false);

    if (success) {
      setLicenseKey("");
    }
  };

  const handleClose = () => {
    setLicenseKey("");
    onClose();
  };

  if (showPermissions) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Bot Permissions Required
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-muted-foreground">
              The trading bot requests access to the following permissions:
            </p>
            
            <div className="space-y-3">
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4" />
                    Trade Execution Access
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Allow the bot to open and close trades for you automatically
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4" />
                    Trade History Access
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Allow the bot to access your trading history and performance data
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4" />
                    Analytics Access
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Allow the bot to view your account analytics and performance metrics
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">
                By granting these permissions, you authorize the trading bot to perform automated trading on your behalf. 
                You can revoke access at any time from your dashboard.
              </p>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Deny Access
              </Button>
              <Button 
                onClick={onAcceptPermissions}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept & Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Connect Trading Bot
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="license-key" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              License Key
            </Label>
            <Input
              id="license-key"
              type="text"
              placeholder="TBL-XXXXXXXX-XXXXXXXX-XXXXXXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="font-mono"
              disabled={isValidating}
            />
            <p className="text-xs text-muted-foreground">
              Enter the license key provided by your administrator
            </p>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              License keys are generated by administrators and grant access to automated trading features. 
              Contact your admin if you need a license key.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isValidating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!licenseKey.trim() || isValidating}
              className="flex-1"
            >
              {isValidating ? "Validating..." : "Connect Bot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};