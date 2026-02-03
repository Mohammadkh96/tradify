import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FoundingMemberBadgeProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function FoundingMemberBadge({ 
  className, 
  size = "md",
  showLabel = true 
}: FoundingMemberBadgeProps) {
  const sizeClasses = {
    sm: "h-4 text-[9px] px-1.5 gap-0.5",
    md: "h-5 text-[10px] px-2 gap-1",
    lg: "h-6 text-xs px-2.5 gap-1.5"
  };

  const iconSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5"
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-bold uppercase tracking-wider",
        "bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20",
        "border border-amber-500/40",
        "text-amber-400",
        "shadow-[0_0_10px_rgba(245,158,11,0.15)]",
        sizeClasses[size],
        className
      )}
      data-testid="badge-founding-member"
    >
      <Crown className={cn(iconSizes[size], "text-amber-400")} />
      {showLabel && <span>Founding Member</span>}
    </div>
  );
}
