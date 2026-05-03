import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  tradeId: number;
  tags?: string[] | null;
  disabled?: boolean;
};

export function TradeAiTags({ tradeId, tags, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [local, setLocal] = useState<string[] | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const current = local ?? (Array.isArray(tags) ? tags : []);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/trades/${tradeId}/ai-tags`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Failed");
      }
      const j = await res.json();
      setLocal(j.tags || []);
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: "AI tags generated", description: `${(j.tags || []).length} pattern${(j.tags || []).length === 1 ? "" : "s"} identified.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Couldn't generate tags", description: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center flex-wrap gap-1" data-testid={`ai-tags-${tradeId}`}>
      {current.length > 0 && current.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded uppercase font-bold tracking-wider"
          data-testid={`ai-tag-${tradeId}-${tag.replace(/\s+/g, '-')}`}
        >
          <Sparkles size={8} />{tag}
        </span>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-1 h-5 px-1.5 rounded border border-dashed text-[9px] font-bold uppercase tracking-wider",
            "border-emerald-500/30 text-emerald-500/70 hover:text-emerald-500 hover:border-emerald-500/60 transition-colors",
            loading && "opacity-60 cursor-not-allowed"
          )}
          title={current.length ? "Regenerate tags" : "Generate AI tags from notes & outcome"}
          data-testid={`button-generate-ai-tags-${tradeId}`}
        >
          {loading ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
          {loading ? "Analyzing…" : current.length ? "Regenerate" : "AI tags"}
        </button>
      )}
    </div>
  );
}
