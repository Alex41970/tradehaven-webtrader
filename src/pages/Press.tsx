import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Award, Download, Mail } from "lucide-react";

const Press = () => {
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
            Press & Media
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Latest news, press releases, and media coverage about Lexington Capital Investing.
          </p>
        </div>

        {/* Press Contact */}
        <Card className="p-8 mb-16 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Mail className="w-12 h-12 text-primary" />
              <div>
                <h3 className="text-xl font-bold mb-1">Media Inquiries</h3>
                <p className="text-muted-foreground">For press inquiries, contact our media team</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="font-semibold mb-1">press@lexingtoncapital.com</p>
              <p className="text-sm text-muted-foreground">Response within 24 hours</p>
            </div>
          </div>
        </Card>

        {/* Latest Press Releases */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Latest Press Releases</h2>
          <div className="space-y-6">
            {[
              {
                date: "January 15, 2024",
                title: "Lexington Capital Surpasses 2 Million Active Traders Milestone",
                excerpt: "Leading trading platform celebrates significant growth with users across 120+ countries and $100B+ in monthly trading volume.",
                category: "Company News"
              },
              {
                date: "December 3, 2023",
                title: "Lexington Capital Launches AI-Powered Trading Assistant",
                excerpt: "Revolutionary new feature uses advanced machine learning to provide personalized trading insights and strategy recommendations.",
                category: "Product Launch"
              },
              {
                date: "October 20, 2023",
                title: "Lexington Capital Wins 'Best Trading Platform 2023' Award",
                excerpt: "Industry recognition for innovation, user experience, and customer satisfaction from Global Finance Awards.",
                category: "Awards"
              },
              {
                date: "September 8, 2023",
                title: "Lexington Capital Expands to Asian Markets with Singapore Office",
                excerpt: "Strategic expansion includes new regional headquarters and 24/7 multilingual support for Asian traders.",
                category: "Expansion"
              }
            ].map((release, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{release.date}</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                      {release.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                    {release.title}
                  </h3>
                  <p className="text-muted-foreground">{release.excerpt}</p>
                  <Button variant="link" className="self-start p-0 h-auto">
                    Read full release →
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Awards & Recognition */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Awards & Recognition</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { year: "2023", award: "Best Trading Platform", organization: "Global Finance Awards" },
              { year: "2023", award: "Innovation in Fintech", organization: "TechCrunch Disrupt" },
              { year: "2022", award: "Customer Choice Award", organization: "Trustpilot" },
              { year: "2022", award: "Top Broker", organization: "ForexBrokers.com" },
              { year: "2021", award: "Best Mobile App", organization: "App Excellence Awards" },
              { year: "2021", award: "Rising Star in Fintech", organization: "European FinTech Awards" }
            ].map((item, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-xl transition-all bg-gradient-to-br from-card to-card/50">
                <Award className="w-12 h-12 mx-auto mb-4 text-accent" />
                <div className="text-3xl font-bold text-primary mb-2">{item.year}</div>
                <h3 className="font-bold mb-1">{item.award}</h3>
                <p className="text-sm text-muted-foreground">{item.organization}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Media Coverage */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Featured In</h2>
          <Card className="p-8 bg-gradient-to-br from-card to-card/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
              {["Bloomberg", "Reuters", "TechCrunch", "Forbes", "Financial Times", "CNBC", "WSJ", "The Guardian"].map((outlet, index) => (
                <div key={index} className="text-center font-bold text-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {outlet}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Press Kit */}
        <Card className="p-12 text-center bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-primary/30">
          <Download className="w-16 h-16 mx-auto mb-6 text-primary" />
          <h2 className="text-3xl font-bold mb-4">Press Kit</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Download our official press kit including logos, brand assets, executive photos, and company information.
          </p>
          <Button size="lg" className="text-lg px-8">
            Download Press Kit (12 MB)
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Press;
