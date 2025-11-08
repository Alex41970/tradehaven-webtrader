import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, FileCheck, Building, Scale } from "lucide-react";

const Regulatory = () => {
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
        {/* Hero */}
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Regulatory Information
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            TradePro is fully authorized and regulated by leading financial authorities worldwide, ensuring the highest standards of security and compliance.
          </p>
        </div>

        {/* Key Commitments */}
        <div className="grid md:grid-cols-4 gap-8 mb-16">
          <Card className="p-6 text-center hover:shadow-xl transition-all bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <Shield className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="font-bold mb-2">Client Fund Protection</h3>
            <p className="text-sm text-muted-foreground">Segregated accounts & insurance coverage</p>
          </Card>
          <Card className="p-6 text-center hover:shadow-xl transition-all bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <FileCheck className="w-12 h-12 mx-auto mb-4 text-accent" />
            <h3 className="font-bold mb-2">Regulatory Compliance</h3>
            <p className="text-sm text-muted-foreground">Full adherence to all regulations</p>
          </Card>
          <Card className="p-6 text-center hover:shadow-xl transition-all bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <Building className="w-12 h-12 mx-auto mb-4 text-trading-success" />
            <h3 className="font-bold mb-2">Audited & Transparent</h3>
            <p className="text-sm text-muted-foreground">Regular third-party audits</p>
          </Card>
          <Card className="p-6 text-center hover:shadow-xl transition-all bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <Scale className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="font-bold mb-2">Fair Trading</h3>
            <p className="text-sm text-muted-foreground">Best execution & no conflicts</p>
          </Card>
        </div>

        {/* Regulatory Licenses */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Our Regulatory Licenses</h2>
          <div className="space-y-6">
            <Card className="p-8 hover:shadow-lg transition-all border-primary/20">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/4">
                  <div className="bg-primary/20 rounded-lg p-6 h-full flex items-center justify-center">
                    <Shield className="w-16 h-16 text-primary" />
                  </div>
                </div>
                <div className="md:w-3/4">
                  <h3 className="text-2xl font-bold mb-2">United Kingdom - FCA</h3>
                  <p className="text-muted-foreground mb-4">Financial Conduct Authority</p>
                  <div className="space-y-2 text-sm">
                    <p><strong>Entity:</strong> TradePro UK Limited</p>
                    <p><strong>Registration:</strong> Authorized and regulated by the FCA</p>
                    <p><strong>License Number:</strong> FCA 987654</p>
                    <p><strong>Address:</strong> 123 Financial District, Canary Wharf, London E14 5AB, UK</p>
                    <p className="text-foreground/90 mt-4">
                      The FCA is the primary regulator for financial services firms in the UK, ensuring consumer protection and market integrity.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-all border-primary/20">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/4">
                  <div className="bg-accent/20 rounded-lg p-6 h-full flex items-center justify-center">
                    <Shield className="w-16 h-16 text-accent" />
                  </div>
                </div>
                <div className="md:w-3/4">
                  <h3 className="text-2xl font-bold mb-2">Cyprus - CySEC</h3>
                  <p className="text-muted-foreground mb-4">Cyprus Securities and Exchange Commission</p>
                  <div className="space-y-2 text-sm">
                    <p><strong>Entity:</strong> TradePro (CY) Limited</p>
                    <p><strong>Registration:</strong> Licensed and regulated by CySEC</p>
                    <p><strong>License Number:</strong> CySEC 123/45</p>
                    <p><strong>Address:</strong> 456 Limassol Avenue, Limassol 3030, Cyprus</p>
                    <p className="text-foreground/90 mt-4">
                      CySEC regulation provides EU-wide regulatory coverage through MiFID II passporting rights.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-all border-primary/20">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/4">
                  <div className="bg-trading-success/20 rounded-lg p-6 h-full flex items-center justify-center">
                    <Shield className="w-16 h-16 text-trading-success" />
                  </div>
                </div>
                <div className="md:w-3/4">
                  <h3 className="text-2xl font-bold mb-2">Australia - ASIC</h3>
                  <p className="text-muted-foreground mb-4">Australian Securities and Investments Commission</p>
                  <div className="space-y-2 text-sm">
                    <p><strong>Entity:</strong> TradePro Australia Pty Ltd</p>
                    <p><strong>Registration:</strong> Authorized and regulated by ASIC</p>
                    <p><strong>AFSL Number:</strong> 456789</p>
                    <p><strong>Address:</strong> 789 Collins Street, Melbourne VIC 3000, Australia</p>
                    <p className="text-foreground/90 mt-4">
                      ASIC ensures financial markets operate fairly, transparently, and efficiently for Australian investors.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Client Protection */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Client Protection Measures</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4 text-primary">Segregated Client Funds</h3>
              <p className="text-muted-foreground mb-4">
                All client funds are held in segregated accounts with tier-1 banks, completely separate from TradePro's operational funds. This ensures your money is protected even in the unlikely event of company insolvency.
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-foreground/90">
                <li>Held with top-rated financial institutions</li>
                <li>Daily reconciliation and monitoring</li>
                <li>Cannot be used for company operations</li>
                <li>Protected in insolvency scenarios</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4 text-primary">Investor Compensation Schemes</h3>
              <p className="text-muted-foreground mb-4">
                Eligible clients are covered by investor compensation schemes that provide additional protection:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-foreground/90">
                <li>UK: FSCS coverage up to £85,000</li>
                <li>EU: ICF coverage up to €20,000</li>
                <li>Australia: Australian investor protections</li>
                <li>Coverage applies if we cannot meet obligations</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4 text-primary">Negative Balance Protection</h3>
              <p className="text-muted-foreground mb-4">
                Retail clients benefit from negative balance protection, meaning you cannot lose more than your account balance.
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-foreground/90">
                <li>Available for all retail clients</li>
                <li>Automatic protection on all accounts</li>
                <li>No additional debt liability</li>
                <li>Peace of mind when trading</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4 text-primary">Regular Audits & Reporting</h3>
              <p className="text-muted-foreground mb-4">
                We undergo regular independent audits and submit detailed reports to our regulators:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-foreground/90">
                <li>Annual financial audits by Big Four firms</li>
                <li>Quarterly regulatory reporting</li>
                <li>Capital adequacy monitoring</li>
                <li>Compliance and risk assessments</li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Compliance Commitments */}
        <Card className="p-8 mb-16 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <h2 className="text-2xl font-bold mb-6 text-center">Our Compliance Commitments</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold mb-2 text-accent">Anti-Money Laundering (AML)</h4>
              <p className="text-sm text-muted-foreground">
                Strict KYC procedures and transaction monitoring to prevent financial crime and comply with AML regulations.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-accent">Best Execution</h4>
              <p className="text-sm text-muted-foreground">
                We are committed to obtaining the best possible results for clients when executing orders.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-accent">Data Protection</h4>
              <p className="text-sm text-muted-foreground">
                Full compliance with GDPR and data protection laws to safeguard your personal information.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-accent">Conflict of Interest</h4>
              <p className="text-sm text-muted-foreground">
                We maintain policies to identify, prevent, and manage conflicts of interest in client dealings.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-accent">Market Conduct</h4>
              <p className="text-sm text-muted-foreground">
                Adherence to all market conduct rules to ensure fair and transparent trading conditions.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-accent">Client Categorization</h4>
              <p className="text-sm text-muted-foreground">
                Appropriate categorization of clients with corresponding levels of regulatory protection.
              </p>
            </div>
          </div>
        </Card>

        {/* Regulatory Documents */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Regulatory Documents</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "Terms of Business", desc: "Our complete terms and conditions" },
              { title: "Risk Disclosure", desc: "Important risk warnings and disclosures" },
              { title: "Privacy Policy", desc: "How we handle your personal data" },
              { title: "Conflicts of Interest Policy", desc: "How we manage conflicts" },
              { title: "Order Execution Policy", desc: "Our approach to executing client orders" },
              { title: "Complaints Procedure", desc: "How to raise a complaint" }
            ].map((doc, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-start gap-4">
                  <FileCheck className="w-8 h-8 text-primary group-hover:text-accent transition-colors" />
                  <div className="flex-1">
                    <h3 className="font-bold mb-1 group-hover:text-primary transition-colors">{doc.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{doc.desc}</p>
                    <Button variant="link" className="p-0 h-auto text-sm">
                      Download PDF →
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Contact */}
        <Card className="p-12 text-center bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-primary/30">
          <h2 className="text-3xl font-bold mb-4">Questions About Regulation?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Our compliance team is available to answer any questions about our regulatory status or client protection measures.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact">
              <Button size="lg" className="text-lg px-8">
                Contact Compliance Team
              </Button>
            </Link>
            <Link to="/risk-disclosure">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Read Risk Disclosure
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Regulatory;
