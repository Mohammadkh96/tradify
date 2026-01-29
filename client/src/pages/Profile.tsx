import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Shield, CreditCard, Save, AlertTriangle, Globe, Clock, Phone, CheckCircle2, XCircle, ArrowRight, Loader2, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";
import { SiPaypal } from "react-icons/si";
import { Link } from "wouter";

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

export default function Profile() {
  const { toast } = useToast();
  const { data: user, isLoading } = useQuery<UserRole>({
    queryKey: ["/api/user"],
  });

  const subscription_tier = user?.subscriptionTier?.toUpperCase() || "FREE";
  const isPro = subscription_tier === "PRO" || subscription_tier === "ELITE";
  const isElite = subscription_tier === "ELITE";

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery<any>({
    queryKey: ["/api/paypal/subscription"],
    enabled: isPro && !!user?.paypalSubscriptionId,
  });

  const [country, setCountry] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("");

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
      toast({ title: "Subscription Cancelled", description: "Your subscription has been cancelled. You'll retain Pro access until the end of your billing period." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Cancellation Failed", 
        description: error.message || "Failed to cancel subscription. Please try again.", 
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
      toast({ title: "Profile Updated", description: "Your changes have been saved." });
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

  if (isLoading) return <div className="p-8 text-emerald-500 font-black animate-pulse uppercase tracking-widest">Loading Profile...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-foreground bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase italic tracking-tighter">Terminal Settings</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-black opacity-70">Manage your institutional account</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border border-border rounded-xl">
          <CreditCard size={16} className="text-emerald-500" />
          <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{user?.subscriptionTier} PLAN</span>
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
                  <CardTitle className="text-foreground uppercase italic tracking-tight font-black">Personal Information</CardTitle>
                  <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">Identity and localization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email Terminal (Read-only)</label>
                  <Input value={user?.userId} disabled className="bg-background border-border text-muted-foreground h-11 font-bold opacity-60" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Globe size={10} /> Country
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
                    <Clock size={10} /> Time Zone
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
                    <Phone size={10} /> Phone (Optional)
                  </label>
                  <Input 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)} 
                    placeholder="+1 234 567 890"
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
                  {updateMutation.isPending ? "Syncing..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-destructive/20 shadow-2xl">
            <CardHeader className="border-b border-border bg-destructive/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <AlertTriangle size={20} className="text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-foreground uppercase italic tracking-tight font-black">Danger Zone</CardTitle>
                  <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">Irreversible account actions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-foreground uppercase tracking-tight">Deactivate Account</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">Disable terminal access. Data is retained.</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (confirm("Are you sure you want to deactivate your account?")) {
                      deactivateMutation.mutate();
                    }
                  }}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 uppercase font-black text-[10px] tracking-widest"
                >
                  Deactivate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-foreground uppercase italic tracking-tight text-lg font-black">Plan Overview</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="p-4 bg-background rounded-xl border border-border shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Current Plan</span>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Active</span>
                </div>
                <div className="text-2xl font-black text-foreground uppercase italic tracking-tighter">{user?.subscriptionTier}</div>
              </div>
              
              <div className="space-y-2">
                <h5 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-70">Included Features</h5>
                <ul className="space-y-2">
                  {user?.subscriptionTier === "FREE" ? (
                    <>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> Basic Journaling
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> MT5 Integration
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> Educational Hub
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground/40 italic">
                        <XCircle size={12} className="text-muted-foreground/30" /> Advanced Analytics
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> Full Intelligence Suite
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> Unlimited Storage
                      </li>
                      <li className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                        <CheckCircle2 size={12} className="text-emerald-500" /> Priority Sync
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {user?.subscriptionTier === "FREE" && (
                <Link href="/pricing">
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-[10px] mt-4 shadow-lg shadow-emerald-500/20 group h-12 rounded-xl">
                    Upgrade to PRO
                    <ArrowRight size={14} className="ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Subscription Management - Only for Pro users */}
          {isPro && (
            <Card className="bg-card border-border shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0070ba]/10 rounded-lg">
                    <SiPaypal size={20} className="text-[#0070ba]" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground uppercase italic tracking-tight text-lg font-black">Subscription</CardTitle>
                    <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">Manage your billing</CardDescription>
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
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{subscription.status}</span>
                      </div>
                      
                      {subscription.nextBillingTime && (
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-muted-foreground" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Next Billing</span>
                          </div>
                          <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
                            {new Date(subscription.nextBillingTime).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <DollarSign size={14} className="text-muted-foreground" />
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount</span>
                        </div>
                        <span className="text-[10px] font-black text-foreground uppercase tracking-widest">$19.00/month</span>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 uppercase font-black text-[10px] tracking-widest mt-2"
                          data-testid="button-cancel-subscription"
                        >
                          Cancel Subscription
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground font-black uppercase tracking-tight">Cancel Subscription?</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            Are you sure you want to cancel your Pro subscription? You'll retain access until the end of your current billing period, then your account will be downgraded to Free.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="uppercase font-black text-[10px] tracking-widest">Keep Subscription</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => cancelSubscriptionMutation.mutate()}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground uppercase font-black text-[10px] tracking-widest"
                            disabled={cancelSubscriptionMutation.isPending}
                          >
                            {cancelSubscriptionMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                      Subscription details unavailable
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
