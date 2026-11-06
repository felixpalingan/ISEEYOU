'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { VulnerabilityFinding, SeverityLevel } from '@iseeyou/shared-types';
import { Badge } from '@/components/ui/Badge';
import {
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Flame,
  X,
  Gauge,
} from 'lucide-react';

interface RiskGaugeProps {
  score: number;
  level: string;
  findings: VulnerabilityFinding[];
  isScanning?: boolean;
  onInspectFindings?: () => void;
}

export function RiskGauge({
  score,
  level,
  findings,
  isScanning = false,
  onInspectFindings,
}: RiskGaugeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as HTMLElement)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Breakdown counts & weights
  const criticalFindings = useMemo(
    () => findings.filter((f) => f.severity.toLowerCase() === 'critical'),
    [findings]
  );
  const highFindings = useMemo(
    () => findings.filter((f) => f.severity.toLowerCase() === 'high'),
    [findings]
  );
  const mediumFindings = useMemo(
    () => findings.filter((f) => f.severity.toLowerCase() === 'medium'),
    [findings]
  );
  const lowFindings = useMemo(
    () => findings.filter((f) => f.severity.toLowerCase() === 'low' || f.severity.toLowerCase() === 'info'),
    [findings]
  );

  // Computed threat severity color tokens
  const gaugeColor = useMemo(() => {
    if (score >= 70) return '#F14C4C'; // Critical Red
    if (score >= 40) return '#CCA700'; // High / Warning Yellow-Orange
    if (score > 0) return '#3794FF';   // Low / Medium Blue
    return '#89D185';                  // Success Green
  }, [score]);

  // Needle calculations for 180° semi-circle
  // Arc radius = 22, center = (30, 26)
  const normalizedScore = Math.min(100, Math.max(0, score));
  const arcCircumference = 69.115; // Math.PI * 22
  const strokeOffset = arcCircumference * (1 - normalizedScore / 100);

  // Needle end-point
  const angleRad = (normalizedScore / 100) * Math.PI;
  const needleLength = 17;
  const needleX = 30 - needleLength * Math.cos(angleRad);
  const needleY = 26 - needleLength * Math.sin(angleRad);

  return (
    <div className="relative select-none font-mono" ref={popoverRef}>
      {/* 1. Header Trigger Pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded border transition-all cursor-pointer group ${
          score >= 70
            ? 'bg-red-950/60 border-vsc-critical text-vsc-critical hover:bg-red-950/80 shadow-sm shadow-red-950/40'
            : score >= 40
            ? 'bg-yellow-950/50 border-vsc-warning text-vsc-warning hover:bg-yellow-950/70'
            : score > 0
            ? 'bg-blue-950/40 border-vsc-accent-blue text-sky-300 hover:bg-blue-950/60'
            : 'bg-vsc-dropdown border-vsc-borderSubtle text-vsc-success hover:bg-vsc-card'
        }`}
        title="Click to view interactive Attack Surface Risk Gauge"
      >
        {/* Speedometer Miniature SVG Gauge */}
        <div className="w-8 h-4 relative flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 60 30" className="w-8 h-4 overflow-visible">
            {/* Background Arc */}
            <path
              d="M 8 26 A 22 22 0 0 1 52 26"
              fill="none"
              stroke="#333333"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Colored Segment Arc */}
            <path
              d="M 8 26 A 22 22 0 0 1 52 26"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={arcCircumference}
              strokeDashoffset={strokeOffset}
              className="transition-all duration-700 ease-out"
            />
            {/* Needle Pivot Center Dot */}
            <circle cx="30" cy="26" r="3" fill="#CCCCCC" />
            {/* Speedometer Needle */}
            <line
              x1="30"
              y1="26"
              x2={needleX}
              y2={needleY}
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
        </div>

        {/* Digital Score & Status Text */}
        <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              score >= 70
                ? 'bg-vsc-critical animate-ping'
                : score >= 40
                ? 'bg-vsc-warning'
                : 'bg-vsc-success'
            }`}
          />
          <span className="text-vsc-bright font-black">{score}</span>
          <span className="text-[10px] text-vsc-muted">/100</span>
          <span className="uppercase text-[10px] tracking-wider ml-0.5">({level})</span>
        </div>

        <ChevronDown
          className={`w-3 h-3 text-vsc-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-vsc-bright' : 'group-hover:text-vsc-bright'
          }`}
        />
      </button>

      {/* 2. Interactive Risk Gauge Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-vsc-dropdown border border-vsc-border rounded shadow-2xl shadow-black/80 z-50 p-4 text-xs font-mono text-vsc-text animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-vsc-border">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-vsc-accent-blue" />
              <span className="font-bold text-vsc-bright uppercase tracking-wider text-xs">
                Attack Surface Score
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-vsc-muted hover:text-vsc-bright p-0.5 rounded hover:bg-vsc-panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Large Speedometer Display */}
          <div className="py-4 flex flex-col items-center justify-center border-b border-vsc-border/60">
            <div className="w-36 h-20 relative flex items-center justify-center">
              <svg viewBox="0 0 60 32" className="w-36 h-20 overflow-visible">
                {/* Gauge Background Track */}
                <path
                  d="M 6 27 A 24 24 0 0 1 54 27"
                  fill="none"
                  stroke="#262626"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {/* 4 Colored Gauge Bands (Low, Medium, High, Critical) */}
                <path
                  d="M 6 27 A 24 24 0 0 1 18 10"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="5"
                  opacity="0.3"
                />
                <path
                  d="M 18 10 A 24 24 0 0 1 30 3"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="5"
                  opacity="0.3"
                />
                <path
                  d="M 30 3 A 24 24 0 0 1 42 10"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="5"
                  opacity="0.3"
                />
                <path
                  d="M 42 10 A 24 24 0 0 1 54 27"
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="5"
                  opacity="0.3"
                />

                {/* Active Score Arc */}
                <path
                  d="M 6 27 A 24 24 0 0 1 54 27"
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={75.398} // Math.PI * 24
                  strokeDashoffset={75.398 * (1 - normalizedScore / 100)}
                  className="transition-all duration-700 ease-out"
                />

                {/* Center Pivot Point */}
                <circle cx="30" cy="27" r="3.5" fill="#CCCCCC" />
                <circle cx="30" cy="27" r="1.5" fill="#181818" />

                {/* Active Needle */}
                <line
                  x1="30"
                  y1="27"
                  x2={30 - 20 * Math.cos(angleRad)}
                  y2={27 - 20 * Math.sin(angleRad)}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
            </div>

            {/* Score & Risk Level Label */}
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-3xl font-black font-mono text-vsc-bright">{score}</span>
              <span className="text-sm font-mono text-vsc-muted">/ 100</span>
              <Badge
                variant={
                  score >= 70
                    ? 'critical'
                    : score >= 40
                    ? 'high'
                    : score > 0
                    ? 'low'
                    : 'success'
                }
                size="xs"
                className="ml-2 font-mono uppercase font-bold"
              >
                {level}
              </Badge>
            </div>
            <p className="text-[10px] text-vsc-muted mt-0.5">
              {score >= 70
                ? 'Critical hazard: Active CVEs or open database ports detected'
                : score >= 40
                ? 'Elevated threat: Host exposed to public network reconnaissance'
                : score > 0
                ? 'Low exposure: Passive DNS & social footprint verified'
                : 'Clean perimeter: No critical vulnerabilities recorded'}
            </p>
          </div>

          {/* Finding Breakdown Breakdown */}
          <div className="py-3 space-y-1.5 border-b border-vsc-border/60">
            <div className="text-[10px] font-bold uppercase text-vsc-muted tracking-wider mb-1">
              Vulnerability Weight Breakdown
            </div>

            <div className="flex items-center justify-between text-[11px] p-1 rounded bg-vsc-canvas/50">
              <span className="flex items-center gap-1.5 text-red-400 font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-vsc-critical" />
                <span>Critical Severity (+35 pts)</span>
              </span>
              <span className="font-bold text-vsc-bright">{criticalFindings.length}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] p-1 rounded bg-vsc-canvas/50">
              <span className="flex items-center gap-1.5 text-orange-400 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                <span>High Severity (+20 pts)</span>
              </span>
              <span className="font-bold text-vsc-bright">{highFindings.length}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] p-1 rounded bg-vsc-canvas/50">
              <span className="flex items-center gap-1.5 text-yellow-400">
                <Info className="w-3.5 h-3.5 text-yellow-400" />
                <span>Medium Severity (+10 pts)</span>
              </span>
              <span className="font-bold text-vsc-bright">{mediumFindings.length}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] p-1 rounded bg-vsc-canvas/50">
              <span className="flex items-center gap-1.5 text-blue-300">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Low / Info Severity (+5 pts)</span>
              </span>
              <span className="font-bold text-vsc-bright">{lowFindings.length}</span>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-3">
            <button
              onClick={() => {
                setIsOpen(false);
                onInspectFindings?.();
              }}
              className="w-full py-1.5 rounded bg-vsc-accent-blue hover:bg-vsc-accent-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Inspect Findings in Problems Drawer</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
