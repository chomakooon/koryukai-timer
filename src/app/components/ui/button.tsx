import * as React from 'react';
import { cn } from '../../lib/utils';

type Variant = 'default' | 'outline' | 'destructive' | 'black';
type Size = 'default' | 'sm' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  default: 'border-4 border-black bg-primary text-black hover:bg-primary/90 active-brutal shadow-brutal-sm font-bold',
  outline: 'border-4 border-black bg-white text-black hover:bg-gray-100 active-brutal shadow-brutal-sm font-bold',
  destructive: 'border-4 border-black bg-destructive text-white hover:bg-destructive/90 active-brutal shadow-brutal-sm font-bold',
  black: 'border-4 border-black bg-black text-white hover:bg-gray-900 focus:bg-gray-900 active-brutal shadow-brutal-sm font-bold'
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
          'inline-flex items-center justify-center gap-2 rounded-none font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:translate-x-0 disabled:active:translate-y-0',
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
