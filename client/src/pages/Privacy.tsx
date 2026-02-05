import { Shield } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Privacy() {
  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <SEO 
        title="Privacy Policy | Tradify"
        description="Tradify's Privacy Policy explains how we collect, use, and protect your trading data and personal information. GDPR compliant."
        canonical="https://tradifyapp.com/privacy"
      />
      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-primary h-8 w-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Privacy Policy</h1>
      </div>
      
      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-sm text-slate-500">Last updated: February 3, 2026</p>
        
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl mb-8">
          <p className="text-white font-medium">This Privacy Policy describes how Tradify ("we", "us", or "our") collects, uses, and shares information about you when you use our trading journal application and related services (collectively, the "Service"). By using the Service, you agree to the collection and use of information in accordance with this policy.</p>
        </div>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">1. Information We Collect</h2>
          
          <h3 className="text-lg font-semibold text-white mt-4 mb-2">1.1 Information You Provide</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">Account Information:</strong> Email address, username, and password when you create an account.</li>
            <li><strong className="text-white">Profile Information:</strong> Optional profile details you choose to provide.</li>
            <li><strong className="text-white">Payment Information:</strong> Billing details processed through PayPal (we do not store full payment card details).</li>
            <li><strong className="text-white">Trading Data:</strong> Trade entries, notes, strategies, and performance metrics you input manually.</li>
            <li><strong className="text-white">Communications:</strong> Messages sent to our support team or through contact forms.</li>
          </ul>

          <h3 className="text-lg font-semibold text-white mt-4 mb-2">1.2 Information Collected Automatically</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">MT5 Integration Data:</strong> Account balance, equity, trade history, and performance metrics synced from your MetaTrader 5 accounts.</li>
            <li><strong className="text-white">Usage Data:</strong> Features accessed, pages viewed, and interactions with the Service.</li>
            <li><strong className="text-white">Device Information:</strong> Browser type, operating system, and device identifiers.</li>
            <li><strong className="text-white">Log Data:</strong> IP addresses, access times, and referring URLs.</li>
            <li><strong className="text-white">Cookies:</strong> Session cookies for authentication and preferences.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">2. How We Use Your Information</h2>
          <p>We use the collected information for the following purposes:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li><strong className="text-white">Service Delivery:</strong> To provide, maintain, and improve the trading journal functionality.</li>
            <li><strong className="text-white">Account Management:</strong> To create and manage your account, process subscriptions, and handle billing.</li>
            <li><strong className="text-white">Analytics:</strong> To generate performance metrics, statistics, and insights for your dashboard.</li>
            <li><strong className="text-white">Communications:</strong> To send service updates, security alerts, and support responses.</li>
            <li><strong className="text-white">Product Improvement:</strong> To understand usage patterns and enhance user experience.</li>
            <li><strong className="text-white">Security:</strong> To detect, prevent, and address fraud, abuse, and technical issues.</li>
            <li><strong className="text-white">Legal Compliance:</strong> To comply with applicable laws and regulatory requirements.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">3. Data Sharing and Disclosure</h2>
          <p className="font-semibold text-white">We do NOT sell, rent, or trade your personal information. We may share data only in these circumstances:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li><strong className="text-white">Service Providers:</strong> Third-party vendors who assist in operating our Service (e.g., PayPal for payments, email providers for transactional emails).</li>
            <li><strong className="text-white">Legal Requirements:</strong> When required by law, court order, or governmental authority.</li>
            <li><strong className="text-white">Protection of Rights:</strong> To protect the rights, property, or safety of Tradify, our users, or others.</li>
            <li><strong className="text-white">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets (with notice to users).</li>
            <li><strong className="text-white">With Your Consent:</strong> When you explicitly authorize us to share specific information.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">4. Data Security</h2>
          <p>We implement industry-standard security measures to protect your information:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li><strong className="text-white">Encryption:</strong> All data transmitted between your browser and our servers is encrypted using TLS/SSL.</li>
            <li><strong className="text-white">Password Protection:</strong> Passwords are hashed using secure algorithms and never stored in plain text.</li>
            <li><strong className="text-white">Access Controls:</strong> Limited access to personal data on a need-to-know basis.</li>
            <li><strong className="text-white">Regular Audits:</strong> Periodic security assessments and vulnerability testing.</li>
            <li><strong className="text-white">Secure Infrastructure:</strong> Hosted on secure, monitored cloud infrastructure.</li>
          </ul>
          <p className="mt-3 text-sm">However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security of your data.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">5. Data Retention</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">Active Accounts:</strong> We retain your data as long as your account is active.</li>
            <li><strong className="text-white">Trade History:</strong> Retention varies by subscription tier (Free: 30 days, Pro: 1 year, Elite: Unlimited).</li>
            <li><strong className="text-white">Deleted Accounts:</strong> Upon account deletion request, we remove personal data within 30 days, except where retention is required by law.</li>
            <li><strong className="text-white">Backup Data:</strong> Encrypted backups may retain data for up to 90 days after deletion.</li>
            <li><strong className="text-white">Legal Obligations:</strong> Some data may be retained longer to comply with legal or regulatory requirements.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">6. Your Rights and Choices</h2>
          <p>Depending on your jurisdiction, you may have the following rights:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li><strong className="text-white">Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong className="text-white">Correction:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong className="text-white">Deletion:</strong> Request deletion of your personal data ("right to be forgotten").</li>
            <li><strong className="text-white">Portability:</strong> Request export of your data in a machine-readable format.</li>
            <li><strong className="text-white">Opt-Out:</strong> Unsubscribe from marketing communications at any time.</li>
            <li><strong className="text-white">Restrict Processing:</strong> Request limitation of how we use your data.</li>
            <li><strong className="text-white">Withdraw Consent:</strong> Withdraw previously given consent for data processing.</li>
          </ul>
          <p className="mt-3">To exercise these rights, contact us at support@tradifyapp.com.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">7. Cookies and Tracking Technologies</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong className="text-white">Essential Cookies:</strong> Required for authentication and core functionality.</li>
            <li><strong className="text-white">Preference Cookies:</strong> Remember your settings and preferences.</li>
            <li><strong className="text-white">Analytics:</strong> We may use anonymized analytics to understand usage patterns.</li>
          </ul>
          <p className="mt-3">You can control cookie settings through your browser preferences. Disabling essential cookies may affect Service functionality.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">8. Third-Party Services</h2>
          <p>Our Service integrates with third-party services that have their own privacy policies:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li><strong className="text-white">PayPal:</strong> Payment processing (see PayPal's Privacy Policy).</li>
            <li><strong className="text-white">MetaTrader 5:</strong> Trade data synchronization (data is fetched from your MT5 account).</li>
            <li><strong className="text-white">OpenAI:</strong> AI-powered features for Pro/Elite users (queries are anonymized).</li>
          </ul>
          <p className="mt-3">We encourage you to review the privacy policies of these third-party services.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">9. International Data Transfers</h2>
          <p>Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers in compliance with applicable data protection laws.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">10. Children's Privacy</h2>
          <p>The Service is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child, we will take steps to delete such information promptly.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">11. Changes to This Policy</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>We may update this Privacy Policy periodically to reflect changes in our practices.</li>
            <li>Material changes will be communicated via email or prominent notice on the Service.</li>
            <li>Continued use of the Service after changes constitutes acceptance of the updated policy.</li>
            <li>The "Last updated" date at the top indicates when the policy was last revised.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">12. Contact Us</h2>
          <p>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
          <p className="mt-2"><strong className="text-white">Email:</strong> support@tradifyapp.com</p>
          <p><strong className="text-white">Website:</strong> https://tradifyapp.com</p>
        </section>

        <div className="border-t border-slate-700 pt-6 mt-8">
          <p className="text-sm text-slate-500">By using Tradify, you acknowledge that you have read and understood this Privacy Policy and agree to the collection, use, and disclosure of your information as described herein.</p>
        </div>
      </div>
    </div>
  );
}
