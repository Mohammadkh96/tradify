import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Send, Check, X, Loader2, UserPlus, MessageSquare, DollarSign, Briefcase } from "lucide-react";

type CoachEntry = {
  userId: string;
  displayName: string;
  bio: string | null;
  specialties: string[];
  hourlyRate: number | null;
  currency: string;
  available: boolean;
  experienceYears: number | null;
};

type CoachRequest = {
  id: number;
  coachId: string;
  studentId: string;
  message: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  respondedAt: string | null;
  coachName?: string;
};

type CoachProfile = {
  userId: string;
  displayName: string;
  bio: string | null;
  specialties: string[];
  hourlyRate: number | null;
  currency: string;
  available: boolean;
  contactEmail: string | null;
  experienceYears: number | null;
};

export default function CoachesPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [contactCoach, setContactCoach] = useState<CoachEntry | null>(null);
  const [contactMessage, setContactMessage] = useState("");

  const { data: directory = [], isLoading: loadingDir } = useQuery<CoachEntry[]>({
    queryKey: ["/api/coaches/directory"],
  });

  const { data: profile } = useQuery<CoachProfile | null>({
    queryKey: ["/api/coaches/me/profile"],
  });

  const { data: requests } = useQuery<{ incoming: CoachRequest[]; outgoing: CoachRequest[] }>({
    queryKey: ["/api/coaches/me/requests"],
  });

  const sendRequest = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/coaches/${contactCoach!.userId}/request`, { message: contactMessage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaches/me/requests"] });
      toast({ title: t("coaches.toastSent"), description: t("coaches.toastSentDesc", { name: contactCoach?.displayName }) });
      setContactCoach(null);
      setContactMessage("");
    },
    onError: (e: any) => toast({ variant: "destructive", title: t("coaches.toastSent"), description: e.message }),
  });

  const respond = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "accept" | "decline" }) =>
      apiRequest("POST", `/api/coaches/requests/${id}/respond`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaches/me/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/students"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic text-foreground flex items-center gap-3">
            <GraduationCap className="h-10 w-10 text-emerald-500" />
            {t("coaches.title")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{t("coaches.subtitle")}</p>
        </div>

        <Tabs defaultValue="directory" className="w-full">
          <TabsList>
            <TabsTrigger value="directory" data-testid="tab-coaches-directory">{t("coaches.tabDirectory")}</TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-coaches-requests">
              {t("coaches.tabRequests")}
              {(requests?.incoming.filter(r => r.status === "pending").length || 0) > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">
                  {requests!.incoming.filter(r => r.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="listing" data-testid="tab-coaches-listing">{t("coaches.tabListing")}</TabsTrigger>
          </TabsList>

          {/* DIRECTORY */}
          <TabsContent value="directory" className="mt-6">
            {loadingDir ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : directory.length === 0 ? (
              <Card><CardContent className="text-center py-16 text-muted-foreground">
                {t("coaches.emptyDirectory")}
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {directory.map(c => (
                  <Card key={c.userId} className="flex flex-col" data-testid={`card-coach-${c.userId}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                            {c.displayName.charAt(0).toUpperCase()}
                          </div>
                          {c.displayName}
                        </CardTitle>
                        {c.available && <Badge className="bg-emerald-500 text-slate-950 hover:bg-emerald-500">{t("coaches.available")}</Badge>}
                      </div>
                      {c.experienceYears != null && (
                        <CardDescription className="flex items-center gap-1 text-xs"><Briefcase size={12} />{t("coaches.yearsExperience", { count: c.experienceYears })}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3">
                      {c.bio && <p className="text-sm text-muted-foreground line-clamp-4">{c.bio}</p>}
                      {c.specialties?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.specialties.map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground border border-border rounded uppercase font-bold tracking-wider">{s}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-auto pt-3">
                        {c.hourlyRate != null ? (
                          <div className="text-sm font-bold text-foreground flex items-center gap-1"><DollarSign size={14} className="text-emerald-500" />{c.hourlyRate} {c.currency}{t("coaches.perHour")}</div>
                        ) : <span className="text-xs text-muted-foreground italic">{t("coaches.rateOnRequest")}</span>}
                        <Button
                          size="sm"
                          className="bg-emerald-500 hover:bg-emerald-600 gap-1"
                          onClick={() => setContactCoach(c)}
                          data-testid={`button-contact-coach-${c.userId}`}
                        ><Send size={12} />{t("coaches.contact")}</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* REQUESTS */}
          <TabsContent value="requests" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />{t("coaches.incomingTitle")}</CardTitle>
                <CardDescription>{t("coaches.incomingDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {(requests?.incoming || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("coaches.noIncoming")}</p>
                ) : (
                  <div className="space-y-3">
                    {requests!.incoming.map(r => (
                      <div key={r.id} className="flex items-start justify-between gap-3 p-3 border border-border rounded-lg" data-testid={`row-incoming-${r.id}`}>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold flex items-center gap-2 flex-wrap">
                            {r.studentId}
                            <Badge variant={r.status === "pending" ? "outline" : r.status === "accepted" ? "default" : "secondary"}>
                              {r.status}
                            </Badge>
                          </div>
                          {r.message && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.message}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                        </div>
                        {r.status === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 gap-1" onClick={() => respond.mutate({ id: r.id, action: "accept" })} data-testid={`button-accept-${r.id}`}>
                              <Check size={14} />{t("coaches.accept")}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => respond.mutate({ id: r.id, action: "decline" })} data-testid={`button-decline-${r.id}`}>
                              <X size={14} />{t("coaches.decline")}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" />{t("coaches.outgoingTitle")}</CardTitle>
                <CardDescription>{t("coaches.outgoingDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {(requests?.outgoing || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("coaches.noOutgoing")}</p>
                ) : (
                  <div className="space-y-2">
                    {requests!.outgoing.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg" data-testid={`row-outgoing-${r.id}`}>
                        <div className="min-w-0">
                          <div className="text-sm font-bold">{r.coachName || r.coachId}</div>
                          <p className="text-[10px] text-muted-foreground/60">{new Date(r.createdAt).toLocaleString()}</p>
                        </div>
                        <Badge variant={r.status === "pending" ? "outline" : r.status === "accepted" ? "default" : "secondary"}>{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LISTING */}
          <TabsContent value="listing" className="mt-6">
            <CoachProfileForm profile={profile || null} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Contact dialog */}
      <Dialog open={!!contactCoach} onOpenChange={(o) => { if (!o) { setContactCoach(null); setContactMessage(""); } }}>
        <DialogContent data-testid="dialog-contact-coach">
          <DialogHeader>
            <DialogTitle>{t("coaches.contactDialogTitle", { name: contactCoach?.displayName })}</DialogTitle>
            <DialogDescription>{t("coaches.contactDialogDesc")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
            placeholder={t("coaches.contactPlaceholder")}
            rows={5}
            data-testid="textarea-contact-message"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setContactCoach(null)}>{t("coaches.cancel")}</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending} data-testid="button-send-request">
              {sendRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {t("coaches.send")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CoachProfileForm({ profile }: { profile: CoachProfile | null }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    displayName: profile?.displayName || "",
    bio: profile?.bio || "",
    specialties: (profile?.specialties || []).join(", "),
    hourlyRate: profile?.hourlyRate?.toString() || "",
    currency: profile?.currency || "USD",
    available: profile?.available ?? true,
    contactEmail: profile?.contactEmail || "",
    experienceYears: profile?.experienceYears?.toString() || "",
  }));

  const save = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/coaches/me/profile", {
      displayName: form.displayName,
      bio: form.bio,
      specialties: form.specialties.split(",").map(s => s.trim()).filter(Boolean),
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
      currency: form.currency,
      available: form.available,
      contactEmail: form.contactEmail || null,
      experienceYears: form.experienceYears ? Number(form.experienceYears) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaches/me/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coaches/directory"] });
      toast({ title: t("coaches.toastSaved"), description: form.available ? t("coaches.toastSavedVisible") : t("coaches.toastSavedHidden") });
    },
    onError: (e: any) => toast({ variant: "destructive", title: t("coaches.toastSaved"), description: e.message }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("coaches.listingTitle")}</CardTitle>
        <CardDescription>{t("coaches.listingDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">{t("coaches.displayName")} *</Label>
            <Input id="displayName" value={form.displayName} onChange={(e) => setForm(f => ({ ...f, displayName: e.target.value }))} data-testid="input-coach-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="experience">{t("coaches.experienceLabel")}</Label>
            <Input id="experience" type="number" min={0} max={80} value={form.experienceYears} onChange={(e) => setForm(f => ({ ...f, experienceYears: e.target.value }))} data-testid="input-coach-experience" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">{t("coaches.bio")}</Label>
          <Textarea id="bio" rows={4} value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} placeholder={t("coaches.bioPlaceholder")} data-testid="textarea-coach-bio" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="specialties">{t("coaches.specialties")}</Label>
          <Input id="specialties" value={form.specialties} onChange={(e) => setForm(f => ({ ...f, specialties: e.target.value }))} placeholder={t("coaches.specialtiesPlaceholder")} data-testid="input-coach-specialties" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="rate">{t("coaches.rate")}</Label>
            <Input id="rate" type="number" min={0} value={form.hourlyRate} onChange={(e) => setForm(f => ({ ...f, hourlyRate: e.target.value }))} data-testid="input-coach-rate" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">{t("coaches.currency")}</Label>
            <Input id="currency" value={form.currency} maxLength={4} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} data-testid="input-coach-currency" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact">{t("coaches.contactEmail")}</Label>
            <Input id="contact" type="email" value={form.contactEmail} onChange={(e) => setForm(f => ({ ...f, contactEmail: e.target.value }))} data-testid="input-coach-email" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-3">
            <Switch checked={form.available} onCheckedChange={(v) => setForm(f => ({ ...f, available: v }))} data-testid="switch-coach-available" />
            <Label className="cursor-pointer">{t("coaches.visible")}</Label>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.displayName.trim()} className="bg-emerald-500 hover:bg-emerald-600" data-testid="button-save-coach-profile">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("coaches.saveListing")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
