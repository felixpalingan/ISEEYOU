import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'icon';
  isLoading?: boolean;
}

const variantStyles = {
  primary:
    'bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold border-transparent shadow-sm focus-visible:ring-2 focus-visible:ring-sky-400/60',
  secondary:
    'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-slate-200 hover:text-white',
  danger:
    'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300 hover:text-rose-200',
  ghost:
    'bg-transparent hover:bg-white/[0.05] text-slate-400 hover:text-slate-100 border-transparent',
  outline:
    'bg-transparent hover:bg-white/[0.05] border-white/[0.1] text-slate-300 hover:text-white',
};

const sizeStyles = {
  xs: 'text-[10px] px-2 py-0.5 rounded-md',
  sm: 'text-xs px-2.5 py-1 rounded-md',
  md: 'text-xs px-3 py-1.5 rounded-md font-medium',
  icon: 'w-7 h-7 p-0 flex items-center justify-center rounded-md',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'sm',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 border transition-all duration-150 select-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed outline-none font-sans',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
