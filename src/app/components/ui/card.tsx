import * as React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-none border-4 border-black bg-white text-card-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]', className)} {...props} />;
}
