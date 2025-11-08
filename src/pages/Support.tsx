import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, BookOpen, Video, MessageSquare, FileText, HelpCircle } from "lucide-react";

const Support = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            TradePro
          </Link>
          <Link to="/">
            <Button variant="ghost">Back to Home</Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Hero with Search */}
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Help Center
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Find answers, tutorials, and resources to help you succeed on TradePro.
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search for help articles, guides, or tutorials..."
              className="pl-12 h-14 text-lg"
            />
          </div>
        </div>

        {/* Quick Help Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
            <MessageSquare className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Live Chat Support</h3>
            <p className="text-muted-foreground mb-4">
              Chat with our support team in real-time, 24/7
            </p>
            <Button className="w-full">Start Chat</Button>
          </Card>

          <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
            <Video className="w-12 h-12 text-accent mb-4" />
            <h3 className="text-xl font-bold mb-2">Video Tutorials</h3>
            <p className="text-muted-foreground mb-4">
              Step-by-step video guides for all features
            </p>
            <Button variant="outline" className="w-full">Watch Videos</Button>
          </Card>

          <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
            <FileText className="w-12 h-12 text-trading-success mb-4" />
            <h3 className="text-xl font-bold mb-2">Submit a Ticket</h3>
            <p className="text-muted-foreground mb-4">
              Get personalized help from our support team
            </p>
            <Button variant="outline" className="w-full">Create Ticket</Button>
          </Card>
        </div>

        {/* Knowledge Base Categories */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Browse by Category</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: BookOpen, title: "Getting Started", articles: "24 articles", color: "text-primary" },
              { icon: HelpCircle, title: "Account Management", articles: "18 articles", color: "text-accent" },
              { icon: FileText, title: "Trading Basics", articles: "32 articles", color: "text-trading-success" },
              { icon: Video, title: "Platform Guides", articles: "15 articles", color: "text-primary" },
              { icon: MessageSquare, title: "Deposits & Withdrawals", articles: "12 articles", color: "text-accent" },
              { icon: BookOpen, title: "Security & Privacy", articles: "10 articles", color: "text-trading-success" }
            ].map((category, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                <category.icon className={`w-10 h-10 mb-4 ${category.color}`} />
                <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">
                  {category.title}
                </h3>
                <p className="text-sm text-muted-foreground">{category.articles}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Popular Articles */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Popular Articles</h2>
          <Card className="divide-y divide-border">
            {[
              "How do I create an account on TradePro?",
              "What payment methods are supported?",
              "How to place my first trade?",
              "Understanding leverage and margin",
              "How to withdraw funds from my account?",
              "Two-factor authentication setup guide",
              "How to read trading charts and indicators?",
              "What are the trading fees and commissions?"
            ].map((article, index) => (
              <div key={index} className="p-4 hover:bg-accent/5 cursor-pointer transition-colors flex items-center justify-between group">
                <span className="group-hover:text-primary transition-colors">{article}</span>
                <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
              </div>
            ))}
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left">
                What is the minimum deposit required to start trading?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The minimum deposit varies by account type. Standard accounts require a minimum of $100, while Premium accounts require $1,000. We recommend starting with an amount you're comfortable with and can afford to risk.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left">
                How long do withdrawals take to process?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Most withdrawals are processed within 1-3 business days. The exact timing depends on your payment method and bank processing times. E-wallet withdrawals are typically fastest (same day), while bank transfers may take 3-5 business days.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left">
                Is my money safe with TradePro?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes, your funds are protected through multiple layers of security. We use segregated accounts to keep client funds separate from company funds, employ bank-level encryption, and are fully regulated by major financial authorities. Client deposits are also covered by investor protection schemes up to applicable limits.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left">
                Can I use TradePro on mobile devices?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Absolutely! TradePro offers native mobile apps for both iOS and Android, as well as a fully responsive web platform. You can trade, manage your account, and access all features seamlessly across all your devices.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left">
                What trading instruments are available?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                TradePro offers a wide range of trading instruments including Forex (60+ currency pairs), Commodities (Gold, Silver, Oil, etc.), Indices (US500, UK100, etc.), Cryptocurrencies (Bitcoin, Ethereum, etc.), and Stocks (1000+ global stocks). Check our Markets page for the complete list.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left">
                Do you offer educational resources for beginners?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! We provide comprehensive educational resources including video tutorials, webinars, trading guides, market analysis, and a demo account where you can practice with virtual funds. Our educational academy covers everything from basics to advanced trading strategies.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Video Tutorial Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Getting Started Videos</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Account Setup", duration: "3:45", thumbnail: "bg-primary/20" },
              { title: "First Trade Walkthrough", duration: "5:20", thumbnail: "bg-accent/20" },
              { title: "Platform Tour", duration: "8:15", thumbnail: "bg-trading-success/20" }
            ].map((video, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group">
                <div className={`${video.thumbnail} aspect-video flex items-center justify-center relative`}>
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <div className="w-0 h-0 border-l-8 border-l-primary-foreground border-y-6 border-y-transparent ml-1"></div>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-background/80 px-2 py-1 rounded text-xs">
                    {video.duration}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold group-hover:text-primary transition-colors">{video.title}</h3>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Contact Support CTA */}
        <Card className="p-12 text-center bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-primary/30">
          <h2 className="text-3xl font-bold mb-4">Still Need Help?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Our support team is available 24/7 to assist you with any questions or issues.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8">
              Contact Support
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Schedule a Call
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Support;
