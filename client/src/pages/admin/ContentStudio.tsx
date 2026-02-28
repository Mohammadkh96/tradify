import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  Sparkles,
  Send,
  Save,
  Trash2,
  RefreshCw,
  Copy,
  CheckCircle,
  AlertTriangle,
  Film,
  FileText,
  Mail,
  MessageSquare,
} from "lucide-react";

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

interface GeneratedPost {
  caption: string;
  hashtags: string;
  bestPostingTime: string;
  hook?: string;
  similarityWarning?: boolean;
}

interface GeneratedReelScript {
  hook: string;
  hookVariations?: string[];
  problem: string;
  solution: string;
  cta: string;
  visualDirections: string;
  similarityWarning?: boolean;
}

interface GeneratedBlog {
  title: string;
  metaTitle: string;
  metaDescription: string;
  content: string;
  similarityWarning?: boolean;
}

interface GeneratedEmail {
  subjectLine: string;
  body: string;
  similarityWarning?: boolean;
}

function PostGeneratorTab() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("instagram");
  const [contentType, setContentType] = useState("educational_tip");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<GeneratedPost | null>(null);
  const [editedCaption, setEditedCaption] = useState("");
  const [editedHashtags, setEditedHashtags] = useState("");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/post", {
        platform,
        contentType,
        topic: topic || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      const post: GeneratedPost = {
        caption: data.caption || data.content || "",
        hashtags: data.hashtags || "",
        bestPostingTime: data.bestPostingTime || data.posting_time || "",
        hook: data.hook || "",
        similarityWarning: data.similarityWarning || false,
      };
      setResult(post);
      setEditedCaption(post.caption);
      setEditedHashtags(post.hashtags);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Generation Failed", description: error.message || "Failed to generate post. Try again." });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/content", {
        type: "post",
        platform,
        title: `${contentType} - ${platform}`,
        content: editedCaption,
        hashtags: editedHashtags,
        hook: result?.hook || "",
        status: "draft",
        aiModelUsed: "openai",
        topicTags: topic ? [topic] : [],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/content"] });
      toast({ title: "Saved", description: "Post saved to content library." });
      setResult(null);
      setTopic("");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save post." });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <MessageSquare size={16} className="text-emerald-500" /> Post Configuration
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Configure your social media post parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Platform</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="bg-muted border-border" data-testid="select-post-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="twitter">Twitter / X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Content Type</label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger className="bg-muted border-border" data-testid="select-post-content-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="educational_tip">Educational Tip</SelectItem>
                  <SelectItem value="feature_highlight">Feature Highlight</SelectItem>
                  <SelectItem value="testimonial">Testimonial</SelectItem>
                  <SelectItem value="promotional">Promotional</SelectItem>
                  <SelectItem value="behind_the_scenes">Behind the Scenes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Topic (Optional)</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Risk management tips for prop firm traders"
              className="bg-muted border-border"
              data-testid="input-post-topic"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-post"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles size={14} className="mr-2" /> Generate Post
                </>
              )}
            </Button>
            {result && (
              <Button
                variant="outline"
                className="font-bold uppercase tracking-widest text-xs"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-generate-another-post"
              >
                <RefreshCw size={14} className="mr-2" /> Generate Another
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {generateMutation.isPending && !result && (
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" /> Generated Post
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {result.similarityWarning && (
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-amber-500/30 text-amber-500">
                    <AlertTriangle size={10} className="mr-1" /> Similar Content Found
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-emerald-500/30 text-emerald-500">
                  {platform}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Caption</label>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(editedCaption)} data-testid="button-copy-caption">
                  <Copy size={14} />
                </Button>
              </div>
              <Textarea
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                className="bg-muted border-border min-h-[120px]"
                data-testid="textarea-post-caption"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hashtags</label>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(editedHashtags)} data-testid="button-copy-hashtags">
                  <Copy size={14} />
                </Button>
              </div>
              <Input
                value={editedHashtags}
                onChange={(e) => setEditedHashtags(e.target.value)}
                className="bg-muted border-border text-sm"
                data-testid="input-post-hashtags"
              />
            </div>
            {result.bestPostingTime && (
              <div className="text-xs text-muted-foreground">
                <span className="font-bold uppercase tracking-widest text-[10px]">Best Posting Time:</span>{" "}
                <span className="text-foreground" data-testid="text-best-posting-time">{result.bestPostingTime}</span>
              </div>
            )}
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <Button
                className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-post"
              >
                {saveMutation.isPending ? "Saving..." : <><Save size={14} className="mr-2" /> Save to Library</>}
              </Button>
              <Button
                variant="outline"
                className="font-bold uppercase tracking-widest text-xs text-rose-500 border-rose-500/30"
                onClick={() => setResult(null)}
                data-testid="button-discard-post"
              >
                <Trash2 size={14} className="mr-2" /> Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReelScriptGeneratorTab() {
  const { toast } = useToast();
  const [goal, setGoal] = useState("awareness");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<GeneratedReelScript | null>(null);
  const [editedScript, setEditedScript] = useState({
    hook: "",
    problem: "",
    solution: "",
    cta: "",
    visualDirections: "",
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/reel-script", {
        goal,
        topic: topic || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      const script: GeneratedReelScript = {
        hook: data.hook || "",
        hookVariations: data.hookVariations || data.hook_variations || [],
        problem: data.problem || "",
        solution: data.solution || "",
        cta: data.cta || "",
        visualDirections: data.visualDirections || data.visual_directions || "",
        similarityWarning: data.similarityWarning || false,
      };
      setResult(script);
      setEditedScript({
        hook: script.hook,
        problem: script.problem,
        solution: script.solution,
        cta: script.cta,
        visualDirections: script.visualDirections,
      });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Generation Failed", description: error.message || "Failed to generate reel script." });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fullContent = `HOOK:\n${editedScript.hook}\n\nPROBLEM:\n${editedScript.problem}\n\nSOLUTION:\n${editedScript.solution}\n\nCTA:\n${editedScript.cta}\n\nVISUAL DIRECTIONS:\n${editedScript.visualDirections}`;
      const res = await apiRequest("POST", "/api/admin/marketing/content", {
        type: "reel_script",
        platform: "instagram",
        title: `Reel Script - ${goal}`,
        content: fullContent,
        hook: editedScript.hook,
        cta: editedScript.cta,
        status: "draft",
        aiModelUsed: "openai",
        topicTags: topic ? [topic] : [],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/content"] });
      toast({ title: "Saved", description: "Reel script saved to content library." });
      setResult(null);
      setTopic("");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save reel script." });
    },
  });

  const copyFullScript = () => {
    const fullScript = `HOOK:\n${editedScript.hook}\n\nPROBLEM:\n${editedScript.problem}\n\nSOLUTION:\n${editedScript.solution}\n\nCTA:\n${editedScript.cta}\n\nVISUAL DIRECTIONS:\n${editedScript.visualDirections}`;
    navigator.clipboard.writeText(fullScript);
    toast({ title: "Copied", description: "Full script copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Film size={16} className="text-emerald-500" /> Reel Script Configuration
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Configure your reel script parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Goal</label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger className="bg-muted border-border" data-testid="select-reel-goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="awareness">Awareness</SelectItem>
                <SelectItem value="signups">Signups</SelectItem>
                <SelectItem value="feature_demo">Feature Demo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Topic (Optional)</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., How Tradify auto-tracks your prop firm challenge"
              className="bg-muted border-border"
              data-testid="input-reel-topic"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-reel"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles size={14} className="mr-2" /> Generate Reel Script
                </>
              )}
            </Button>
            {result && (
              <Button
                variant="outline"
                className="font-bold uppercase tracking-widest text-xs"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-generate-another-reel"
              >
                <RefreshCw size={14} className="mr-2" /> Generate Another
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {generateMutation.isPending && !result && (
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" /> Generated Reel Script
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {result.similarityWarning && (
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-amber-500/30 text-amber-500">
                    <AlertTriangle size={10} className="mr-1" /> Similar Content Found
                  </Badge>
                )}
                <Button size="icon" variant="ghost" onClick={copyFullScript} data-testid="button-copy-reel-script">
                  <Copy size={14} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hook (First 3 Seconds)</label>
              <Textarea
                value={editedScript.hook}
                onChange={(e) => setEditedScript((prev) => ({ ...prev, hook: e.target.value }))}
                className="bg-muted border-border"
                rows={2}
                data-testid="textarea-reel-hook"
              />
            </div>
            {result.hookVariations && result.hookVariations.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hook Variations</label>
                <div className="space-y-2">
                  {result.hookVariations.map((variation, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-muted rounded-md cursor-pointer hover-elevate"
                      onClick={() => setEditedScript((prev) => ({ ...prev, hook: variation }))}
                      data-testid={`button-hook-variation-${idx}`}
                    >
                      <span className="text-xs text-muted-foreground font-mono">{idx + 1}.</span>
                      <span className="text-sm text-foreground">{variation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Problem</label>
              <Textarea
                value={editedScript.problem}
                onChange={(e) => setEditedScript((prev) => ({ ...prev, problem: e.target.value }))}
                className="bg-muted border-border"
                rows={3}
                data-testid="textarea-reel-problem"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Solution</label>
              <Textarea
                value={editedScript.solution}
                onChange={(e) => setEditedScript((prev) => ({ ...prev, solution: e.target.value }))}
                className="bg-muted border-border"
                rows={3}
                data-testid="textarea-reel-solution"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Call to Action</label>
              <Textarea
                value={editedScript.cta}
                onChange={(e) => setEditedScript((prev) => ({ ...prev, cta: e.target.value }))}
                className="bg-muted border-border"
                rows={2}
                data-testid="textarea-reel-cta"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Visual Directions</label>
              <Textarea
                value={editedScript.visualDirections}
                onChange={(e) => setEditedScript((prev) => ({ ...prev, visualDirections: e.target.value }))}
                className="bg-muted border-border"
                rows={4}
                data-testid="textarea-reel-visual-directions"
              />
            </div>
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <Button
                className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-reel"
              >
                {saveMutation.isPending ? "Saving..." : <><Save size={14} className="mr-2" /> Save to Library</>}
              </Button>
              <Button
                variant="outline"
                className="font-bold uppercase tracking-widest text-xs text-rose-500 border-rose-500/30"
                onClick={() => setResult(null)}
                data-testid="button-discard-reel"
              >
                <Trash2 size={14} className="mr-2" /> Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BlogGeneratorTab() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [seoKeyword, setSeoKeyword] = useState("");
  const [result, setResult] = useState<GeneratedBlog | null>(null);
  const [editedBlog, setEditedBlog] = useState({
    title: "",
    metaTitle: "",
    metaDescription: "",
    content: "",
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/blog", {
        topic: topic || undefined,
        seoKeyword: seoKeyword || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      const blog: GeneratedBlog = {
        title: data.title || "",
        metaTitle: data.metaTitle || data.meta_title || "",
        metaDescription: data.metaDescription || data.meta_description || "",
        content: data.content || data.article || "",
        similarityWarning: data.similarityWarning || false,
      };
      setResult(blog);
      setEditedBlog({
        title: blog.title,
        metaTitle: blog.metaTitle,
        metaDescription: blog.metaDescription,
        content: blog.content,
      });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Generation Failed", description: error.message || "Failed to generate blog article." });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/content", {
        type: "blog",
        platform: "website",
        title: editedBlog.title,
        content: editedBlog.content,
        status: "draft",
        aiModelUsed: "openai",
        topicTags: [topic, seoKeyword].filter(Boolean),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/content"] });
      toast({ title: "Saved", description: "Blog article saved to content library as draft." });
      setResult(null);
      setTopic("");
      setSeoKeyword("");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save blog article." });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const slug = editedBlog.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const res = await apiRequest("POST", "/api/admin/blog", {
        title: editedBlog.title,
        slug,
        content: editedBlog.content,
        excerpt: editedBlog.metaDescription,
        metaTitle: editedBlog.metaTitle,
        metaDescription: editedBlog.metaDescription,
        category: "Platform Updates",
        tags: [topic, seoKeyword].filter(Boolean),
        status: "published",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Published", description: "Blog article published to blog system." });
      setResult(null);
      setTopic("");
      setSeoKeyword("");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to publish blog article." });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <FileText size={16} className="text-emerald-500" /> Blog Article Configuration
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Generate SEO-optimized blog articles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Topic</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., How to pass a prop firm challenge"
                className="bg-muted border-border"
                data-testid="input-blog-topic"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">SEO Keyword</label>
              <Input
                value={seoKeyword}
                onChange={(e) => setSeoKeyword(e.target.value)}
                placeholder="e.g., prop firm challenge tips"
                className="bg-muted border-border"
                data-testid="input-blog-seo-keyword"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-blog"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles size={14} className="mr-2" /> Generate Blog Article
                </>
              )}
            </Button>
            {result && (
              <Button
                variant="outline"
                className="font-bold uppercase tracking-widest text-xs"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-generate-another-blog"
              >
                <RefreshCw size={14} className="mr-2" /> Generate Another
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {generateMutation.isPending && !result && (
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" /> Generated Blog Article
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {result.similarityWarning && (
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-amber-500/30 text-amber-500">
                    <AlertTriangle size={10} className="mr-1" /> Similar Content Found
                  </Badge>
                )}
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(editedBlog.content)} data-testid="button-copy-blog">
                  <Copy size={14} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Title</label>
              <Input
                value={editedBlog.title}
                onChange={(e) => setEditedBlog((prev) => ({ ...prev, title: e.target.value }))}
                className="bg-muted border-border font-bold"
                data-testid="input-blog-generated-title"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Meta Title</label>
                <Input
                  value={editedBlog.metaTitle}
                  onChange={(e) => setEditedBlog((prev) => ({ ...prev, metaTitle: e.target.value }))}
                  className="bg-muted border-border text-sm"
                  data-testid="input-blog-meta-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Meta Description</label>
                <Input
                  value={editedBlog.metaDescription}
                  onChange={(e) => setEditedBlog((prev) => ({ ...prev, metaDescription: e.target.value }))}
                  className="bg-muted border-border text-sm"
                  data-testid="input-blog-meta-description"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Article Content</label>
              <Textarea
                value={editedBlog.content}
                onChange={(e) => setEditedBlog((prev) => ({ ...prev, content: e.target.value }))}
                className="bg-muted border-border font-mono text-sm min-h-[300px]"
                data-testid="textarea-blog-content"
              />
            </div>
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <Button
                className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-blog-draft"
              >
                {saveMutation.isPending ? "Saving..." : <><Save size={14} className="mr-2" /> Save as Draft</>}
              </Button>
              <Button
                variant="outline"
                className="font-bold uppercase tracking-widest text-xs border-emerald-500/30 text-emerald-500"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                data-testid="button-publish-blog"
              >
                {publishMutation.isPending ? "Publishing..." : <><Send size={14} className="mr-2" /> Publish to Blog</>}
              </Button>
              <Button
                variant="outline"
                className="font-bold uppercase tracking-widest text-xs text-rose-500 border-rose-500/30"
                onClick={() => setResult(null)}
                data-testid="button-discard-blog"
              >
                <Trash2 size={14} className="mr-2" /> Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmailGeneratorTab() {
  const { toast } = useToast();
  const [emailType, setEmailType] = useState("welcome");
  const [segment, setSegment] = useState("all_users");
  const [result, setResult] = useState<GeneratedEmail | null>(null);
  const [editedEmail, setEditedEmail] = useState({
    subjectLine: "",
    body: "",
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/generate/email", {
        emailType,
        segment,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      const email: GeneratedEmail = {
        subjectLine: data.subjectLine || data.subject_line || data.subject || "",
        body: data.body || data.content || "",
        similarityWarning: data.similarityWarning || false,
      };
      setResult(email);
      setEditedEmail({
        subjectLine: email.subjectLine,
        body: email.body,
      });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Generation Failed", description: error.message || "Failed to generate email campaign." });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/marketing/content", {
        type: "email",
        platform: "email",
        title: editedEmail.subjectLine,
        content: editedEmail.body,
        status: "draft",
        aiModelUsed: "openai",
        topicTags: [emailType, segment],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/content"] });
      toast({ title: "Saved", description: "Email campaign saved to content library." });
      setResult(null);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save email campaign." });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Mail size={16} className="text-emerald-500" /> Email Campaign Configuration
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Generate email campaigns for different segments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Email Type</label>
              <Select value={emailType} onValueChange={setEmailType}>
                <SelectTrigger className="bg-muted border-border" data-testid="select-email-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="feature_announcement">Feature Announcement</SelectItem>
                  <SelectItem value="re_engagement">Re-engagement</SelectItem>
                  <SelectItem value="promotion">Promotion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Recipient Segment</label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="bg-muted border-border" data-testid="select-email-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_users">All Users</SelectItem>
                  <SelectItem value="early_access">Early Access</SelectItem>
                  <SelectItem value="free">Free Users</SelectItem>
                  <SelectItem value="pro">Pro Users</SelectItem>
                  <SelectItem value="elite">Elite Users</SelectItem>
                  <SelectItem value="inactive">Inactive Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-email"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles size={14} className="mr-2" /> Generate Email
                </>
              )}
            </Button>
            {result && (
              <Button
                variant="outline"
                className="font-bold uppercase tracking-widest text-xs"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-generate-another-email"
              >
                <RefreshCw size={14} className="mr-2" /> Generate Another
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {generateMutation.isPending && !result && (
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" /> Generated Email Campaign
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {result.similarityWarning && (
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-amber-500/30 text-amber-500">
                    <AlertTriangle size={10} className="mr-1" /> Similar Content Found
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-muted-foreground/30 text-muted-foreground">
                  {emailType}
                </Badge>
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-emerald-500/30 text-emerald-500">
                  {segment.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Subject Line</label>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(editedEmail.subjectLine)} data-testid="button-copy-email-subject">
                  <Copy size={14} />
                </Button>
              </div>
              <Input
                value={editedEmail.subjectLine}
                onChange={(e) => setEditedEmail((prev) => ({ ...prev, subjectLine: e.target.value }))}
                className="bg-muted border-border font-bold"
                data-testid="input-email-subject"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Email Body</label>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(editedEmail.body)} data-testid="button-copy-email-body">
                  <Copy size={14} />
                </Button>
              </div>
              <Textarea
                value={editedEmail.body}
                onChange={(e) => setEditedEmail((prev) => ({ ...prev, body: e.target.value }))}
                className="bg-muted border-border min-h-[200px]"
                data-testid="textarea-email-body"
              />
            </div>
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <Button
                className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-email"
              >
                {saveMutation.isPending ? "Saving..." : <><Save size={14} className="mr-2" /> Save to Library</>}
              </Button>
              <Button
                variant="outline"
                className="font-bold uppercase tracking-widest text-xs text-rose-500 border-rose-500/30"
                onClick={() => setResult(null)}
                data-testid="button-discard-email"
              >
                <Trash2 size={14} className="mr-2" /> Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ContentStudio() {
  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-content-studio-title">
          <Sparkles /> Content Studio
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">AI-Powered Content Generation Engine</p>
      </div>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="bg-muted border border-border w-full flex flex-wrap justify-start gap-1 h-auto p-1" data-testid="tabs-content-studio">
          <TabsTrigger value="posts" className="text-xs font-bold uppercase tracking-widest gap-1" data-testid="tab-posts">
            <MessageSquare size={14} /> Posts
          </TabsTrigger>
          <TabsTrigger value="reels" className="text-xs font-bold uppercase tracking-widest gap-1" data-testid="tab-reels">
            <Film size={14} /> Reel Scripts
          </TabsTrigger>
          <TabsTrigger value="blog" className="text-xs font-bold uppercase tracking-widest gap-1" data-testid="tab-blog">
            <FileText size={14} /> Blog Articles
          </TabsTrigger>
          <TabsTrigger value="email" className="text-xs font-bold uppercase tracking-widest gap-1" data-testid="tab-email">
            <Mail size={14} /> Email Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-6">
          <PostGeneratorTab />
        </TabsContent>
        <TabsContent value="reels" className="mt-6">
          <ReelScriptGeneratorTab />
        </TabsContent>
        <TabsContent value="blog" className="mt-6">
          <BlogGeneratorTab />
        </TabsContent>
        <TabsContent value="email" className="mt-6">
          <EmailGeneratorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
