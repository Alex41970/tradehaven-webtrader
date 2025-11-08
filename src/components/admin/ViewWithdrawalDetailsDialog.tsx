import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, Building2, User, Calendar, DollarSign, Copy, AlertTriangle, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ViewWithdrawalDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: any;
}

export const ViewWithdrawalDetailsDialog = ({ open, onOpenChange, request }: ViewWithdrawalDetailsDialogProps) => {
  const { toast } = useToast();

  if (!request) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const getCryptoType = (address: string) => {
    if (!address) return "Crypto";
    if (address.startsWith("BTC:")) return "Bitcoin (BTC)";
    if (address.startsWith("ETH:")) return "Ethereum (ETH)";
    if (address.startsWith("USDT:")) return "Tether (USDT)";
    return "Cryptocurrency";
  };

  const getCryptoAddress = (address: string) => {
    if (!address) return address;
    const parts = address.split(":");
    return parts.length > 1 ? parts[1] : address;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Withdrawal Request Details</DialogTitle>
        </DialogHeader>

        {request.status === 'pending' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              ⚠️ Verify all details carefully before processing this withdrawal
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* User Information */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              User Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium text-right">
                  {request.user_profiles?.first_name} {request.user_profiles?.surname}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium text-right break-all">{request.user_profiles?.email}</span>
              </div>
            </div>
          </div>

          {/* Amount & Status */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Request Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-lg">${request.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium uppercase">{request.withdrawal_type}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={request.status === 'pending' ? 'secondary' : 
                               request.status === 'approved' ? 'default' : 'destructive'}>
                  {request.status}
                </Badge>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">
                  {new Date(request.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Crypto Details */}
          {request.crypto_wallet_address && (
            <div className="border rounded-lg p-4 space-y-3 bg-primary/5">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {getCryptoType(request.crypto_wallet_address)} Withdrawal
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm text-muted-foreground">Wallet Address:</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <code className="text-xs bg-background p-2 rounded border font-mono break-all text-right max-w-md">
                      {getCryptoAddress(request.crypto_wallet_address)}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(getCryptoAddress(request.crypto_wallet_address), "Wallet address")}
                      className="flex-shrink-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bank Details */}
          {request.bank_details && (
            <div className="border rounded-lg p-4 space-y-3 bg-primary/5">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Bank Wire Transfer Details
              </h3>
              <div className="space-y-3">
                {request.bank_details.bankName && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">Bank Name:</span>
                    <span className="font-medium text-right">{request.bank_details.bankName}</span>
                  </div>
                )}
                
                {request.bank_details.accountHolderName && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">Account Holder:</span>
                    <span className="font-medium text-right">{request.bank_details.accountHolderName}</span>
                  </div>
                )}

                {request.bank_details.accountNumber && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm text-muted-foreground">Account Number:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-background px-3 py-2 rounded border font-mono">
                          {request.bank_details.accountNumber}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(request.bank_details.accountNumber, "Account number")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {request.bank_details.routingNumber && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm text-muted-foreground">Routing Number:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-background px-3 py-2 rounded border font-mono">
                          {request.bank_details.routingNumber}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(request.bank_details.routingNumber, "Routing number")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {request.bank_details.swiftCode && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm text-muted-foreground">SWIFT Code:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-background px-3 py-2 rounded border font-mono">
                          {request.bank_details.swiftCode}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(request.bank_details.swiftCode, "SWIFT code")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          {request.admin_notes && (
            <>
              <Separator />
              <div className="border rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm">
                  {request.status === 'rejected' ? 'Rejection Reason' : 'Admin Notes'}
                </h3>
                <div className={`text-sm p-3 rounded-md ${
                  request.status === 'rejected' 
                    ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                    : 'bg-muted'
                }`}>
                  {request.admin_notes}
                </div>
              </div>
            </>
          )}

          {request.processed_at && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Processed on {new Date(request.processed_at).toLocaleString()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
