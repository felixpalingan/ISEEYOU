'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Flame,
  Layers,
  ExternalLink,
  Target,
  FileCode,
  ShieldCheck,
  Bot,
} from 'lucide-react';
import { AIAnalysisReport, AttackChainStep } from '@iseeyou/shared-types';
import { Badge, Button } from '@/components/ui';

interface AIAnalystCardProps {
  report: AIAnalysisReport | null;
  isAnalyzing: boolean;
  onRefresh: () => void;
  target: string;
}

export function AIAnalystCard({
  report,
  isAnalyzing,
  onRefresh,
  target,
}: AIAnalystCardProps) {
  const [copied, setCopied] = useState(false);

  const getThreatBadge = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950 text-red-300 border border-vsc-critical flex items-center gap-1">
            <Flame className="w-3 h-3 text-vsc-critical animate-pulse" />
            CRITICAL THREAT
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-950 text-orange-300 border border-orange-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            HIGH THREAT
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-yellow-950 text-yellow-300 border border-yellow-500">
            MEDIUM THREAT
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500">
            LOW THREAT
          </span>
        );
    }
  };

  const handleCopyReport = () => {
    if (!report) return;
    const text = `# ISEEYOU AI RECON ANALYSIS REPORT
Target: ${report.target} (${report.targetType})
Model: ${report.model}
Threat Level: ${report.threatLevel}
Timestamp: ${report.generatedAt}

## Executive Summary
${report.executiveSummary}

## Key Perimeter Exposures
${report.keyExposures.map((e) => `- ${e}`).join('\n')}

## Attack Chain Hypothesis (MITRE ATT&CK)
${report.attackChain
  .map(
    (s) =>
      `### Step ${s.step}: ${s.title}\n- Technique: ${s.technique}\n- Target Asset: ${s.targetAsset}\n- Action: ${s.description}\n- Consequence: ${s.impact}`
  )
  .join('\n\n')}

## Prioritized SecOps Recommendations
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono select-text bg-vsc-canvas text-vsc-text">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between bg-vsc-sidebar p-3 rounded border border-vsc-border">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-vsc-panel border border-vsc-borderSubtle">
            <Sparkles className="w-4 h-4 text-vsc-keyword" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-vsc-bright">AI RECON ANALYST // COPILOT</span>
              {report && getThreatBadge(report.threatLevel)}
              <span className="text-[10px] px-1.5 py-0.2 rounded border border-vsc-borderSubtle bg-vsc-panel text-sky-400 font-mono">
                {report?.model || 'Gemini 1.5 Flash'}
              </span>
            </div>
            <span className="text-[10px] text-vsc-muted">
              Offensive Attack Surface Synthesis & MITRE ATT&CK Chain Generator
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyReport}
            disabled={!report || isAnalyzing}
            className="text-[10px] h-7 px-2.5 flex items-center gap-1 font-mono"
            title="Copy full intelligence report in Markdown"
          >
            {copied ? <Check className="w-3 h-3 text-vsc-success" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied Markdown' : 'Copy Report'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onRefresh}
            disabled={isAnalyzing}
            className="text-[10px] h-7 px-2.5 flex items-center gap-1.5 font-mono"
          >
            <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Synthesizing...' : 'Re-Analyze'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Loading State */}
      {isAnalyzing && (
        <div className="p-8 bg-vsc-card border border-vsc-border rounded flex flex-col items-center justify-center text-center space-y-3">
          <Bot className="w-8 h-8 text-vsc-accent-blue animate-bounce" />
          <div className="space-y-1">
            <div className="text-xs font-bold text-vsc-bright">Synthesizing Attack Surface Intelligence...</div>
            <p className="text-[11px] text-vsc-muted max-w-md">
              Correlating discovered subdomains, open ports, leaked credentials, and graph links to produce realistic offensive exploitation hypotheses.
            </p>
          </div>
          <div className="w-48 h-1 bg-vsc-dropdown rounded-full overflow-hidden">
            <div className="h-full bg-vsc-accent-blue animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {/* 3. Empty State if no report yet */}
      {!isAnalyzing && !report && (
        <div className="p-8 bg-vsc-card border border-vsc-border rounded flex flex-col items-center justify-center text-center space-y-2">
          <Sparkles className="w-8 h-8 text-vsc-muted opacity-60" />
          <div className="text-xs font-bold text-vsc-bright">No AI Recon Analysis Generated Yet</div>
          <p className="text-[11px] text-vsc-muted max-w-sm">
            Launch a target scan or click &quot;Re-Analyze&quot; above to trigger Gemini Flash reconnaissance synthesis.
          </p>
          <Button variant="primary" size="sm" onClick={onRefresh} className="text-xs mt-2">
            Generate Analysis Now
          </Button>
        </div>
      )}

      {/* 4. Active Report Content */}
      {!isAnalyzing && report && (
        <div className="space-y-4">
          {/* Executive Summary Card */}
          <div className="bg-vsc-card p-4 rounded border border-vsc-border space-y-2">
            <div className="flex items-center justify-between border-b border-vsc-borderSubtle pb-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-vsc-bright">
                <ShieldAlert className="w-3.5 h-3.5 text-vsc-keyword" />
                <span>Executive Threat Summary</span>
              </div>
              <span className="text-[10px] text-vsc-muted">
                Generated: {new Date(report.generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-xs text-vsc-text leading-relaxed whitespace-pre-line">
              {report.executiveSummary}
            </p>
          </div>

          {/* Key Exposures Grid */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-vsc-muted">
              Identified Threat Vectors ({report.keyExposures.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.keyExposures.map((exp, idx) => (
                <div
                  key={`exp-${idx}`}
                  className="p-2.5 bg-vsc-panel rounded border border-vsc-border text-xs flex items-start gap-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] text-vsc-bright font-mono">{exp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attack Chain Hypothesis (Visual Multi-Step Flow) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-vsc-muted flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-vsc-critical" />
                <span>Attack Chain Hypothesis (MITRE ATT&CK Model)</span>
              </div>
              <span className="text-[10px] text-vsc-info font-mono">
                {report.attackChain.length} Exploitation Steps
              </span>
            </div>

            <div className="space-y-3 relative before:absolute before:left-3 before:top-4 before:bottom-4 before:w-0.5 before:bg-vsc-borderSubtle">
              {report.attackChain.map((step) => (
                <div
                  key={`step-${step.step}`}
                  className="relative pl-8 group"
                >
                  {/* Step circle indicator */}
                  <div className="absolute left-1 top-2.5 -translate-x-1/2 w-4 h-4 rounded-full bg-vsc-panel border-2 border-vsc-accent-blue text-[9px] font-bold text-vsc-bright flex items-center justify-center z-10 group-hover:scale-110 transition-transform">
                    {step.step}
                  </div>

                  <div className="p-3 bg-vsc-card rounded border border-vsc-border hover:border-vsc-accent-blue/80 transition-colors space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-vsc-bright">{step.title}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded border border-sky-800 text-sky-400 bg-sky-950 font-mono">
                          {step.technique}
                        </span>
                      </div>
                      <span className="text-[10px] text-vsc-muted font-mono bg-vsc-panel px-1.5 py-0.2 rounded border border-vsc-borderSubtle">
                        Target: {step.targetAsset}
                      </span>
                    </div>

                    <p className="text-[11px] text-vsc-text leading-relaxed">{step.description}</p>

                    <div className="pt-1 border-t border-vsc-borderSubtle/60 flex items-center gap-1.5 text-[10px]">
                      <span className="text-vsc-muted">Consequence / Impact:</span>
                      <span className="text-amber-300 font-semibold">{step.impact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="bg-vsc-panel p-3.5 rounded border border-vsc-border space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-xs text-vsc-bright">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tactical SecOps Mitigation Playbook</span>
            </div>
            <ul className="space-y-1.5 text-xs text-vsc-muted">
              {report.recommendations.map((rec, idx) => (
                <li key={`rec-${idx}`} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span className="text-[11px] leading-relaxed text-vsc-text">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
