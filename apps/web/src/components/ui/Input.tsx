import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefixIcon?: React.ReactNode;
  suffixBadge?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, prefixIcon, suffixBadge, disabled, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex items-center bg-vsc-canvas border border-vsc-border rounded px-2.5 py-1 transition-colors duration-150',
          'focus-within:border-vsc-borderFocus focus-within:ring-1 focus-within:ring-vsc-borderFocus',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {prefixIcon && <span className="mr-2 text-vsc-muted flex items-center">{prefixIcon}</span>}
        <input
          ref={ref}
          disabled={disabled}
          className="bg-transparent border-none outline-none text-xs text-vsc-bright w-full font-mono placeholder:text-vsc-muted"
          {...props}
        />
        {suffixBadge && <div className="ml-2 flex items-center">{suffixBadge}</div>}
      </div>
    );
  }
);

Input.displayName = 'Input';
