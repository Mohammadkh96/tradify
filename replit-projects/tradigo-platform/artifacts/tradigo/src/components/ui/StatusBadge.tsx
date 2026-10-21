import React from 'react';
import { Badge } from './Badge';
import { StatusConfig } from '../../utils/status';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  config: StatusConfig;
  className?: string;
}

export function StatusBadge({ config, className }: StatusBadgeProps) {
  // Map our semantic tone to the Badge variant
  const toneMap: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "info" | "outline"> = {
    default: "secondary",
    success: "success",
    warning: "warning",
    danger: "destructive",
    info: "info"
  };

  return (
    <Badge variant={toneMap[config.tone] || "secondary"} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
