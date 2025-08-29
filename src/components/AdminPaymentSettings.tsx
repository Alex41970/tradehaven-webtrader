import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CryptoWallet {
  currency: string;
  address: string;
}

interface BankDetails {
  bank_name: string;
  account_holder: string;
  account_number: string;
  routing_number: string;
  swift_code: string;
  iban: string;
}

export const AdminPaymentSettings: React.FC = () => {
  const { user } = useAuth();
  const [cryptoWallets, setCryptoWallets] = useState<CryptoWallet[]>([
    { currency: 'BTC', address: '' }
  ]);
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank_name: '',
    account_holder: '',
    account_number: '',
    routing_number: '',
    swift_code: '',
    iban: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPaymentSettings();
    }
  }, [user]);

  const fetchPaymentSettings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_payment_settings')
        .select('crypto_wallets, bank_wire_details')
        .eq('admin_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Load crypto wallets
        const wallets = data.crypto_wallets || {};
        if (Object.keys(wallets).length > 0) {
          setCryptoWallets(
            Object.entries(wallets).map(([currency, address]) => ({
              currency,
              address: address as string
            }))
          );
        }

        // Load bank details
        if (data.bank_wire_details && typeof data.bank_wire_details === 'object') {
          const bankDetails = data.bank_wire_details as Record<string, string>;
          setBankDetails({
            bank_name: bankDetails.bank_name || '',
            account_holder: bankDetails.account_holder || '',
            account_number: bankDetails.account_number || '',
            routing_number: bankDetails.routing_number || '',
            swift_code: bankDetails.swift_code || '',
            iban: bankDetails.iban || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
      toast.error('Failed to load payment settings');
    } finally {
      setIsLoading(false);
    }
  };

  const addCryptoWallet = () => {
    setCryptoWallets([...cryptoWallets, { currency: '', address: '' }]);
  };

  const removeCryptoWallet = (index: number) => {
    setCryptoWallets(cryptoWallets.filter((_, i) => i !== index));
  };

  const updateCryptoWallet = (index: number, field: keyof CryptoWallet, value: string) => {
    const updated = [...cryptoWallets];
    updated[index][field] = value;
    setCryptoWallets(updated);
  };

  const updateBankDetail = (field: keyof BankDetails, value: string) => {
    setBankDetails(prev => ({ ...prev, [field]: value }));
  };

  const savePaymentSettings = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Convert crypto wallets to object format
      const cryptoWalletsObj = cryptoWallets.reduce((acc, wallet) => {
        if (wallet.currency && wallet.address) {
          acc[wallet.currency.toUpperCase()] = wallet.address;
        }
        return acc;
      }, {} as Record<string, string>);

      // Filter out empty bank details
      const filteredBankDetails = Object.entries(bankDetails).reduce((acc, [key, value]) => {
        if (value.trim()) {
          acc[key] = value.trim();
        }
        return acc;
      }, {} as Record<string, string>);

      const { error } = await supabase
        .from('admin_payment_settings')
        .upsert({
          admin_id: user.id,
          crypto_wallets: cryptoWalletsObj,
          bank_wire_details: filteredBankDetails,
          is_active: true
        }, {
          onConflict: 'admin_id'
        });

      if (error) throw error;

      toast.success('Payment settings saved successfully');
    } catch (error) {
      console.error('Error saving payment settings:', error);
      toast.error('Failed to save payment settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading payment settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cryptocurrency Wallets</CardTitle>
          <CardDescription>
            Configure crypto wallet addresses for client deposits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cryptoWallets.map((wallet, index) => (
            <div key={index} className="flex items-end space-x-3">
              <div className="flex-1">
                <Label htmlFor={`currency-${index}`} className="text-sm">Currency</Label>
                <select
                  id={`currency-${index}`}
                  value={wallet.currency}
                  onChange={(e) => updateCryptoWallet(index, 'currency', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select Currency</option>
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="USDT">Tether (USDT)</option>
                  <option value="USDC">USD Coin (USDC)</option>
                </select>
              </div>
              <div className="flex-[2]">
                <Label htmlFor={`address-${index}`} className="text-sm">Wallet Address</Label>
                <Input
                  id={`address-${index}`}
                  placeholder="Enter wallet address"
                  value={wallet.address}
                  onChange={(e) => updateCryptoWallet(index, 'address', e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => removeCryptoWallet(index)}
                disabled={cryptoWallets.length === 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addCryptoWallet} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Crypto Wallet
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Wire Transfer Details</CardTitle>
          <CardDescription>
            Configure bank account details for client deposits and withdrawals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bank_name" className="text-sm">Bank Name</Label>
              <Input
                id="bank_name"
                placeholder="Enter bank name"
                value={bankDetails.bank_name}
                onChange={(e) => updateBankDetail('bank_name', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="account_holder" className="text-sm">Account Holder</Label>
              <Input
                id="account_holder"
                placeholder="Full name on account"
                value={bankDetails.account_holder}
                onChange={(e) => updateBankDetail('account_holder', e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="account_number" className="text-sm">Account Number</Label>
            <Input
              id="account_number"
              placeholder="Enter account number"
              value={bankDetails.account_number}
              onChange={(e) => updateBankDetail('account_number', e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="routing_number" className="text-sm">Routing Number</Label>
              <Input
                id="routing_number"
                placeholder="Enter routing number"
                value={bankDetails.routing_number}
                onChange={(e) => updateBankDetail('routing_number', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="swift_code" className="text-sm">SWIFT Code</Label>
              <Input
                id="swift_code"
                placeholder="Enter SWIFT code"
                value={bankDetails.swift_code}
                onChange={(e) => updateBankDetail('swift_code', e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="iban" className="text-sm">IBAN (Optional)</Label>
            <Input
              id="iban"
              placeholder="Enter IBAN"
              value={bankDetails.iban}
              onChange={(e) => updateBankDetail('iban', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={savePaymentSettings} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};