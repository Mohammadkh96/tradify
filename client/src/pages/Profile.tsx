import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Shield, CreditCard, Save, AlertTriangle, Globe, Clock, Phone, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

  if (isLoading) return <div className="p-8 text-emerald-500 font-mono">LOADING PROFILE...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase italic tracking-tighter">Terminal Settings</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Manage your institutional account</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg">
          <CreditCard size={16} className="text-primary" />
          <span className="text-xs font-black text-foreground uppercase tracking-widest">{user?.subscriptionTier} PLAN</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-card border-border shadow-2xl">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User size={20} className="text-primary" />
                </div>
                <div>
                  <CardTitle className="text-foreground uppercase italic tracking-tight">Personal Information</CardTitle>
                  <CardDescription className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Identity and localization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email Terminal (Read-only)</label>
                  <Input value={user?.userId} disabled className="bg-muted border-border text-muted-foreground h-11" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Globe size={10} /> Country
                  </label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="bg-background border-border text-foreground h-11 uppercase text-[10px] tracking-widest">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {countries.map((c) => (
                        <SelectItem key={c} value={c} className="focus:bg-primary focus:text-primary-foreground text-[10px] uppercase tracking-widest">
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
                    <SelectTrigger className="bg-background border-border text-foreground h-11 uppercase text-[10px] tracking-widest">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground h-64">
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz} className="focus:bg-primary focus:text-primary-foreground text-[10px] uppercase tracking-widest">
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
                    className="bg-background border-border text-foreground h-11 focus:ring-primary/20 focus:border-primary/50" 
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-border flex justify-end">
                <Button 
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs h-11 px-8"
                >
                  <Save size={16} className="mr-2" />
                  {updateMutation.isPending ? "Syncing..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-2xl border-destructive/20">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <AlertTriangle size={20} className="text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-foreground uppercase italic tracking-tight">Danger Zone</CardTitle>
                  <CardDescription className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Irreversible account actions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Deactivate Account</h4>
                  <p className="text-xs text-muted-foreground mt-1">Temporarily disable your terminal access. Data is retained.</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (confirm("Are you sure you want to deactivate your account?")) {
                      deactivateMutation.mutate();
                    }
                  }}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 uppercase font-bold text-[10px] tracking-widest"
                >
                  Deactivate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border shadow-2xl">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-foreground uppercase italic tracking-tight text-lg">Plan Overview</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="p-4 bg-muted rounded-xl border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Current Plan</span>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <div className="text-2xl font-black text-foreground uppercase italic tracking-tighter">{user?.subscriptionTier}</div>
              </div>
              
              <div className="space-y-2">
                <h5 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Included Features</h5>
                <ul className="space-y-2">
                  {user?.subscriptionTier === "FREE" ? (
                    <>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={12} className="text-primary" /> Basic Journaling
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={12} className="text-primary" /> MT5 Integration
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={12} className="text-primary" /> Educational Hub
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground opacity-50">
                        <XCircle size={12} className="text-destructive" /> Advanced Analytics
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground opacity-50">
                        <XCircle size={12} className="text-destructive" /> Unlimited History
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground opacity-50">
                        <XCircle size={12} className="text-destructive" /> AI Insights Layer
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={12} className="text-primary" /> Full Intelligence Suite
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={12} className="text-primary" /> Unlimited Journal Storage
                      </li>
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={12} className="text-primary" /> Advanced Risk Analytics
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {user?.subscriptionTier === "FREE" && (
                <Link href="/pricing">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] mt-4 shadow-lg shadow-primary/20 group">
                    Upgrade to PRO
                    <ArrowRight size={14} className="ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
