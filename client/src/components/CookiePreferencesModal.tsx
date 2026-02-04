import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, BarChart3, Megaphone, Shield, Lock } from "lucide-react";
import { CookiePreferences, getCookiePreferences } from "./CookieConsent";

interface CookiePreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prefs: CookiePreferences) => void;
}

export function CookiePreferencesModal({ isOpen, onClose, onSave }: CookiePreferencesModalProps) {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existing = getCookiePreferences();
      if (existing) {
        setAnalytics(existing.analytics);
        setMarketing(existing.marketing);
      } else {
        setAnalytics(false);
        setMarketing(false);
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave({
      necessary: true,
      analytics,
      marketing,
      timestamp: Date.now(),
    });
  };

  const handleAcceptAll = () => {
    onSave({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Cookie className="h-5 w-5 text-amber-500" />
            Cookie Preferences
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Manage your cookie preferences. You can enable or disable different types of cookies below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-xl border border-border">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg mt-0.5">
                <Lock className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Strictly Necessary
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase">
                    Always Active
                  </span>
                </Label>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Essential for the website to function. These cannot be disabled as they are required for 
                  authentication, security, and basic functionality.
                </p>
              </div>
            </div>
            <Switch checked={true} disabled className="opacity-50" />
          </div>

          <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-xl border border-border">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg mt-0.5">
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <Label htmlFor="analytics-toggle" className="text-sm font-semibold text-foreground">
                  Analytics Cookies
                </Label>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Help us understand how visitors interact with our website by collecting and reporting 
                  information anonymously. Used for Google Analytics and similar services.
                </p>
              </div>
            </div>
            <Switch
              id="analytics-toggle"
              checked={analytics}
              onCheckedChange={setAnalytics}
              data-testid="switch-cookie-analytics"
            />
          </div>

          <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-xl border border-border">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg mt-0.5">
                <Megaphone className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <Label htmlFor="marketing-toggle" className="text-sm font-semibold text-foreground">
                  Marketing Cookies
                </Label>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Used to track visitors across websites to display relevant advertisements. 
                  Includes Facebook Pixel, Google Ads, and similar advertising services.
                </p>
              </div>
            </div>
            <Switch
              id="marketing-toggle"
              checked={marketing}
              onCheckedChange={setMarketing}
              data-testid="switch-cookie-marketing"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="sm:order-1" data-testid="button-cookie-prefs-cancel">
            Cancel
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleAcceptAll} 
            className="text-emerald-500 hover:text-emerald-600 sm:order-2"
            data-testid="button-cookie-prefs-accept-all"
          >
            Accept All
          </Button>
          <Button 
            onClick={handleSave} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white sm:order-3"
            data-testid="button-cookie-prefs-save"
          >
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
