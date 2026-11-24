import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TransactionHistory } from "@/hooks/useTransactionHistory";
import { Calendar, CreditCard, Clock, MessageSquare, Building, Coins, ArrowUpRight, ArrowDownLeft, Gift, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionHistoryPopupProps {
  transaction: TransactionHistory | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionHistoryPopup = ({ transaction, isOpen, onClose }: TransactionHistoryPopupProps) => {
  if (!transaction) return null;

  const isCredit = transaction.type === 'credit';
  const isAdjustment = isCredit && transaction.method === 'adjustment';

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
        return 'bg-success/10 text-success border-success/20';
      case 'rejected':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'pending':
      default:
        return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const icon = isCredit
    ? <Gift className="h-6 w-6 text-primary" />
    : transaction.type === 'deposit'
      ? <ArrowDownLeft className="h-6 w-6 text-success" />
      : <ArrowUpRight className="h-6 w-6 text-chart-3" />;

  const amountText = `$${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className={cn("rounded-full p-3", isCredit ? "bg-primary/10" : transaction.type === 'deposit' ? "bg-success/10" : "bg-chart-3/10")}>
              {icon}
            </div>
            <div className="min-w-0 text-left">
              <h3 className={cn("text-lg font-semibold", !isCredit && "capitalize")}>
                {isCredit ? transaction.title : `${transaction.type} Request`}
              </h3>
              <p className="text-sm font-normal text-muted-foreground">
                {isCredit ? (isAdjustment ? 'Account adjustment' : 'Credit activity') : 'Transaction Details'}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Amount */}
          <Card>
            <CardContent className="p-4">
              {!isCredit && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Status</span>
                  <Badge className={getStatusColor(transaction.status)}>
                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Amount</span>
                <span className="num text-2xl font-bold text-foreground">
                  {isCredit ? `${transaction.direction === 'out' ? '−' : '+'}${amountText}` : amountText}
                </span>
              </div>
            </CardContent>
          </Card>

          {isCredit && !isAdjustment && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Credit is money from the company. You can trade with it, but it cannot be withdrawn. Profit you make with it is yours.</span>
            </div>
          )}

          {/* Transaction Info */}
          <div className="space-y-3">
            {!isCredit && (
              <>
                <div className="flex items-center space-x-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Payment Method</p>
                    <p className="text-sm text-muted-foreground capitalize">{transaction.method.replace('_', ' ')}</p>
                  </div>
                </div>

                <Separator />
              </>
            )}

            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{isCredit ? 'Date' : 'Request Date'}</p>
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
                      {isCredit ? 'Note' : transaction.status === 'rejected' ? 'Rejection Reason' : 'Admin Notes'}
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
                <span className="text-xs font-medium text-muted-foreground">{isCredit ? 'Reference' : 'Request ID'}</span>
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
