import * as React from 'react';
import { cn } from '../../lib/utils';

type Variant = 'default' | 'outline' | 'destructive';
type Size = 'default' | 'sm' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-95',
  outline: 'border border-border bg-white text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-95'
};

const sizeClasses: Record<Size, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-8 px-3 text-sm',
  lg: 'h-12 px-6 text-base'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
