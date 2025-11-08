import { Link } from "react-router-dom";
import { TrendingUp, Twitter, Linkedin, Facebook, Instagram } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="h-8 w-8 bg-gradient-to-br from-trading-primary to-trading-accent rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold">LCI</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Professional trading platform trusted by over 500,000 traders worldwide. 
              Trade with confidence on our regulated and secure platform.
            </p>
            <div className="flex space-x-3">
              <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Trading */}
          <div>
            <h4 className="font-semibold mb-4">Trading</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Forex</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Stocks</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Commodities</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Cryptocurrency</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Indices</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Press</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
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
              <li><a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Risk Disclosure</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Regulatory</a></li>
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
                Lexington Capital Investing is authorized and regulated by the FCA (FRN 123456). 
                Trading involves risk of loss.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Visa_2021.svg/320px-Visa_2021.svg.png" alt="Visa" className="h-6 opacity-50" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/320px-Mastercard-logo.svg.png" alt="Mastercard" className="h-6 opacity-50" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/320px-PayPal.svg.png" alt="PayPal" className="h-6 opacity-50" />
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              <strong>Risk Warning:</strong> Trading leveraged products such as Forex and CFDs may not be suitable for all investors 
              as they carry a high degree of risk to your capital. 76% of retail investor accounts lose money when trading CFDs with 
              this provider. Please ensure you fully understand the risks involved and seek independent advice if necessary. 
              Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
