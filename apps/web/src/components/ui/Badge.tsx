import React from 'react';
import { cn } from '@/lib/utils';

export type SeverityVariant = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success';
export type EntityVariant = 'domain' | 'subdomain' | 'ip' | 'email' | 'username' | 'port' | 'breach' | 'secret';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: SeverityVariant | EntityVariant | 'default';
  size?: 'xs' | 'sm' | 'md';
  pulse?: boolean;
}

const variantStyles: Record<string, string> = {
  // Severity variants
  critical: 'bg-red-950/70 border-vsc-critical text-vsc-critical font-bold',
  high: 'bg-orange-950/70 border-orange-500 text-orange-400 font-bold',
  medium: 'bg-yellow-950/70 border-vsc-warning text-vsc-warning font-semibold',
  low: 'bg-blue-950/50 border-blue-400 text-blue-300',
  info: 'bg-vsc-dropdown border-vsc-borderSubtle text-vsc-info',
  success: 'bg-emerald-950/60 border-vsc-success text-vsc-success font-semibold',

  // Entity type variants
  domain: 'bg-vsc-dropdown border-vsc-borderSubtle text-vsc-keyword font-mono font-bold',
  subdomain: 'bg-vsc-dropdown border-vsc-borderSubtle text-sky-400 font-mono',
  ip: 'bg-vsc-dropdown border-vsc-borderSubtle text-emerald-400 font-mono font-semibold',
  email: 'bg-vsc-dropdown border-vsc-borderSubtle text-amber-400 font-mono font-semibold',
  username: 'bg-vsc-dropdown border-vsc-borderSubtle text-purple-400 font-mono font-semibold',
  port: 'bg-vsc-dropdown border-vsc-borderSubtle text-cyan-300 font-mono',
  breach: 'bg-red-950/80 border-vsc-critical text-vsc-critical font-mono font-bold',
  secret: 'bg-rose-950/80 border-rose-500 text-rose-300 font-mono font-bold',

  default: 'bg-vsc-dropdown border-vsc-border text-vsc-muted',
};

const sizeStyles = {
  xs: 'text-[9px] px-1 py-0.2 rounded',
  sm: 'text-[10px] px-1.5 py-0.5 rounded',
  md: 'text-xs px-2 py-0.5 rounded',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  pulse = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const style = variantStyles[variant] || variantStyles.default;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border select-none transition-colors tracking-wide',
        style,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {pulse && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full animate-pulse',
            variant === 'critical' ? 'bg-vsc-critical' : 'bg-vsc-accent-blue'
          )}
        />
      )}
      {children}
    </span>
  );
}
