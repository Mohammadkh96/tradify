import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({ label, value, subtext, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300",
      className
    )}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        {icon && <div className="text-muted-foreground/60">{icon}</div>}
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-numeric text-foreground">{value}</span>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            trend === "up" && "bg-emerald-500/10 text-emerald-500",
            trend === "down" && "bg-destructive/10 text-destructive",
            trend === "neutral" && "bg-muted text-muted-foreground"
          )}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
          </span>
        )}
      </div>
      
      {subtext && (
        <p className="text-xs text-muted-foreground mt-1 font-medium tracking-tighter uppercase opacity-70">{subtext}</p>
      )}
    </div>
  );
}
