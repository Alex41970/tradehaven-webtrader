import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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

            <Card>
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
  );
};