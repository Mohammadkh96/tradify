
import { MainLayout } from "@/components/MainLayout";

export default function Privacy() {
  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <div className="prose prose-invert max-w-none text-slate-400">
        <p>Last updated: January 26, 2026</p>
        <p>Your privacy is important to us. Tradify collects minimal data necessary to provide trade journaling services.</p>
        <h2 className="text-xl font-bold text-white mt-8 mb-4">1. DATA COLLECTION</h2>
        <p>We collect account metrics and trade history via MT5 integration to display in your personal dashboard.</p>
      </div>
    </div>
  );
}
