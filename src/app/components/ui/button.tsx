import * as React from 'react';
import { cn } from '../../lib/utils';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent';
type Size = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-[#486756] text-white',
  secondary: 'bg-[#547A6A] text-white',
  outline: 'bg-white text-black hover:bg-slate-100',
  ghost: 'bg-transparent text-black hover:bg-white border-transparent shadow-none hover:border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
  destructive: 'bg-[#ef4444] text-white',
  accent: 'bg-[#486756] text-white'
};

const sizeClasses: Record<Size, string> = {
  default: 'h-12 px-6 py-2',
  sm: 'h-10 px-4 text-sm',
  lg: 'h-16 px-8 text-lg',
  icon: 'h-12 w-12'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-none border-4 border-black font-black uppercase transition-all duration-75 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:pointer-events-none disabled:opacity-50',
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
