import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Briefcase, Heart, Zap, Globe, TrendingUp, Award } from "lucide-react";

const Careers = () => {
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
            Build Your Career at LCI
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Join a team of innovators, traders, and technologists shaping the future of financial markets.
          </p>
        </div>

        {/* Why Work Here */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Why Lexington Capital?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1">
              <Zap className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-xl font-bold mb-2">Innovation Culture</h3>
              <p className="text-muted-foreground">
                Work with cutting-edge technology and contribute to products used by millions of traders worldwide.
              </p>
            </Card>
            <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1">
              <Heart className="w-12 h-12 text-trading-danger mb-4" />
              <h3 className="text-xl font-bold mb-2">Work-Life Balance</h3>
              <p className="text-muted-foreground">
                Flexible hours, remote options, and generous time off to ensure you thrive both professionally and personally.
              </p>
            </Card>
            <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1">
              <TrendingUp className="w-12 h-12 text-trading-success mb-4" />
              <h3 className="text-xl font-bold mb-2">Growth Opportunities</h3>
              <p className="text-muted-foreground">
                Clear career progression paths, continuous learning programs, and mentorship from industry experts.
              </p>
            </Card>
          </div>
        </div>

        {/* Benefits */}
        <Card className="p-8 mb-16 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <h2 className="text-3xl font-bold mb-8 text-center">Benefits & Perks</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              "💰 Competitive salary and equity options",
              "🏥 Comprehensive health, dental, and vision coverage",
              "🏖️ Unlimited PTO and flexible working hours",
              "🏡 Remote-first culture with global teams",
              "📚 $5,000 annual learning and development budget",
              "💻 Latest tech equipment and tools",
              "🎉 Regular team events and offsites",
              "🍼 Generous parental leave policies",
              "🏋️ Gym membership and wellness programs",
              "🍽️ Catered meals and snacks in office",
              "🚀 Stock options and performance bonuses",
              "🌍 Relocation assistance for the right candidates"
            ].map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="text-2xl">{benefit.split(' ')[0]}</div>
                <p className="text-foreground/90">{benefit.split(' ').slice(1).join(' ')}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Open Positions */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Open Positions</h2>
          <div className="space-y-4">
            {[
              { title: "Senior Frontend Engineer", dept: "Engineering", location: "Remote / London", type: "Full-time" },
              { title: "Trading Platform Architect", dept: "Engineering", location: "New York", type: "Full-time" },
              { title: "Product Manager - Trading Tools", dept: "Product", location: "Remote", type: "Full-time" },
              { title: "Senior DevOps Engineer", dept: "Infrastructure", location: "Remote / Singapore", type: "Full-time" },
              { title: "Compliance Analyst", dept: "Legal & Compliance", location: "London", type: "Full-time" },
              { title: "UX/UI Designer", dept: "Design", location: "Remote", type: "Full-time" },
              { title: "Data Scientist - Trading Analytics", dept: "Data", location: "New York / Remote", type: "Full-time" },
              { title: "Customer Success Manager", dept: "Support", location: "Remote", type: "Full-time" }
            ].map((job, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {job.dept}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-4 h-4" />
                        {job.location}
                      </span>
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                        {job.type}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    Apply Now
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Company Culture */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Our Culture</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6 bg-gradient-to-br from-card to-card/50">
              <Award className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Excellence</h3>
              <p className="text-muted-foreground">
                We set high standards and support each other in achieving exceptional results. Every team member is empowered to make an impact.
              </p>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-card to-card/50">
              <Globe className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-xl font-bold mb-2">Diversity & Inclusion</h3>
              <p className="text-muted-foreground">
                We celebrate diverse perspectives and backgrounds. Our team spans 40+ countries, creating a rich, inclusive environment.
              </p>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <Card className="p-12 text-center bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-primary/30">
          <h2 className="text-3xl font-bold mb-4">Don't See the Right Role?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            We're always looking for exceptional talent. Send us your resume and let us know what you're passionate about.
          </p>
          <Button size="lg" className="text-lg px-8">
            Submit General Application
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Careers;
