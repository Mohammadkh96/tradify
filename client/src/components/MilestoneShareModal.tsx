import { useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Link2, Check } from "lucide-react";
import MilestoneShareCard, { MilestoneShareCardProps } from "./MilestoneShareCard";

interface MilestoneShareModalProps extends MilestoneShareCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
}

const CARD_SIZE = 1080;
const PREVIEW_SIZE = 340;
const SCALE = PREVIEW_SIZE / CARD_SIZE;

export function MilestoneShareModal({
  open,
  onOpenChange,
  title,
  subtitle,
  variant,
  userName,
  data,
}: MilestoneShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 1,
        backgroundColor: "#0A0F1E",
        useCORS: true,
        logging: false,
        width: CARD_SIZE,
        height: CARD_SIZE,
      });
      const link = document.createElement("a");
      link.download = `tradifyapp-${variant}-card.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
    } finally {
      setDownloading(false);
    }
  }, [variant, downloading]);

  const handleCopyLink = useCallback(async () => {
    const utmUrl = `https://tradifyapp.com?utm_source=share&utm_medium=social&utm_campaign=milestone_${variant}`;
    try {
      await navigator.clipboard.writeText(utmUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.createElement("input");
      input.value = utmUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [variant]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[420px] bg-[#0D1426] border border-white/10 p-6"
        data-testid="milestone-share-modal"
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-base font-black uppercase tracking-wider text-white">
            {title || "Share Your Milestone"}
          </DialogTitle>
          {subtitle && (
            <p className="text-xs text-white/40 mt-1">{subtitle}</p>
          )}
        </DialogHeader>

        <div
          className="flex justify-center mb-5 overflow-hidden rounded-xl"
          style={{ height: PREVIEW_SIZE + 2 }}
        >
          <div
            style={{
              transform: `scale(${SCALE})`,
              transformOrigin: "top left",
              width: CARD_SIZE,
              height: CARD_SIZE,
              borderRadius: 0,
              flexShrink: 0,
            }}
          >
            <MilestoneShareCard
              ref={cardRef}
              variant={variant}
              userName={userName}
              data={data}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 bg-[#00D9A3] hover:bg-[#00c491] text-[#0A0F1E] font-bold uppercase tracking-wider text-xs h-10 gap-2"
            data-testid="button-download-card"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Generating..." : "Download 1080×1080"}
          </Button>

          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="flex-1 border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-wider text-xs h-10 gap-2"
            data-testid="button-copy-share-link"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#00D9A3]" />
                <span className="text-[#00D9A3]">Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Copy Link
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-[10px] text-white/20 mt-3 tracking-wide">
          Share on X, Discord, or Instagram Stories
        </p>
      </DialogContent>
    </Dialog>
  );
}
