import { AlertTriangle } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function RiskDisclaimer() {
  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <SEO 
        title="Risk Disclaimer | TradifyApp"
        description="Important risk disclosure for TradifyApp users. Trading forex and CFDs involves substantial risk. Read our full risk disclaimer before trading."
        canonical="https://tradifyapp.com/risk-disclaimer"
      />
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="text-rose-500 h-8 w-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Risk Disclaimer</h1>
      </div>
      
      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-sm text-slate-500">Last updated: February 3, 2026</p>
        
        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl mb-8">
          <p className="text-rose-500 font-bold uppercase tracking-widest text-sm mb-2">High Risk Warning</p>
          <p className="text-white font-medium">Trading foreign exchange (Forex), contracts for difference (CFDs), cryptocurrencies, and other financial instruments on margin carries a high level of risk and may not be suitable for all investors. The high degree of leverage available in these markets can work against you as well as for you. Before deciding to trade, you should carefully consider your investment objectives, level of experience, and risk appetite.</p>
        </div>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">1. General Risk Warning</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Trading financial instruments involves substantial risk of loss and is not suitable for every investor.</li>
            <li>You could lose some or all of your initial investment; do not invest money you cannot afford to lose.</li>
            <li>Past performance is not indicative of future results.</li>
            <li>High volatility in financial markets can result in significant and rapid losses.</li>
            <li>Leveraged products amplify both potential gains and potential losses.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">2. Platform Disclaimer</h2>
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
            <p className="font-semibold text-white mb-3">TRADIFY IS A JOURNALING AND ANALYTICS PLATFORM ONLY. WE EXPRESSLY DISCLAIM:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Any responsibility for your trading decisions or their outcomes.</li>
              <li>Any claim that our platform provides financial, investment, or trading advice.</li>
              <li>Any guarantee of accuracy in data displayed, including MT5 synced data.</li>
              <li>Any representation that using our platform will result in profits or prevent losses.</li>
              <li>Any liability for losses incurred while using our Service.</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">3. No Financial Advice</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Nothing on this platform constitutes financial, investment, legal, or tax advice.</li>
            <li>All content, including AI-generated analysis, is for <strong className="text-white">educational and informational purposes only</strong>.</li>
            <li>Strategy validation tools and rule engines do not guarantee trading success.</li>
            <li>Performance metrics and statistics are historical data and do not predict future outcomes.</li>
            <li>You should consult with qualified professionals before making any financial decisions.</li>
            <li>We are not registered as investment advisors, broker-dealers, or financial planners.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">4. Performance Disclaimers</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">No Guarantees:</strong> There is no guarantee that any strategy, indicator, or analysis will result in profits.</li>
            <li><strong className="text-white">Hypothetical Results:</strong> Any simulated or backtested results have inherent limitations and do not represent actual trading.</li>
            <li><strong className="text-white">Individual Results Vary:</strong> Trading outcomes depend on numerous factors including skill, experience, market conditions, and risk management.</li>
            <li><strong className="text-white">Market Conditions:</strong> Markets can be unpredictable; strategies that worked historically may not work in the future.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">5. Leverage and Margin Trading Risks</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Leverage allows you to control large positions with small capital, magnifying both profits and losses.</li>
            <li>Margin calls can force liquidation of positions at unfavorable prices.</li>
            <li>You may lose more than your initial deposit in leveraged trading.</li>
            <li>Stop-loss orders may not always execute at the intended price during volatile conditions.</li>
            <li>Overnight positions carry additional risks including gaps and swap charges.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">6. Market and Execution Risks</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">Slippage:</strong> Orders may be executed at prices different from expected, especially during high volatility.</li>
            <li><strong className="text-white">Liquidity Risk:</strong> Some instruments may have limited liquidity, affecting execution quality.</li>
            <li><strong className="text-white">Gap Risk:</strong> Prices can gap significantly between trading sessions.</li>
            <li><strong className="text-white">System Failures:</strong> Technical issues with brokers or platforms can affect trade execution.</li>
            <li><strong className="text-white">Regulatory Changes:</strong> Laws and regulations can change, affecting trading conditions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">7. Educational Content Disclaimer</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Educational materials are provided for informational purposes only.</li>
            <li>Content reflects general concepts and may not apply to your specific situation.</li>
            <li>Trading strategies discussed are examples and not recommendations.</li>
            <li>We do not guarantee the accuracy, completeness, or timeliness of educational content.</li>
            <li>Applying educational concepts without proper understanding can result in losses.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">8. AI-Generated Content Disclaimer</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>AI analysis features (available to Pro/Elite subscribers) use artificial intelligence to generate insights.</li>
            <li>AI outputs are probabilistic and may contain errors or inaccuracies.</li>
            <li>AI analysis should never be the sole basis for trading decisions.</li>
            <li>AI cannot predict market movements or guarantee profitable outcomes.</li>
            <li>Users must apply their own judgment when interpreting AI-generated content.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">9. Data Accuracy Disclaimer</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Data synchronized from MT5 or entered manually may contain errors.</li>
            <li>We do not guarantee the accuracy, completeness, or reliability of displayed data.</li>
            <li>Discrepancies between TradifyApp and your broker's records should be verified with your broker.</li>
            <li>Analytics and statistics are calculated based on available data and may not reflect actual results.</li>
            <li>Users are responsible for verifying all trade information independently.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">10. Third-Party Disclaimer</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>References to brokers, platforms, or services do not constitute endorsements.</li>
            <li>We are not affiliated with MetaQuotes, MT5, or any brokerage firms.</li>
            <li>Third-party integrations are provided as-is without guarantees of performance.</li>
            <li>Users are responsible for compliance with their broker's terms of service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">11. Psychological Risks</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Trading can be emotionally challenging and stressful.</li>
            <li>Losses can lead to psychological distress, including anxiety and depression.</li>
            <li>Overtrading and revenge trading are common behavioral pitfalls.</li>
            <li>Addiction to trading is a recognized condition; seek help if needed.</li>
            <li>Never trade with money needed for essential expenses or obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">12. Limitation of Liability</h2>
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
            <p className="font-semibold text-white mb-3">TO THE FULLEST EXTENT PERMITTED BY LAW:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>TradifyApp shall not be liable for any trading losses, lost profits, or financial damages.</li>
              <li>We are not liable for decisions made based on information from our platform.</li>
              <li>Our liability is limited to the fees paid for the Service in the preceding 12 months.</li>
              <li>We disclaim all warranties, express or implied, regarding trading outcomes.</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">13. Acknowledgment</h2>
          <p>By using TradifyApp, you acknowledge and agree that:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>You have read, understood, and accept all risks described in this disclaimer.</li>
            <li>You are solely responsible for your trading decisions and their consequences.</li>
            <li>You will not hold TradifyApp liable for any losses incurred.</li>
            <li>You understand that trading involves substantial risk of financial loss.</li>
            <li>You have the financial means and risk tolerance appropriate for trading activities.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">14. Seek Professional Advice</h2>
          <p>We strongly encourage all users to:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Consult with a licensed financial advisor before trading.</li>
            <li>Educate yourself thoroughly about markets and trading strategies.</li>
            <li>Start with a demo account before risking real capital.</li>
            <li>Only trade with capital you can afford to lose completely.</li>
            <li>Implement proper risk management including position sizing and stop-losses.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">15. Contact Information</h2>
          <p>For questions about this Risk Disclaimer, please contact us:</p>
          <p className="mt-2"><strong className="text-white">Email:</strong> support@tradifyapp.com</p>
          <p><strong className="text-white">Website:</strong> https://tradifyapp.com</p>
        </section>

        <div className="border-t border-rose-500/20 pt-6 mt-8">
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg">
            <p className="text-rose-400 font-semibold text-sm uppercase tracking-wide">Final Warning</p>
            <p className="text-white mt-2">Trading is risky. Most retail traders lose money. Only trade with funds you can afford to lose. This platform is a tool for journaling and education—it does not guarantee success or provide trading advice.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
