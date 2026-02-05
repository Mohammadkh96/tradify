import { FileText } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Terms() {
  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <SEO 
        title="Terms of Service | Tradify"
        description="Read Tradify's Terms of Service. Understand your rights and responsibilities when using our trading journal and MT5 sync platform."
        canonical="https://tradifyapp.com/terms"
      />
      <div className="flex items-center gap-3 mb-6">
        <FileText className="text-primary h-8 w-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Terms of Service</h1>
      </div>
      
      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-sm text-slate-500">Last updated: February 3, 2026</p>
        
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl mb-8">
          <p className="text-white font-medium">Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Tradify application (the "Service") operated by Tradify ("us", "we", or "our"). Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.</p>
        </div>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">1. Acceptance of Terms</h2>
          <p>By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>You must be at least 18 years of age to use this Service.</li>
            <li>You must have the legal capacity to enter into a binding agreement.</li>
            <li>You are responsible for ensuring compliance with all applicable laws in your jurisdiction.</li>
            <li>By creating an account, you represent that all information provided is accurate and truthful.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">2. Description of Service</h2>
          <p>Tradify is a trading journal and analytics platform that provides:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li><strong className="text-white">Trade Journaling:</strong> Record, track, and analyze your trading activities.</li>
            <li><strong className="text-white">MT5 Integration:</strong> Automatic synchronization with MetaTrader 5 accounts.</li>
            <li><strong className="text-white">Performance Analytics:</strong> Statistical analysis and visualization of trading performance.</li>
            <li><strong className="text-white">Strategy Validation:</strong> Tools to create, test, and validate trading strategies against predefined rules.</li>
            <li><strong className="text-white">Educational Content:</strong> Access to trading education materials and resources.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">3. Platform Limitations</h2>
          <p className="font-semibold text-white">TRADIFY IS STRICTLY A TECHNICAL PLATFORM. WE EXPRESSLY DO NOT:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Provide financial, investment, tax, or legal advice of any kind.</li>
            <li>Offer trading signals, recommendations, or market predictions.</li>
            <li>Execute trades on your behalf or manage your trading accounts.</li>
            <li>Guarantee any trading outcomes, profits, or performance results.</li>
            <li>Act as a broker, dealer, or financial intermediary.</li>
            <li>Provide automated trading systems or algorithmic trading services.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">4. User Accounts</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You must immediately notify us of any unauthorized use of your account.</li>
            <li>You are solely responsible for all activities that occur under your account.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
            <li>One account per user; multiple accounts are prohibited.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">5. Subscription and Payments</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">Free Tier:</strong> Basic features available at no cost with limited functionality.</li>
            <li><strong className="text-white">Pro Tier ($29/month):</strong> Enhanced features including extended trade history and advanced analytics.</li>
            <li><strong className="text-white">Elite Tier ($59/month):</strong> Full access to all features including AI analysis and premium reports.</li>
            <li>All payments are processed through PayPal and are subject to PayPal's terms of service.</li>
            <li>Subscriptions are billed monthly on a recurring basis until cancelled.</li>
            <li>You may cancel your subscription at any time; access continues until the end of the billing period.</li>
            <li>No refunds are provided for partial months or unused features.</li>
            <li>We reserve the right to modify pricing with 30 days' notice to existing subscribers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">6. Data Accuracy and Responsibility</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>While we strive for accuracy, we do not guarantee the accuracy of data synced from MT5 or other sources.</li>
            <li>Users are solely responsible for verifying the accuracy of their trade records.</li>
            <li>Any discrepancies between Tradify data and your broker's records should be reported immediately.</li>
            <li>We are not liable for any decisions made based on data displayed in the platform.</li>
            <li>Historical data and analytics are provided for informational purposes only.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">7. Intellectual Property</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>The Service and its original content, features, and functionality are owned by Tradify.</li>
            <li>Our trademarks, logos, and service marks may not be used without prior written consent.</li>
            <li>You retain ownership of any trading data you input into the platform.</li>
            <li>Educational content is for personal use only and may not be redistributed.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">8. Prohibited Conduct</h2>
          <p>You agree NOT to:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Use the Service for any unlawful purpose or in violation of any regulations.</li>
            <li>Attempt to gain unauthorized access to any portion of the Service.</li>
            <li>Interfere with or disrupt the Service or servers connected to the Service.</li>
            <li>Reverse engineer, decompile, or disassemble any aspect of the Service.</li>
            <li>Use automated systems (bots, scrapers) to access the Service without permission.</li>
            <li>Share your account credentials or allow others to access your account.</li>
            <li>Misrepresent your identity or affiliation with any person or entity.</li>
            <li>Upload malicious code, viruses, or harmful content.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">9. Limitation of Liability</h2>
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
            <p className="font-semibold text-white mb-3">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Tradify shall not be liable for any indirect, incidental, special, consequential, or punitive damages.</li>
              <li>We are not liable for any trading losses, lost profits, or financial damages.</li>
              <li>Our total liability shall not exceed the amount paid by you for the Service in the past 12 months.</li>
              <li>We do not warrant that the Service will be uninterrupted, error-free, or secure.</li>
              <li>We are not responsible for third-party services, including MT5 or payment processors.</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">10. Indemnification</h2>
          <p>You agree to defend, indemnify, and hold harmless Tradify and its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorney's fees) arising from:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Your use of the Service.</li>
            <li>Your violation of these Terms.</li>
            <li>Your violation of any rights of another party.</li>
            <li>Your trading activities and decisions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">11. Service Modifications</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>We reserve the right to modify, suspend, or discontinue the Service at any time.</li>
            <li>We may update features, pricing, or functionality without prior notice.</li>
            <li>Continued use of the Service after changes constitutes acceptance of modified terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">12. Termination</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>We may terminate or suspend your access immediately, without prior notice, for any breach of these Terms.</li>
            <li>Upon termination, your right to use the Service will cease immediately.</li>
            <li>You may request deletion of your account and associated data at any time.</li>
            <li>Certain provisions of these Terms shall survive termination.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">13. Governing Law</h2>
          <p>These Terms shall be governed and construed in accordance with applicable laws, without regard to conflict of law provisions. Any disputes arising from these Terms shall be resolved through binding arbitration or in courts of competent jurisdiction.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">14. Severability</h2>
          <p>If any provision of these Terms is held to be unenforceable or invalid, such provision will be modified to the minimum extent necessary, and the remaining provisions will continue in full force and effect.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">15. Contact Information</h2>
          <p>For questions about these Terms, please contact us at:</p>
          <p className="mt-2"><strong className="text-white">Email:</strong> support@tradifyapp.com</p>
          <p><strong className="text-white">Website:</strong> https://tradifyapp.com</p>
        </section>

        <div className="border-t border-slate-700 pt-6 mt-8">
          <p className="text-sm text-slate-500">By using Tradify, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.</p>
        </div>
      </div>
    </div>
  );
}
