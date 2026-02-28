import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, Sparkles, Users, DollarSign, Settings, BookOpen,
  Copy, Save, RefreshCw, Trash2, ChevronDown, ChevronUp,
  Zap, TrendingUp, Shield, Clock, ArrowRight
} from "lucide-react";
import { format } from "date-fns";

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

function CampaignBuilderTab() {
  const { toast } = useToast();
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");
  const [audience, setAudience] = useState("");
  const [timeline, setTimeline] = useState("");
  const [result, setResult] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const generateMutation = useMutation({
    mutationFn: async (data: { goal: string; budget: string; audience: string }) => {
      const res = await apiRequest("POST", "/api/admin/marketing/ad-strategy", data);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/ad-strategies"] });
      toast({ title: "Strategy Generated", description: "Campaign strategy created and saved." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Generation Failed", description: error.message });
    },
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  };

  const strategyData = result?.fullStrategy || result;

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Target size={16} className="text-emerald-500" /> Campaign Parameters
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Define your campaign objectives and constraints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Campaign Goal</label>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger className="bg-muted border-border" data-testid="select-campaign-goal">
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signups">Drive Signups</SelectItem>
                  <SelectItem value="awareness">Brand Awareness</SelectItem>
                  <SelectItem value="retargeting">Retargeting</SelectItem>
                  <SelectItem value="feature_launch">Feature Launch</SelectItem>
                  <SelectItem value="free_trial">Free Trial Promotion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Budget (USD)</label>
              <Input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. $500/month or $20/day"
                className="bg-muted border-border text-sm"
                data-testid="input-campaign-budget"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Target Audience</label>
              <Input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Forex traders, prop firm challengers"
                className="bg-muted border-border text-sm"
                data-testid="input-campaign-audience"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Timeline</label>
              <Select value={timeline} onValueChange={setTimeline}>
                <SelectTrigger className="bg-muted border-border" data-testid="select-campaign-timeline">
                  <SelectValue placeholder="Select timeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7_days">7 Days</SelectItem>
                  <SelectItem value="14_days">14 Days</SelectItem>
                  <SelectItem value="30_days">30 Days</SelectItem>
                  <SelectItem value="60_days">60 Days</SelectItem>
                  <SelectItem value="90_days">90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs mt-2"
            onClick={() => generateMutation.mutate({ goal, budget, audience })}
            disabled={generateMutation.isPending || !goal || !budget || !audience}
            data-testid="button-generate-campaign"
          >
            {generateMutation.isPending ? (
              <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Generating Strategy...</span>
            ) : (
              <span className="flex items-center gap-2"><Sparkles size={14} /> Generate Campaign Strategy</span>
            )}
          </Button>
        </CardContent>
      </Card>

      {generateMutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {strategyData && !generateMutation.isPending && (
        <div className="space-y-4" data-testid="campaign-strategy-result">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Zap size={16} className="text-emerald-500" /> Campaign Type
                </h3>
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-emerald-500/30 text-emerald-500">
                  {strategyData.campaignType || "Generated"}
                </Badge>
              </div>
              {strategyData.campaignTypeReasoning && (
                <p className="text-sm text-muted-foreground">{strategyData.campaignTypeReasoning}</p>
              )}
            </CardContent>
          </Card>

          {strategyData.adSetStructure && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => toggleSection("adSet")}
                  data-testid="button-toggle-adset"
                >
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Users size={16} className="text-blue-500" /> Ad Set Structure
                  </h3>
                  {expandedSections.adSet ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSections.adSet && (
                  <div className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
                    {typeof strategyData.adSetStructure === "string"
                      ? strategyData.adSetStructure
                      : JSON.stringify(strategyData.adSetStructure, null, 2)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {strategyData.audienceTargeting && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => toggleSection("audience")}
                  data-testid="button-toggle-audience"
                >
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Target size={16} className="text-purple-500" /> Audience Configuration
                  </h3>
                  {expandedSections.audience ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSections.audience && (
                  <div className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
                    {typeof strategyData.audienceTargeting === "string"
                      ? strategyData.audienceTargeting
                      : JSON.stringify(strategyData.audienceTargeting, null, 2)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {strategyData.budgetAllocation && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => toggleSection("budget")}
                  data-testid="button-toggle-budget"
                >
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <DollarSign size={16} className="text-amber-500" /> Budget Allocation
                  </h3>
                  {expandedSections.budget ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSections.budget && (
                  <div className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
                    {typeof strategyData.budgetAllocation === "string"
                      ? strategyData.budgetAllocation
                      : JSON.stringify(strategyData.budgetAllocation, null, 2)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {strategyData.bidStrategy && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <TrendingUp size={16} className="text-emerald-500" /> Bid Strategy
                </h3>
                <p className="text-sm text-muted-foreground">{strategyData.bidStrategy}</p>
              </CardContent>
            </Card>
          )}

          {strategyData.testingPhases && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => toggleSection("testing")}
                  data-testid="button-toggle-testing"
                >
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Clock size={16} className="text-blue-500" /> Testing Phases
                  </h3>
                  {expandedSections.testing ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSections.testing && (
                  <div className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
                    {typeof strategyData.testingPhases === "string"
                      ? strategyData.testingPhases
                      : JSON.stringify(strategyData.testingPhases, null, 2)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {strategyData.setupInstructions && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <BookOpen size={16} className="text-emerald-500" /> Setup Instructions
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(
                      typeof strategyData.setupInstructions === "string"
                        ? strategyData.setupInstructions
                        : JSON.stringify(strategyData.setupInstructions, null, 2)
                    )}
                    data-testid="button-copy-setup"
                  >
                    <Copy size={14} className="mr-1" /> Copy
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof strategyData.setupInstructions === "string"
                    ? strategyData.setupInstructions
                    : JSON.stringify(strategyData.setupInstructions, null, 2)}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                generateMutation.mutate({ goal, budget, audience });
              }}
              data-testid="button-regenerate-campaign"
            >
              <RefreshCw size={14} className="mr-1" /> Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdCopyGeneratorTab() {
  const { toast } = useToast();
  const [campaignGoal, setCampaignGoal] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [result, setResult] = useState<any>(null);

  const { data: campaigns } = useQuery<any[]>({
    queryKey: ["/api/admin/marketing/campaigns"],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { campaignGoal: string; audience: string }) => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/ad-copy", data);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Ad Copy Generated", description: `${data.variations?.length || 0} variations created.` });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Generation Failed", description: error.message });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (variation: any) => {
      const res = await apiRequest("POST", "/api/admin/marketing/content", {
        type: "ad_copy",
        platform: "meta_ads",
        title: variation.headline || "Ad Copy",
        content: `${variation.primaryText || ""}\n\nHeadline: ${variation.headline || ""}\nDescription: ${variation.description || ""}`,
        hook: variation.primaryText,
        cta: variation.description,
        frameworkUsed: variation.framework,
        status: "draft",
        aiModelUsed: "openai",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/content"] });
      toast({ title: "Saved", description: "Ad copy saved to content library." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Save Failed", description: error.message });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-500" /> Ad Copy Parameters
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Generate multiple ad copy variations with different frameworks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Campaign Goal</label>
              <Select value={campaignGoal} onValueChange={setCampaignGoal}>
                <SelectTrigger className="bg-muted border-border" data-testid="select-adcopy-goal">
                  <SelectValue placeholder="Select or describe goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drive_signups">Drive Signups</SelectItem>
                  <SelectItem value="increase_awareness">Increase Awareness</SelectItem>
                  <SelectItem value="promote_feature">Promote Feature</SelectItem>
                  <SelectItem value="retarget_users">Retarget Users</SelectItem>
                  <SelectItem value="free_trial">Free Trial Promotion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Target Audience</label>
              <Input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Beginner forex traders aged 25-40"
                className="bg-muted border-border text-sm"
                data-testid="input-adcopy-audience"
              />
            </div>
          </div>
          <Button
            className="w-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs mt-2"
            onClick={() => generateMutation.mutate({ campaignGoal, audience: targetAudience })}
            disabled={generateMutation.isPending || !campaignGoal || !targetAudience}
            data-testid="button-generate-adcopy"
          >
            {generateMutation.isPending ? (
              <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Generating Variations...</span>
            ) : (
              <span className="flex items-center gap-2"><Sparkles size={14} /> Generate Ad Copy Variations</span>
            )}
          </Button>
        </CardContent>
      </Card>

      {generateMutation.isPending && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {result?.variations && !generateMutation.isPending && (
        <div className="space-y-4" data-testid="adcopy-result">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-widest">
              {result.variations.length} Variations Generated
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResult(null);
                generateMutation.mutate({ campaignGoal, audience: targetAudience });
              }}
              data-testid="button-regenerate-adcopy"
            >
              <RefreshCw size={14} className="mr-1" /> Generate More
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.variations.map((variation: any, index: number) => (
              <Card key={index} className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-blue-500/30 text-blue-500">
                      {variation.framework || `Variation ${index + 1}`}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyToClipboard(`${variation.primaryText}\n\nHeadline: ${variation.headline}\nDescription: ${variation.description}`)}
                        data-testid={`button-copy-adcopy-${index}`}
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => saveMutation.mutate(variation)}
                        disabled={saveMutation.isPending}
                        data-testid={`button-save-adcopy-${index}`}
                      >
                        <Save size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Primary Text</div>
                      <p className="text-sm text-foreground">{variation.primaryText}</p>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Headline</div>
                      <p className="text-sm font-bold text-foreground">{variation.headline}</p>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Description</div>
                      <p className="text-sm text-muted-foreground">{variation.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {result && !result.variations && !generateMutation.isPending && (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-bold text-foreground">Generated Ad Copy</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(typeof result === "string" ? result : JSON.stringify(result, null, 2))}
                data-testid="button-copy-raw-adcopy"
              >
                <Copy size={14} className="mr-1" /> Copy
              </Button>
            </div>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
              {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AudienceStrategyTab() {
  const { toast } = useToast();
  const [budget, setBudget] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<any>(null);

  const generateMutation = useMutation({
    mutationFn: async (data: { budget: string; goal: string }) => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/audience-strategy", data);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Audience Strategy Generated", description: "Targeting recommendations ready." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Generation Failed", description: error.message });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Strategy copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Users size={16} className="text-emerald-500" /> Audience Parameters
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Get targeting recommendations for Meta Ads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Monthly Budget (USD)</label>
              <Input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. $500"
                className="bg-muted border-border text-sm"
                data-testid="input-audience-budget"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Campaign Goal</label>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger className="bg-muted border-border" data-testid="select-audience-goal">
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signups">Drive Signups</SelectItem>
                  <SelectItem value="awareness">Brand Awareness</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                  <SelectItem value="conversions">Conversions</SelectItem>
                  <SelectItem value="retargeting">Retargeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs mt-2"
            onClick={() => generateMutation.mutate({ budget, goal })}
            disabled={generateMutation.isPending || !budget || !goal}
            data-testid="button-generate-audience"
          >
            {generateMutation.isPending ? (
              <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Analyzing Audiences...</span>
            ) : (
              <span className="flex items-center gap-2"><Users size={14} /> Generate Audience Strategy</span>
            )}
          </Button>
        </CardContent>
      </Card>

      {generateMutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {result && !generateMutation.isPending && (
        <div className="space-y-4" data-testid="audience-strategy-result">
          {result.broadTargeting && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Target size={16} className="text-purple-500" /> Broad / Andromeda Targeting
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof result.broadTargeting === "string" ? result.broadTargeting : JSON.stringify(result.broadTargeting, null, 2)}
                </div>
              </CardContent>
            </Card>
          )}

          {result.interestTargeting && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-blue-500" /> Interest Targeting
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof result.interestTargeting === "string" ? result.interestTargeting : JSON.stringify(result.interestTargeting, null, 2)}
                </div>
              </CardContent>
            </Card>
          )}

          {result.lookalike && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Users size={16} className="text-emerald-500" /> Lookalike Audiences
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof result.lookalike === "string" ? result.lookalike : JSON.stringify(result.lookalike, null, 2)}
                </div>
              </CardContent>
            </Card>
          )}

          {result.retargeting && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <RefreshCw size={16} className="text-amber-500" /> Retargeting Funnel
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof result.retargeting === "string" ? result.retargeting : JSON.stringify(result.retargeting, null, 2)}
                </div>
              </CardContent>
            </Card>
          )}

          {result.customAudiences && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-blue-500" /> Custom Audiences Setup
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof result.customAudiences === "string" ? result.customAudiences : JSON.stringify(result.customAudiences, null, 2)}
                </div>
              </CardContent>
            </Card>
          )}

          {(!result.broadTargeting && !result.interestTargeting && !result.lookalike) && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h3 className="font-bold text-foreground">Audience Strategy</h3>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(JSON.stringify(result, null, 2))} data-testid="button-copy-audience">
                    <Copy size={14} className="mr-1" /> Copy
                  </Button>
                </div>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                generateMutation.mutate({ budget, goal });
              }}
              data-testid="button-regenerate-audience"
            >
              <RefreshCw size={14} className="mr-1" /> Regenerate
            </Button>
            <Button
              variant="outline"
              onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
              data-testid="button-copy-audience-all"
            >
              <Copy size={14} className="mr-1" /> Copy All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptimizationRulesTab() {
  const { toast } = useToast();
  const [campaignType, setCampaignType] = useState("");
  const [result, setResult] = useState<any>(null);

  const generateMutation = useMutation({
    mutationFn: async (data: { campaignType: string }) => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/optimization-rules", data);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Rules Generated", description: "Optimization rules ready for review." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Generation Failed", description: error.message });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Rules copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Settings size={16} className="text-emerald-500" /> Campaign Type
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Generate kill rules, scale rules, fatigue thresholds, and day-parting suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Campaign Type</label>
            <Select value={campaignType} onValueChange={setCampaignType}>
              <SelectTrigger className="bg-muted border-border" data-testid="select-optimization-type">
                <SelectValue placeholder="Select campaign type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="advantage_plus">Advantage+ Shopping</SelectItem>
                <SelectItem value="manual_sales">Manual Sales Campaign</SelectItem>
                <SelectItem value="cbo">Campaign Budget Optimization (CBO)</SelectItem>
                <SelectItem value="leads">Lead Generation</SelectItem>
                <SelectItem value="traffic">Traffic Campaign</SelectItem>
                <SelectItem value="awareness">Awareness Campaign</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs mt-2"
            onClick={() => generateMutation.mutate({ campaignType })}
            disabled={generateMutation.isPending || !campaignType}
            data-testid="button-generate-rules"
          >
            {generateMutation.isPending ? (
              <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Generating Rules...</span>
            ) : (
              <span className="flex items-center gap-2"><Settings size={14} /> Generate Optimization Rules</span>
            )}
          </Button>
        </CardContent>
      </Card>

      {generateMutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {result && !generateMutation.isPending && (
        <div className="space-y-4" data-testid="optimization-rules-result">
          {result.killRules && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-rose-500" /> Kill Rules
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof result.killRules === "string" ? result.killRules : (
                    Array.isArray(result.killRules) ? result.killRules.map((rule: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 mb-2">
                        <span className="text-rose-500 font-mono text-xs mt-0.5">{i + 1}.</span>
                        <span>{rule}</span>
                      </div>
                    )) : JSON.stringify(result.killRules, null, 2)
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {result.scaleRules && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <TrendingUp size={16} className="text-emerald-500" /> Scale Rules
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof result.scaleRules === "string" ? result.scaleRules : (
                    Array.isArray(result.scaleRules) ? result.scaleRules.map((rule: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 mb-2">
                        <span className="text-emerald-500 font-mono text-xs mt-0.5">{i + 1}.</span>
                        <span>{rule}</span>
                      </div>
                    )) : JSON.stringify(result.scaleRules, null, 2)
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {result.fatigueThresholds && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-amber-500" /> Creative Fatigue Thresholds
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof result.fatigueThresholds === "string" ? result.fatigueThresholds : JSON.stringify(result.fatigueThresholds, null, 2)}
                </div>
              </CardContent>
            </Card>
          )}

          {result.dayParting && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-blue-500" /> Day-Parting Suggestions
                </h3>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof result.dayParting === "string" ? result.dayParting : JSON.stringify(result.dayParting, null, 2)}
                </div>
              </CardContent>
            </Card>
          )}

          {(!result.killRules && !result.scaleRules) && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
              data-testid="button-copy-rules"
            >
              <Copy size={14} className="mr-1" /> Copy All Rules
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                generateMutation.mutate({ campaignType });
              }}
              data-testid="button-regenerate-rules"
            >
              <RefreshCw size={14} className="mr-1" /> Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaybooksTab() {
  const { toast } = useToast();
  const [expandedPlaybook, setExpandedPlaybook] = useState<number | null>(null);

  const { data: playbooks, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/marketing/playbooks"],
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Playbook copied to clipboard." });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!playbooks || playbooks.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-12 text-center">
          <BookOpen size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No playbooks available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="playbooks-list">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen size={16} className="text-emerald-500" />
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {playbooks.length} Campaign Playbooks
        </span>
      </div>

      {playbooks.map((playbook: any, index: number) => (
        <Card key={index} className="bg-card border-border">
          <CardContent className="p-6">
            <button
              className="w-full text-left"
              onClick={() => setExpandedPlaybook(expandedPlaybook === index ? null : index)}
              data-testid={`button-playbook-${index}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-foreground text-base">{playbook.name || playbook.title || `Playbook ${index + 1}`}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{playbook.description || playbook.overview}</p>
                </div>
                <div className="flex items-center gap-2">
                  {playbook.budget && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-amber-500/30 text-amber-500">
                      {playbook.budget}
                    </Badge>
                  )}
                  {playbook.timeline && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-blue-500/30 text-blue-500">
                      {playbook.timeline}
                    </Badge>
                  )}
                  {expandedPlaybook === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>
            </button>

            {expandedPlaybook === index && (
              <div className="mt-6 space-y-4 border-t border-border pt-4">
                {playbook.structure && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Campaign Structure</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded-md">
                      {typeof playbook.structure === "string" ? playbook.structure : JSON.stringify(playbook.structure, null, 2)}
                    </div>
                  </div>
                )}
                {playbook.targeting && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Targeting</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded-md">
                      {typeof playbook.targeting === "string" ? playbook.targeting : JSON.stringify(playbook.targeting, null, 2)}
                    </div>
                  </div>
                )}
                {playbook.copy && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Ad Copy</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded-md">
                      {typeof playbook.copy === "string" ? playbook.copy : JSON.stringify(playbook.copy, null, 2)}
                    </div>
                  </div>
                )}
                {playbook.schedule && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Timeline / Schedule</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded-md">
                      {typeof playbook.schedule === "string" ? playbook.schedule : JSON.stringify(playbook.schedule, null, 2)}
                    </div>
                  </div>
                )}

                {(!playbook.structure && !playbook.targeting) && (
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded-md">
                    {JSON.stringify(playbook, null, 2)}
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap pt-2">
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(JSON.stringify(playbook, null, 2))}
                    data-testid={`button-copy-playbook-${index}`}
                  >
                    <Copy size={14} className="mr-1" /> Copy Playbook
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SavedStrategiesSection() {
  const { toast } = useToast();

  const { data: strategies, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/marketing/ad-strategies"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/marketing/ad-strategies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/ad-strategies"] });
      toast({ title: "Deleted", description: "Strategy removed." });
    },
  });

  if (isLoading) return null;
  if (!strategies || strategies.length === 0) return null;

  return (
    <Card className="bg-card border-border mt-6">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <BookOpen size={16} className="text-muted-foreground" /> Saved Strategies ({strategies.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {strategies.map((strategy: any) => (
            <div key={strategy.id} className="flex items-center justify-between gap-4 p-3 bg-muted rounded-md">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-foreground">{strategy.objective}</span>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-muted-foreground/30 text-muted-foreground">
                    {strategy.campaignType}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {strategy.createdAt ? format(new Date(strategy.createdAt), "MMM d, yyyy HH:mm") : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => deleteMutation.mutate(strategy.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-strategy-${strategy.id}`}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export default function MetaAdsStrategist() {
  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-meta-ads-title">
          <Target /> Meta Ads Strategist
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">AI-Powered Campaign Strategy & Ad Copy Generation</p>
      </div>

      <Tabs defaultValue="campaign-builder" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-1 h-auto bg-muted p-1" data-testid="tabs-meta-ads">
          <TabsTrigger value="campaign-builder" className="text-xs font-bold uppercase tracking-widest" data-testid="tab-campaign-builder">
            Campaign Builder
          </TabsTrigger>
          <TabsTrigger value="ad-copy" className="text-xs font-bold uppercase tracking-widest" data-testid="tab-ad-copy">
            Ad Copy
          </TabsTrigger>
          <TabsTrigger value="audience" className="text-xs font-bold uppercase tracking-widest" data-testid="tab-audience">
            Audience
          </TabsTrigger>
          <TabsTrigger value="optimization" className="text-xs font-bold uppercase tracking-widest" data-testid="tab-optimization">
            Optimization
          </TabsTrigger>
          <TabsTrigger value="playbooks" className="text-xs font-bold uppercase tracking-widest" data-testid="tab-playbooks">
            Playbooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaign-builder" className="mt-6">
          <CampaignBuilderTab />
          <SavedStrategiesSection />
        </TabsContent>

        <TabsContent value="ad-copy" className="mt-6">
          <AdCopyGeneratorTab />
        </TabsContent>

        <TabsContent value="audience" className="mt-6">
          <AudienceStrategyTab />
        </TabsContent>

        <TabsContent value="optimization" className="mt-6">
          <OptimizationRulesTab />
        </TabsContent>

        <TabsContent value="playbooks" className="mt-6">
          <PlaybooksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
