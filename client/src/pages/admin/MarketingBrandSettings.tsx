import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Palette, Save, CheckCircle, AlertCircle, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

interface BrandSettings {
  id?: number;
  userId?: string;
  brandName: string;
  description: string;
  targetAudiencePersonas: string[];
  uniqueSellingPoints: string[];
  competitors: string[];
  brandVoice: string;
  brandTone: string;
  colors: string[];
  keyMessages: string[];
}

const defaultSettings: BrandSettings = {
  brandName: "",
  description: "",
  targetAudiencePersonas: [],
  uniqueSellingPoints: [],
  competitors: [],
  brandVoice: "",
  brandTone: "",
  colors: [],
  keyMessages: [],
};

const VOICE_OPTIONS = [
  "Professional",
  "Casual",
  "Authoritative",
  "Friendly",
  "Educational",
  "Motivational",
  "Technical",
  "Conversational",
];

const TONE_OPTIONS = [
  "Confident",
  "Empathetic",
  "Urgent",
  "Playful",
  "Inspirational",
  "Direct",
  "Supportive",
  "Bold",
];

function ArrayFieldEditor({
  label,
  items,
  onChange,
  placeholder,
  testIdPrefix,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  testIdPrefix: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const addItem = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setInputValue("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className="bg-muted border-border text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          data-testid={`input-${testIdPrefix}-add`}
        />
        <Button
          size="icon"
          variant="outline"
          onClick={addItem}
          disabled={!inputValue.trim()}
          data-testid={`button-${testIdPrefix}-add`}
        >
          <Plus size={14} />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <Badge
              key={index}
              variant="outline"
              className="text-xs font-medium border-muted-foreground/30 text-foreground gap-1"
              data-testid={`badge-${testIdPrefix}-${index}`}
            >
              {item}
              <button
                onClick={() => removeItem(index)}
                className="ml-1 text-muted-foreground hover:text-foreground"
                data-testid={`button-${testIdPrefix}-remove-${index}`}
              >
                <X size={10} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketingBrandSettings() {
  const { toast } = useToast();
  const [form, setForm] = useState<BrandSettings>(defaultSettings);

  const { data: settings, isLoading } = useQuery<BrandSettings | null>({
    queryKey: ["/api/admin/marketing/brand-settings"],
  });

  useEffect(() => {
    if (settings) {
      setForm({
        brandName: settings.brandName || "",
        description: settings.description || "",
        targetAudiencePersonas: Array.isArray(settings.targetAudiencePersonas) ? settings.targetAudiencePersonas : [],
        uniqueSellingPoints: Array.isArray(settings.uniqueSellingPoints) ? settings.uniqueSellingPoints : [],
        competitors: Array.isArray(settings.competitors) ? settings.competitors : [],
        brandVoice: settings.brandVoice || "",
        brandTone: settings.brandTone || "",
        colors: Array.isArray(settings.colors) ? settings.colors : [],
        keyMessages: Array.isArray(settings.keyMessages) ? settings.keyMessages : [],
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: BrandSettings) => {
      const res = await apiRequest("PUT", "/api/admin/marketing/brand-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/brand-settings"] });
      toast({ title: "Saved", description: "Brand settings updated successfully." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save brand settings." });
    },
  });

  const completenessFields = [
    { key: "brandName", label: "Brand Name", filled: !!form.brandName },
    { key: "description", label: "Description", filled: !!form.description },
    { key: "targetAudiencePersonas", label: "Target Audience", filled: form.targetAudiencePersonas.length > 0 },
    { key: "uniqueSellingPoints", label: "USPs", filled: form.uniqueSellingPoints.length > 0 },
    { key: "competitors", label: "Competitors", filled: form.competitors.length > 0 },
    { key: "brandVoice", label: "Brand Voice", filled: !!form.brandVoice },
    { key: "brandTone", label: "Brand Tone", filled: !!form.brandTone },
    { key: "colors", label: "Brand Colors", filled: form.colors.length > 0 },
    { key: "keyMessages", label: "Key Messages", filled: form.keyMessages.length > 0 },
  ];

  const filledCount = completenessFields.filter((f) => f.filled).length;
  const totalCount = completenessFields.length;
  const completenessPercent = Math.round((filledCount / totalCount) * 100);
  const isComplete = filledCount === totalCount;

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground" data-testid="page-brand-settings">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500"
            data-testid="heading-brand-settings"
          >
            <Palette /> Brand Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">
            Define your brand identity for AI content generation
          </p>
        </div>
        <Button
          className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending || !form.brandName}
          data-testid="button-save-brand-settings"
        >
          <Save size={14} className="mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                Brand Identity
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Core brand information used in all AI-generated content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Brand Name *
                </label>
                <Input
                  value={form.brandName}
                  onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  placeholder="e.g. Tradify"
                  className="bg-muted border-border text-sm"
                  data-testid="input-brand-name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Brand Description
                </label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe your brand in a few sentences..."
                  className="bg-muted border-border text-sm resize-none"
                  rows={3}
                  data-testid="textarea-brand-description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Brand Voice
                  </label>
                  <Select
                    value={form.brandVoice}
                    onValueChange={(value) => setForm({ ...form, brandVoice: value })}
                  >
                    <SelectTrigger className="bg-muted border-border text-sm" data-testid="select-brand-voice">
                      <SelectValue placeholder="Select brand voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((voice) => (
                        <SelectItem key={voice} value={voice}>
                          {voice}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Brand Tone
                  </label>
                  <Select
                    value={form.brandTone}
                    onValueChange={(value) => setForm({ ...form, brandTone: value })}
                  >
                    <SelectTrigger className="bg-muted border-border text-sm" data-testid="select-brand-tone">
                      <SelectValue placeholder="Select brand tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {tone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                Target Audience & Positioning
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Define who you are targeting and how you stand out
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ArrayFieldEditor
                label="Target Audience Personas"
                items={form.targetAudiencePersonas}
                onChange={(items) => setForm({ ...form, targetAudiencePersonas: items })}
                placeholder="e.g. Beginner forex traders aged 18-35"
                testIdPrefix="personas"
              />

              <ArrayFieldEditor
                label="Unique Selling Points (USPs)"
                items={form.uniqueSellingPoints}
                onChange={(items) => setForm({ ...form, uniqueSellingPoints: items })}
                placeholder="e.g. AI-powered trade journaling"
                testIdPrefix="usps"
              />

              <ArrayFieldEditor
                label="Competitors"
                items={form.competitors}
                onChange={(items) => setForm({ ...form, competitors: items })}
                placeholder="e.g. Edgewonk, TraderSync"
                testIdPrefix="competitors"
              />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                Brand Assets & Messaging
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Colors and key messages for consistent branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ArrayFieldEditor
                label="Brand Colors"
                items={form.colors}
                onChange={(items) => setForm({ ...form, colors: items })}
                placeholder="e.g. #10B981 (Emerald Green)"
                testIdPrefix="colors"
              />

              <ArrayFieldEditor
                label="Key Messages"
                items={form.keyMessages}
                onChange={(items) => setForm({ ...form, keyMessages: items })}
                placeholder="e.g. Trade smarter, not harder"
                testIdPrefix="messages"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border h-fit lg:sticky lg:top-8">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                {isComplete ? (
                  <CheckCircle size={16} className="text-emerald-500" />
                ) : (
                  <AlertCircle size={16} className="text-amber-500" />
                )}
                Profile Completeness
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Complete your brand profile for better AI-generated content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-2xl font-black",
                      isComplete ? "text-emerald-500" : "text-amber-500"
                    )}
                    data-testid="text-completeness-percent"
                  >
                    {completenessPercent}%
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    {filledCount}/{totalCount} fields
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-500",
                      isComplete ? "bg-emerald-500" : "bg-amber-500"
                    )}
                    style={{ width: `${completenessPercent}%` }}
                    data-testid="progress-completeness"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {completenessFields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center gap-2 text-xs"
                    data-testid={`status-field-${field.key}`}
                  >
                    {field.filled ? (
                      <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle size={12} className="text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={cn(
                        field.filled ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {field.label}
                    </span>
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
