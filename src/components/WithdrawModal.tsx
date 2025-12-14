import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Wallet, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useSharedUserProfile } from '@/hooks/useSharedUserProfile';

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { profile } = useSharedUserProfile();
  const [step, setStep] = useState(1);
  const [withdrawalType, setWithdrawalType] = useState<'crypto' | 'wire'>('crypto');
  const [amount, setAmount] = useState('');
  const [cryptoWallet, setCryptoWallet] = useState('');
  const [cryptoCurrency, setCryptoCurrency] = useState('BTC');
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    routingNumber: '',
    swiftCode: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const maxWithdrawable = profile?.available_margin || 0;

  const handleSubmitRequest = async () => {
    if (!user || !amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > maxWithdrawable) {
      toast.error('Withdrawal amount exceeds available balance');
      return;
    }

    if (withdrawalType === 'crypto' && !cryptoWallet) {
      toast.error('Please enter a crypto wallet address');
      return;
    }

    if (withdrawalType === 'wire' && (!bankDetails.bankName || !bankDetails.accountNumber)) {
      toast.error('Please fill in all required bank details');
      return;
    }

    setIsLoading(true);
    try {
      const requestData = {
        user_id: user.id,
        amount: parseFloat(amount),
        withdrawal_type: withdrawalType,
        status: 'pending' as const,
        ...(withdrawalType === 'crypto' ? {
          crypto_wallet_address: `${cryptoCurrency}:${cryptoWallet}`
        } : {
          bank_details: bankDetails
        })
      };

      const { error } = await supabase
        .from('withdrawal_requests')
        .insert(requestData);

      if (error) throw error;

      toast.success('Withdrawal request submitted successfully! Your admin will review it shortly.');
      onOpenChange(false);
      setStep(1);
      setAmount('');
      setCryptoWallet('');
      setBankDetails({
        bankName: '',
        accountHolder: '',
        accountNumber: '',
        routingNumber: '',
        swiftCode: ''
      });
    } catch {
      toast.error('Failed to submit withdrawal request');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-muted-foreground">Available Balance:</span>
                <span className="font-bold text-primary">${maxWithdrawable.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Select Withdrawal Method</Label>
              <RadioGroup
                value={withdrawalType}
                onValueChange={(value) => setWithdrawalType(value as 'crypto' | 'wire')}
                className="mt-3"
              >
                <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50">
                  <RadioGroupItem value="crypto" id="crypto" />
                  <div className="flex items-center space-x-3">
                    <Wallet className="h-5 w-5 text-primary" />
                    <div>
                      <Label htmlFor="crypto" className="text-sm font-medium">Cryptocurrency</Label>
                      <p className="text-xs text-muted-foreground">Fast withdrawal to crypto wallet</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50">
                  <RadioGroupItem value="wire" id="wire" />
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <div>
                      <Label htmlFor="wire" className="text-sm font-medium">Bank Wire Transfer</Label>
                      <p className="text-xs text-muted-foreground">Withdrawal to bank account</p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>
            <Button onClick={() => setStep(2)} className="w-full">
              Continue
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="amount" className="text-base font-medium">Withdrawal Amount</Label>
              <div className="mt-2">
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount in USD"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  max={maxWithdrawable}
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum: ${maxWithdrawable.toLocaleString()}
                </p>
              </div>
            </div>

            {parseFloat(amount) > maxWithdrawable && (
              <div className="flex items-center space-x-2 text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Amount exceeds available balance</span>
              </div>
            )}

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setStep(1)} className="w-full">
                Back
              </Button>
              <Button 
                onClick={() => setStep(3)} 
                className="w-full"
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxWithdrawable}
              >
                Continue
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  {withdrawalType === 'crypto' ? <Wallet className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                  <span>Withdrawal Details</span>
                </CardTitle>
                <CardDescription>
                  Amount: ${parseFloat(amount).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {withdrawalType === 'crypto' ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cryptoCurrency" className="text-sm font-medium">Cryptocurrency</Label>
                      <select
                        id="cryptoCurrency"
                        value={cryptoCurrency}
                        onChange={(e) => setCryptoCurrency(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                      >
                        <option value="BTC">Bitcoin (BTC)</option>
                        <option value="ETH">Ethereum (ETH)</option>
                        <option value="USDT">Tether (USDT)</option>
                        <option value="USDC">USD Coin (USDC)</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="cryptoWallet" className="text-sm font-medium">Wallet Address</Label>
                      <Input
                        id="cryptoWallet"
                        placeholder="Enter your wallet address"
                        value={cryptoWallet}
                        onChange={(e) => setCryptoWallet(e.target.value)}
                        className="font-mono text-xs mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bankName" className="text-sm font-medium">Bank Name *</Label>
                        <Input
                          id="bankName"
                          placeholder="Bank name"
                          value={bankDetails.bankName}
                          onChange={(e) => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="accountHolder" className="text-sm font-medium">Account Holder</Label>
                        <Input
                          id="accountHolder"
                          placeholder="Full name"
                          value={bankDetails.accountHolder}
                          onChange={(e) => setBankDetails(prev => ({ ...prev, accountHolder: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="accountNumber" className="text-sm font-medium">Account Number *</Label>
                      <Input
                        id="accountNumber"
                        placeholder="Account number"
                        value={bankDetails.accountNumber}
                        onChange={(e) => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="routingNumber" className="text-sm font-medium">Routing Number</Label>
                        <Input
                          id="routingNumber"
                          placeholder="Routing number"
                          value={bankDetails.routingNumber}
                          onChange={(e) => setBankDetails(prev => ({ ...prev, routingNumber: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="swiftCode" className="text-sm font-medium">SWIFT Code</Label>
                        <Input
                          id="swiftCode"
                          placeholder="SWIFT code"
                          value={bankDetails.swiftCode}
                          onChange={(e) => setBankDetails(prev => ({ ...prev, swiftCode: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium text-sm mb-2">Important Notice:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Withdrawal requests are processed within 1-3 business days</li>
                <li>• Make sure all details are correct - incorrect details may delay processing</li>
                <li>• A processing fee may apply depending on the withdrawal method</li>
                <li>• Contact support if you need to cancel or modify your request</li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setStep(2)} className="w-full">
                Back
              </Button>
              <Button 
                onClick={handleSubmitRequest} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Submitting...' : 'Submit Withdrawal Request'}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Withdraw Funds {step > 1 && `- Step ${step}/3`}
          </DialogTitle>
        </DialogHeader>
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
};
