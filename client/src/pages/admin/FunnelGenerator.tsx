import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Megaphone, BookOpen, Target, Zap, Heart,
  Image, MessageSquare, Video, FileText, Globe,
  GitCompare, Quote, TrendingUp, Mail,
  Download, Copy, Trash2, RefreshCw, Loader2,
  CheckCircle, Package, ExternalLink, ChevronDown, ChevronUp
} from "lucide-react";

interface FunnelStage {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  goal: string;
  strategy: string;
  tone: string;
  color: string;
  assetTypes: { id: string; label: string; icon: string; description: string }[];
}

interface GeneratedAsset {
  id: string;
  type: string;
  stage: string;
  platform: string;
  content?: string;
  fileUrl?: string;
  htmlContent?: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
  metadata?: Record<string, any>;
  generatedAt: string;
}

const stageIcons: Record<string, any> = {
  awareness: Megaphone,
  consideration: BookOpen,
  decision: Target,
  action: Zap,
  loyalty: Heart,
};

const stageColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  awareness: { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400", glow: "shadow-emerald-500/20" },
  consideration: { bg: "bg-blue-500/10", border: "border-blue-500/40", text: "text-blue-400", glow: "shadow-blue-500/20" },
  decision: { bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400", glow: "shadow-amber-500/20" },
  action: { bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-400", glow: "shadow-purple-500/20" },
  loyalty: { bg: "bg-pink-500/10", border: "border-pink-500/40", text: "text-pink-400", glow: "shadow-pink-500/20" },
};

const assetTypeIcons: Record<string, any> = {
  ad_image: Image,
  social_post: MessageSquare,
  reel_script: Video,
  ad_copy: FileText,
  landing_page: Globe,
  blog_article: BookOpen,
  email_campaign: Mail,
  comparison_post: GitCompare,
  testimonial_post: Quote,
  case_study: TrendingUp,
};

const typeColors: Record<string, string> = {
  ad_image: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  social_post: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  reel_script: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ad_copy: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  landing_page: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  blog_article: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  email_campaign: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  comparison_post: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  testimonial_post: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  case_study: "bg-teal-500/20 text-teal-400 border-teal-500/30",
};

const platforms = ["instagram", "facebook", "tiktok", "linkedin", "twitter", "youtube"];
const imageStyles = ["Professional", "Bold/Vibrant", "Minimalist", "Lifestyle", "3D Render"];

const topicPlaceholders: Record<string, string> = {
  awareness: "e.g., The #1 reason 90% of traders fail (and how a journal fixes it)...",
  consideration: "e.g., How Tradify's AI analytics compare to manual spreadsheet tracking...",
  decision: "e.g., How a trader went from -3% to +8% monthly returns using Tradify...",
  action: "e.g., Welcome to Pro — here's how to set up your first dashboard in 5 minutes...",
  loyalty: "e.g., You've logged 100 trades! Here's what your data reveals about your growth...",
};

export default function FunnelGenerator() {
  const { toast } = useToast();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("instagram");
  const [imageStyle, setImageStyle] = useState("Professional");
  const [results, setResults] = useState<GeneratedAsset[]>([]);
  const [showControls, setShowControls] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const { data: stages, isLoading: stagesLoading } = useQuery<FunnelStage[]>({
    queryKey: ["/api/admin/marketing/funnel/stages"],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { stage: string; assetTypes: string[]; topic?: string; platform?: string; imageStyle?: string }) => {
      const res = await apiRequest("POST", "/api/admin/marketing/funnel/generate", data);
      return res.json();
    },
    onSuccess: (data: GeneratedAsset[]) => {
      setResults(data);
      toast({ title: "Assets Generated", description: `${data.length} assets created for ${selectedStage} stage` });
    },
    onError: (err: Error) => {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (data: { type: string; stage: string; topic?: string; platform?: string; imageStyle?: string }) => {
      const res = await apiRequest("POST", "/api/admin/marketing/funnel/generate-single", data);
      return res.json();
    },
    onSuccess: (newAsset: GeneratedAsset, variables: any) => {
      setResults(prev => prev.map(a => (a.type === variables.type && a.stage === variables.stage) ? newAsset : a));
      toast({ title: "Regenerated", description: `${newAsset.title || newAsset.type} regenerated` });
    },
    onError: (err: Error) => {
      toast({ title: "Regeneration Failed", description: err.message, variant: "destructive" });
    },
  });

  const currentStage = stages?.find(s => s.id === selectedStage);
  const hasImageAssets = selectedAssets.some(a => a.includes("image"));

  function handleStageSelect(stageId: string) {
    setSelectedStage(stageId);
    setSelectedAssets([]);
  }

  function toggleAsset(assetId: string) {
    setSelectedAssets(prev =>
      prev.includes(assetId) ? prev.filter(a => a !== assetId) : [...prev, assetId]
    );
  }

  function selectAllAssets() {
    if (!currentStage) return;
    if (selectedAssets.length === currentStage.assetTypes.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(currentStage.assetTypes.map(a => a.id));
    }
  }

  function handleGenerate() {
    if (!selectedStage || selectedAssets.length === 0) return;
    generateMutation.mutate({
      stage: selectedStage,
      assetTypes: selectedAssets,
      topic: topic || undefined,
      platform: selectedPlatform,
      imageStyle,
    });
  }

  async function handleExportZip() {
    if (results.length === 0) return;
    try {
      const res = await apiRequest("POST", "/api/admin/marketing/funnel/export-bundle", { assets: results });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tradify-funnel-assets-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "ZIP bundle downloaded" });
    } catch {
      toast({ title: "Export Failed", variant: "destructive" });
    }
  }

  function copyAllText() {
    const textAssets = results.filter(a => a.content && !a.fileUrl);
    const text = textAssets.map(a => `--- ${a.title || a.type} (${a.stage}) ---\n\n${a.content}`).join("\n\n========\n\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${textAssets.length} text assets copied to clipboard` });
  }

  function copyContent(content: string) {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  }

  function toggleExpanded(id: string) {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (stagesLoading) {
    return (
      <div className="p-8 space-y-8 bg-background min-h-screen" data-testid="funnel-loading">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground" data-testid="funnel-generator-page">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-page-title">
          <Package /> Content Factory
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">
          Generate complete marketing assets by funnel stage
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" data-testid="funnel-stages-grid">
        {(stages || []).map((stage, idx) => {
          const Icon = stageIcons[stage.id] || Megaphone;
          const colors = stageColors[stage.id] || stageColors.awareness;
          const isSelected = selectedStage === stage.id;
          const widthClass = idx === 0 ? "col-span-1" : "";
          return (
            <Card
              key={stage.id}
              className={`cursor-pointer transition-all duration-200 border-2 ${widthClass} ${
                isSelected
                  ? `${colors.border} ${colors.bg} shadow-lg ${colors.glow}`
                  : "border-border/50 bg-card/50"
              }`}
              onClick={() => handleStageSelect(stage.id)}
              data-testid={`card-stage-${stage.id}`}
            >
              <CardContent className="p-4 text-center space-y-2">
                <div className={`inline-flex p-2 rounded-lg ${colors.bg}`}>
                  <Icon size={24} className={colors.text} />
                </div>
                <h3 className={`font-bold text-sm uppercase tracking-tight ${isSelected ? colors.text : "text-foreground"}`}>
                  {stage.shortLabel}
                </h3>
                <p className="text-[10px] text-muted-foreground leading-tight">{stage.description}</p>
                {isSelected && (
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                    {stage.tone}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {currentStage && (
        <Card className="bg-card border-border" data-testid="card-asset-selection">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <CheckCircle size={16} className={stageColors[currentStage.id]?.text} />
                Select Asset Types — {currentStage.shortLabel}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllAssets}
                data-testid="button-select-all"
                className="text-xs uppercase tracking-widest"
              >
                {selectedAssets.length === currentStage.assetTypes.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground italic">{currentStage.goal}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentStage.assetTypes.map((asset) => {
                const AssetIcon = assetTypeIcons[asset.id] || FileText;
                const checked = selectedAssets.includes(asset.id);
                return (
                  <label
                    key={asset.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? `${stageColors[currentStage.id]?.border} ${stageColors[currentStage.id]?.bg}`
                        : "border-border/50"
                    }`}
                    data-testid={`checkbox-asset-${asset.id}`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleAsset(asset.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <AssetIcon size={14} className={stageColors[currentStage.id]?.text} />
                        <span className="text-sm font-medium">{asset.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{asset.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStage && selectedAssets.length > 0 && (
        <Card className="bg-card border-border" data-testid="card-creative-controls">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowControls(!showControls)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Creative Controls</CardTitle>
              {showControls ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </CardHeader>
          {showControls && (
            <CardContent className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">
                  Topic / Theme
                </label>
                <Textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={topicPlaceholders[currentStage.id] || "What should the content focus on?"}
                  className="bg-background border-border min-h-[80px]"
                  data-testid="input-topic"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">
                  Primary Platform
                </label>
                <div className="flex flex-wrap gap-2">
                  {platforms.map(p => (
                    <Button
                      key={p}
                      variant={selectedPlatform === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedPlatform(p)}
                      className={`text-xs capitalize ${selectedPlatform === p ? "bg-emerald-600" : ""}`}
                      data-testid={`button-platform-${p}`}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>

              {hasImageAssets && (
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">
                    Image Style
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {imageStyles.map(style => (
                      <Button
                        key={style}
                        variant={imageStyle === style ? "default" : "outline"}
                        size="sm"
                        onClick={() => setImageStyle(style)}
                        className={`text-xs ${imageStyle === style ? "bg-emerald-600" : ""}`}
                        data-testid={`button-style-${style.toLowerCase().replace(/\//g, "-")}`}
                      >
                        {style}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {currentStage && selectedAssets.length > 0 && (
        <Button
          size="lg"
          className="w-full bg-emerald-600 text-white font-bold uppercase tracking-widest text-sm h-14"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          data-testid="button-generate"
        >
          {generateMutation.isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 size={20} className="animate-spin" />
              Generating {selectedAssets.length} Assets...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap size={20} />
              Generate {selectedAssets.length} Asset{selectedAssets.length !== 1 ? "s" : ""}
            </span>
          )}
        </Button>
      )}

      {generateMutation.isPending && (
        <Card className="bg-card border-border" data-testid="card-generation-progress">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 size={24} className="animate-spin text-emerald-500" />
              <div>
                <p className="font-bold text-sm">Generating Assets...</p>
                <p className="text-xs text-muted-foreground">Creating {selectedAssets.length} assets for {currentStage?.shortLabel} stage</p>
              </div>
            </div>
            <Progress value={undefined} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              This may take 30-120 seconds depending on asset types selected
            </p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && !generateMutation.isPending && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3 bg-card border border-border rounded-lg p-4" data-testid="bar-batch-actions">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-500" />
              <span className="font-bold text-sm" data-testid="text-results-count">
                Generated {results.length} asset{results.length !== 1 ? "s" : ""} for {currentStage?.shortLabel || selectedStage} stage
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportZip} data-testid="button-export-zip" className="text-xs uppercase tracking-widest">
                <Download size={14} className="mr-1" /> ZIP Bundle
              </Button>
              <Button variant="outline" size="sm" onClick={copyAllText} data-testid="button-copy-all" className="text-xs uppercase tracking-widest">
                <Copy size={14} className="mr-1" /> Copy All Text
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setResults([])} data-testid="button-clear-results" className="text-xs uppercase tracking-widest text-muted-foreground">
                <Trash2 size={14} className="mr-1" /> Clear
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="grid-results">
            {results.map((asset) => (
              <AssetCard
                key={`${asset.type}-${asset.id}`}
                asset={asset}
                expanded={expandedCards.has(asset.id)}
                onToggleExpand={() => toggleExpanded(asset.id)}
                onCopy={copyContent}
                onRegenerate={() =>
                  regenerateMutation.mutate({
                    type: asset.type,
                    stage: asset.stage,
                    topic: topic || undefined,
                    platform: selectedPlatform,
                    imageStyle,
                  })
                }
                isRegenerating={regenerateMutation.isPending}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AssetCard({
  asset,
  expanded,
  onToggleExpand,
  onCopy,
  onRegenerate,
  isRegenerating,
}: {
  asset: GeneratedAsset;
  expanded: boolean;
  onToggleExpand: () => void;
  onCopy: (content: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  const colors = stageColors[asset.stage] || stageColors.awareness;

  return (
    <Card className="bg-card border-border overflow-hidden" data-testid={`card-asset-${asset.type}-${asset.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] uppercase tracking-wider border ${typeColors[asset.type] || "bg-slate-500/20 text-slate-400"}`}>
              {asset.type.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className={`text-[9px] uppercase tracking-wider ${colors.text} ${colors.border}`}>
              {asset.stage}
            </Badge>
            {asset.platform && asset.platform !== "all" && (
              <Badge variant="outline" className="text-[9px] capitalize">{asset.platform}</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            data-testid={`button-regenerate-${asset.type}`}
            className="text-xs"
          >
            <RefreshCw size={12} className={isRegenerating ? "animate-spin" : ""} />
          </Button>
        </div>
        {asset.title && (
          <p className="font-bold text-sm mt-1" data-testid={`text-title-${asset.id}`}>{asset.title}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <AssetPreview asset={asset} expanded={expanded} onToggleExpand={onToggleExpand} />

        <div className="flex gap-2 pt-2 border-t border-border/50">
          {asset.fileUrl && (
            <a href={asset.fileUrl} download={asset.fileName} className="inline-flex">
              <Button variant="outline" size="sm" className="text-xs" data-testid={`button-download-${asset.type}`}>
                <Download size={12} className="mr-1" />
                Download {asset.mimeType === "image/png" ? "PNG" : asset.mimeType === "text/html" ? "HTML" : "File"}
              </Button>
            </a>
          )}
          {asset.content && (
            <Button variant="outline" size="sm" onClick={() => onCopy(asset.content!)} className="text-xs" data-testid={`button-copy-${asset.type}`}>
              <Copy size={12} className="mr-1" /> Copy
            </Button>
          )}
          {asset.htmlContent && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([asset.htmlContent!], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = asset.fileName || "landing-page.html";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs"
                data-testid={`button-download-html-${asset.type}`}
              >
                <Download size={12} className="mr-1" /> HTML
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([asset.htmlContent!], { type: "text/html" });
                  window.open(URL.createObjectURL(blob), "_blank");
                }}
                className="text-xs"
                data-testid={`button-preview-${asset.type}`}
              >
                <ExternalLink size={12} className="mr-1" /> Preview
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AssetPreview({
  asset,
  expanded,
  onToggleExpand,
}: {
  asset: GeneratedAsset;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  if (asset.type === "ad_image" && asset.fileUrl) {
    return (
      <div className="rounded-lg overflow-hidden border border-border/50 bg-black/20">
        <img
          src={asset.fileUrl}
          alt={asset.title || "Ad Creative"}
          className="w-full h-auto max-h-80 object-contain"
          data-testid={`img-preview-${asset.id}`}
        />
      </div>
    );
  }

  if (asset.type === "landing_page" && asset.htmlContent) {
    return (
      <div className="rounded-lg overflow-hidden border border-border/50">
        <iframe
          srcDoc={asset.htmlContent}
          className="w-full h-64 bg-white"
          sandbox="allow-scripts"
          title="Landing Page Preview"
          data-testid={`iframe-preview-${asset.id}`}
        />
      </div>
    );
  }

  if (asset.type === "reel_script" && asset.metadata) {
    const m = asset.metadata;
    return (
      <div className="space-y-2 text-sm">
        {m.hook && (
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Hook</p>
            <p className="text-foreground">{m.hook}</p>
          </div>
        )}
        {m.problem && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Problem</p>
            <p className="text-foreground">{m.problem}</p>
          </div>
        )}
        {m.solution && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Solution</p>
            <p className="text-foreground">{m.solution}</p>
          </div>
        )}
        {m.cta && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">CTA</p>
            <p className="text-foreground">{m.cta}</p>
          </div>
        )}
        {m.visualDirections && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Visual Directions</p>
            <p className="text-foreground text-xs">{typeof m.visualDirections === 'string' ? m.visualDirections : JSON.stringify(m.visualDirections)}</p>
          </div>
        )}
      </div>
    );
  }

  if (asset.type === "email_campaign" && asset.metadata) {
    const m = asset.metadata;
    return (
      <div className="space-y-2">
        {m.subjectLine && (
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Subject</p>
            <p className="text-sm font-medium text-foreground">{m.subjectLine}</p>
          </div>
        )}
        {m.preheader && (
          <p className="text-xs text-muted-foreground italic px-1">{m.preheader}</p>
        )}
        <div className="bg-background border border-border/50 rounded-lg p-3 max-h-40 overflow-y-auto">
          <p className="text-sm text-foreground whitespace-pre-wrap">{asset.content}</p>
        </div>
      </div>
    );
  }

  if (asset.type === "social_post" && asset.metadata) {
    const m = asset.metadata;
    return (
      <div className="space-y-2">
        {m.hook && (
          <p className="text-xs font-bold text-blue-400 italic">{m.hook}</p>
        )}
        <div className="bg-background border border-border/50 rounded-lg p-3">
          <p className="text-sm text-foreground whitespace-pre-wrap">{m.caption || asset.content}</p>
        </div>
        {m.hashtags && (
          <p className="text-xs text-blue-400/70">{m.hashtags}</p>
        )}
        {m.bestPostingTime && (
          <p className="text-[10px] text-muted-foreground">Best posting time: {m.bestPostingTime}</p>
        )}
      </div>
    );
  }

  if ((asset.type === "case_study") && asset.metadata) {
    const m = asset.metadata;
    return (
      <div className="space-y-2">
        {m.beforeMetrics && m.afterMetrics && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">Before</p>
              {Object.entries(m.beforeMetrics).map(([k, v]) => (
                <p key={k} className="text-xs text-foreground"><span className="text-muted-foreground capitalize">{k}:</span> {v as string}</p>
              ))}
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">After</p>
              {Object.entries(m.afterMetrics).map(([k, v]) => (
                <p key={k} className="text-xs text-foreground"><span className="text-muted-foreground capitalize">{k}:</span> {v as string}</p>
              ))}
            </div>
          </div>
        )}
        <ContentPreview content={asset.content || m.story || ""} expanded={expanded} onToggle={onToggleExpand} />
      </div>
    );
  }

  if (asset.type === "ad_copy" && asset.metadata) {
    const variations = Array.isArray(asset.metadata) ? asset.metadata : asset.metadata.variations || asset.metadata;
    if (Array.isArray(variations)) {
      return (
        <div className="space-y-2">
          {variations.slice(0, expanded ? undefined : 2).map((v: any, i: number) => (
            <div key={i} className="bg-background border border-border/50 rounded-lg p-3">
              {v.headline && <p className="font-bold text-sm text-foreground mb-1">{v.headline}</p>}
              <p className="text-sm text-foreground whitespace-pre-wrap">{v.body || v.primaryText || v.text || JSON.stringify(v)}</p>
              {v.cta && <p className="text-xs text-emerald-400 font-bold mt-1">{v.cta}</p>}
            </div>
          ))}
          {Array.isArray(variations) && variations.length > 2 && (
            <Button variant="ghost" size="sm" onClick={onToggleExpand} className="text-xs w-full">
              {expanded ? "Show less" : `Show ${variations.length - 2} more`}
            </Button>
          )}
        </div>
      );
    }
  }

  return (
    <ContentPreview
      content={asset.content || ""}
      expanded={expanded}
      onToggle={onToggleExpand}
    />
  );
}

function ContentPreview({ content, expanded, onToggle }: { content: string; expanded: boolean; onToggle: () => void }) {
  const isLong = content.length > 500;
  const displayContent = isLong && !expanded ? content.slice(0, 500) + "..." : content;

  return (
    <div>
      <div className="bg-background border border-border/50 rounded-lg p-3 max-h-60 overflow-y-auto">
        <p className="text-sm text-foreground whitespace-pre-wrap" data-testid="text-content-preview">{displayContent}</p>
      </div>
      {isLong && (
        <Button variant="ghost" size="sm" onClick={onToggle} className="text-xs w-full mt-1">
          {expanded ? <><ChevronUp size={12} className="mr-1" /> Show less</> : <><ChevronDown size={12} className="mr-1" /> Show more</>}
        </Button>
      )}
    </div>
  );
}
