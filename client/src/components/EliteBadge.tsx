import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface EliteBadgeProps {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function EliteBadge({ size = "md", showLabel = true, className }: EliteBadgeProps) {
  const sizeClasses = {
    sm: "h-5 px-2 text-[9px] gap-1",
    md: "h-6 px-2.5 text-[10px] gap-1.5",
    lg: "h-7 px-3 text-xs gap-2",
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <div
      data-testid="badge-elite"
      className={cn(
        "inline-flex items-center rounded-full font-black uppercase tracking-wider",
        "bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20",
        "border border-amber-500/30",
        "text-amber-400",
        "shadow-[0_0_12px_rgba(245,158,11,0.15)]",
        sizeClasses[size],
        className
      )}
    >
      <Crown 
        size={iconSizes[size]} 
        className="text-amber-400 fill-amber-500/30" 
      />
      {showLabel && <span>Elite</span>}
    </div>
  );
}

export function ProBadge({ size = "md", showLabel = true, className }: EliteBadgeProps) {
  const sizeClasses = {
    sm: "h-5 px-2 text-[9px] gap-1",
    md: "h-6 px-2.5 text-[10px] gap-1.5",
    lg: "h-7 px-3 text-xs gap-2",
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <div
      data-testid="badge-pro"
      className={cn(
        "inline-flex items-center rounded-full font-black uppercase tracking-wider",
        "bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20",
        "border border-emerald-500/30",
        "text-emerald-400",
        sizeClasses[size],
        className
      )}
    >
      <svg 
        width={iconSizes[size]} 
        height={iconSizes[size]} 
        viewBox="0 0 24 24" 
        fill="none" 
        className="text-emerald-400"
      >
        <path 
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
          fill="currentColor" 
          fillOpacity="0.3"
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      {showLabel && <span>Pro</span>}
    </div>
  );
}

interface TierBadgeProps {
  tier: string | null | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function TierBadge({ tier, size = "md", showLabel = true, className }: TierBadgeProps) {
  const normalizedTier = tier?.toUpperCase();
  
  if (normalizedTier === "ELITE") {
    return <EliteBadge size={size} showLabel={showLabel} className={className} />;
  }
  
  if (normalizedTier === "PRO") {
    return <ProBadge size={size} showLabel={showLabel} className={className} />;
  }
  
  return null;
}
