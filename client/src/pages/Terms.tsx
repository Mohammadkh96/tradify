
import { MainLayout } from "@/components/MainLayout";

export default function Terms() {
  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <div className="prose prose-invert max-w-none text-slate-400">
        <p>Last updated: January 26, 2026</p>
        <p>TRADIFY is a trading journal application. By using our services, you agree to these terms.</p>
        <h2 className="text-xl font-bold text-white mt-8 mb-4">1. PLATFORM ONLY</h2>
        <p>Tradify is strictly a technical platform. We do not provide financial advice, signals, or automated trading services.</p>
        <h2 className="text-xl font-bold text-white mt-8 mb-4">2. DATA ACCURACY</h2>
        <p>While we sync with MT5, users are responsible for verifying the accuracy of their trade records.</p>
      </div>
    </div>
  );
}
