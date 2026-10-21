import React, { useState } from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Key, CheckCircle2, Save } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { cn } from '../../lib/utils';

export const SettingsView: React.FC = () => {
  const { canonicalUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [displayName, setDisplayName] = useState(canonicalUser?.displayName || 'Pro Trader');
  const [email, setEmail] = useState(canonicalUser?.email || 'trader@tradigo.io');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [riskAuthAlerts, setRiskAuthAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center">
            <SettingsIcon className="w-6 h-6 mr-2 text-primary" /> Account & Preferences
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your personal credentials, notification feeds, and risk management parameters.
          </p>
        </div>
        {saved && (
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Changes Saved</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-border pb-3">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base">User Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-border pb-3">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base">Notification & Alert Channels</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
              <div>
                <span className="font-semibold text-sm text-foreground block">Email Notifications</span>
                <span className="text-xs text-muted-foreground">Receive weekly trade audits and booking confirmations</span>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
              <div>
                <span className="font-semibold text-sm text-foreground block">Instant Push Alerts</span>
                <span className="text-xs text-muted-foreground">Notify when coaches accept Coach Now requests</span>
              </div>
              <input
                type="checkbox"
                checked={pushAlerts}
                onChange={(e) => setPushAlerts(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
              <div>
                <span className="font-semibold text-sm text-foreground block">Risk Authorization Audits</span>
                <span className="text-xs text-muted-foreground">Real-time alerts on margin calls and drawdown limits</span>
              </div>
              <input
                type="checkbox"
                checked={riskAuthAlerts}
                onChange={(e) => setRiskAuthAlerts(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Security & API Keys */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-border pb-3">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base">Security & API Access</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40 border border-border">
              <div>
                <span className="font-semibold text-sm text-foreground block">Two-Factor Authentication (2FA)</span>
                <span className="text-xs text-muted-foreground">Protected via authenticator app</span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Enabled
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40 border border-border">
              <div>
                <span className="font-semibold text-sm text-foreground block">MetaTrader / cTrader API Token</span>
                <span className="text-xs text-muted-foreground">Active bridge connector for live account sync</span>
              </div>
              <button
                type="button"
                onClick={() => alert('API Key rotated successfully.')}
                className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors"
              >
                Rotate Token
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-95 transition-all flex items-center space-x-2 active:scale-[0.99]"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
