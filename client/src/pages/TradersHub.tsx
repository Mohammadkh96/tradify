import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Plus, 
  MessageSquare, 
  Flag, 
  Trash2, 
  Info,
  Image as ImageIcon,
  AlertTriangle,
  UserCheck,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export default function TradersHub() {
  const { t } = useTranslation("common", { keyPrefix: "tradersHub" });
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", symbol: "", type: "Idea", imageUrl: "" });

  const { data: user } = useQuery<any>({ queryKey: ["/api/user"] });
  const { data: posts, isLoading } = useQuery<any[]>({ 
    queryKey: ["/api/traders-hub/posts"],
    refetchInterval: 30000
  });
  const { data: creatorProfile } = useQuery<any>({
    queryKey: [`/api/traders-hub/creators/${user?.userId}`],
    enabled: !!user?.userId
  });

  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [applyData, setApplyData] = useState({ background: "", contentFocus: "" });
  const [profileData, setProfileData] = useState({ displayName: "", bio: "", externalLink: "" });

  const applyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/traders-hub/apply", data);
      return res.json();
    },
    onSuccess: () => {
      setIsApplyOpen(false);
      toast({ title: t("toastApplied"), description: t("toastAppliedDesc") });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/traders-hub/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/traders-hub/creators/${user?.userId}`] });
      setIsProfileOpen(false);
      toast({ title: t("toastProfileUpdated") });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/traders-hub/posts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/traders-hub/posts"] });
      setIsCreateOpen(false);
      setNewPost({ title: "", content: "", symbol: "", type: "Idea", imageUrl: "" });
      toast({ title: t("toastPostPublished"), description: t("toastPostPublishedDesc") });
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive", 
        title: t("toastPostFailed"), 
        description: error.message || t("toastPostFailedDesc")
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/traders-hub/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/traders-hub/posts"] });
      toast({ title: t("toastPostRemoved") });
    }
  });

  const reportMutation = useMutation({
    mutationFn: async (postId: number) => {
      await apiRequest("POST", "/api/traders-hub/reports", { postId, reason: "Signal/Financial Advice" });
    },
    onSuccess: () => {
      toast({ title: t("toastReported"), description: t("toastReportedDesc") });
    }
  });

  if (isLoading) return <div className="p-8 text-muted-foreground uppercase font-black animate-pulse">{t("syncing")}</div>;

  return (
    <div className="container mx-auto p-6 space-y-6 bg-background text-foreground min-h-screen relative">
      {/* Coming Soon Overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-center space-y-6 p-8 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Users className="text-emerald-500" size={40} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">{t("comingSoon")}</h2>
            <p className="text-muted-foreground mt-2 uppercase text-xs font-bold tracking-widest">{t("comingSoonHint")}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("comingSoonDesc")}
            </p>
            <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider">
              {t("launchingSoon")}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500/60 animate-pulse delay-75"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500/30 animate-pulse delay-150"></span>
          </div>
        </div>
      </div>

      {/* Blurred Content Behind */}
      <div className="blur-sm pointer-events-none select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase flex items-center gap-3">
            <Users className="text-emerald-500" size={32} />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 uppercase text-xs font-bold tracking-widest">{t("subtitle")}</p>
          <p className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-widest mt-2 border-l-2 border-amber-500/50 pl-2">
            {t("disclaimer")}
            <Link to="/risk-disclaimer" className="ml-2 text-emerald-500/70 hover:underline">{t("viewRiskDisclaimer")}</Link>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {creatorProfile?.status === "APPROVED" ? (
            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-emerald-500/30 text-emerald-500 font-bold uppercase text-xs tracking-widest hover:bg-emerald-500/10">
                  <UserCheck className="mr-2" size={16} />
                  {t("btnCreatorProfile")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border text-foreground max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">{t("editCreatorProfile")}</DialogTitle>
                  <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">
                    {t("publicPresence")}
                  </CardDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("labelDisplayName")}</label>
                    <Input 
                      className="bg-background border-border"
                      value={profileData.displayName || creatorProfile.displayName}
                      onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("labelBio")}</label>
                    <Textarea 
                      className="bg-background border-border"
                      value={profileData.bio || creatorProfile.bio || ""}
                      onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("labelExternalLink")}</label>
                    <Input 
                      className="bg-background border-border"
                      placeholder={t("externalLinkPlaceholder")}
                      value={profileData.externalLink || creatorProfile.externalLink || ""}
                      onChange={(e) => setProfileData({...profileData, externalLink: e.target.value})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    className="w-full font-black uppercase tracking-tighter"
                    onClick={() => updateProfileMutation.mutate(profileData)}
                  >
                    {t("btnSaveProfile")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-border text-muted-foreground font-bold uppercase text-xs tracking-widest hover:bg-muted">
                  <ShieldCheck className="mr-2" size={16} />
                  {t("btnBecomeCreator")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border text-foreground max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">{t("creatorApplicationTitle")}</DialogTitle>
                  <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                    {t("creatorApplicationDesc")}
                  </CardDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("labelTradingBackground")}</label>
                    <Textarea 
                      placeholder={t("tradingBackgroundPlaceholder")}
                      className="bg-background border-border"
                      value={applyData.background}
                      onChange={(e) => setApplyData({...applyData, background: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("labelContentFocus")}</label>
                    <Input 
                      placeholder={t("contentFocusPlaceholder")}
                      className="bg-background border-border"
                      value={applyData.contentFocus}
                      onChange={(e) => setApplyData({...applyData, contentFocus: e.target.value})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    className="w-full font-black uppercase tracking-tighter"
                    disabled={applyMutation.isPending || !applyData.background || !applyData.contentFocus}
                    onClick={() => applyMutation.mutate(applyData)}
                  >
                    {t("btnSubmitApplication")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-tighter">
                <Plus className="mr-2" size={18} />
                {t("btnShareReasoning")}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tighter">{t("newCommunityPost")}</DialogTitle>
                <CardDescription className="text-muted-foreground font-bold uppercase text-[10px]">
                  {t("newCommunityPostDesc")}
                </CardDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("labelPostType")}</label>
                    <Select value={newPost.type} onValueChange={(v) => setNewPost({...newPost, type: v})}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder={t("selectType")} />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="Idea">{t("typeIdea")}</SelectItem>
                        <SelectItem value="Review">{t("typeReview")}</SelectItem>
                        <SelectItem value="Commentary">{t("typeCommentary")}</SelectItem>
                        <SelectItem value="Education">{t("typeEducation")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("labelSymbolOptional")}</label>
                    <Input 
                      placeholder={t("symbolPlaceholder")}
                      className="bg-background border-border"
                      value={newPost.symbol}
                      onChange={(e) => setNewPost({...newPost, symbol: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("labelTitle")}</label>
                  <Input 
                    placeholder={t("titlePlaceholder")}
                    className="bg-background border-border"
                    value={newPost.title}
                    onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("labelReasoning")}</label>
                  <Textarea 
                    placeholder={t("reasoningPlaceholder")}
                    className="bg-background border-border min-h-[150px]"
                    value={newPost.content}
                    onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <ImageIcon size={14} /> {t("labelImageUrl")}
                  </label>
                  <Input 
                    placeholder={t("imageUrlPlaceholder")}
                    className="bg-background border-border"
                    value={newPost.imageUrl}
                    onChange={(e) => setNewPost({...newPost, imageUrl: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <div className="flex flex-col w-full gap-4">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3">
                    <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                    <p className="text-[10px] text-amber-700 dark:text-amber-200 leading-relaxed uppercase font-bold italic">
                      {t("guidelineConfirm")}
                    </p>
                  </div>
                  <Button 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-tighter py-6"
                    disabled={createMutation.isPending || !newPost.title || !newPost.content}
                    onClick={() => createMutation.mutate(newPost)}
                  >
                    {createMutation.isPending ? t("btnEnforcing") : t("btnPublishToHub")}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {posts?.map((post) => (
            <Card key={post.id} className="bg-card border-border hover:border-primary/20 shadow-sm transition-all overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-background border-border text-[9px] font-black uppercase tracking-widest text-emerald-500">
                      {post.type}
                    </Badge>
                    {post.symbol && (
                      <Badge variant="outline" className="bg-background border-border text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        {post.symbol}
                      </Badge>
                    )}
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      • {format(new Date(post.createdAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                  <CardTitle className="text-xl font-black text-foreground tracking-tight uppercase">
                    {post.title}
                  </CardTitle>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter flex items-center gap-2">
                    {t("sharedBy")} <span className="text-emerald-500">{post.user?.userId || t("unknown")}</span>
                    {post.user?.role === "OWNER" && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black h-4 uppercase">{t("verified")}</Badge>
                    )}
                  </p>
                </div>
                {(user?.userId === post.userId || user?.role === "ADMIN" || user?.role === "OWNER") && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={() => {
                      if (window.confirm(t("confirmDelete"))) deleteMutation.mutate(post.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>
                {post.imageUrl && (
                  <div className="rounded-lg border border-border overflow-hidden bg-background">
                    <img src={post.imageUrl} alt={t("imgAltChart")} className="w-full h-auto object-contain max-h-[400px]" />
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t border-border/50 pt-4 flex flex-col items-stretch gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-emerald-500 transition-colors uppercase">
                      <MessageSquare size={14} />
                      {post.commentCount} {t("discussions")}
                    </button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] font-bold text-muted-foreground hover:text-amber-500 uppercase gap-1.5"
                    onClick={() => reportMutation.mutate(post.id)}
                  >
                    <Flag size={12} />
                    {t("btnFlag")}
                  </Button>
                </div>
                
                {post.user?.userId && (
                  <CreatorInfo userId={post.user.userId} />
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border shadow-md sticky top-24">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                <span className="shrink-0"><Info size={16} /></span>
                {t("hubGuidelines")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { label: t("guideEducationLabel"), desc: t("guideEducationDesc") },
                  { label: t("guideNoSignalsLabel"), desc: t("guideNoSignalsDesc") },
                  { label: t("guideNoGuaranteesLabel"), desc: t("guideNoGuaranteesDesc") },
                  { label: t("guideBeFactualLabel"), desc: t("guideBeFactualDesc") }
                ].map((item, i) => (
                  <div key={i} className="space-y-1">
                    <h5 className="text-[10px] font-black text-foreground tracking-tight uppercase italic">{item.label}</h5>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase leading-tight">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}

function CreatorInfo({ userId }: { userId: string }) {
  const { t } = useTranslation("common", { keyPrefix: "tradersHub" });
  const { data: profile } = useQuery<any>({
    queryKey: [`/api/traders-hub/creators/${userId}`],
    enabled: !!userId
  });

  if (!profile || profile.status !== "APPROVED") return null;

  return (
    <div className="p-3 bg-background rounded-lg border border-border flex items-center justify-between gap-4 group">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-foreground uppercase truncate flex items-center gap-2">
          {profile.displayName}
          {profile.isVerified && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[7px] h-3 uppercase">{t("verified")}</Badge>}
        </p>
        <p className="text-[9px] text-muted-foreground font-bold uppercase truncate mt-0.5">{profile.bio || t("noBio")}</p>
      </div>
    </div>
  );
}
