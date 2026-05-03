import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Upload, X, Maximize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  tradeId: number;
  hasChart: boolean;
  disabled?: boolean;
};

export function TradeChartUploader({ tradeId, hasChart, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [bust, setBust] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const src = `/api/trades/${tradeId}/chart?v=${bust}`;

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Charts must be under 5MB." });
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      toast({ variant: "destructive", title: "Unsupported format", description: "Use PNG, JPG, or WebP." });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("chart", file);
      const res = await fetch(`/api/trades/${tradeId}/chart`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Upload failed");
      }
      setBust(Date.now());
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: "Chart uploaded", description: "Your annotated chart is attached to this trade." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message || "Try again." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this chart?")) return;
    try {
      const res = await fetch(`/api/trades/${tradeId}/chart`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: "Chart removed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message });
    }
  }

  if (hasChart) {
    return (
      <>
        <div className="relative inline-block group/chart" data-testid={`chart-thumb-${tradeId}`}>
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="block w-16 h-12 rounded border border-border overflow-hidden bg-muted hover:border-emerald-500/50 transition-colors"
            data-testid={`button-view-chart-${tradeId}`}
          >
            <img src={src} alt="trade chart" className="w-full h-full object-cover" />
          </button>
          <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 group-hover/chart:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="p-0.5 bg-background/90 border border-border rounded text-muted-foreground hover:text-emerald-500"
              title="Expand"
            >
              <Maximize2 size={10} />
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-0.5 bg-background/90 border border-border rounded text-muted-foreground hover:text-rose-500"
                title="Remove chart"
                data-testid={`button-delete-chart-${tradeId}`}
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {lightbox && (
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 cursor-zoom-out"
            onClick={() => setLightbox(false)}
            data-testid={`lightbox-chart-${tradeId}`}
          >
            <img src={src} alt="trade chart full" className="max-w-full max-h-full rounded shadow-2xl" />
            <button
              type="button"
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
              onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
            >
              <X size={20} />
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        data-testid={`input-chart-${tradeId}`}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "h-6 inline-flex items-center gap-1 px-2 rounded border border-dashed text-[10px] font-bold uppercase",
          "border-border/60 text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-500 transition-colors",
          (disabled || uploading) && "opacity-50 cursor-not-allowed"
        )}
        data-testid={`button-upload-chart-${tradeId}`}
      >
        {uploading ? <Upload size={10} className="animate-pulse" /> : <ImageIcon size={10} />}
        {uploading ? "Uploading..." : "Add chart"}
      </button>
    </>
  );
}
