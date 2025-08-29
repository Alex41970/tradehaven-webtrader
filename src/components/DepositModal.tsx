import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Copy, CreditCard, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AdminPaymentSettings {
  crypto_wallets: Record<string, string>;
  bank_wire_details: {
    bank_name?: string;
    account_holder?: string;
    account_number?: string;
    routing_number?: string;
    swift_code?: string;
    iban?: string;
  };
}

export const DepositModal: React.FC<DepositModalProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [depositType, setDepositType] = useState<'crypto' | 'wire'>('crypto');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<AdminPaymentSettings | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchPaymentSettings();
    }
  }, [open, user]);

  const fetchPaymentSettings = async () => {
    if (!user) return;

    try {
      // Get user's admin ID first
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('admin_id')
        .eq('user_id', user.id)
        .single();

      if (profile?.admin_id) {
        // Get admin's payment settings
        const { data: settings } = await supabase
          .from('admin_payment_settings')
          .select('crypto_wallets, bank_wire_details')
          .eq('admin_id', profile.admin_id)
          .eq('is_active', true)
          .single();

        if (settings) {
          setPaymentSettings({
            crypto_wallets: (settings.crypto_wallets as Record<string, string>) || {},
            bank_wire_details: (settings.bank_wire_details as {
              bank_name?: string;
              account_holder?: string;
              account_number?: string;
              routing_number?: string;
              swift_code?: string;
              iban?: string;
            }) || {}
          });
        }
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  const handleSubmitRequest = async () => {
    if (!user || !amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('deposit_requests')
        .insert({
          user_id: user.id,
          amount: parseFloat(amount),
          deposit_type: depositType,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Deposit request submitted successfully! Your admin will review it shortly.');
      onOpenChange(false);
      setStep(1);
      setAmount('');
      setDepositType('crypto');
    } catch (error) {
      console.error('Error submitting deposit request:', error);
      toast.error('Failed to submit deposit request');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Select Deposit Method</Label>
              <RadioGroup
                value={depositType}
                onValueChange={(value) => setDepositType(value as 'crypto' | 'wire')}
                className="mt-3"
              >
                <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50">
                  <RadioGroupItem value="crypto" id="crypto" />
                  <div className="flex items-center space-x-3">
                    <Wallet className="h-5 w-5 text-primary" />
                    <div>
                      <Label htmlFor="crypto" className="text-sm font-medium">Cryptocurrency</Label>
                      <p className="text-xs text-muted-foreground">Fast and secure crypto transfer</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50">
                  <RadioGroupItem value="wire" id="wire" />
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <div>
                      <Label htmlFor="wire" className="text-sm font-medium">Bank Wire Transfer</Label>
                      <p className="text-xs text-muted-foreground">Traditional bank transfer</p>
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
              <Label htmlFor="amount" className="text-base font-medium">Deposit Amount</Label>
              <div className="mt-2">
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount in USD"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setStep(1)} className="w-full">
                Back
              </Button>
              <Button 
                onClick={() => setStep(3)} 
                className="w-full"
                disabled={!amount || parseFloat(amount) <= 0}
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
                  {depositType === 'crypto' ? <Wallet className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                  <span>{depositType === 'crypto' ? 'Cryptocurrency' : 'Bank Wire'} Deposit</span>
                </CardTitle>
                <CardDescription>
                  Amount: ${parseFloat(amount).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {depositType === 'crypto' && paymentSettings?.crypto_wallets && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Available Crypto Wallets:</Label>
                    {Object.entries(paymentSettings.crypto_wallets).map(([currency, address]) => (
                      <div key={currency} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm uppercase">{currency}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(address)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground break-all mt-1">
                          {address}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {depositType === 'wire' && paymentSettings?.bank_wire_details && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Bank Wire Details:</Label>
                    <div className="rounded-lg border p-3 space-y-2">
                      {paymentSettings.bank_wire_details.bank_name && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Bank Name:</span>
                          <span className="text-sm font-medium">{paymentSettings.bank_wire_details.bank_name}</span>
                        </div>
                      )}
                      {paymentSettings.bank_wire_details.account_holder && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Account Holder:</span>
                          <span className="text-sm font-medium">{paymentSettings.bank_wire_details.account_holder}</span>
                        </div>
                      )}
                      {paymentSettings.bank_wire_details.account_number && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Account Number:</span>
                          <span className="text-sm font-medium">{paymentSettings.bank_wire_details.account_number}</span>
                        </div>
                      )}
                      {paymentSettings.bank_wire_details.routing_number && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Routing Number:</span>
                          <span className="text-sm font-medium">{paymentSettings.bank_wire_details.routing_number}</span>
                        </div>
                      )}
                      {paymentSettings.bank_wire_details.swift_code && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">SWIFT Code:</span>
                          <span className="text-sm font-medium">{paymentSettings.bank_wire_details.swift_code}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!paymentSettings && (
                  <div className="text-center text-muted-foreground py-6">
                    <p>Payment details not configured yet.</p>
                    <p className="text-sm">Please contact your admin for deposit instructions.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium text-sm mb-2">Important Instructions:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Make sure to use the exact amount specified</li>
                <li>• Include your user ID in the transfer memo/description</li>
                <li>• Processing may take 1-24 hours depending on the method</li>
                <li>• Contact support if you have any issues</li>
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
                {isLoading ? 'Submitting...' : 'Submit Deposit Request'}
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
            Deposit Funds {step > 1 && `- Step ${step}/3`}
          </DialogTitle>
        </DialogHeader>
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
};