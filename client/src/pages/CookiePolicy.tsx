import { Cookie, Shield, BarChart3, Megaphone, Lock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CookiePreferencesModal } from "@/components/CookiePreferencesModal";
import { CookiePreferences, setCookiePreferences } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";

export default function CookiePolicy() {
  const [showPreferences, setShowPreferences] = useState(false);

  const handleSavePreferences = (prefs: CookiePreferences) => {
    setCookiePreferences(prefs);
    setShowPreferences(false);
  };

  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <SEO 
        title="Cookie Policy | TradifyApp"
        description="Learn how TradifyApp uses cookies. Manage your preferences for analytics and marketing cookies. GDPR compliant cookie consent."
        canonical="https://tradifyapp.com/cookie-policy"
      />
      <div className="flex items-center gap-3 mb-6">
        <Cookie className="text-amber-500 h-8 w-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Cookie Policy</h1>
      </div>
      
      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-sm text-slate-500">Last updated: February 4, 2026</p>
        
        <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl mb-8">
          <p className="text-amber-500 font-bold uppercase tracking-widest text-sm mb-2">Your Privacy Matters</p>
          <p className="text-white font-medium">This Cookie Policy explains how TradifyApp ("we", "us", or "our") uses cookies and similar technologies to recognize you when you visit our website. It explains what these technologies are, why we use them, and your rights to control our use of them.</p>
        </div>

        <Button 
          onClick={() => setShowPreferences(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white mb-6"
          data-testid="button-manage-cookies"
        >
          <Settings className="h-4 w-4 mr-2" />
          Manage Cookie Preferences
        </Button>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">1. What Are Cookies?</h2>
          <p>Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners to make their websites work, or to work more efficiently, as well as to provide reporting information.</p>
          <p className="mt-3">Cookies set by the website owner (in this case, TradifyApp) are called "first-party cookies". Cookies set by parties other than the website owner are called "third-party cookies". Third-party cookies enable third-party features or functionality to be provided on or through the website (e.g., advertising, interactive content, and analytics).</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">2. Types of Cookies We Use</h2>
          
          <div className="space-y-4 mt-4">
            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Lock className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-white">Strictly Necessary Cookies</h3>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase">Always Active</span>
              </div>
              <p className="text-sm">These cookies are essential for the website to function and cannot be switched off in our systems. They are usually only set in response to actions made by you which amount to a request for services, such as setting your privacy preferences, logging in, or filling in forms.</p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                <li><strong className="text-white">Session cookies:</strong> Maintain your login state and authentication</li>
                <li><strong className="text-white">Security cookies:</strong> Protect against fraud and unauthorized access</li>
                <li><strong className="text-white">Consent cookies:</strong> Remember your cookie preferences</li>
                <li><strong className="text-white">Payment cookies:</strong> Required for PayPal transactions</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                </div>
                <h3 className="font-semibold text-white">Analytics Cookies</h3>
                <span className="text-[9px] bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full font-bold uppercase">Optional</span>
              </div>
              <p className="text-sm">These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site. They help us to know which pages are the most and least popular and see how visitors move around the site.</p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                <li><strong className="text-white">Google Analytics:</strong> Collects anonymous data about how you use our website</li>
                <li><strong className="text-white">Performance monitoring:</strong> Helps us identify and fix issues</li>
                <li><strong className="text-white">Usage patterns:</strong> Understand which features are most valuable</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Megaphone className="h-4 w-4 text-purple-500" />
                </div>
                <h3 className="font-semibold text-white">Marketing Cookies</h3>
                <span className="text-[9px] bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded-full font-bold uppercase">Optional</span>
              </div>
              <p className="text-sm">These cookies may be set through our site by our advertising partners. They may be used by those companies to build a profile of your interests and show you relevant advertisements on other sites.</p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                <li><strong className="text-white">Facebook Pixel:</strong> Measures ad effectiveness and enables retargeting</li>
                <li><strong className="text-white">Google Ads:</strong> Serves relevant advertisements based on your interests</li>
                <li><strong className="text-white">LinkedIn Insight:</strong> Professional advertising and conversion tracking</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">3. How Can You Control Cookies?</h2>
          <p>You have the right to decide whether to accept or reject cookies. You can exercise your cookie preferences by clicking the "Manage Cookie Preferences" button above.</p>
          <p className="mt-3">You can also set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our website though your access to some functionality and areas of our website may be restricted.</p>
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg mt-4">
            <p className="font-semibold text-white mb-2">Browser Settings:</p>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li><strong className="text-white">Chrome:</strong> Settings → Privacy and security → Cookies</li>
              <li><strong className="text-white">Firefox:</strong> Options → Privacy & Security → Cookies</li>
              <li><strong className="text-white">Safari:</strong> Preferences → Privacy → Cookies</li>
              <li><strong className="text-white">Edge:</strong> Settings → Cookies and site permissions</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">4. Cookie Retention</h2>
          <p>Different cookies have different lifespans:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li><strong className="text-white">Session cookies:</strong> Deleted when you close your browser</li>
            <li><strong className="text-white">Persistent cookies:</strong> Remain on your device for a set period (typically 1-2 years) or until you delete them</li>
            <li><strong className="text-white">Consent preferences:</strong> Stored for 12 months</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">5. Third-Party Cookies</h2>
          <p>Some cookies are placed by third-party services that appear on our pages. We do not control the setting of these cookies, so we suggest you check the third-party websites for more information about their cookies and how to manage them:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li><strong className="text-white">Google:</strong> <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">Privacy Policy</a></li>
            <li><strong className="text-white">Facebook:</strong> <a href="https://www.facebook.com/policies/cookies/" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">Cookie Policy</a></li>
            <li><strong className="text-white">PayPal:</strong> <a href="https://www.paypal.com/webapps/mpp/ua/cookie-full" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">Cookie Policy</a></li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">6. Updates to This Policy</h2>
          <p>We may update this Cookie Policy from time to time in order to reflect changes to the cookies we use or for other operational, legal, or regulatory reasons. Please revisit this Cookie Policy regularly to stay informed about our use of cookies.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">7. Contact Us</h2>
          <p>If you have any questions about our use of cookies or other technologies, please contact us:</p>
          <p className="mt-2"><strong className="text-white">Email:</strong> support@tradifyapp.com</p>
          <p><strong className="text-white">Website:</strong> https://tradifyapp.com</p>
        </section>

        <div className="border-t border-amber-500/20 pt-6 mt-8">
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex items-center gap-4">
            <Shield className="h-8 w-8 text-amber-500 shrink-0" />
            <div>
              <p className="text-amber-400 font-semibold text-sm uppercase tracking-wide">GDPR Compliant</p>
              <p className="text-white mt-1 text-sm">We are committed to protecting your privacy and complying with GDPR, CCPA, and other privacy regulations.</p>
            </div>
          </div>
        </div>
      </div>

      <CookiePreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        onSave={handleSavePreferences}
      />
    </div>
  );
}
