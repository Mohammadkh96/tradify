import React from 'react';
import { cn } from '../../lib/utils';

export const PageHeader = ({ title, description, children, className }: { title: string, description?: string, children?: React.ReactNode, className?: string }) => {
  return (
    <div className={cn("flex flex-col md:flex-row items-start md:items-center justify-between mb-8", className)}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="mt-4 md:mt-0 flex items-center space-x-2">{children}</div>}
    </div>
  );
};

export const SectionHeader = ({ title, description, children, className }: { title: string, description?: string, children?: React.ReactNode, className?: string }) => {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center space-x-2">{children}</div>}
    </div>
  );
};
