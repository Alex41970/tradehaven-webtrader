import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { logger } from '@/utils/logger';

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

interface UserProfile {
  user_id: string;
  email: string;
  first_name?: string;
  surname?: string;
}

interface UserPaymentSettingsProps {
  users: UserProfile[];
}

export const UserPaymentSettings: React.FC<UserPaymentSettingsProps> = ({ users }) => {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [cryptoWallets, setCryptoWallets] = useState<CryptoWallet[]>([]);
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

  const fetchPaymentSettings = useCallback(async (userId: string) => {
    if (!user || !userId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_payment_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return;
      }

      if (data) {
        const wallets = Object.entries(data.crypto_wallets || {}).map(([currency, address]) => ({
          currency,
          address: address as string
        }));
        setCryptoWallets(wallets);

        const bankData = data.bank_wire_details as any || {};
        setBankDetails({
          bank_name: bankData.bank_name || '',
          account_holder: bankData.account_holder || '',
          account_number: bankData.account_number || '',
          routing_number: bankData.routing_number || '',
          swift_code: bankData.swift_code || '',
          iban: bankData.iban || ''
        });
      } else {
        setCryptoWallets([]);
        setBankDetails({
          bank_name: '',
          account_holder: '',
          account_number: '',
          routing_number: '',
          swift_code: '',
          iban: ''
        });
      }
    } catch {
      toast.error('Failed to load payment settings');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedUserId) {
      fetchPaymentSettings(selectedUserId);
    }
  }, [selectedUserId, fetchPaymentSettings]);

  const addCryptoWallet = () => {
    setCryptoWallets([...cryptoWallets, { currency: '', address: '' }]);
  };

  const removeCryptoWallet = (index: number) => {
    setCryptoWallets(cryptoWallets.filter((_, i) => i !== index));
  };

  const updateCryptoWallet = (index: number, field: keyof CryptoWallet, value: string) => {
    const updated = [...cryptoWallets];
    updated[index] = { ...updated[index], [field]: value };
    setCryptoWallets(updated);
  };

  const updateBankDetail = (field: keyof BankDetails, value: string) => {
    setBankDetails(prev => ({ ...prev, [field]: value }));
  };

  const savePaymentSettings = async () => {
    if (!user || !selectedUserId) {
      toast.error('Please select a user first');
      return;
    }

    setIsSaving(true);
    try {
      if (!isSuperAdmin()) {
        const { data: relationship, error: relError } = await supabase
          .from('admin_user_relationships')
          .select('id')
          .eq('admin_id', user.id)
          .eq('user_id', selectedUserId)
          .maybeSingle();

        if (relError) {
          logger.error('Assignment preflight failed', relError);
          toast.error(`Permission check failed: ${relError.message}${relError.code ? ` (code: ${relError.code})` : ''}`);
          return;
        }

        if (!relationship) {
          toast.error("You're not assigned to this user. Ask a super admin to assign them to you first.");
          return;
        }
      }

      const cryptoWalletsObj = cryptoWallets.reduce((acc, wallet) => {
        if (wallet.currency && wallet.address) {
          acc[wallet.currency] = wallet.address;
        }
        return acc;
      }, {} as Record<string, string>);

      const filteredBankDetails = Object.entries(bankDetails).reduce((acc, [key, value]) => {
        if (value && value.trim()) {
          acc[key] = value.trim();
        }
        return acc;
      }, {} as Record<string, string>);

      const { error } = await supabase
        .from('user_payment_settings')
        .upsert(
          {
            user_id: selectedUserId,
            admin_id: user.id,
            crypto_wallets: cryptoWalletsObj,
            bank_wire_details: filteredBankDetails,
            is_active: true
          },
          {
            onConflict: 'user_id'
          }
        );

      if (error) {
        logger.error('Error saving payment settings', error);
        const details = [error.message, error.details, error.hint, error.code]
          .filter(Boolean)
          .join(' | ');
        toast.error(`Failed to save payment settings: ${details}`);
        return;
      }

      toast.success('Payment settings saved successfully');
    } catch (err: any) {
      logger.error('Unexpected error saving payment settings', err);
      const details = [err?.message, err?.details, err?.hint, err?.code]
        .filter(Boolean)
        .join(' | ');
      toast.error(`Failed to save payment settings: ${details || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="user-select">Select User</Label>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a user to configure payment settings" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.user_id} value={u.user_id}>
                {u.first_name && u.surname 
                  ? `${u.first_name} ${u.surname} (${u.email})`
                  : u.email
                }
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedUserId && (
        <>
          {isLoading ? (
            <div className="text-center py-8">Loading payment settings...</div>
          ) : (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Cryptocurrency Wallets</h3>
                    <Button onClick={addCryptoWallet} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Wallet
                    </Button>
                  </div>
                  
                  {cryptoWallets.map((wallet, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label htmlFor={`currency-${index}`}>Currency</Label>
                        <Input
                          id={`currency-${index}`}
                          placeholder="e.g., BTC, ETH, USDT"
                          value={wallet.currency}
                          onChange={(e) => updateCryptoWallet(index, 'currency', e.target.value)}
                        />
                      </div>
                      <div className="flex-2">
                        <Label htmlFor={`address-${index}`}>Wallet Address</Label>
                        <Input
                          id={`address-${index}`}
                          placeholder="Enter wallet address"
                          value={wallet.address}
                          onChange={(e) => updateCryptoWallet(index, 'address', e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => removeCryptoWallet(index)}
                        size="sm"
                        variant="outline"
                        className="mb-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {cryptoWallets.length === 0 && (
                    <p className="text-muted-foreground text-sm">No cryptocurrency wallets configured.</p>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Bank Wire Transfer Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bank_name">Bank Name</Label>
                      <Input
                        id="bank_name"
                        placeholder="Enter bank name"
                        value={bankDetails.bank_name}
                        onChange={(e) => updateBankDetail('bank_name', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="account_holder">Account Holder</Label>
                      <Input
                        id="account_holder"
                        placeholder="Enter account holder name"
                        value={bankDetails.account_holder}
                        onChange={(e) => updateBankDetail('account_holder', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="account_number">Account Number</Label>
                      <Input
                        id="account_number"
                        placeholder="Enter account number"
                        value={bankDetails.account_number}
                        onChange={(e) => updateBankDetail('account_number', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="routing_number">Routing Number</Label>
                      <Input
                        id="routing_number"
                        placeholder="Enter routing number"
                        value={bankDetails.routing_number}
                        onChange={(e) => updateBankDetail('routing_number', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="swift_code">SWIFT Code</Label>
                      <Input
                        id="swift_code"
                        placeholder="Enter SWIFT code"
                        value={bankDetails.swift_code}
                        onChange={(e) => updateBankDetail('swift_code', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="iban">IBAN</Label>
                      <Input
                        id="iban"
                        placeholder="Enter IBAN"
                        value={bankDetails.iban}
                        onChange={(e) => updateBankDetail('iban', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex justify-end">
                <Button onClick={savePaymentSettings} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Payment Settings'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
