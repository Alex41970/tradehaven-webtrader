import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Clock, MessageSquare } from "lucide-react";

const Contact = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <div className="flex-1 flex justify-center">
              <Link to="/" className="text-xl md:text-2xl font-bold bg-gradient-to-r from-trading-primary to-trading-accent bg-clip-text text-transparent">
                <span className="hidden md:inline">Lexington Capital Investing</span>
                <span className="md:hidden">LCI</span>
              </Link>
            </div>
            <div className="w-[100px]"></div> {/* Spacer for center alignment */}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Get In Touch
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Have questions? We're here to help. Reach out through any of our channels and we'll respond promptly.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {/* Contact Methods */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 hover:shadow-lg transition-all">
              <MessageSquare className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Live Chat</h3>
              <p className="text-muted-foreground mb-4">
                Chat with our support team in real-time
              </p>
              <Button className="w-full">Start Chat</Button>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-all">
              <Mail className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-xl font-bold mb-2">Email Support</h3>
              <p className="text-muted-foreground mb-2">
                support@lexingtoncapital.com
              </p>
              <p className="text-sm text-muted-foreground">
                Response within 24 hours
              </p>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
              <Clock className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">24/7 Support</h3>
              <p className="text-muted-foreground">
                Our global support team is available around the clock to assist you with any questions or issues.
              </p>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-6">Send Us a Message</h2>
              <form className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@example.com" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="How can we help you?" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Please describe your inquiry in detail..."
                    rows={6}
                  />
                </div>

                <Button size="lg" className="w-full">
                  Send Message
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  We typically respond within 1-2 business hours during working hours, and within 24 hours outside of working hours.
                </p>
              </form>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <Card className="p-12 text-center bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-primary/30">
          <h2 className="text-3xl font-bold mb-4">Need Help with Trading?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Visit our comprehensive support center for FAQs, tutorials, and trading guides.
          </p>
          <Link to="/support">
            <Button size="lg" className="text-lg px-8">
              Visit Support Center
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
};

export default Contact;