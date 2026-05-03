import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Image as ImageIcon, Film, Loader2, Download, Wand2, Calendar, Target, TrendingUp, MessageSquare, Megaphone, Video, Copy } from "lucide-react";

interface PlanCampaign {
  name: string;
  goal: string;
  channels: string[];
  budget: string;
  duration: string;
  kpis: string[];
}

interface PlanWeek {
  week: number;
  theme: string;
  posts: { day: string; platform: string; type: string; hook: string }[];
}

interface MarketingPlan {
  summary: string;
  positioning: string;
  campaigns: PlanCampaign[];
  calendar: PlanWeek[];
  budgetBreakdown: { channel: string; pct: number; rationale: string }[];
  kpis: { metric: string; target: string }[];
}

interface MediaAsset {
  id: string;
  fileUrl: string;
  fileName: string;
  type: string;
  createdAt: string;
  prompt: string;
}

export default function MarketingStudio() {
  return (
    <AdminLayout>
      <div className="p-8 max-w-[1400px] mx-auto space-y-6">
        <header>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight" data-testid="text-studio-title">Marketing Studio</h1>
              <p className="text-sm text-slate-400">All-in-one: plan, photos, and video promos — generated from one place.</p>
            </div>
          </div>
        </header>

        <Tabs defaultValue="plan" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="plan" data-testid="tab-plan"><Target className="h-4 w-4 mr-2" />Plan</TabsTrigger>
            <TabsTrigger value="photos" data-testid="tab-photos"><ImageIcon className="h-4 w-4 mr-2" />Photos</TabsTrigger>
            <TabsTrigger value="videos" data-testid="tab-videos"><Film className="h-4 w-4 mr-2" />Videos</TabsTrigger>
            <TabsTrigger value="copy" data-testid="tab-copy"><Megaphone className="h-4 w-4 mr-2" />Posts & Ads</TabsTrigger>
          </TabsList>

          <TabsContent value="plan"><PlanTab /></TabsContent>
          <TabsContent value="photos"><PhotosTab /></TabsContent>
          <TabsContent value="videos"><VideosTab /></TabsContent>
          <TabsContent value="copy"><CopyTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

// ============== PLAN TAB ==============
function PlanTab() {
  const { toast } = useToast();
  const [goal, setGoal] = useState("Acquire 1,000 active free users and convert 5% to Pro within 30 days");
  const [audience, setAudience] = useState("Retail forex/CFD traders, prop firm challenge takers, ages 22-45");
  const [timeframe, setTimeframe] = useState("4 weeks");
  const [budget, setBudget] = useState("$3,000");
  const [channels, setChannels] = useState("Instagram Reels, TikTok, Meta Ads, YouTube Shorts, X");
  const [plan, setPlan] = useState<MarketingPlan | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/studio/plan", {
        goal, audience, timeframe, budget, channels,
      });
      return res.json() as Promise<MarketingPlan>;
    },
    onSuccess: (data) => { setPlan(data); toast({ title: "Plan generated", description: "Marketing plan is ready below." }); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message || "Could not generate plan", variant: "destructive" }),
  });

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-emerald-500" />Plan inputs</CardTitle>
          <CardDescription>Tell the AI your goal, audience, and budget.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal">Primary goal</Label>
            <Textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} data-testid="input-plan-goal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audience">Target audience</Label>
            <Textarea id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} rows={2} data-testid="input-plan-audience" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="timeframe">Timeframe</Label>
              <Input id="timeframe" value={timeframe} onChange={(e) => setTimeframe(e.target.value)} data-testid="input-plan-timeframe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget">Budget</Label>
              <Input id="budget" value={budget} onChange={(e) => setBudget(e.target.value)} data-testid="input-plan-budget" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channels">Channels</Label>
            <Input id="channels" value={channels} onChange={(e) => setChannels(e.target.value)} data-testid="input-plan-channels" />
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold" data-testid="button-generate-plan">
            {mut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating plan…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate full plan</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {!plan && !mut.isPending && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-slate-500">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Your generated marketing plan will appear here.</p>
            </CardContent>
          </Card>
        )}
        {mut.isPending && (
          <Card><CardContent className="py-16 text-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-emerald-500" />
            <p className="text-sm">Crafting your full plan — campaigns, calendar, budget split, KPIs…</p>
          </CardContent></Card>
        )}
        {plan && (
          <>
            <Card>
              <CardHeader>
                <CardTitle data-testid="text-plan-summary-title">Strategy summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-slate-300 leading-relaxed" data-testid="text-plan-summary">{plan.summary}</p>
                {plan.positioning && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">Positioning</div>
                    <p className="text-slate-200">{plan.positioning}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {plan.campaigns?.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Campaigns ({plan.campaigns.length})</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {plan.campaigns.map((c, i) => (
                    <div key={i} className="rounded-lg border border-slate-800 p-4 space-y-2" data-testid={`card-campaign-${i}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white">{c.name}</h4>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">{c.duration}</Badge>
                      </div>
                      <p className="text-sm text-slate-300">{c.goal}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(c.channels) ? c.channels : typeof c.channels === "string" ? [c.channels] : []).map((ch, ci) => <Badge key={`${ch}-${ci}`} variant="secondary">{ch}</Badge>)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span><strong className="text-slate-200">Budget:</strong> {c.budget}</span>
                        {Array.isArray(c.kpis) && c.kpis.length > 0 && <span><strong className="text-slate-200">KPIs:</strong> {c.kpis.join(", ")}</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {plan.calendar?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-emerald-500" />Content calendar</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {plan.calendar.map((w) => (
                    <div key={w.week} className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-widest text-emerald-500">Week {w.week} — {w.theme}</div>
                      <div className="rounded-lg border border-slate-800 divide-y divide-slate-800">
                        {(Array.isArray(w.posts) ? w.posts : []).map((p, j) => (
                          <div key={j} className="px-3 py-2 grid grid-cols-[80px_120px_100px_1fr] gap-2 text-xs items-center" data-testid={`row-post-w${w.week}-${j}`}>
                            <span className="font-bold text-slate-300">{p.day}</span>
                            <Badge variant="outline" className="text-[10px] justify-self-start">{p.platform}</Badge>
                            <span className="text-slate-400">{p.type}</span>
                            <span className="text-slate-300 truncate" title={p.hook}>{p.hook}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {plan.budgetBreakdown?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Budget breakdown</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {plan.budgetBreakdown.map((b, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{b.channel}</span>
                          <span className="font-bold text-emerald-400">{b.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${b.pct}%` }} />
                        </div>
                        {b.rationale && <p className="text-xs text-slate-500">{b.rationale}</p>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {plan.kpis?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />KPIs</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {plan.kpis.map((k, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-800 pb-2 last:border-0 text-sm">
                        <span className="text-slate-300">{k.metric}</span>
                        <span className="font-bold text-emerald-400">{k.target}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============== PHOTOS TAB ==============
const PHOTO_PRESETS = [
  { id: "ad", label: "Ad creative", style: "bold cinematic ad creative, dramatic lighting" },
  { id: "lifestyle", label: "Lifestyle", style: "natural lifestyle photography, candid mood" },
  { id: "product", label: "Product hero", style: "premium product hero shot, studio lighting" },
  { id: "abstract", label: "Abstract data", style: "abstract data visualization, glowing particles" },
  { id: "editorial", label: "Editorial", style: "editorial magazine photography, fashion-grade composition" },
];

function PhotosTab() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("A focused trader in a dark modern office, glowing emerald candlestick charts on multiple monitors, cinematic side-light");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [styleId, setStyleId] = useState("ad");
  const [photos, setPhotos] = useState<MediaAsset[]>([]);

  const mut = useMutation({
    mutationFn: async () => {
      const preset = PHOTO_PRESETS.find((p) => p.id === styleId);
      const res = await apiRequest("POST", "/api/admin/marketing/studio/photo", {
        prompt, aspectRatio, photoStyle: preset?.style || "",
      });
      return res.json() as Promise<MediaAsset>;
    },
    onSuccess: (data) => {
      setPhotos((prev) => [{ ...data, prompt, createdAt: new Date().toISOString() }, ...prev]);
      toast({ title: "Photo generated", description: "Saved to your library." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message || "Could not generate photo", variant: "destructive" }),
  });

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-emerald-500" />Static photo</CardTitle>
          <CardDescription>Generate brand-aligned photos for ads, posts, and stories.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="photoPrompt">Describe the photo</Label>
            <Textarea id="photoPrompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} data-testid="input-photo-prompt" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Aspect ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger data-testid="select-photo-aspect"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">Square (1:1)</SelectItem>
                  <SelectItem value="4:5">Portrait (4:5)</SelectItem>
                  <SelectItem value="9:16">Story (9:16)</SelectItem>
                  <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Style</Label>
              <Select value={styleId} onValueChange={setStyleId}>
                <SelectTrigger data-testid="select-photo-style"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHOTO_PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold" data-testid="button-generate-photo">
            {mut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating photo…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate photo</>}
          </Button>
          <p className="text-xs text-slate-500">~10-25s per photo. Uses gpt-image-1.</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Generated photos ({photos.length})</h3>
        {photos.length === 0 && !mut.isPending && (
          <Card className="border-dashed"><CardContent className="py-16 text-center text-slate-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No photos yet. Generate your first one.</p>
          </CardContent></Card>
        )}
        {mut.isPending && (
          <Card><CardContent className="py-12 text-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-emerald-500" />
            <p className="text-sm">Painting your photo…</p>
          </CardContent></Card>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {photos.map((p) => (
            <Card key={p.id} className="overflow-hidden" data-testid={`card-photo-${p.id}`}>
              <div className="aspect-square bg-slate-900 overflow-hidden">
                <img src={p.fileUrl} alt={p.prompt} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-slate-400 line-clamp-2">{p.prompt}</p>
                <a href={p.fileUrl} download={p.fileName} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 hover:underline" data-testid={`link-download-photo-${p.id}`}>
                  <Download className="h-3 w-3" />Download
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============== POSTS & ADS TAB ==============
function CopyTab() {
  return (
    <Tabs defaultValue="post" className="space-y-4">
      <TabsList>
        <TabsTrigger value="post" data-testid="subtab-post"><MessageSquare className="h-4 w-4 mr-2" />Social post</TabsTrigger>
        <TabsTrigger value="reel" data-testid="subtab-reel"><Video className="h-4 w-4 mr-2" />Reel script</TabsTrigger>
        <TabsTrigger value="ad" data-testid="subtab-ad"><Megaphone className="h-4 w-4 mr-2" />Ad copy (5-7 variations)</TabsTrigger>
      </TabsList>
      <TabsContent value="post"><SocialPostPanel /></TabsContent>
      <TabsContent value="reel"><ReelScriptPanel /></TabsContent>
      <TabsContent value="ad"><AdCopyPanel /></TabsContent>
    </Tabs>
  );
}

function CopyBtn({ text, testId }: { text: string; testId: string }) {
  const { toast } = useToast();
  return (
    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); }} data-testid={testId}>
      <Copy className="h-3 w-3 mr-1.5" />Copy
    </Button>
  );
}

function SocialPostPanel() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("instagram");
  const [contentType, setContentType] = useState("educational tip");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<any>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/post", { platform, contentType, topic: topic || undefined });
      return res.json();
    },
    onSuccess: (d) => { setResult(d); toast({ title: "Post generated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-emerald-500" />Social post</CardTitle><CardDescription>Generate ready-to-post social copy.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger data-testid="select-post-platform"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="twitter">X / Twitter</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Content type</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger data-testid="select-post-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="educational tip">Educational tip</SelectItem>
                <SelectItem value="feature highlight">Feature highlight</SelectItem>
                <SelectItem value="testimonial">Testimonial</SelectItem>
                <SelectItem value="promotional">Promotional</SelectItem>
                <SelectItem value="behind the scenes">Behind the scenes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Topic (optional)</Label>
            <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder="Leave blank for AI to choose" data-testid="input-post-topic" />
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold" data-testid="button-generate-post">
            {mut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate post</>}
          </Button>
        </CardContent>
      </Card>
      <div>
        {!result && !mut.isPending && (<Card className="border-dashed"><CardContent className="py-16 text-center text-slate-500"><MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Generated post will appear here.</p></CardContent></Card>)}
        {mut.isPending && (<Card><CardContent className="py-12 text-center text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-emerald-500" /></CardContent></Card>)}
        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Generated post</CardTitle>
                <CopyBtn text={`${result.caption || ""}\n\n${result.hashtags || ""}`} testId="button-copy-post" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {result.hook && (<div><div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-1">Hook</div><p className="text-slate-200" data-testid="text-post-hook">{result.hook}</p></div>)}
              <div><div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-1">Caption</div><p className="text-slate-300 whitespace-pre-wrap" data-testid="text-post-caption">{result.caption}</p></div>
              {result.cta && (<div><div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-1">CTA</div><p className="text-slate-300">{result.cta}</p></div>)}
              {result.hashtags && (<div><div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-1">Hashtags</div><p className="text-emerald-400 text-xs break-words">{result.hashtags}</p></div>)}
              {result.bestPostingTime && (<div className="text-xs text-slate-500"><strong>Best time:</strong> {result.bestPostingTime}</div>)}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ReelScriptPanel() {
  const { toast } = useToast();
  const [goal, setGoal] = useState("Drive sign-ups for free trial");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<any>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/reel-script", { goal, topic: topic || undefined });
      return res.json();
    },
    onSuccess: (d) => { setResult(d); toast({ title: "Reel script generated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-emerald-500" />Reel / Short script</CardTitle><CardDescription>Hook → Problem → Solution → CTA, with visual cues.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Goal</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} data-testid="input-reel-goal" /></div>
          <div className="space-y-1.5"><Label>Topic (optional)</Label><Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} data-testid="input-reel-topic" /></div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold" data-testid="button-generate-reel">
            {mut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate reel script</>}
          </Button>
        </CardContent>
      </Card>
      <div>
        {!result && !mut.isPending && (<Card className="border-dashed"><CardContent className="py-16 text-center text-slate-500"><Video className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Reel script will appear here.</p></CardContent></Card>)}
        {mut.isPending && (<Card><CardContent className="py-12 text-center text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-emerald-500" /></CardContent></Card>)}
        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Reel script</CardTitle>
                <CopyBtn text={`HOOK: ${result.hook}\n\nPROBLEM: ${result.problem}\n\nSOLUTION: ${result.solution}\n\nCTA: ${result.cta}\n\nVISUALS: ${result.visualDirections}`} testId="button-copy-reel" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { k: "Hook", v: result.hook, tid: "text-reel-hook" },
                { k: "Problem", v: result.problem, tid: "text-reel-problem" },
                { k: "Solution", v: result.solution, tid: "text-reel-solution" },
                { k: "CTA", v: result.cta, tid: "text-reel-cta" },
                { k: "Visual directions", v: result.visualDirections, tid: "text-reel-visuals" },
              ].map((row) => row.v ? (
                <div key={row.k}>
                  <div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-1">{row.k}</div>
                  <p className="text-slate-300 whitespace-pre-wrap" data-testid={row.tid}>{row.v}</p>
                </div>
              ) : null)}
              {Array.isArray(result.hookVariations) && result.hookVariations.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-1">Hook variations</div>
                  <ul className="list-disc list-inside text-slate-300 space-y-1">
                    {result.hookVariations.map((h: string, i: number) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function AdCopyPanel() {
  const { toast } = useToast();
  const [campaignGoal, setCampaignGoal] = useState("Drive free signups for trading journal");
  const [audience, setAudience] = useState("Retail forex/CFD traders, prop firm challenge takers, ages 22-45");
  const [result, setResult] = useState<any>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/ad-copy", { campaignGoal, audience });
      return res.json();
    },
    onSuccess: (d) => { setResult(d); toast({ title: "Ad copy generated", description: `${(d.variations || []).length} variations` }); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-emerald-500" />Meta ad copy</CardTitle><CardDescription>5-7 variations using AIDA, PAS, Hook-Story-Offer, etc.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Campaign goal</Label><Textarea value={campaignGoal} onChange={(e) => setCampaignGoal(e.target.value)} rows={3} data-testid="input-ad-goal" /></div>
          <div className="space-y-1.5"><Label>Audience</Label><Textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={3} data-testid="input-ad-audience" /></div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold" data-testid="button-generate-ad">
            {mut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate ad variations</>}
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {!result && !mut.isPending && (<Card className="border-dashed"><CardContent className="py-16 text-center text-slate-500"><Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Ad variations will appear here.</p></CardContent></Card>)}
        {mut.isPending && (<Card><CardContent className="py-12 text-center text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-emerald-500" /></CardContent></Card>)}
        {result?.variations?.map((v: any, i: number) => (
          <Card key={i} data-testid={`card-ad-variation-${i}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">{v.framework || `Variation ${i + 1}`}</Badge>
                <CopyBtn text={`${v.headline}\n${v.primaryText}\n${v.description}\nCTA: ${v.cta}`} testId={`button-copy-ad-${i}`} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold">Headline</div><p className="font-bold text-white">{v.headline}</p></div>
              <div><div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold">Primary text</div><p className="text-slate-300 whitespace-pre-wrap">{v.primaryText}</p></div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {v.description && <div><div className="text-slate-500 font-bold">Description</div><p className="text-slate-300">{v.description}</p></div>}
                {v.cta && <div><div className="text-slate-500 font-bold">CTA</div><p className="text-emerald-400">{v.cta}</p></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============== VIDEOS TAB ==============
function VideosTab() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("A focused trader transforming chaos into a clean dashboard, emerald accents");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState("8");
  const [platform, setPlatform] = useState("instagram");
  const [videos, setVideos] = useState<MediaAsset[]>([]);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/studio/video", {
        topic, aspectRatio, videoDuration: Number(duration), platform,
      });
      return res.json() as Promise<MediaAsset>;
    },
    onSuccess: (data) => {
      setVideos((prev) => [{ ...data, prompt: topic, createdAt: new Date().toISOString() }, ...prev]);
      toast({ title: "Video promo ready", description: "Your promo video has been rendered." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message || "Could not generate video", variant: "destructive" }),
  });

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Film className="h-5 w-5 text-emerald-500" />Video promo</CardTitle>
          <CardDescription>Render a short promo video from AI-generated frames + transitions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="videoTopic">Theme / story</Label>
            <Textarea id="videoTopic" value={topic} onChange={(e) => setTopic(e.target.value)} rows={5} data-testid="input-video-topic" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Aspect ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger data-testid="select-video-aspect"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">Vertical (9:16) — Reels/TikTok</SelectItem>
                  <SelectItem value="1:1">Square (1:1) — Feed</SelectItem>
                  <SelectItem value="16:9">Landscape (16:9) — YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration (s)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger data-testid="select-video-duration"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 seconds</SelectItem>
                  <SelectItem value="8">8 seconds</SelectItem>
                  <SelectItem value="12">12 seconds</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Target platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger data-testid="select-video-platform"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram / Reels</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube">YouTube Shorts</SelectItem>
                <SelectItem value="meta">Meta Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold" data-testid="button-generate-video">
            {mut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Rendering video… (~60-90s)</> : <><Sparkles className="h-4 w-4 mr-2" />Generate video promo</>}
          </Button>
          <p className="text-xs text-slate-500">Renders 4-6 AI frames stitched with smooth transitions via ffmpeg.</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Generated videos ({videos.length})</h3>
        {videos.length === 0 && !mut.isPending && (
          <Card className="border-dashed"><CardContent className="py-16 text-center text-slate-500">
            <Film className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No videos yet. Generate your first promo.</p>
          </CardContent></Card>
        )}
        {mut.isPending && (
          <Card><CardContent className="py-12 text-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-emerald-500" />
            <p className="text-sm">Rendering frames + ffmpeg encode… stay on this page.</p>
          </CardContent></Card>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {videos.map((v) => (
            <Card key={v.id} className="overflow-hidden" data-testid={`card-video-${v.id}`}>
              <video src={v.fileUrl} controls className="w-full bg-black" style={{ maxHeight: 400 }} />
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-slate-400 line-clamp-2">{v.prompt}</p>
                <a href={v.fileUrl} download={v.fileName} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 hover:underline" data-testid={`link-download-video-${v.id}`}>
                  <Download className="h-3 w-3" />Download MP4
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
