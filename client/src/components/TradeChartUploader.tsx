import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Upload, X, Maximize2, Pencil, Eraser, Save, Trash2, Undo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type Stroke = { color: string; width: number; points: { x: number; y: number }[] };
type Annotations = { strokes: Stroke[] } | null;

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#ffffff", "#000000"];

type Props = {
  tradeId: number;
  hasChart: boolean;
  disabled?: boolean;
  initialAnnotations?: Annotations;
};

export function TradeChartUploader({ tradeId, hasChart, disabled, initialAnnotations }: Props) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [bust, setBust] = useState(0);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>(() => initialAnnotations?.strokes || []);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("common", { keyPrefix: "journal" });

  useEffect(() => {
    setStrokes(initialAnnotations?.strokes || []);
  }, [initialAnnotations, lightbox]);

  const src = `/api/trades/${tradeId}/chart?v=${bust}`;

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: t("chart.fileTooLarge"), description: t("chart.fileTooLargeDesc") });
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      toast({ variant: "destructive", title: t("chart.unsupportedFormat"), description: t("chart.unsupportedFormatDesc") });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("chart", file);
      const res = await fetch(`/api/trades/${tradeId}/chart`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || t("chart.uploadFailed"));
      }
      setBust(Date.now());
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: t("chart.uploaded"), description: t("chart.uploadedDesc") });
    } catch (e: any) {
      toast({ variant: "destructive", title: t("chart.uploadFailed"), description: e.message || t("chart.uploadFailedDesc") });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t("chart.removeConfirm"))) return;
    try {
      const res = await fetch(`/api/trades/${tradeId}/chart`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(t("chart.deleteFailed"));
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: t("chart.removed") });
    } catch (e: any) {
      toast({ variant: "destructive", title: t("chart.deleteFailed"), description: e.message });
    }
  }

  function svgPoint(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!annotateMode) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrawing(true);
    setStrokes(s => [...s, { color, width, points: [svgPoint(e)] }]);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing || !annotateMode) return;
    const p = svgPoint(e);
    setStrokes(s => {
      if (!s.length) return s;
      const last = s[s.length - 1];
      return [...s.slice(0, -1), { ...last, points: [...last.points, p] }];
    });
  }
  function onPointerUp() { setDrawing(false); }

  async function saveAnnotations() {
    setSaving(true);
    try {
      const res = await fetch(`/api/trades/${tradeId}/chart-annotations`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations: { strokes } }),
      });
      if (!res.ok) throw new Error(t("chart.saveFailed"));
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: t("annotateSaved") });
      setAnnotateMode(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: t("chart.saveFailed"), description: e.message });
    } finally {
      setSaving(false);
    }
  }

  function strokeToPath(s: Stroke): string {
    if (!s.points.length) return "";
    return s.points.reduce((acc, p, i) => {
      const x = Number.isFinite(p.x) ? p.x : 0;
      const y = Number.isFinite(p.y) ? p.y : 0;
      return acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`);
    }, "");
  }

  // Restrict colors to hex / known palette — JSONB is user-controlled so the
  // raw string can't be trusted in an SVG stroke attribute.
  function safeColor(c: string): string {
    if (typeof c !== "string") return "#10b981";
    return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#10b981";
  }
  function safeWidth(w: number): number {
    const n = Number(w);
    return Number.isFinite(n) ? Math.max(1, Math.min(20, n)) : 3;
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
            <img src={src} alt={t("chart.altThumb")} className="w-full h-full object-cover" />
          </button>
          <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 group-hover/chart:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="p-0.5 bg-background/90 border border-border rounded text-muted-foreground hover:text-emerald-500"
              title={t("chart.expand")}
            >
              <Maximize2 size={10} />
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-0.5 bg-background/90 border border-border rounded text-muted-foreground hover:text-rose-500"
                title={t("chart.removeChart")}
                data-testid={`button-delete-chart-${tradeId}`}
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {lightbox && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4"
            onClick={(e) => { if (!annotateMode && e.target === e.currentTarget) setLightbox(false); }}
            data-testid={`lightbox-chart-${tradeId}`}
          >
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-3 bg-black/60 border border-white/10 rounded-full px-3 py-2 backdrop-blur-sm flex-wrap justify-center">
              {!disabled && (
                <button
                  type="button"
                  onClick={() => setAnnotateMode(a => !a)}
                  className={cn("inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors",
                    annotateMode ? "bg-emerald-500 text-slate-950" : "bg-white/10 text-white hover:bg-white/20")}
                  data-testid={`button-annotate-toggle-${tradeId}`}
                >
                  <Pencil size={12} />{annotateMode ? t("annotateDrawing") : t("annotate")}
                </button>
              )}
              {annotateMode && (
                <>
                  <div className="flex items-center gap-1">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={cn("w-5 h-5 rounded-full border-2", color === c ? "border-emerald-400" : "border-white/20")}
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="w-20"
                    title={t("chart.strokeWidth")}
                  />
                  <button
                    type="button"
                    onClick={() => setStrokes(s => s.slice(0, -1))}
                    disabled={!strokes.length}
                    className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
                    title={t("chart.undoStroke")}
                    data-testid={`button-annotate-undo-${tradeId}`}
                  >
                    <Undo size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (confirm(t("annotateClearConfirm"))) setStrokes([]); }}
                    disabled={!strokes.length}
                    className="p-1.5 rounded-full bg-white/10 text-white hover:bg-rose-500/30 disabled:opacity-40"
                    title={t("chart.clearAll")}
                    data-testid={`button-annotate-clear-${tradeId}`}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={saveAnnotations}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                    data-testid={`button-annotate-save-${tradeId}`}
                  >
                    <Save size={12} />{saving ? t("annotateSaving") : t("annotateSave")}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setAnnotateMode(false); setLightbox(false); }}
                className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 ml-2"
                title={t("chart.close")}
              >
                <X size={14} />
              </button>
            </div>

            {/* Image + svg overlay */}
            <div className="relative max-w-full max-h-[80vh]">
              <img src={src} alt={t("chart.altFull")} className="max-w-full max-h-[80vh] rounded shadow-2xl block" draggable={false} />
              <svg
                ref={svgRef}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className={cn("absolute inset-0 w-full h-full", annotateMode ? "cursor-crosshair touch-none" : "pointer-events-none")}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                data-testid={`svg-annotations-${tradeId}`}
              >
                {strokes.map((s, i) => {
                  const w = safeWidth(s.width);
                  return (
                    <path
                      key={i}
                      d={strokeToPath(s)}
                      stroke={safeColor(s.color)}
                      strokeWidth={w / 4}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      style={{ strokeWidth: `${w}px` }}
                    />
                  );
                })}
              </svg>
            </div>
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
        {uploading ? t("chart.uploading") : t("chart.addChart")}
      </button>
    </>
  );
}
