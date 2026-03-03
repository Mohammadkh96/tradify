import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, FileText, BarChart3, Users, TrendingUp, ArrowUpRight, PenTool, Clock, RefreshCw, Sparkles, Wand2, Loader2, Play, Settings, Lightbulb, Zap, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface MarketingStats {
  totalContent: number;
  contentByType: Record<string, number>;
  contentByPlatform: Record<string, number>;
  activeCampaigns: number;
  totalCampaigns: number;
  recentContent: Array<{
    id: number;
    type: string;
    platform: string;
    title: string;
    content: string;
    status: string;
    createdAt: string;
  }>;
  userInsights: {
    totalUsers: number;
    signupsThisWeek: number;
    signupsThisMonth: number;
    freeUsers: number;
    proUsers: number;
    eliteUsers: number;
    conversionRate: string;
  };
}

interface SmartSuggestion {
  title: string;
  type: string;
  platform: string;
  description: string;
  hook: string;
  reasoning: string;
}

interface PipelineConfig {
  enabled: boolean;
  weeklyTypes: { type: string; count: number; platform: string }[];
}

const typeColors: Record<string, string> = {
  post: "border-blue-500/30 text-blue-500",
  reel_script: "border-purple-500/30 text-purple-500",
  blog: "border-amber-500/30 text-amber-500",
  ad_copy: "border-rose-500/30 text-rose-500",
  email: "border-cyan-500/30 text-cyan-500",
};

const platformColors: Record<string, string> = {
  instagram: "border-pink-500/30 text-pink-500",
  facebook: "border-blue-500/30 text-blue-500",
  twitter: "border-sky-500/30 text-sky-500",
  linkedin: "border-blue-600/30 text-blue-600",
  tiktok: "border-fuchsia-500/30 text-fuchsia-500",
  meta_ads: "border-indigo-500/30 text-indigo-500",
  email: "border-cyan-500/30 text-cyan-500",
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export default function MarketingDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: stats, isLoading, isFetching, refetch } = useQuery<MarketingStats>({
    queryKey: ["/api/admin/marketing/stats"],
  });

  const { data: brandSettings } = useQuery<any>({
    queryKey: ["/api/admin/marketing/brand-settings"],
  });

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>({
    enabled: false,
    weeklyTypes: [
      { type: "post", count: 3, platform: "instagram" },
      { type: "blog", count: 1, platform: "instagram" },
      { type: "email", count: 1, platform: "email" },
    ],
  });
  const [pipelineLoaded, setPipelineLoaded] = useState(false);

  useEffect(() => {
    if (brandSettings?.contentPipeline && !pipelineLoaded) {
      try {
        const saved = typeof brandSettings.contentPipeline === "string"
          ? JSON.parse(brandSettings.contentPipeline)
          : brandSettings.contentPipeline;
        if (saved && saved.weeklyTypes) {
          setPipelineConfig(saved);
          setPipelineLoaded(true);
        }
      } catch { /* ignore */ }
    }
  }, [brandSettings, pipelineLoaded]);

  const suggestionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/smart-suggestions", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      setSuggestions(data.suggestions || []);
      toast({ title: "Smart Suggestions Ready", description: `${data.suggestions?.length || 0} content ideas based on your top performers.` });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Suggestions Failed", description: err.message });
    },
  });

  const pipelineRunMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/pipeline/run", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/content"] });
      toast({ title: "Pipeline Complete!", description: `${data.count || data.content?.length || 0} content pieces generated and scheduled.` });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Pipeline Failed", description: err.message });
    },
  });

  const pipelineSaveMutation = useMutation({
    mutationFn: async (config: PipelineConfig) => {
      const res = await apiRequest("PATCH", "/api/admin/marketing/pipeline", { contentPipeline: config });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pipeline Saved", description: "Your content pipeline config has been saved." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Save Failed", description: err.message });
    },
  });

  const addPipelineType = () => {
    setPipelineConfig(prev => ({
      ...prev,
      weeklyTypes: [...prev.weeklyTypes, { type: "post", count: 1, platform: "instagram" }],
    }));
  };

  const removePipelineType = (idx: number) => {
    setPipelineConfig(prev => ({
      ...prev,
      weeklyTypes: prev.weeklyTypes.filter((_, i) => i !== idx),
    }));
  };

  const updatePipelineType = (idx: number, field: string, value: any) => {
    setPipelineConfig(prev => ({
      ...prev,
      weeklyTypes: prev.weeklyTypes.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }));
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 bg-background min-h-screen text-foreground" data-testid="marketing-dashboard-loading">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const contentByType = stats?.contentByType || {};
  const contentByPlatform = stats?.contentByPlatform || {};
  const userInsights = stats?.userInsights;
  const recentContent = stats?.recentContent || [];

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground" data-testid="marketing-dashboard">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-marketing-dashboard-title">
            <Megaphone /> Marketing Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold" data-testid="text-marketing-dashboard-subtitle">
            AI-Powered Content & Strategy
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-stats"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/marketing/content-studio")}
            data-testid="button-quick-generate-post"
          >
            <PenTool size={16} className="mr-2" /> Content Studio
          </Button>
          <Button
            className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
            onClick={() => navigate("/admin/marketing/content-library")}
            data-testid="button-quick-calendar"
          >
            <Calendar size={16} className="mr-2" /> Library & Calendar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border" data-testid="card-total-content">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-foreground" data-testid="text-total-content-count">{stats?.totalContent || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Total Content</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <FileText size={20} className="text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-total-users">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-foreground" data-testid="text-total-users-count">{userInsights?.totalUsers || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Total Users</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-purple-500/10 flex items-center justify-center">
                <Users size={20} className="text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-conversion-rate">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-emerald-500" data-testid="text-conversion-rate">{userInsights?.conversionRate || "0"}%</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Conversion Rate</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-signups-week">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-blue-500" data-testid="text-signups-week">{userInsights?.signupsThisWeek || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Signups This Week</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-blue-500/10 flex items-center justify-center">
                <Users size={20} className="text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SmartSuggestionsPanel
          suggestions={suggestions}
          isLoading={suggestionsMutation.isPending}
          onGenerate={() => suggestionsMutation.mutate()}
          navigate={navigate}
        />

        <ContentPipelinePanel
          config={pipelineConfig}
          onUpdateConfig={setPipelineConfig}
          onAddType={addPipelineType}
          onRemoveType={removePipelineType}
          onUpdateType={updatePipelineType}
          onSave={() => pipelineSaveMutation.mutate(pipelineConfig)}
          onRun={() => pipelineRunMutation.mutate()}
          isSaving={pipelineSaveMutation.isPending}
          isRunning={pipelineRunMutation.isPending}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border" data-testid="card-content-by-type">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-500" /> Content by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(contentByType).length === 0 ? (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-content-type">No content generated yet. Start creating in the Content Studio.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(contentByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between gap-4" data-testid={`row-content-type-${type}`}>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${typeColors[type] || "border-muted-foreground/30 text-muted-foreground"}`}>
                        {type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, (count / (stats?.totalContent || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-content-by-platform">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-500" /> Content by Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(contentByPlatform).length === 0 ? (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-content-platform">No content generated yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(contentByPlatform).map(([platform, count]) => (
                  <div key={platform} className="flex items-center justify-between gap-4" data-testid={`row-content-platform-${platform}`}>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${platformColors[platform] || "border-muted-foreground/30 text-muted-foreground"}`}>
                        {platform.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, (count / (stats?.totalContent || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border" data-testid="card-user-insights">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-emerald-500" /> User Data Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-md" data-testid="stat-signups-week">
                <div className="text-xl font-black text-foreground">{userInsights?.signupsThisWeek || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Signups This Week</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-signups-month">
                <div className="text-xl font-black text-foreground">{userInsights?.signupsThisMonth || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Signups This Month</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-free-users">
                <div className="text-xl font-black text-foreground">{userInsights?.freeUsers || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Free Users</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-pro-users">
                <div className="text-xl font-black text-emerald-500">{userInsights?.proUsers || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Pro Users</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-elite-users">
                <div className="text-xl font-black text-amber-500">{userInsights?.eliteUsers || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Elite Users</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-conversion">
                <div className="text-xl font-black text-emerald-500">{userInsights?.conversionRate || "0"}%</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Free to Paid</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-recent-activity">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} className="text-emerald-500" /> Recent Content Activity
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/marketing/content-library")}
              data-testid="button-view-all-content"
            >
              View All <ArrowUpRight size={14} className="ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentContent.length === 0 ? (
              <div className="text-center py-8" data-testid="text-no-recent-activity">
                <p className="text-sm text-muted-foreground italic mb-4">No content created yet.</p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/marketing/content-studio")}
                  data-testid="button-start-creating"
                >
                  <PenTool size={16} className="mr-2" /> Start Creating
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentContent.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-md"
                    data-testid={`row-recent-content-${item.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate" data-testid={`text-recent-title-${item.id}`}>
                        {item.title || item.content.substring(0, 60) + "..."}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-[8px] font-black uppercase tracking-widest ${typeColors[item.type] || "border-muted-foreground/30 text-muted-foreground"}`}>
                          {item.type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className={`text-[8px] font-black uppercase tracking-widest ${platformColors[item.platform] || "border-muted-foreground/30 text-muted-foreground"}`}>
                          {item.platform.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono whitespace-nowrap" data-testid={`text-recent-date-${item.id}`}>
                      {item.createdAt ? format(new Date(item.createdAt), "MMM d") : "N/A"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SmartSuggestionsPanel({ suggestions, isLoading, onGenerate, navigate }: {
  suggestions: SmartSuggestion[];
  isLoading: boolean;
  onGenerate: () => void;
  navigate: (path: string) => void;
}) {
  return (
    <Card className="bg-card border-border" data-testid="card-smart-suggestions">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Lightbulb size={16} className="text-amber-500" /> Smart Suggestions
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={onGenerate}
          disabled={isLoading}
          className="gap-1.5"
          data-testid="button-get-suggestions"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {isLoading ? "Analyzing..." : "Get Suggestions"}
        </Button>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-6">
            <Lightbulb size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-suggestions">
              Rate your content to unlock AI-powered suggestions based on your top performers.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Get Suggestions" to analyze your best-rated content and receive personalized ideas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s, idx) => (
              <div key={idx} className="p-3 border border-border rounded-md space-y-2" data-testid={`card-suggestion-${idx}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", typeColors[s.type] || "border-muted-foreground/30 text-muted-foreground")}>
                    {s.type.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", platformColors[s.platform] || "border-muted-foreground/30 text-muted-foreground")}>
                    {s.platform}
                  </Badge>
                </div>
                <h4 className="text-sm font-bold text-foreground" data-testid={`text-suggestion-title-${idx}`}>{s.title}</h4>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                {s.hook && (
                  <div className="text-xs italic text-foreground/80 bg-muted px-2 py-1 rounded">
                    Hook: "{s.hook}"
                  </div>
                )}
                <div className="text-[10px] text-amber-500/80">
                  <Sparkles size={10} className="inline mr-1" /> {s.reasoning}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1"
                  onClick={() => navigate("/admin/marketing/content-studio")}
                  data-testid={`button-generate-suggestion-${idx}`}
                >
                  <Wand2 size={12} /> Generate This
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContentPipelinePanel({ config, onUpdateConfig, onAddType, onRemoveType, onUpdateType, onSave, onRun, isSaving, isRunning }: {
  config: PipelineConfig;
  onUpdateConfig: (c: PipelineConfig) => void;
  onAddType: () => void;
  onRemoveType: (idx: number) => void;
  onUpdateType: (idx: number, field: string, value: any) => void;
  onSave: () => void;
  onRun: () => void;
  isSaving: boolean;
  isRunning: boolean;
}) {
  return (
    <Card className="bg-card border-border" data-testid="card-content-pipeline">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Zap size={16} className="text-emerald-500" /> Content Pipeline
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onSave}
            disabled={isSaving}
            className="gap-1.5 text-xs"
            data-testid="button-save-pipeline"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Settings size={12} />}
            {isSaving ? "Saving..." : "Save Config"}
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white font-bold uppercase tracking-widest text-xs gap-1.5"
            onClick={onRun}
            disabled={isRunning || config.weeklyTypes.length === 0}
            data-testid="button-run-pipeline"
          >
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isRunning ? "Running..." : "Run Pipeline Now"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground mb-2">
            Configure what content gets auto-generated when you run the pipeline. Content will be scheduled across the current week as drafts.
          </div>

          {config.weeklyTypes.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap" data-testid={`pipeline-row-${idx}`}>
              <Select value={item.type} onValueChange={(v) => onUpdateType(idx, "type", v)}>
                <SelectTrigger className="w-32 h-8 text-xs bg-muted border-border" data-testid={`select-pipeline-type-${idx}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="reel_script">Reel Script</SelectItem>
                  <SelectItem value="blog">Blog</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="ad_copy">Ad Copy</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">x</span>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={item.count}
                  onChange={(e) => onUpdateType(idx, "count", parseInt(e.target.value) || 1)}
                  className="w-16 h-8 text-xs bg-muted border-border text-center"
                  data-testid={`input-pipeline-count-${idx}`}
                />
              </div>

              <Select value={item.platform} onValueChange={(v) => onUpdateType(idx, "platform", v)}>
                <SelectTrigger className="w-32 h-8 text-xs bg-muted border-border" data-testid={`select-pipeline-platform-${idx}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                onClick={() => onRemoveType(idx)}
                data-testid={`button-remove-pipeline-${idx}`}
              >
                <span className="text-lg leading-none">&times;</span>
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={onAddType}
            className="text-xs w-full"
            data-testid="button-add-pipeline-type"
          >
            + Add Content Type
          </Button>

          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border">
            Total per run: {config.weeklyTypes.reduce((sum, t) => sum + t.count, 0)} pieces
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
