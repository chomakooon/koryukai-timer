import * as React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'rounded-md border border-border bg-white px-3 py-2 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-green-300',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
