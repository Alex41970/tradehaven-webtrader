import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Globe, Shield, TrendingUp, Users, Award } from "lucide-react";

const AboutUs = () => {
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
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            About Lexington Capital
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Leading the future of digital trading with innovative technology, unmatched security, and a commitment to trader success since 2015.
          </p>
        </div>

        {/* Mission Section */}
        <Card className="p-8 mb-16 bg-gradient-to-br from-card to-card/50 border-primary/20">
          <h2 className="text-3xl font-bold mb-4 text-primary">Our Mission</h2>
          <p className="text-lg text-foreground/90 leading-relaxed">
            To democratize financial markets by providing cutting-edge trading technology, transparent pricing, and world-class education to traders worldwide. We believe everyone deserves access to professional-grade trading tools and resources, regardless of their experience level or location.
          </p>
        </Card>

        {/* Values Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Our Core Values</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 bg-card border-border/40">
              <Shield className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Security First</h3>
              <p className="text-muted-foreground">
                Bank-level encryption and segregated accounts to protect your funds and data at all times.
              </p>
            </Card>
            <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 bg-card border-border/40">
              <TrendingUp className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-xl font-bold mb-2">Innovation</h3>
              <p className="text-muted-foreground">
                Constantly evolving our platform with the latest technology and market insights.
              </p>
            </Card>
            <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 bg-card border-border/40">
              <Users className="w-12 h-12 text-trading-success mb-4" />
              <h3 className="text-xl font-bold mb-2">Client Success</h3>
              <p className="text-muted-foreground">
                Your success is our success. We provide 24/7 support and comprehensive education.
              </p>
            </Card>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Our Journey</h2>
          <div className="space-y-8 relative before:absolute before:left-8 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary/30">
            {[
              { year: "2015", title: "Founded", desc: "Lexington Capital established with a vision to revolutionize online trading" },
              { year: "2017", title: "100K Users", desc: "Reached 100,000 active traders across 50 countries" },
              { year: "2019", title: "Advanced Platform", desc: "Launched AI-powered trading analytics and automated strategies" },
              { year: "2021", title: "1M Users", desc: "Surpassed 1 million traders and $50B in monthly volume" },
              { year: "2023", title: "Industry Leader", desc: "Recognized as top trading platform with multiple awards" },
              { year: "2024", title: "Global Expansion", desc: "Expanded to 120+ countries with localized support" }
            ].map((milestone, index) => (
              <div key={index} className="flex gap-8 items-start pl-20">
                <div className="absolute left-0 w-16 h-16 rounded-full bg-primary/20 border-4 border-primary flex items-center justify-center font-bold text-sm">
                  {milestone.year}
                </div>
                <Card className="flex-1 p-6 bg-card/50 border-primary/20">
                  <h3 className="text-xl font-bold mb-2">{milestone.title}</h3>
                  <p className="text-muted-foreground">{milestone.desc}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-8 mb-16">
          {[
            { icon: Users, value: "2M+", label: "Active Traders" },
            { icon: Globe, value: "120+", label: "Countries" },
            { icon: TrendingUp, value: "$100B+", label: "Monthly Volume" },
            { icon: Award, value: "15+", label: "Industry Awards" }
          ].map((stat, index) => (
            <Card key={index} className="p-6 text-center bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
              <stat.icon className="w-12 h-12 mx-auto mb-4 text-primary" />
              <div className="text-3xl font-bold text-primary mb-2">{stat.value}</div>
              <div className="text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Leadership Team */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Leadership Team</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Sarah Chen", role: "CEO & Co-Founder", bio: "Former Goldman Sachs executive with 20+ years in fintech" },
              { name: "Michael Rodriguez", role: "CTO", bio: "Ex-Google engineer specializing in high-frequency trading systems" },
              { name: "Emily Watson", role: "Head of Compliance", bio: "15 years experience in financial regulation and risk management" }
            ].map((member, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-xl transition-all bg-card">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent mx-auto mb-4"></div>
                <h3 className="text-xl font-bold mb-1">{member.name}</h3>
                <p className="text-primary text-sm mb-3">{member.role}</p>
                <p className="text-muted-foreground text-sm">{member.bio}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Card className="p-12 text-center bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-primary/30">
          <h2 className="text-3xl font-bold mb-4">Join Our Global Community</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Start trading with confidence on a platform trusted by millions worldwide.
          </p>
          <Link to="/auth">
            <Button size="lg" className="text-lg px-8">
              Get Started Today
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
};

export default AboutUs;
