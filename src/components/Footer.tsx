import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

const PAYMENT_ICON_SOURCES: Record<string, string[]> = {
  visa: [
    "https://cdn.simpleicons.org/visa/9ca3af",
    "https://cdn.simpleicons.org/visa/ffffff",
  ],
  mastercard: [
    "https://cdn.simpleicons.org/mastercard/9ca3af",
    "https://cdn.simpleicons.org/mastercard/ffffff",
  ],
  paypal: [
    "https://cdn.simpleicons.org/paypal/9ca3af",
    "https://cdn.simpleicons.org/paypal/ffffff",
  ],
};

type PaymentName = "visa" | "mastercard" | "paypal";

function PaymentIcon({ name, label }: { name: PaymentName; label: string }) {
  const sources = PAYMENT_ICON_SOURCES[name];
  return (
    <span className="inline-flex items-center justify-center w-12 h-6 opacity-60 hover:opacity-80 transition-opacity">
      <img
        src={sources[0]}
        alt={label}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="h-6 w-auto select-none pointer-events-none"
        onError={(e) => {
          const img = e.currentTarget;
          const current = img.getAttribute("data-idx") ? parseInt(img.getAttribute("data-idx")!, 10) : 0;
          const next = current + 1;
          if (sources[next]) {
            img.setAttribute("data-idx", String(next));
            img.src = sources[next];
          } else {
            img.style.display = "none";
          }
        }}
      />
    </span>
  );
}

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <Logo size="md" className="mb-4" />
            <p className="text-sm text-muted-foreground">
              Professional trading platform trusted by over 500,000 traders worldwide. 
              Trade with confidence on our regulated and secure platform.
            </p>
          </div>

          {/* Trading */}
          <div>
            <h4 className="font-semibold mb-4">Trading</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/markets/forex" className="hover:text-foreground transition-colors">Forex</Link></li>
              <li><Link to="/markets/stocks" className="hover:text-foreground transition-colors">Stocks</Link></li>
              <li><Link to="/markets/commodities" className="hover:text-foreground transition-colors">Commodities</Link></li>
              <li><Link to="/markets/crypto" className="hover:text-foreground transition-colors">Cryptocurrency</Link></li>
              <li><Link to="/markets/indices" className="hover:text-foreground transition-colors">Indices</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
              <li><Link to="/careers" className="hover:text-foreground transition-colors">Careers</Link></li>
              <li><Link to="/press" className="hover:text-foreground transition-colors">Press</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link to="/support" className="hover:text-foreground transition-colors">Support</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/terms" className="hover:text-foreground transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li><Link to="/cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link></li>
              <li><Link to="/risk-disclosure" className="hover:text-foreground transition-colors">Risk Disclosure</Link></li>
              <li><Link to="/regulatory" className="hover:text-foreground transition-colors">Regulatory</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground text-center md:text-left">
              <p className="mb-2">
                © {new Date().getFullYear()} Lexington Capital Investing. All rights reserved.
              </p>
              <p className="text-xs">
                Lexington Capital Investing operates under strict regulatory compliance. 
                Trading involves risk of loss.
              </p>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <PaymentIcon name="visa" label="Visa" />
              <PaymentIcon name="mastercard" label="Mastercard" />
              <PaymentIcon name="paypal" label="PayPal" />
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              <strong>Risk Warning:</strong> Trading leveraged products such as Forex and CFDs may not be suitable for all investors 
              as they carry a high degree of risk to your capital. 76% of retail investor accounts lose money when trading CFDs. 
              Please ensure you fully understand the risks involved and seek independent advice if necessary. 
              Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
