import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  src?: string;
  alt?: string;
  name?: string;
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  rounded?: 'full' | 'lg' | 'md' | 'sm' | 'none';
  isLoading?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'away';
  fallbackClassName?: string;
}

export function Avatar({
  src,
  alt = 'Avatar',
  name,
  initials,
  size = 'md',
  rounded = 'full',
  isLoading = false,
  status,
  className,
  fallbackClassName,
  ...props
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Derive initials from name or explicit initials
  const getInitials = () => {
    if (initials) return initials;
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return 'TR';
  };

  // Size mapping
  const sizeClass = typeof size === 'number'
    ? ''
    : {
        xs: 'h-7 w-7 text-xs',
        sm: 'h-9 w-9 text-xs',
        md: 'h-11 w-11 text-sm',
        lg: 'h-14 w-14 text-base',
        xl: 'h-20 w-20 text-xl',
      }[size] || 'h-11 w-11 text-sm';

  const customSizeStyle = typeof size === 'number'
    ? { width: `${size}px`, height: `${size}px`, minWidth: `${size}px` }
    : undefined;

  const roundedClass = {
    full: 'rounded-full',
    lg: 'rounded-lg',
    md: 'rounded-md',
    sm: 'rounded-sm',
    none: 'rounded-none',
  }[rounded] || 'rounded-full';

  // Status indicator size
  const statusSizeClass = {
    xs: 'h-2 w-2 -bottom-0.5 -right-0.5',
    sm: 'h-2.5 w-2.5 bottom-0 right-0',
    md: 'h-3 w-3 bottom-0.5 right-0.5',
    lg: 'h-3.5 w-3.5 bottom-1 right-1',
    xl: 'h-4 w-4 bottom-1.5 right-1.5',
  }[typeof size === 'string' ? size : 'md'] || 'h-3 w-3 bottom-0.5 right-0.5';

  const statusColorClass = {
    online: 'bg-emerald-500 ring-2 ring-background',
    offline: 'bg-zinc-500 ring-2 ring-background',
    busy: 'bg-rose-500 ring-2 ring-background',
    away: 'bg-amber-500 ring-2 ring-background',
  };

  if (isLoading) {
    return (
      <Skeleton
        width={typeof size === 'number' ? size : undefined}
        height={typeof size === 'number' ? size : undefined}
        rounded={rounded}
        className={cn(
          typeof size === 'string' ? {
            xs: 'h-7 w-7',
            sm: 'h-9 w-9',
            md: 'h-11 w-11',
            lg: 'h-14 w-14',
            xl: 'h-20 w-20',
          }[size] : '',
          className
        )}
      />
    );
  }

  return (
    <div
      style={customSizeStyle}
      className={cn(
        "relative inline-flex items-center justify-center font-medium bg-secondary/80 text-foreground border border-border/60 overflow-hidden shrink-0 select-none shadow-sm transition-all",
        sizeClass,
        roundedClass,
        className
      )}
      {...props}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setHasError(true)}
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <span className={cn("font-semibold tracking-wider text-primary", fallbackClassName)}>
          {getInitials()}
        </span>
      )}

      {status && (
        <span
          className={cn(
            "absolute rounded-full",
            statusSizeClass,
            statusColorClass[status]
          )}
        />
      )}
    </div>
  );
}

// Compound components for Radix / Shadcn API compatibility if needed
export const AvatarRoot = Avatar;

export function AvatarImage({ src, alt = '', className }: { src?: string; alt?: string; className?: string }) {
  return src ? <img src={src} alt={alt} className={cn("aspect-square h-full w-full object-cover", className)} /> : null;
}

export function AvatarFallback({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-secondary text-secondary-foreground font-medium", className)}>
      {children}
    </div>
  );
}
