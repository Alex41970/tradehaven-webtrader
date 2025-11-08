import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const RiskDisclosure = () => {
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

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="animate-fade-in">
          <div className="flex items-center gap-4 mb-4">
            <AlertTriangle className="w-12 h-12 text-trading-danger" />
            <h1 className="text-4xl md:text-5xl font-bold">Risk Disclosure</h1>
          </div>
          <p className="text-muted-foreground mb-8">Last Updated: January 1, 2024</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <Card className="p-6 bg-trading-danger/10 border-trading-danger/30">
              <p className="text-foreground font-semibold mb-0">
                ⚠️ IMPORTANT WARNING: Trading leveraged products such as CFDs, Forex, and derivatives carries a high level of risk and may not be suitable for all investors. You could lose substantially more than your initial investment.
              </p>
            </Card>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">General Risk Warning</h2>
              <p className="text-foreground/90 leading-relaxed">
                Before you decide to trade leveraged financial products offered by TradePro, you should carefully consider your investment objectives, level of experience, and risk appetite. There is a possibility that you may sustain a loss of some or all of your initial investment, and therefore you should not invest money that you cannot afford to lose.
              </p>
              <p className="text-foreground/90 leading-relaxed mt-4">
                You should be aware of all the risks associated with trading leveraged products and seek advice from an independent financial advisor if you have any doubts.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">Specific Risks</h2>
              
              <h3 className="text-xl font-semibold mb-3 text-accent">1. Leverage Risk</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                Leverage can magnify both your profits and your losses. A small market movement can have a proportionately larger impact on the funds you have deposited or will have to deposit. This means you could lose more than your initial investment. You should ensure you understand how leverage works and that you are comfortable with the level of risk involved.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">2. Market Volatility</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                Financial markets can be extremely volatile. Prices can change rapidly, and in ways that are difficult to predict. Past performance is not indicative of future results. Market volatility can result in significant losses over a short period of time.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">3. Margin Calls and Liquidation</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                When trading on margin, if the market moves against your position, you may be required to deposit additional funds to maintain your position. Failure to do so may result in your position being liquidated at a loss, and you will be liable for any resulting deficit in your account.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">4. Currency Risk</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                If you trade in a currency other than your base currency, exchange rate fluctuations can affect your profits and losses. Currency values can be highly volatile and can change quickly due to economic, political, or other factors.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">5. Liquidity Risk</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                Under certain market conditions, it may be difficult or impossible to liquidate a position. This can occur, for example, at times of rapid price movement, if the price rises or falls in one trading session to such an extent that trading is restricted or suspended.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">6. System and Technology Risks</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                Trading through an online platform carries risks related to system access, response times, and security. System failures or delays may affect your ability to execute trades and manage risk effectively. While we maintain robust systems, technical issues can occur.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">7. Counterparty Risk</h3>
              <p className="text-foreground/90 leading-relaxed">
                When you trade with TradePro, you are exposed to our creditworthiness as your counterparty. While client funds are held in segregated accounts and we maintain strong capital reserves, there is a risk that we may not be able to meet our obligations in extreme circumstances.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">Product-Specific Risks</h2>
              
              <h3 className="text-xl font-semibold mb-3 text-accent">Contracts for Difference (CFDs)</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. Between 74-89% of retail investor accounts lose money when trading CFDs. You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">Forex Trading</h3>
              <p className="text-foreground/90 leading-relaxed mb-4">
                Forex trading involves substantial risk of loss and is not suitable for all investors. The high degree of leverage can work against you as well as for you. You should be aware that no trading system can guarantee profits.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-accent">Cryptocurrency Trading</h3>
              <p className="text-foreground/90 leading-relaxed">
                Cryptocurrencies are highly volatile and speculative. They are not backed by any government or central bank. Cryptocurrency markets can be affected by regulatory changes, security breaches, and technological issues. You could lose your entire investment.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">Risk Management</h2>
              <p className="text-foreground/90 leading-relaxed mb-4">
                To help manage risk, we recommend:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li>Never invest more than you can afford to lose</li>
                <li>Use stop-loss orders to limit potential losses</li>
                <li>Diversify your portfolio across different instruments</li>
                <li>Start with a demo account to practice before risking real money</li>
                <li>Continuously educate yourself about the markets and trading strategies</li>
                <li>Monitor your positions regularly and be prepared to act quickly</li>
                <li>Use appropriate leverage levels based on your risk tolerance</li>
                <li>Keep emotions out of trading decisions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">No Investment Advice</h2>
              <p className="text-foreground/90 leading-relaxed">
                The information provided by TradePro is for general information purposes only and should not be considered as investment advice. We do not provide personal recommendations or advice on the merits of any particular trade. You are solely responsible for your trading decisions and should seek independent financial advice if you have any doubts.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">Past Performance</h2>
              <p className="text-foreground/90 leading-relaxed">
                Past performance is not a reliable indicator of future results. Historical returns, backtesting results, and examples shown on our website are for illustrative purposes only and do not guarantee future performance. Market conditions can change rapidly, and previous success does not ensure future profits.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">Regulatory Information</h2>
              <p className="text-foreground/90 leading-relaxed">
                TradePro is authorized and regulated by major financial authorities. However, regulatory protection varies by jurisdiction. Please refer to our <Link to="/regulatory" className="text-primary hover:underline">Regulatory Information</Link> page for details about the protections available in your region.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">Client Categorization</h2>
              <p className="text-foreground/90 leading-relaxed">
                Clients are categorized as Retail, Professional, or Eligible Counterparties. The level of regulatory protection varies by category, with retail clients receiving the highest level of protection. Professional clients and eligible counterparties may receive reduced protection.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4 text-primary">Contact Us</h2>
              <p className="text-foreground/90 leading-relaxed">
                If you have any questions about the risks involved in trading, please contact us:
              </p>
              <Card className="p-6 mt-4 bg-card/50">
                <p className="text-foreground/90">
                  <strong>Email:</strong> risk@tradepro.com<br />
                  <strong>Phone:</strong> +44 20 1234 5678<br />
                  <strong>Address:</strong> 123 Financial District, Canary Wharf, London E14 5AB, UK
                </p>
              </Card>
            </section>

            <Card className="p-6 bg-trading-danger/10 border-trading-danger/30 mt-8">
              <p className="text-foreground font-semibold mb-4">
                By opening an account and trading with TradePro, you acknowledge that you have read, understood, and accepted this Risk Disclosure statement.
              </p>
              <p className="text-foreground/90 mb-0">
                Trading leveraged products is not suitable for everyone. Please ensure you fully understand the risks involved and seek independent advice if necessary.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskDisclosure;
