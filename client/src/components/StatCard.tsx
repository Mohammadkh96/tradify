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
      "bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-slate-700 transition-all duration-300",
      className
    )}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-slate-400">{label}</h3>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-numeric text-white">{value}</span>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            trend === "up" && "bg-emerald-500/10 text-emerald-500",
            trend === "down" && "bg-rose-500/10 text-rose-500",
            trend === "neutral" && "bg-slate-500/10 text-slate-500"
          )}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
          </span>
        )}
      </div>
      
      {subtext && (
        <p className="text-xs text-slate-500 mt-1">{subtext}</p>
      )}
    </div>
  );
}
