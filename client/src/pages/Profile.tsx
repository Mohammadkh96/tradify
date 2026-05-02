import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Users, Shield, CreditCard, Save, AlertTriangle, Globe, Clock, Phone, CheckCircle2, XCircle, ArrowRight, Loader2, Calendar, DollarSign, Crown, Lock, Eye, EyeOff, MessageSquare, Sparkles, Send, Languages, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/hooks/usePlan";
import { useSampleModeDismissed } from "@/hooks/useSampleMode";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";
import { PLAN_CONFIGS, getFounderPrice } from "@shared/plans";
import { SiPaypal } from "react-icons/si";
import { Link } from "wouter";
import { TierBadge } from "@/components/EliteBadge";
import { FoundingMemberBadge } from "@/components/FoundingMemberBadge";
import { AlertSettingsCard } from "@/components/AlertSettingsCard";

const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
];

const timezones = Intl.supportedValuesOf('timeZone');

function FoundingSuggestionsCard({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("feature");

  const { data: mySuggestions, isLoading: loadingSuggestions } = useQuery<any[]>({
    queryKey: ["/api/founding-suggestions"],
  });

  const submitSuggestionMutation = useMutation({
    mutationFn: async (data: { category: string; title: string; description: string }) => {
      const res = await apiRequest("POST", "/api/founding-suggestions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founding-suggestions"] });
      setTitle("");
      setDescription("");
      toast({
        title: t("profile.toastSuggestionSubmitted"),
        description: t("profile.toastSuggestionSubmittedDesc"),
      });
    },
    onError: (error: any) => {
      let errorMsg = t("profile.toastSubmitFailedDefault");
      try {
        const parsed = error.message?.match(/\d+:\s*(.*)/);
        if (parsed?.[1]) {
          const json = JSON.parse(parsed[1]);
          errorMsg = json.message || errorMsg;
        }
      } catch { }
      toast({
        title: t("profile.toastSubmitFailed"),
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) {
      toast({
        title: t("profile.toastMissingFields"),
        description: t("profile.toastMissingFieldsDesc"),
        variant: "destructive",
      });
      return;
    }
    submitSuggestionMutation.mutate({ category, title: title.trim(), description: description.trim() });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="text-[9px] uppercase tracking-widest">{t("profile.statusPending")}</Badge>;
      case "reviewed":
        return <Badge className="text-[9px] uppercase tracking-widest bg-blue-500/20 text-blue-500 border-blue-500/30">{t("profile.statusReviewed")}</Badge>;
      case "implemented":
        return <Badge className="text-[9px] uppercase tracking-widest bg-emerald-500/20 text-emerald-500 border-emerald-500/30">{t("profile.statusImplemented")}</Badge>;
      default:
        return <Badge variant="outline" className="text-[9px] uppercase tracking-widest">{status}</Badge>;
    }
  };

  return (
    <Card className="bg-gradient-to-b from-amber-500/10 to-card border-amber-500/30 shadow-2xl overflow-hidden">
      <CardHeader className="border-b border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Sparkles size={20} className="text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-foreground uppercase italic tracking-tight text-lg font-black flex items-center gap-2">
              {t("profile.shapeRoadmap")}
              <Crown size={16} className="text-amber-500" />
            </CardTitle>
            <CardDescription className="text-amber-500/70 uppercase text-[10px] font-black tracking-widest">
              {t("profile.founderExclusive")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("profile.shapeRoadmapBody")}
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("profile.categoryLabel")}</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-muted border-border" data-testid="select-suggestion-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">{t("profile.categoryFeature")}</SelectItem>
                <SelectItem value="improvement">{t("profile.categoryImprovement")}</SelectItem>
                <SelectItem value="bug">{t("profile.categoryBug")}</SelectItem>
                <SelectItem value="other">{t("profile.categoryOther")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("profile.titleLabel")}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("profile.titlePlaceholder")}
              className="bg-muted border-border"
              data-testid="input-suggestion-title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("profile.descriptionLabel")}</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("profile.descriptionPlaceholder")}
              className="bg-muted border-border min-h-[100px] resize-none"
              data-testid="textarea-suggestion-description"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitSuggestionMutation.isPending || !title.trim() || !description.trim()}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-500/20 h-12 rounded-xl"
            data-testid="button-submit-suggestion"
          >
            {submitSuggestionMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                {t("profile.submitting")}
              </>
            ) : (
              <>
                <Send size={14} className="mr-2" />
                {t("profile.submitSuggestion")}
              </>
            )}
          </Button>
        </div>

        {loadingSuggestions ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={20} className="animate-spin text-amber-500" />
          </div>
        ) : mySuggestions && mySuggestions.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-amber-500/20">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("profile.previousSuggestions")}</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {mySuggestions.slice(0, 5).map((suggestion: any) => (
                <div key={suggestion.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="outline" className="text-[9px] uppercase tracking-widest capitalize">
                      {suggestion.category}
                    </Badge>
                    {getStatusBadge(suggestion.status)}
                  </div>
                  <h5 className="text-sm font-bold text-foreground mb-1">{suggestion.title}</h5>
                  <p className="text-xs text-muted-foreground line-clamp-2">{suggestion.description}</p>
                  {suggestion.adminNotes && (
                    <div className="mt-2 p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">{t("profile.responseLabel")}</p>
                      <p className="text-xs text-muted-foreground">{suggestion.adminNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SampleDataCard() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useSampleModeDismissed();
  const { toast } = useToast();
  const enabled = !dismissed;

  const handleToggle = (next: boolean) => {
    setDismissed(!next);
    toast({
      title: next ? t("profile.toastSampleEnabled") : t("profile.toastSampleHidden"),
      description: next
        ? t("profile.toastSampleEnabledDesc")
        : t("profile.toastSampleHiddenDesc"),
    });
  };

  return (
    <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="card-sample-data">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Sparkles size={20} className="text-emerald-500" />
          </div>
          <div>
            <CardTitle className="text-foreground uppercase italic tracking-tight font-black">{t("profile.sampleDataTitle")}</CardTitle>
            <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">{t("profile.sampleDataSubtitle")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-foreground uppercase tracking-tight">{t("profile.showSampleData")}</h4>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("profile.sampleAria")}
                    data-testid="tooltip-trigger-sample-data"
                  >
                    <Info size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {t("profile.sampleTooltip")}
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">
              {enabled
                ? t("profile.sampleEnabledHint")
                : t("profile.sampleDisabledHint")}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            aria-label={t("profile.showSampleData")}
            data-testid="switch-sample-data"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EmailPreferencesCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: prefs, isLoading } = useQuery<{ marketingEmails: boolean }>({
    queryKey: ["/api/email-preferences"],
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest("POST", "/api/email-preferences", { marketingEmails: enabled });
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-preferences"] });
      toast({
        title: enabled ? t("profile.toastMarketingEnabled") : t("profile.toastMarketingDisabled"),
        description: enabled
          ? t("profile.toastMarketingEnabledDesc")
          : t("profile.toastMarketingDisabledDesc"),
      });
    },
    onError: () => {
      toast({ title: t("profile.toastError"), description: t("profile.toastPrefsFailed"), variant: "destructive" });
    },
  });

  return (
    <Card className="bg-card border-border shadow-2xl overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Send size={20} className="text-emerald-500" />
          </div>
          <div>
            <CardTitle className="text-foreground uppercase italic tracking-tight font-black">{t("profile.emailPrefsTitle")}</CardTitle>
            <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">{t("profile.emailPrefsSubtitle")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between" data-testid="toggle-marketing-emails">
          <div>
            <h4 className="text-sm font-black text-foreground uppercase tracking-tight">{t("profile.marketingEmails")}</h4>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">{t("profile.marketingEmailsDesc")}</p>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Button
              variant={prefs?.marketingEmails ? "default" : "outline"}
              size="sm"
              onClick={() => toggleMutation.mutate(!prefs?.marketingEmails)}
              disabled={toggleMutation.isPending}
              className={prefs?.marketingEmails
                ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase text-[10px] tracking-widest"
                : "border-border text-muted-foreground font-black uppercase text-[10px] tracking-widest"
              }
              data-testid="button-toggle-marketing-emails"
            >
              {toggleMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : prefs?.marketingEmails ? t("profile.enabled") : t("profile.disabled")}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-foreground uppercase tracking-tight">{t("profile.accountEmails")}</h4>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">{t("profile.accountEmailsDesc")}</p>
          </div>
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-emerald-500/30 text-emerald-500">{t("profile.alwaysOn")}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ReferralCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: referralStats, isLoading } = useQuery<{
    referralCode: string;
    referralCount: number;
    referralLink: string;
  }>({
    queryKey: ["/api/user/referral-stats"],
  });

  const copyLink = () => {
    if (referralStats?.referralLink) {
      navigator.clipboard.writeText(referralStats.referralLink);
      toast({ title: t("profile.toastLinkCopied"), description: t("profile.toastLinkCopiedDesc") });
    }
  };

  return (
    <Card className="bg-card border-border shadow-2xl overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Users size={20} className="text-emerald-500" />
          </div>
          <div>
            <CardTitle className="text-foreground uppercase italic tracking-tight text-lg font-black">{t("profile.inviteFriends")}</CardTitle>
            <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">{t("profile.shareTradify")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
          </div>
        ) : referralStats ? (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("profile.referralBody")}
            </p>
            <div className="p-3 bg-background rounded-lg border border-border">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">{t("profile.yourReferralLink")}</p>
              <div className="flex items-center gap-2">
                <Input
                  value={referralStats.referralLink}
                  readOnly
                  className="bg-muted border-border text-foreground text-xs font-mono h-9"
                  data-testid="input-referral-link"
                />
                <Button
                  onClick={copyLink}
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-[10px] h-9 px-4 shrink-0"
                  data-testid="button-copy-referral"
                >
                  {t("profile.copy")}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("profile.referrals")}</span>
              <span className="text-lg font-black text-emerald-500" data-testid="text-referral-count">{referralStats.referralCount}</span>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LanguageSection({ initial }: { initial: string }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleChange = async (code: string) => {
    setSaving(true);
    try {
      await i18n.changeLanguage(code);
      try { localStorage.setItem("tradify_lang", code); } catch {}
      await apiRequest("POST", "/api/user/language", { language: code });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: t("profile.languageSaved") });
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="card-language">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Languages size={20} className="text-emerald-500" />
          </div>
          <div>
            <CardTitle className="text-foreground uppercase italic tracking-tight font-black">{t("profile.languageTitle")}</CardTitle>
            <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">{t("profile.languageSubtitle")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const active = (i18n.language || initial) === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleChange(lang.code)}
                disabled={saving}
                data-testid={`button-profile-language-${lang.code}`}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${active ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-background hover:border-emerald-500/50"}`}
              >
                <span className="text-2xl" aria-hidden>{lang.flag}</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-foreground">{lang.native}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{lang.label}</div>
                </div>
                {active && <CheckCircle2 size={16} className="ml-auto text-emerald-500" />}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: user, isLoading } = useQuery<UserRole>({
    queryKey: ["/api/user"],
  });

  const { isPaid, isElite, tier, config, isPro } = usePlan();

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery<any>({
    queryKey: ["/api/paypal/subscription"],
    enabled: isPaid && !!user?.paypalSubscriptionId,
  });

  const [country, setCountry] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setCountry(user.country || "");
      setPhoneNumber(user.phoneNumber || "");
      setTimezone(user.timezone || "");
    }
  }, [user]);

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/paypal/subscription/cancel", { reason: "User cancelled from profile" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paypal/subscription"] });
      toast({
        title: t("profile.toastSubscriptionCancelledElite"),
        description: isElite ? t("profile.toastSubscriptionCancelledEliteDesc") : t("profile.toastSubscriptionCancelledProDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("profile.toastCancellationFailed"),
        description: error.message || t("profile.toastCancellationFailedDesc"),
        variant: "destructive"
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/update-profile", {
        country,
        phoneNumber,
        timezone,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: t("profile.toastProfileUpdated"), description: t("profile.toastProfileUpdatedDesc") });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error(t("profile.passwordsDoNotMatch"));
      }
      const res = await apiRequest("POST", "/api/user/change-password", {
        currentPassword,
        newPassword,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t("profile.failedToChangePassword"));
      }
      return res.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: t("profile.toastPasswordChanged"), description: t("profile.toastPasswordChangedDesc") });
    },
    onError: (error: Error) => {
      toast({
        title: t("profile.toastPasswordChangeFailed"),
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/deactivate");
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  if (isLoading) return <div className="p-8 text-emerald-500 font-black animate-pulse uppercase tracking-widest">{t("profile.loading")}</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-foreground bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase italic tracking-tighter">{t("profile.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-black opacity-70">{t("profile.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.foundingMember && <FoundingMemberBadge size="lg" />}
          <TierBadge tier={user?.subscriptionTier} size="lg" />
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border border-border rounded-xl">
            <CreditCard size={16} className="text-emerald-500" />
            <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{t("profile.tierPlan", { tier: user?.subscriptionTier })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-card border-border shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <User size={20} className="text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-foreground uppercase italic tracking-tight font-black">{t("profile.personalTitle")}</CardTitle>
                  <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">{t("profile.personalSubtitle")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">{t("profile.emailLabel")}</label>
                  <Input value={user?.userId} disabled className="bg-background border-border text-muted-foreground h-11 font-bold opacity-60" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Globe size={10} /> {t("profile.countryLabel")}
                  </label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="bg-background border-border text-foreground h-11 uppercase text-[10px] font-black tracking-widest">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {countries.map((c) => (
                        <SelectItem key={c} value={c} className="text-[10px] uppercase font-black tracking-widest">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Clock size={10} /> {t("profile.timezoneLabel")}
                  </label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="bg-background border-border text-foreground h-11 uppercase text-[10px] font-black tracking-widest">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground h-64">
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz} className="text-[10px] uppercase font-black tracking-widest">
                          {tz.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Phone size={10} /> {t("profile.phoneLabel")}
                  </label>
                  <Input 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)} 
                    placeholder={t("profile.phonePlaceholder")}
                    className="bg-background border-border text-foreground h-11 focus:ring-primary/20 font-bold" 
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-border flex justify-end">
                <Button 
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs h-11 px-8 shadow-md shadow-emerald-500/20"
                >
                  <Save size={16} className="mr-2" />
                  {updateMutation.isPending ? t("profile.saving") : t("profile.saveChanges")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <LanguageSection initial={user?.language || "en"} />

          <Card className="bg-card border-border shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Lock size={20} className="text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-foreground uppercase italic tracking-tight font-black">{t("profile.securityTitle")}</CardTitle>
                  <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">{t("profile.securitySubtitle")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">{t("profile.currentPasswordLabel")}</label>
                <div className="relative">
                  <Input 
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)} 
                    placeholder={t("profile.currentPasswordPlaceholder")}
                    className="bg-background border-border text-foreground h-11 font-bold pr-10"
                    data-testid="input-current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-current-password"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">{t("profile.newPasswordLabel")}</label>
                <div className="relative">
                  <Input 
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder={t("profile.newPasswordPlaceholder")}
                    className="bg-background border-border text-foreground h-11 font-bold pr-10"
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-new-password"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">{t("profile.confirmPasswordLabel")}</label>
                <Input 
                  type="password"
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder={t("profile.confirmPasswordPlaceholder")}
                  className="bg-background border-border text-foreground h-11 font-bold"
                  data-testid="input-confirm-password"
                />
              </div>
              <div className="pt-4 border-t border-border flex justify-end">
                <Button 
                  onClick={() => changePasswordMutation.mutate()}
                  disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-xs h-11 px-8 shadow-md shadow-amber-500/20"
                  data-testid="button-change-password"
                >
                  <Lock size={16} className="mr-2" />
                  {changePasswordMutation.isPending ? t("profile.updating") : t("profile.changePassword")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <EmailPreferencesCard />

          <SampleDataCard />

          <AlertSettingsCard />

          <Card className="bg-card border-destructive/20 shadow-2xl">
            <CardHeader className="border-b border-border bg-destructive/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <AlertTriangle size={20} className="text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-foreground uppercase italic tracking-tight font-black">{t("profile.dangerZone")}</CardTitle>
                  <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">{t("profile.dangerZoneSubtitle")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-foreground uppercase tracking-tight">{t("profile.deactivateAccount")}</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">{t("profile.deactivateDesc")}</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (confirm(t("profile.deactivateConfirm"))) {
                      deactivateMutation.mutate();
                    }
                  }}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 uppercase font-black text-[10px] tracking-widest"
                >
                  {t("profile.deactivate")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-foreground uppercase italic tracking-tight text-lg font-black">{t("profile.planOverview")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="p-4 bg-background rounded-xl border border-border shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("profile.currentPlan")}</span>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{t("profile.active")}</span>
                </div>
                <div className="text-2xl font-black text-foreground uppercase italic tracking-tighter">{user?.subscriptionTier}</div>
              </div>
              
              <div className="space-y-2">
                <h5 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-70">{t("profile.includedFeatures")}</h5>
                <ul className="space-y-2">
                  {user?.subscriptionTier === "FREE" ? (
                    <>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> {t("profile.freeFeature1")}
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> {t("profile.freeFeature2")}
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> {t("profile.freeFeature3")}
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground/40 italic">
                        <XCircle size={12} className="text-muted-foreground/30" /> {t("profile.freeFeature4")}
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> {t("profile.paidFeature1")}
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> {t("profile.paidFeature2")}
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> {t("profile.paidFeature3")}
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {user?.subscriptionTier === "FREE" && (
                <Link to="/pricing">
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-[10px] mt-4 shadow-lg shadow-emerald-500/20 group h-12 rounded-xl">
                    {t("profile.upgradeToPro")}
                    <ArrowRight size={14} className="ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Subscription Management - For Pro and Elite users */}
          {isPaid && (
            <Card className="bg-card border-border shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0070ba]/10 rounded-lg">
                    <SiPaypal size={20} className="text-[#0070ba]" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground uppercase italic tracking-tight text-lg font-black">{t("profile.subscriptionTitle")}</CardTitle>
                    <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">{t("profile.subscriptionSubtitle")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {isLoadingSubscription ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                  </div>
                ) : subscription ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("profile.status")}</span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{subscription.status}</span>
                      </div>
                      
                      {subscription.nextBillingTime && (
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-muted-foreground" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("profile.nextBilling")}</span>
                          </div>
                          <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
                            {new Date(subscription.nextBillingTime).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <DollarSign size={14} className="text-muted-foreground" />
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("profile.billing")}</span>
                        </div>
                        <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
                          {(() => {
                            const planKey = isElite ? "ELITE" : "PRO";
                            const config = PLAN_CONFIGS[planKey];
                            const isFM = user?.foundingMember === true;
                            if (subscription.billingPeriod === 'annual') {
                              const price = isFM ? getFounderPrice(config.pricing.annual) : config.pricing.annual;
                              return `$${price}.00${t("profile.perYear")}`;
                            } else {
                              const price = isFM ? getFounderPrice(config.pricing.monthly) : config.pricing.monthly;
                              return `$${price}.00${t("profile.perMonth")}`;
                            }
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* Upgrade to Elite option for Pro users */}
                    {isPro && !isElite && (
                      <Button 
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black uppercase tracking-widest text-[10px] mt-2 shadow-lg shadow-amber-500/20"
                        data-testid="button-upgrade-to-elite"
                        onClick={() => window.location.href = '/checkout?plan=ELITE'}
                      >
                        <Crown size={14} className="mr-2" />
                        {t("profile.upgradeToElite")}
                      </Button>
                    )}

                    {/* Only show cancel button if subscription is not already cancelled */}
                    {subscription?.status?.toLowerCase() !== 'cancelled' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 uppercase font-black text-[10px] tracking-widest mt-2"
                            data-testid="button-cancel-subscription"
                          >
                            {t("profile.cancelSubscription")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground font-black uppercase tracking-tight">{t("profile.cancelDialogTitle")}</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                              {isElite ? t("profile.cancelDialogDescElite") : t("profile.cancelDialogDescPro")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="uppercase font-black text-[10px] tracking-widest">{t("profile.keepSubscription")}</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => cancelSubscriptionMutation.mutate()}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground uppercase font-black text-[10px] tracking-widest"
                              disabled={cancelSubscriptionMutation.isPending}
                            >
                              {cancelSubscriptionMutation.isPending ? t("profile.cancelling") : t("profile.yesCancel")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                      {t("profile.subscriptionUnavailable")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Founding Member Suggestions Card */}
          {user?.foundingMember && (
            <FoundingSuggestionsCard userId={user.userId} />
          )}

          {/* Referral Card */}
          <ReferralCard />

          {/* Contact Us Card */}
          <Card className="bg-card border-border shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Shield size={20} className="text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-foreground uppercase italic tracking-tight text-lg font-black">{t("profile.needHelp")}</CardTitle>
                  <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">{t("profile.wereHereForYou")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("profile.needHelpBody")}
              </p>
              <a 
                href="mailto:support@tradify.app?subject=Tradify Support Request" 
                data-testid="link-contact-us-profile"
              >
                <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 h-12 rounded-xl">
                  {t("profile.contactSupport")}
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
