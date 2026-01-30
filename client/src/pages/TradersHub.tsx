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

export default function TradersHub() {
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
      toast({ title: "Application submitted", description: "Moderators will review your request." });
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
      toast({ title: "Profile updated" });
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
      toast({ title: "Post published", description: "Your idea has been shared with the community." });
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive", 
        title: "Post failed", 
        description: error.message || "Failed to publish post. Please check for prohibited language." 
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/traders-hub/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/traders-hub/posts"] });
      toast({ title: "Post removed" });
    }
  });

  const reportMutation = useMutation({
    mutationFn: async (postId: number) => {
      await apiRequest("POST", "/api/traders-hub/reports", { postId, reason: "Signal/Financial Advice" });
    },
    onSuccess: () => {
      toast({ title: "Reported", description: "Moderators will review this content." });
    }
  });

  if (isLoading) return <div className="p-8 text-muted-foreground uppercase font-black animate-pulse">Synchronizing Hub...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6 bg-background text-foreground min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase flex items-center gap-3">
            <Users className="text-emerald-500" size={32} />
            Trader Hub
          </h1>
          <p className="text-muted-foreground mt-1 uppercase text-xs font-bold tracking-widest">Community Learning & Research</p>
          <p className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-widest mt-2 border-l-2 border-amber-500/50 pl-2">
            Community content reflects personal opinions and is not financial advice. 
            <Link to="/risk-disclaimer" className="ml-2 text-emerald-500/70 hover:underline">View Risk Disclaimer</Link>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {creatorProfile?.status === "APPROVED" ? (
            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-emerald-500/30 text-emerald-500 font-bold uppercase text-xs tracking-widest hover:bg-emerald-500/10">
                  <UserCheck className="mr-2" size={16} />
                  Creator Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border text-foreground max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">Edit Creator Profile</DialogTitle>
                  <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">
                    This is your public presence on the platform.
                  </CardDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Display Name</label>
                    <Input 
                      className="bg-background border-border"
                      value={profileData.displayName || creatorProfile.displayName}
                      onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Bio</label>
                    <Textarea 
                      className="bg-background border-border"
                      value={profileData.bio || creatorProfile.bio || ""}
                      onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">External Link (Telegram/Discord)</label>
                    <Input 
                      className="bg-background border-border"
                      placeholder="https://t.me/yourchannel"
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
                    Save Profile
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-border text-muted-foreground font-bold uppercase text-xs tracking-widest hover:bg-muted">
                  <ShieldCheck className="mr-2" size={16} />
                  Become a Creator
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border text-foreground max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">Creator Program Application</DialogTitle>
                  <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                    Creators share ideas and educational content. This is not a signal service.
                  </CardDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Trading Background</label>
                    <Textarea 
                      placeholder="Briefly describe your experience..."
                      className="bg-background border-border"
                      value={applyData.background}
                      onChange={(e) => setApplyData({...applyData, background: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Content Focus</label>
                    <Input 
                      placeholder="e.g. Price Action, Macro Analysis, Education"
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
                    Submit Application
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-tighter">
                <Plus className="mr-2" size={18} />
                Share Reasoning
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tighter">New Community Post</DialogTitle>
                <CardDescription className="text-muted-foreground font-bold uppercase text-[10px]">
                  Focus on reasoning and learning. No signals or advisory content.
                </CardDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Post Type</label>
                    <Select value={newPost.type} onValueChange={(v) => setNewPost({...newPost, type: v})}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="Idea">Market Idea</SelectItem>
                        <SelectItem value="Review">Post-Trade Review</SelectItem>
                        <SelectItem value="Commentary">Session Commentary</SelectItem>
                        <SelectItem value="Education">Educational Write-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Symbol (Optional)</label>
                    <Input 
                      placeholder="e.g. XAUUSD"
                      className="bg-background border-border"
                      value={newPost.symbol}
                      onChange={(e) => setNewPost({...newPost, symbol: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Title</label>
                  <Input 
                    placeholder="The core reasoning behind this observation..."
                    className="bg-background border-border"
                    value={newPost.title}
                    onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Reasoning / Commentary</label>
                  <Textarea 
                    placeholder="Describe your observations, market context, and the 'why' behind this post..."
                    className="bg-background border-border min-h-[150px]"
                    value={newPost.content}
                    onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <ImageIcon size={14} /> Image URL (Static Charts Only)
                  </label>
                  <Input 
                    placeholder="https://example.com/chart-screenshot.png"
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
                      I confirm this post is for educational reasoning only. No "Buy/Sell" commands, guarantees, or investment advice.
                    </p>
                  </div>
                  <Button 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-tighter py-6"
                    disabled={createMutation.isPending || !newPost.title || !newPost.content}
                    onClick={() => createMutation.mutate(newPost)}
                  >
                    {createMutation.isPending ? "ENFORCING GUIDELINES..." : "PUBLISH TO HUB"}
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
                    Shared by <span className="text-emerald-500">{post.user?.userId || "Unknown"}</span>
                    {post.user?.role === "OWNER" && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black h-4 uppercase">Verified</Badge>
                    )}
                  </p>
                </div>
                {(user?.userId === post.userId || user?.role === "ADMIN" || user?.role === "OWNER") && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={() => {
                      if (window.confirm("Delete this post?")) deleteMutation.mutate(post.id);
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
                    <img src={post.imageUrl} alt="Market Reasoning Chart" className="w-full h-auto object-contain max-h-[400px]" />
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t border-border/50 pt-4 flex flex-col items-stretch gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-emerald-500 transition-colors uppercase">
                      <MessageSquare size={14} />
                      {post.commentCount} Discussions
                    </button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] font-bold text-muted-foreground hover:text-amber-500 uppercase gap-1.5"
                    onClick={() => reportMutation.mutate(post.id)}
                  >
                    <Flag size={12} />
                    Flag
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
                Hub Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { label: "EDUCATION ONLY", desc: "This space is for sharing logic and learning, not for instruction." },
                  { label: "NO SIGNALS", desc: "Strictly no 'Buy/Sell' commands or entry/exit triggers." },
                  { label: "NO GUARANTEES", desc: "Never promise ROI or high-probability outcomes." },
                  { label: "BE FACTUAL", desc: "Use data and charts to support your reasoning." }
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
  );
}

function CreatorInfo({ userId }: { userId: string }) {
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
          {profile.isVerified && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[7px] h-3 uppercase">Verified</Badge>}
        </p>
        <p className="text-[9px] text-muted-foreground font-bold uppercase truncate mt-0.5">{profile.bio || "No bio provided"}</p>
      </div>
    </div>
  );
}
