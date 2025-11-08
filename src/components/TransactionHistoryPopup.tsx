import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TransactionHistory } from "@/hooks/useTransactionHistory";
import { Calendar, CreditCard, Clock, MessageSquare, Building, Coins, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface TransactionHistoryPopupProps {
  transaction: TransactionHistory | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionHistoryPopup = ({ transaction, isOpen, onClose }: TransactionHistoryPopupProps) => {
  if (!transaction) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'pending':
      default:
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const getTransactionIcon = () => {
    return transaction.type === 'deposit' ? (
      <div className="p-3 bg-green-500/10 rounded-full">
        <ArrowDownLeft className="h-6 w-6 text-green-500" />
      </div>
    ) : (
      <div className="p-3 bg-blue-500/10 rounded-full">
        <ArrowUpRight className="h-6 w-6 text-blue-500" />
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            {getTransactionIcon()}
            <div>
              <h3 className="text-lg font-semibold capitalize">
                {transaction.type} Request
              </h3>
              <p className="text-sm text-muted-foreground">
                Transaction Details
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Amount */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <Badge className={getStatusColor(transaction.status)}>
                  {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Amount</span>
                <span className="text-2xl font-bold text-foreground">
                  ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Info */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Payment Method</p>
                <p className="text-sm text-muted-foreground capitalize">{transaction.method}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Request Date</p>
                <p className="text-sm text-muted-foreground">{formatDate(transaction.created_at)}</p>
              </div>
            </div>

            {transaction.processed_at && (
              <>
                <Separator />
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Processed Date</p>
                    <p className="text-sm text-muted-foreground">{formatDate(transaction.processed_at)}</p>
                  </div>
                </div>
              </>
            )}

            {/* Payment Details */}
            {transaction.crypto_wallet_address && (
              <>
                <Separator />
                <div className="flex items-center space-x-3">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Crypto Wallet</p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {transaction.crypto_wallet_address}
                    </p>
                  </div>
                </div>
              </>
            )}

            {transaction.bank_details && (
              <>
                <Separator />
                <div className="flex items-center space-x-3">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Bank Details</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {transaction.bank_details.bank_name && (
                        <p>Bank: {transaction.bank_details.bank_name}</p>
                      )}
                      {transaction.bank_details.account_number && (
                        <p>Account: ****{transaction.bank_details.account_number.slice(-4)}</p>
                      )}
                      {transaction.bank_details.routing_number && (
                        <p>Routing: {transaction.bank_details.routing_number}</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Admin Notes / Rejection Reason */}
            {transaction.admin_notes && (
              <>
                <Separator />
                <div className="flex items-start space-x-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1">
                      {transaction.status === 'rejected' ? 'Rejection Reason' : 'Admin Notes'}
                    </p>
                    <div className={`text-sm p-3 rounded-md ${
                      transaction.status === 'rejected' 
                        ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {transaction.admin_notes}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Request ID */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Request ID</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {transaction.id.slice(-12).toUpperCase()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};