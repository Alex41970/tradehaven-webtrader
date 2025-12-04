import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
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

        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Lexington Capital Investing ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our trading platform and services. 
              By using our platform, you consent to the data practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">2.1 Personal Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We collect personal information that you provide to us, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Full name and date of birth</li>
              <li>Email address and phone number</li>
              <li>Residential address</li>
              <li>Government-issued identification documents</li>
              <li>Financial information (bank accounts, payment methods)</li>
              <li>Employment and income information</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Trading Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We automatically collect information about your trading activity:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Trade history and positions</li>
              <li>Account balance and transaction records</li>
              <li>Platform usage and preferences</li>
              <li>Risk management settings</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Technical Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We collect technical data including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>IP address and device information</li>
              <li>Browser type and operating system</li>
              <li>Login timestamps and access logs</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>To create and manage your trading account</li>
              <li>To process your transactions and orders</li>
              <li>To verify your identity and prevent fraud (KYC/AML compliance)</li>
              <li>To provide customer support and respond to inquiries</li>
              <li>To improve our platform and services</li>
              <li>To send important updates and notifications</li>
              <li>To comply with legal and regulatory requirements</li>
              <li>To detect and prevent unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We may share your information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Service Providers:</strong> Third-party companies that help us operate our platform (payment processors, identity verification services)</li>
              <li><strong>Regulatory Authorities:</strong> Financial regulators, law enforcement, and government agencies when required by law</li>
              <li><strong>Legal Advisors:</strong> Lawyers and auditors for compliance and legal purposes</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              We do not sell your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We implement robust security measures to protect your information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>256-bit SSL encryption for all data transmission</li>
              <li>Secure data centers with physical security controls</li>
              <li>Multi-factor authentication options</li>
              <li>Regular security audits and penetration testing</li>
              <li>Employee access controls and confidentiality agreements</li>
              <li>Automated fraud detection systems</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as necessary to provide our services and comply with legal obligations. 
              Typically, we retain account data for 7 years after account closure to meet regulatory requirements. Trading records 
              and transaction history are retained in accordance with financial services regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Your Rights (GDPR Compliance)</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Under the General Data Protection Regulation (GDPR), you have the following rights:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
              <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your data (subject to legal requirements)</li>
              <li><strong>Right to Restriction:</strong> Limit how we process your data</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a structured format</li>
              <li><strong>Right to Object:</strong> Object to certain types of processing</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise any of these rights, please contact our Data Protection Officer at privacy@lexingtoncapital.com
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Cookies and Tracking Technologies</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We use cookies and similar technologies to enhance your experience. Types of cookies we use:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Essential Cookies:</strong> Required for platform functionality</li>
              <li><strong>Performance Cookies:</strong> Help us understand how users interact with our platform</li>
              <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
              <li><strong>Analytics Cookies:</strong> Provide insights into platform usage</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              You can control cookies through your browser settings, but disabling certain cookies may limit platform functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. We ensure 
              that such transfers comply with applicable data protection laws and implement appropriate safeguards such as 
              Standard Contractual Clauses approved by the European Commission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information 
              from children. If we become aware that we have collected data from a child, we will take steps to delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. 
              We will notify you of any material changes via email or through a prominent notice on our platform. The "Last Updated" 
              date at the top of this policy indicates when it was last revised.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="mt-4 p-4 bg-muted/30 rounded-lg space-y-2">
              <p className="text-muted-foreground"><strong>Data Protection Officer</strong></p>
              <p className="text-muted-foreground">Email: privacy@lexingtoncapital.com</p>
              <p className="text-muted-foreground">Phone: +1 (631) 555-0100</p>
              <p className="text-muted-foreground">Address: 585 Bicycle Path, 11776, Port Jefferson Station, United States</p>
            </div>
          </section>

          <section className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Regulatory Information:</strong> Lexington Capital Investing is authorized and regulated by the Financial 
              Conduct Authority (FCA) under registration number FRN 600410. We are committed to maintaining the highest standards 
              of data protection and privacy in accordance with applicable data protection laws.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;