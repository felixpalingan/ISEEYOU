'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  AlertCircle,
  Copy,
  Trash2,
  ArrowDown,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { TelemetryLogLine } from '@/hooks/useScanStream';
import { VulnerabilityFinding, SeverityLevel } from '@iseeyou/shared-types';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface TelemetryTerminalProps {
  logs: TelemetryLogLine[];
  findings: VulnerabilityFinding[];
  isScanning: boolean;
  activeTab: 'terminal' | 'problems';
  onTabChange: (tab: 'terminal' | 'problems') => void;
  onClearLogs: () => void;
  onSelectFinding: (finding: VulnerabilityFinding) => void;
  selectedFindingId?: string;
  className?: string;
}

export function TelemetryTerminal({
  logs,
  findings,
  isScanning,
  activeTab,
  onTabChange,
  onClearLogs,
  onSelectFinding,
  selectedFindingId,
  className,
}: TelemetryTerminalProps) {
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'success' | 'warn' | 'error'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Filter logs by selected level
  const filteredLogs = logs.filter((log) => {
    if (levelFilter === 'all') return true;
    return log.level === levelFilter;
  });

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.module}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success':
        return 'text-vsc-success';
      case 'warn':
        return 'text-vsc-warning font-semibold';
      case 'error':
        return 'text-vsc-critical font-bold';
      case 'info':
      default:
        return 'text-vsc-info';
    }
  };

  return (
    <div className={cn('h-48 bg-vsc-panel border-t border-vsc-border flex flex-col font-mono', className)}>
      {/* 1. Header Bar: Tabs & Controls */}
      <div className="h-8 bg-vsc-sidebar flex items-center justify-between px-2 text-xs border-b border-vsc-border select-none flex-shrink-0">
        <div className="flex items-center h-full">
          {/* Terminal Tab */}
          <button
            type="button"
            onClick={() => onTabChange('terminal')}
            className={cn(
              'flex items-center gap-1.5 h-full px-3 border-b-2 font-medium transition-colors',
              activeTab === 'terminal'
                ? 'border-vsc-accent-blue text-vsc-bright bg-vsc-panel/40'
                : 'border-transparent text-vsc-muted hover:text-vsc-text'
            )}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>TERMINAL</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-vsc-dropdown text-vsc-muted border border-vsc-borderSubtle">
              {logs.length}
            </span>
            {isScanning && <span className="w-1.5 h-1.5 rounded-full bg-vsc-accent-blue animate-pulse ml-1" />}
          </button>

          {/* Problems Tab */}
          <button
            type="button"
            onClick={() => onTabChange('problems')}
            className={cn(
              'flex items-center gap-1.5 h-full px-3 border-b-2 font-medium transition-colors',
              activeTab === 'problems'
                ? 'border-vsc-accent-blue text-vsc-bright bg-vsc-panel/40'
                : 'border-transparent text-vsc-muted hover:text-vsc-text'
            )}
          >
            <AlertCircle className={cn('w-3.5 h-3.5', findings.length > 0 ? 'text-vsc-critical' : 'text-vsc-muted')} />
            <span>PROBLEMS</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.2 rounded border font-bold',
                findings.length > 0
                  ? 'bg-red-950/80 border-vsc-critical text-vsc-critical'
                  : 'bg-vsc-dropdown border-vsc-borderSubtle text-vsc-muted'
              )}
            >
              {findings.length}
            </span>
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {activeTab === 'terminal' && (
            <>
              {/* Level Filter Chips */}
              <div className="flex items-center bg-vsc-dropdown rounded border border-vsc-borderSubtle p-0.5 text-[10px]">
                {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelFilter(lvl)}
                    className={cn(
                      'px-1.5 py-0.2 rounded uppercase transition-colors',
                      levelFilter === lvl
                        ? 'bg-vsc-canvas text-vsc-bright font-bold'
                        : 'text-vsc-muted hover:text-vsc-text'
                    )}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* Auto Scroll Toggle */}
              <button
                type="button"
                onClick={() => setAutoScroll((prev) => !prev)}
                title={autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: PAUSED'}
                className={cn(
                  'p-1 rounded transition-colors',
                  autoScroll ? 'text-vsc-bright bg-vsc-dropdown' : 'text-vsc-muted hover:text-vsc-bright'
                )}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>

              {/* Copy Logs */}
              <button
                type="button"
                onClick={handleCopyLogs}
                title="Copy terminal output"
                className="p-1 text-vsc-muted hover:text-vsc-bright rounded transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-vsc-success" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Clear Logs */}
              <button
                type="button"
                onClick={onClearLogs}
                title="Clear terminal"
                className="p-1 text-vsc-muted hover:text-vsc-critical rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'terminal' ? (
          /* Terminal Stream Output */
          <div
            ref={logContainerRef}
            className="h-full p-2.5 overflow-y-auto text-xs leading-relaxed space-y-1 select-text"
          >
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 hover:bg-white/[0.02] px-1 rounded transition-colors">
                <span className="text-vsc-muted select-none text-[11px] font-mono flex-shrink-0">
                  [{log.timestamp}]
                </span>
                <span className="text-[10px] uppercase font-bold text-vsc-keyword/80 select-none flex-shrink-0">
                  [{log.module}]
                </span>
                <span className={cn('break-all', getLevelColor(log.level))}>{log.message}</span>
              </div>
            ))}

            {/* Blinking Prompt Cursor */}
            {isScanning && (
              <div className="flex items-center gap-2 text-vsc-accent-blue px-1 animate-pulse">
                <span className="text-[11px] text-vsc-muted">
                  [{new Date().toLocaleTimeString('en-US', { hour12: false })}]
                </span>
                <span className="text-vsc-bright font-bold">engine</span>
                <span>streaming telemetry...</span>
                <span className="w-2 h-3.5 bg-vsc-accent-blue inline-block animate-ping" />
              </div>
            )}
          </div>
        ) : (
          /* Problems / Findings View */
          <div className="h-full p-3 overflow-y-auto space-y-2">
            {findings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-vsc-muted text-xs">
                <ShieldAlert className="w-6 h-6 mb-1 text-vsc-muted opacity-50" />
                <span>No vulnerability findings detected yet. Target appears secure.</span>
              </div>
            ) : (
              findings.map((finding) => (
                <div
                  key={finding.id}
                  onClick={() => onSelectFinding(finding)}
                  className={cn(
                    'p-2.5 rounded border transition-all cursor-pointer flex items-start justify-between gap-3',
                    selectedFindingId === finding.id
                      ? 'bg-vsc-canvas border-vsc-accent-blue ring-1 ring-vsc-accent-blue/50'
                      : 'bg-vsc-sidebar hover:bg-vsc-canvas border-vsc-border'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={finding.severity.toLowerCase() as any}
                        size="xs"
                        className="font-bold"
                      >
                        {finding.severity.toUpperCase()}
                      </Badge>
                      <span className="font-bold text-xs text-vsc-bright">{finding.title}</span>
                      {(finding.cve_id || finding.cveId) && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-950 text-red-300 border border-red-800">
                          {finding.cve_id || finding.cveId}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-vsc-muted line-clamp-1">{finding.evidence}</p>
                  </div>
                  <span className="text-[10px] text-vsc-muted font-mono flex-shrink-0">
                    node: {finding.node_id || finding.nodeId}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
