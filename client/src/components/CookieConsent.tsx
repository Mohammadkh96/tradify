import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, Settings, X, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { CookiePreferencesModal } from "./CookiePreferencesModal";

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

const COOKIE_CONSENT_KEY = "tradify_cookie_consent";

export function getCookiePreferences(): CookiePreferences | null {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Error reading cookie preferences:", e);
  }
  return null;
}

export function setCookiePreferences(prefs: CookiePreferences): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: prefs }));
  } catch (e) {
    console.error("Error saving cookie preferences:", e);
  }
}

export function hasAnalyticsConsent(): boolean {
  const prefs = getCookiePreferences();
  return prefs?.analytics ?? false;
}

export function hasMarketingConsent(): boolean {
  const prefs = getCookiePreferences();
  return prefs?.marketing ?? false;
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    const prefs = getCookiePreferences();
    if (!prefs) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const prefs: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    };
    setCookiePreferences(prefs);
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    const prefs: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    };
    setCookiePreferences(prefs);
    setIsVisible(false);
  };

  const handleSavePreferences = (prefs: CookiePreferences) => {
    setCookiePreferences(prefs);
    setShowPreferences(false);
    setIsVisible(false);
  };

  if (!isVisible && !showPreferences) {
    return null;
  }

  return (
    <>
      {isVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-500">
          <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500/10 rounded-xl shrink-0">
                  <Cookie className="h-6 w-6 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    We Value Your Privacy
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use cookies to enhance your experience, analyze site traffic, and for marketing purposes. 
                    By clicking "Accept All", you consent to our use of cookies. You can customize your preferences 
                    or reject non-essential cookies.{" "}
                    <Link to="/cookie-policy" className="text-emerald-500 hover:underline">
                      Learn more
                    </Link>
                  </p>
                </div>
                <button
                  onClick={handleRejectAll}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Close"
                  data-testid="button-cookie-close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex flex-wrap items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreferences(true)}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-cookie-customize"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Customize
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRejectAll}
                  data-testid="button-cookie-reject"
                >
                  Reject All
                </Button>
                <Button
                  size="sm"
                  onClick={handleAcceptAll}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="button-cookie-accept"
                >
                  Accept All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CookiePreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        onSave={handleSavePreferences}
      />
    </>
  );
}

export function CookieSettingsButton() {
  const [showPreferences, setShowPreferences] = useState(false);

  const handleSavePreferences = (prefs: CookiePreferences) => {
    setCookiePreferences(prefs);
    setShowPreferences(false);
  };

  return (
    <>
      <button
        onClick={() => setShowPreferences(true)}
        className="text-muted-foreground hover:text-emerald-500 transition-colors text-xs"
        data-testid="button-cookie-settings"
      >
        Cookie Settings
      </button>
      <CookiePreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        onSave={handleSavePreferences}
      />
    </>
  );
}
