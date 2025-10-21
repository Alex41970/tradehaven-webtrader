import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MessageCircle, Mail, Phone, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactSupportModal: React.FC<ContactSupportModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFaqDialog, setShowFaqDialog] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !subject || !message) {
      toast({
        title: "Please fill in all fields",
        description: "All fields are required to submit your support request.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Support request submitted",
        description: "We'll get back to you within 24 hours.",
      });
      setEmail('');
      setSubject('');
      setMessage('');
      setIsSubmitting(false);
      onClose();
    }, 1000);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Contact Support
          </DialogTitle>
          <DialogDescription>
            Get help with your account, trading questions, or technical issues.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Quick Contact Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Mail className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-semibold text-sm">Email Support</h4>
                <a 
                  href="mailto:support@lexingtoncapitalinvesting.com"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors break-all underline"
                >
                  support@lexingtoncapitalinvesting.com
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Phone className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-semibold text-sm">Phone Support</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <a 
                    href="tel:+13433040557"
                    className="block hover:text-primary transition-colors underline"
                  >
                    +1 (343) 304-0557
                  </a>
                  <a 
                    href="tel:+442080404627"
                    className="block hover:text-primary transition-colors underline"
                  >
                    +44 20 8040 4627
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setShowFaqDialog(true)}
            >
              <CardContent className="p-4 text-center">
                <HelpCircle className="h-6 w-6 mx-auto mb-2 text-primary" />
                <h4 className="font-semibold text-sm">FAQ Center</h4>
                <p className="text-xs text-muted-foreground">Self-service help</p>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief description of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Please provide details about your issue or question..."
                className="min-h-[100px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Submitting..." : "Send Message"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>

    {/* FAQ Dialog */}
    <Dialog open={showFaqDialog} onOpenChange={setShowFaqDialog}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </DialogTitle>
          <DialogDescription>
            Common questions about trading, accounts, and our platform.
          </DialogDescription>
        </DialogHeader>

        <Accordion type="single" collapsible className="w-full">
          {/* Account & Getting Started */}
          <AccordionItem value="deposit">
            <AccordionTrigger>How do I deposit funds?</AccordionTrigger>
            <AccordionContent>
              Click on your balance in the top right, then select "Deposit". Enter the amount and follow the payment instructions. Deposits typically appear within minutes.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payment-methods">
            <AccordionTrigger>What payment methods do you accept?</AccordionTrigger>
            <AccordionContent>
              We accept various payment methods including bank transfers, credit/debit cards, and digital wallets. Available methods may vary by region.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="deposit-time">
            <AccordionTrigger>How long does it take for deposits to reflect?</AccordionTrigger>
            <AccordionContent>
              Most deposits are processed instantly. Bank transfers may take 1-3 business days depending on your bank.
            </AccordionContent>
          </AccordionItem>

          {/* Trading Basics */}
          <AccordionItem value="leverage">
            <AccordionTrigger>What is leverage and how does it work?</AccordionTrigger>
            <AccordionContent>
              Leverage allows you to control larger positions with less capital. For example, 1:100 leverage means $1,000 can control a $100,000 position. While this amplifies profits, it also increases potential losses.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="margin">
            <AccordionTrigger>What is margin and why is it required?</AccordionTrigger>
            <AccordionContent>
              Margin is the collateral needed to open and maintain leveraged positions. It's calculated as a percentage of the full position size. If your margin level drops too low, positions may be automatically closed to prevent further losses.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sl-tp">
            <AccordionTrigger>How do I set Stop Loss and Take Profit?</AccordionTrigger>
            <AccordionContent>
              When opening a trade, enter your desired Stop Loss (SL) and Take Profit (TP) prices in the trading panel. SL limits losses by closing your position at a specified price, while TP locks in profits automatically.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="margin-call">
            <AccordionTrigger>What happens if my margin level drops too low?</AccordionTrigger>
            <AccordionContent>
              If your margin level reaches the margin call threshold, you'll receive a warning. If it continues to drop to the stop-out level, your positions may be automatically closed to prevent your balance from going negative.
            </AccordionContent>
          </AccordionItem>

          {/* Orders & Positions */}
          <AccordionItem value="order-types">
            <AccordionTrigger>What's the difference between market and limit orders?</AccordionTrigger>
            <AccordionContent>
              Market orders execute immediately at the current market price. Limit orders only execute when the price reaches your specified level, giving you more control but no guarantee of execution.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="modify-position">
            <AccordionTrigger>Can I modify an open position?</AccordionTrigger>
            <AccordionContent>
              Yes, you can modify Stop Loss and Take Profit levels on open positions. You can also partially close positions or add to them by opening additional trades in the same direction.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="close-trade">
            <AccordionTrigger>How do I close a trade?</AccordionTrigger>
            <AccordionContent>
              Click the close button (X) on your open position in the Portfolio section, or use the opposite trade button in the trading panel to close your position at the current market price.
            </AccordionContent>
          </AccordionItem>

          {/* Withdrawals */}
          <AccordionItem value="withdraw">
            <AccordionTrigger>How do I withdraw my funds?</AccordionTrigger>
            <AccordionContent>
              Click on your balance, select "Withdraw", enter the amount, and provide your payment details. Ensure all open positions are closed before withdrawing.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="withdraw-time">
            <AccordionTrigger>How long do withdrawals take?</AccordionTrigger>
            <AccordionContent>
              Withdrawal processing times vary by payment method. Digital wallets are typically instant, while bank transfers may take 3-5 business days.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="withdraw-fees">
            <AccordionTrigger>Are there any withdrawal fees?</AccordionTrigger>
            <AccordionContent>
              Withdrawal fees depend on your payment method and region. Check the withdrawal page for specific fees before submitting your request.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
    </>
  );
};