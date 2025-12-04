import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const CookiePolicy = () => {
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

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Cookie Policy</h1>
          <p className="text-muted-foreground mb-8">Last Updated: January 1, 2024</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <Card className="p-6 bg-primary/10 border-primary/20">
              <p className="text-foreground/90 leading-relaxed mb-0">
                This Cookie Policy explains how Lexington Capital Investing ("we", "us", or "our") uses cookies and similar technologies when you visit our website and use our services.
              </p>
            </Card>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">1. What Are Cookies?</h2>
              <p className="text-foreground/90 leading-relaxed">
                Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently, provide reporting information, and improve user experience.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">2. Types of Cookies We Use</h2>
              
              <h3 className="text-xl font-semibold mb-3 text-accent">Essential Cookies</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                These cookies are necessary for the website to function properly. They enable core functionality such as security, network management, and accessibility. You cannot opt out of these cookies as they are required for the service to work.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">Performance Cookies</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                These cookies collect information about how visitors use our website, such as which pages are visited most often. This data helps us optimize our website and improve user experience.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">Functional Cookies</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                These cookies allow our website to remember choices you make (such as your username, language, or region) and provide enhanced, personalized features.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">Targeting/Advertising Cookies</h3>
              <p className="text-foreground/90 leading-relaxed">
                These cookies are used to deliver advertisements more relevant to you and your interests. They also help measure the effectiveness of advertising campaigns.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">3. Third-Party Cookies</h2>
              <p className="text-foreground/90 leading-relaxed mb-4">
                We may also use third-party services that use cookies, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li>Google Analytics for website analytics</li>
                <li>Social media platforms for social sharing features</li>
                <li>Payment processors for secure transactions</li>
                <li>Customer support tools for live chat functionality</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">4. Cookie Duration</h2>
              <p className="text-foreground/90 leading-relaxed mb-4">
                Cookies can be either session cookies or persistent cookies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li><strong>Session Cookies:</strong> Temporary cookies that expire when you close your browser</li>
                <li><strong>Persistent Cookies:</strong> Cookies that remain on your device for a set period or until you delete them</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">5. Managing Cookies</h2>
              <p className="text-foreground/90 leading-relaxed mb-4">
                You have the right to accept or reject cookies. You can manage your cookie preferences through:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li>Our cookie consent banner when you first visit our website</li>
                <li>Your browser settings - most browsers allow you to refuse or accept cookies</li>
                <li>Third-party opt-out tools for specific services</li>
              </ul>
              <p className="text-foreground/90 leading-relaxed mt-4">
                Please note that blocking essential cookies may affect your ability to use certain features of our website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">6. Browser-Specific Cookie Management</h2>
              <p className="text-foreground/90 leading-relaxed mb-4">
                To manage cookies in popular browsers:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li><strong>Google Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
                <li><strong>Firefox:</strong> Options → Privacy & Security → Cookies and Site Data</li>
                <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
                <li><strong>Edge:</strong> Settings → Cookies and site permissions → Cookies and site data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">7. Updates to This Policy</h2>
              <p className="text-foreground/90 leading-relaxed">
                We may update this Cookie Policy from time to time to reflect changes in technology, legislation, our operations, or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on our website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">8. Contact Us</h2>
              <p className="text-foreground/90 leading-relaxed">
                If you have any questions about our use of cookies or this Cookie Policy, please contact us at:
              </p>
              <Card className="p-6 mt-4 bg-card/50">
                <p className="text-foreground/90">
                  <strong>Email:</strong> privacy@lexingtoncapitalinvesting.com<br />
                  <strong>Address:</strong> 585 Bicycle Path, 11776, Port Jefferson Station, United States<br />
                  <strong>Phone:</strong> +1 (343) 304-0557 | +44 20 8040 4627
                </p>
              </Card>
            </section>

            <Card className="p-6 bg-accent/10 border-accent/20 mt-8">
              <p className="text-foreground/90 leading-relaxed mb-0">
                By continuing to use our website, you consent to our use of cookies in accordance with this Cookie Policy.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;