import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, User, DollarSign } from "lucide-react";

interface RejectRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestType: 'deposit' | 'withdrawal';
  requestAmount: number;
  userName: string;
  onConfirm: (reason: string) => void;
}

export const RejectRequestDialog = ({
  open,
  onOpenChange,
  requestType,
  requestAmount,
  userName,
  onConfirm,
}: RejectRequestDialogProps) => {
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    const trimmedReason = rejectionReason.trim();
    
    if (trimmedReason.length < 10) {
      setError("Please provide at least 10 characters explaining the rejection reason");
      return;
    }
    
    if (trimmedReason.length > 500) {
      setError("Rejection reason must be 500 characters or less");
      return;
    }

    onConfirm(trimmedReason);
    
    // Reset state
    setRejectionReason("");
    setError("");
  };

  const handleClose = () => {
    setRejectionReason("");
    setError("");
    onOpenChange(false);
  };

  const remainingChars = 500 - rejectionReason.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-destructive/10 rounded-full">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                Reject {requestType === 'deposit' ? 'Deposit' : 'Withdrawal'} Request
              </DialogTitle>
              <DialogDescription>
                Provide a clear reason for the user
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium">{userName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium">
                ${requestAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Rejection Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="rejectionReason" className="text-sm font-medium">
              Rejection Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                setError("");
              }}
              placeholder="Please provide a clear reason for rejection (e.g., 'Insufficient account verification' or 'Invalid bank details provided')"
              className="min-h-[120px] resize-none text-sm"
              maxLength={500}
            />
            <div className="flex justify-between items-center">
              <p className={`text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
                {error || "This message will be visible to the user"}
              </p>
              <p className={`text-xs ${remainingChars < 50 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                {remainingChars} characters remaining
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={rejectionReason.trim().length < 10}
          >
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
