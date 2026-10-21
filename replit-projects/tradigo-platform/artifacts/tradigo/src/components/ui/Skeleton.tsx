import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  height?: string | number;
  width?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full' | string;
  animate?: boolean;
  [key: string]: any;
}

export function Skeleton({
  className,
  height,
  width,
  rounded = 'md',
  animate = true,
  style,
  ...props
}: SkeletonProps) {
  const roundedClass = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded] || rounded;

  const customStyle: React.CSSProperties = {
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...style,
  };

  return (
    <div
      style={customStyle}
      className={cn(
        "bg-muted/80 dark:bg-muted/30 border border-border/40",
        animate && "animate-pulse",
        roundedClass,
        className
      )}
      {...props}
    />
  );
}

export function CoachCardSkeleton() {
  return (
    <div className="min-w-0 max-w-full bg-card border border-border rounded-lg overflow-hidden flex flex-col shadow-sm">
      <div className="p-5 flex-1 space-y-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center space-x-4">
            <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-32 max-w-full" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        </div>
        <div className="flex items-center space-x-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
          <Skeleton className="h-5 w-14 rounded" />
        </div>
        <div className="space-y-2 pt-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-secondary/30 border-t border-border">
        <div className="min-w-0 space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-9 w-28 max-w-full rounded-md" />
      </div>
    </div>
  );
}

export function DashboardCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-6 shadow-sm space-y-4", className)}>
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3 py-2">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    </div>
  );
}

