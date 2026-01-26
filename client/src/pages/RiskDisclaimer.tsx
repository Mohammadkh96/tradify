
import { MainLayout } from "@/components/MainLayout";
import { AlertTriangle } from "lucide-react";

export default function RiskDisclaimer() {
  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="text-rose-500 h-8 w-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Risk Disclaimer</h1>
      </div>
      
      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl mb-8">
          <p className="text-rose-500 font-bold uppercase tracking-widest text-sm mb-2">High Risk Warning</p>
          <p className="text-white font-medium">Trading foreign exchange on margin carries a high level of risk, and may not be suitable for all investors. The high degree of leverage can work against you as well as for you.</p>
        </div>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">1. No Guarantees</h2>
          <p>Before deciding to invest in foreign exchange you should carefully consider your investment objectives, level of experience, and risk appetite. The possibility exists that you could sustain a loss of some or all of your initial investment and therefore you should not invest money that you cannot afford to lose.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">2. Performance Transparency</h2>
          <p>Past performance is not indicative of future results. Any statistics, win rates, or performance metrics shown within the Tradify platform are based on historical data provided via your MT5 connection and do not guarantee future outcomes.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">3. Not Financial Advice</h2>
          <p>Tradify is a technical analysis and journaling platform. We do not provide financial advice, trading signals, or market recommendations. All analytical outputs, including AI-generated insights, are for educational and informational purposes only.</p>
        </section>
      </div>
    </div>
  );
}
