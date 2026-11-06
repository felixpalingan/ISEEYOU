import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'icon';
  isLoading?: boolean;
}

const variantStyles = {
  primary:
    'bg-vsc-blue hover:bg-vsc-blueHover text-white border-transparent focus:ring-1 focus:ring-vsc-borderFocus',
  secondary:
    'bg-vsc-dropdown hover:bg-vsc-card border-vsc-border text-vsc-text hover:text-vsc-bright',
  danger:
    'bg-red-900/60 hover:bg-red-800/80 border-vsc-critical text-vsc-critical hover:text-white',
  ghost:
    'bg-transparent hover:bg-vsc-card text-vsc-muted hover:text-vsc-bright border-transparent',
  outline:
    'bg-transparent hover:bg-vsc-card border-vsc-border text-vsc-text hover:text-vsc-bright',
};

const sizeStyles = {
  xs: 'text-[10px] px-1.5 py-0.5 rounded',
  sm: 'text-xs px-2.5 py-1 rounded',
  md: 'text-xs px-3 py-1.5 rounded font-medium',
  icon: 'w-7 h-7 p-0 flex items-center justify-center rounded',
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
          'inline-flex items-center justify-center gap-1.5 border transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none font-sans',
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
