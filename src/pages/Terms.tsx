import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <h1 className="text-4xl font-bold mb-4">Terms and Conditions</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using Lexington Capital Investing ("the Platform"), you accept and agree to be bound by these Terms and Conditions. 
              If you do not agree to these terms, you may not access or use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Services Description</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Lexington Capital Investing provides an online trading platform that allows users to trade various financial instruments including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Foreign Exchange (Forex)</li>
              <li>Stocks and Equities</li>
              <li>Commodities</li>
              <li>Cryptocurrencies</li>
              <li>Indices and Derivatives</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Eligibility and Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              To use our services, you must:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into binding contracts</li>
              <li>Not be a resident of a restricted jurisdiction</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Risk Disclosure</h2>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
              <p className="font-semibold text-destructive mb-3">Important Risk Warning</p>
              <p className="text-muted-foreground leading-relaxed">
                Trading financial instruments carries a high level of risk and may not be suitable for all investors. 
                You could lose some or all of your initial investment. Past performance is not indicative of future results. 
                Before trading, you should carefully consider your investment objectives, experience level, and risk appetite. 
                76% of retail investor accounts lose money when trading CFDs with this provider.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. User Obligations</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              As a user of our platform, you agree to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Comply with all applicable laws and regulations</li>
              <li>Not engage in market manipulation or fraudulent activities</li>
              <li>Not use the platform for money laundering or terrorist financing</li>
              <li>Maintain sufficient funds in your account to cover your trading positions</li>
              <li>Immediately notify us of any unauthorized use of your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Fees and Charges</h2>
            <p className="text-muted-foreground leading-relaxed">
              Trading on our platform may be subject to various fees including spreads, commissions, overnight financing charges, 
              and withdrawal fees. All applicable fees are disclosed on our website and trading platform. We reserve the right to 
              modify our fee structure with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Deposits and Withdrawals</h2>
            <p className="text-muted-foreground leading-relaxed">
              All deposits and withdrawals are processed in accordance with our payment policies. We reserve the right to request 
              additional documentation to verify your identity and prevent fraud. Withdrawal requests may take 1-5 business days 
              to process depending on your payment method.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Lexington Capital Investing shall not be liable for any indirect, incidental, 
              special, consequential, or punitive damages arising from your use of our services. Our total liability shall not exceed 
              the fees paid by you in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content, trademarks, and intellectual property on the platform are owned by Lexington Capital Investing or our 
              licensors. You may not reproduce, distribute, or create derivative works without our express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your account at any time for violation of these terms or for any other 
              reason at our sole discretion. Upon termination, you must close all open positions and withdraw your funds.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms and Conditions shall be governed by and construed in accordance with the laws of the United Kingdom. 
              Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify you of any material changes via email or 
              through the platform. Your continued use of our services after such modifications constitutes acceptance of the 
              updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms and Conditions, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">Email: legal@lexingtoncapital.com</p>
              <p className="text-muted-foreground">Address: 123 Financial District, London, EC2N 1HQ, United Kingdom</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
