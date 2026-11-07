import React from 'react';
import { cn } from '@/lib/utils';
import { EntityType } from '@iseeyou/shared-types';

export type SeverityVariant = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success';
export type EntityVariant = EntityType;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: SeverityVariant | EntityVariant | 'default';
  size?: 'xs' | 'sm' | 'md';
  pulse?: boolean;
}

const variantStyles: Record<string, string> = {
  // Severity variants (Restrained saturation, high contrast legibility)
  critical: 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-semibold',
  high: 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold',
  medium: 'bg-amber-500/10 border-amber-500/25 text-amber-200 font-medium',
  low: 'bg-sky-500/10 border-sky-500/25 text-sky-300',
  info: 'bg-white/[0.04] border-white/[0.08] text-slate-300',
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-medium',

  // Entity type variants (Quiet dark surface + subtle semantic text tint)
  domain: 'bg-sky-500/10 border-sky-500/25 text-sky-300 font-mono font-medium',
  subdomain: 'bg-white/[0.04] border-white/[0.08] text-sky-300 font-mono',
  ip: 'bg-white/[0.04] border-white/[0.08] text-emerald-300 font-mono font-medium',
  email: 'bg-amber-500/10 border-amber-500/25 text-amber-300 font-mono font-medium',
  username: 'bg-sky-500/10 border-sky-500/25 text-sky-300 font-mono font-medium',
  port: 'bg-white/[0.04] border-white/[0.08] text-cyan-300 font-mono',
  breach: 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-mono font-semibold',
  secret: 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-mono font-semibold',
  document: 'bg-white/[0.04] border-white/[0.08] text-slate-300 font-mono',
  associate: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 font-mono font-medium',
  organization: 'bg-white/[0.04] border-white/[0.08] text-amber-200 font-mono font-medium',
  location: 'bg-white/[0.04] border-white/[0.08] text-slate-300 font-mono font-medium',

  default: 'bg-white/[0.04] border-white/[0.08] text-slate-400',
};

const sizeStyles = {
  xs: 'text-[9px] px-1.5 py-0.5 rounded',
  sm: 'text-[10px] px-1.5 py-0.5 rounded-md',
  md: 'text-xs px-2 py-0.5 rounded-md',
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
        'inline-flex items-center gap-1 border select-none transition-colors tracking-wide tabular-nums',
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
            variant === 'critical' ? 'bg-rose-400' : 'bg-sky-400'
          )}
        />
      )}
      {children}
    </span>
  );
}
