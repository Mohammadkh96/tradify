import React from 'react';
import { cn } from '../../lib/utils';
import { Label } from '@radix-ui/react-label';

export const FormField = ({ children, label, error, className }: { children: React.ReactNode, label?: string, error?: string, className?: string }) => {
  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</Label>}
      {children}
      {error && <FormError>{error}</FormError>}
    </div>
  );
};

export const FormError = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return (
    <p className={cn("text-[0.8rem] font-medium text-destructive", className)}>
      {children}
    </p>
  );
};
