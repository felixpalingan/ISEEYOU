import React from 'react';
import { cn } from '@/lib/utils';

export type StatusType = 'idle' | 'running' | 'success' | 'warning' | 'critical' | 'error';

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: StatusType;
  label?: string;
  pulse?: boolean;
}

const statusColors: Record<StatusType, { dot: string; text: string }> = {
  idle: { dot: 'bg-vsc-muted', text: 'text-vsc-muted' },
  running: { dot: 'bg-vsc-blue', text: 'text-vsc-blue' },
  success: { dot: 'bg-vsc-success', text: 'text-vsc-success' },
  warning: { dot: 'bg-vsc-warning', text: 'text-vsc-warning' },
  critical: { dot: 'bg-vsc-critical', text: 'text-vsc-critical' },
  error: { dot: 'bg-vsc-critical', text: 'text-vsc-critical' },
};

export function StatusIndicator({
  status = 'idle',
  label,
  pulse = false,
  className,
  ...props
}: StatusIndicatorProps) {
  const { dot, text } = statusColors[status] || statusColors.idle;

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs font-mono select-none', className)}
      {...props}
    >
      <span className="relative flex h-2 w-2">
        {(pulse || status === 'running') && (
          <span
            className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', dot)}
          />
        )}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', dot)} />
      </span>
      {label && <span className={cn('font-semibold', text)}>{label}</span>}
    </span>
  );
}
