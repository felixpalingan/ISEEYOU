'use client';

import React, { useState } from 'react';
import {
  FileDown,
  X,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Server,
  FileText,
  Printer,
  Download,
  Terminal,
} from 'lucide-react';
import { EntityNode, VulnerabilityFinding, AIAnalysisReport } from '@iseeyou/shared-types';
import { Button } from './ui';
import { downloadAuditReportPDF, TLPLevel } from '@/lib/pdf_exporter';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: string;
  targetType?: string;
  riskScore: number;
  findings: VulnerabilityFinding[];
  nodes: EntityNode[];
  aiReport?: AIAnalysisReport | null;
}

export function ExportReportModal({
  isOpen,
  onClose,
  target,
  targetType = 'domain',
  riskScore,
  findings,
  nodes,
  aiReport,
}: ExportReportModalProps) {
  const [organization, setOrganization] = useState(
    target ? `${target.toUpperCase()} Security Operations` : 'Target Organization'
  );
  const [auditor, setAuditor] = useState('ISEEYOU Automated Recon Mesh');
  const [tlpLevel, setTlpLevel] = useState<TLPLevel>('TLP:AMBER');
  const [maskSensitiveData, setMaskSensitiveData] = useState(true);
  const [includeAiNarrative, setIncludeAiNarrative] = useState(true);
  const [includeAssetInventory, setIncludeAssetInventory] = useState(true);
  const [includeRemediationPlaybook, setIncludeRemediationPlaybook] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  const handleDownload = () => {
    try {
      setIsExporting(true);
      setTimeout(() => {
        downloadAuditReportPDF({
          target,
          targetType,
          riskScore,
          findings,
          nodes,
          aiReport,
          organizationName: organization,
          auditorName: auditor,
          tlpLevel,
          maskSensitiveData,
          includeAiNarrative,
          includeAssetInventory,
          includeRemediationPlaybook,
        });
        setIsExporting(false);
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 3500);
      }, 300);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setIsExporting(false);
    }
  };

  const getTlpBadgeColor = (tlp: TLPLevel) => {
    switch (tlp) {
      case 'TLP:RED':
        return 'text-red-400 border-red-500/50 bg-red-950/40';
      case 'TLP:AMBER':
        return 'text-amber-400 border-amber-500/50 bg-amber-950/40';
      case 'TLP:GREEN':
        return 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40';
      case 'TLP:CLEAR':
      default:
        return 'text-slate-300 border-slate-600 bg-slate-800/50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#1E1E1E] border border-vsc-border rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-vsc-border bg-[#252526]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-sky-950/80 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <FileDown className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-vsc-foreground tracking-wide">
                  Export Professional Security Audit Report
                </h2>
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-sky-950/60 text-sky-300 border border-sky-800/40 rounded">
                  PDF / A4 Vector
                </span>
              </div>
              <p className="text-xs text-vsc-muted">
                Industry-standard pentest & attack surface audit report with cryptographic integrity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-vsc-muted hover:text-vsc-foreground p-1 rounded hover:bg-vsc-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-vsc-foreground">
          {/* Target & KPI Summary Banner */}
          <div className="grid grid-cols-4 gap-2.5 p-3 rounded bg-[#252526]/80 border border-vsc-border">
            <div className="border-r border-vsc-border/60 pr-2">
              <span className="text-[10px] text-vsc-muted block mb-0.5">Target Scope</span>
              <span className="font-mono font-medium text-sky-300 truncate block" title={target}>
                {target || 'N/A'}
              </span>
            </div>
            <div className="border-r border-vsc-border/60 pr-2">
              <span className="text-[10px] text-vsc-muted block mb-0.5">Risk Posture</span>
              <span
                className={`font-semibold ${
                  riskScore >= 70
                    ? 'text-red-400'
                    : riskScore >= 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {riskScore}/100 {riskScore >= 70 ? '(Critical)' : riskScore >= 40 ? '(High)' : '(Moderate)'}
              </span>
            </div>
            <div className="border-r border-vsc-border/60 pr-2">
              <span className="text-[10px] text-vsc-muted block mb-0.5">Discovered Assets</span>
              <span className="font-mono text-vsc-foreground">{nodes.length} Nodes</span>
            </div>
            <div>
              <span className="text-[10px] text-vsc-muted block mb-0.5">Exposures</span>
              <span className="font-mono text-amber-400">
                {findings.length} ({criticalCount} Crit / {highCount} High)
              </span>
            </div>
          </div>

          {/* Form Options Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-vsc-muted mb-1">
                Organization / Client Name
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Target Organization"
                className="w-full bg-[#2D2D2D] border border-vsc-border rounded px-2.5 py-1.5 text-xs text-vsc-foreground focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-vsc-muted mb-1">
                Lead Auditor / SecOps Team
              </label>
              <input
                type="text"
                value={auditor}
                onChange={(e) => setAuditor(e.target.value)}
                placeholder="Security Operations Team"
                className="w-full bg-[#2D2D2D] border border-vsc-border rounded px-2.5 py-1.5 text-xs text-vsc-foreground focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* TLP Security Classification Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-vsc-muted flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Traffic Light Protocol (TLP) Security Marking</span>
              </label>
              <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${getTlpBadgeColor(tlpLevel)}`}>
                {tlpLevel} Selected
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['TLP:CLEAR', 'TLP:GREEN', 'TLP:AMBER', 'TLP:RED'] as TLPLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setTlpLevel(level)}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-mono border transition-all text-center ${
                    tlpLevel === level
                      ? getTlpBadgeColor(level) + ' ring-1 ring-offset-1 ring-offset-[#1E1E1E]'
                      : 'border-vsc-border/60 bg-[#252526] text-vsc-muted hover:border-vsc-border'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Report Sections Customizer Checklist */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-medium text-vsc-muted block mb-1">
              Report Sections & Confidentiality Settings
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex items-start gap-2.5 p-2 rounded bg-[#252526] border border-vsc-border/60 cursor-pointer hover:border-vsc-border">
                <input
                  type="checkbox"
                  checked={includeAiNarrative}
                  onChange={(e) => setIncludeAiNarrative(e.target.checked)}
                  className="mt-0.5 rounded border-vsc-border accent-sky-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-vsc-foreground text-[11px]">
                    <Sparkles className="w-3 h-3 text-sky-400" />
                    <span>AI Threat Synthesis</span>
                  </div>
                  <span className="text-[10px] text-vsc-muted block">
                    Executive summary, forecast & MITRE ATT&CK chain
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded bg-[#252526] border border-vsc-border/60 cursor-pointer hover:border-vsc-border">
                <input
                  type="checkbox"
                  checked={includeAssetInventory}
                  onChange={(e) => setIncludeAssetInventory(e.target.checked)}
                  className="mt-0.5 rounded border-vsc-border accent-sky-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-vsc-foreground text-[11px]">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    <span>Asset Inventory & Provenance</span>
                  </div>
                  <span className="text-[10px] text-vsc-muted block">
                    All subdomains, IPs, open ports & data sources
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded bg-[#252526] border border-vsc-border/60 cursor-pointer hover:border-vsc-border">
                <input
                  type="checkbox"
                  checked={includeRemediationPlaybook}
                  onChange={(e) => setIncludeRemediationPlaybook(e.target.checked)}
                  className="mt-0.5 rounded border-vsc-border accent-sky-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-vsc-foreground text-[11px]">
                    <Terminal className="w-3 h-3 text-amber-400" />
                    <span>Remediation Playbooks</span>
                  </div>
                  <span className="text-[10px] text-vsc-muted block">
                    1-Click UFW, Nginx, WAF & UU PDP/GDPR actions
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded bg-[#252526] border border-vsc-border/60 cursor-pointer hover:border-vsc-border">
                <input
                  type="checkbox"
                  checked={maskSensitiveData}
                  onChange={(e) => setMaskSensitiveData(e.target.checked)}
                  className="mt-0.5 rounded border-vsc-border accent-emerald-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-emerald-300 text-[11px]">
                    <ShieldAlert className="w-3 h-3 text-emerald-400" />
                    <span>Mandatory Credential Masking</span>
                  </div>
                  <span className="text-[10px] text-vsc-muted block">
                    Redacts passwords and secrets (e.g. pa****ord123)
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Format & Specification Note */}
          <div className="p-3 rounded bg-sky-950/20 border border-sky-800/40 text-[11px] text-sky-200/90 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-sky-300">
              <FileText className="w-3.5 h-3.5" />
              <span>Report Deliverable Specifications</span>
            </div>
            <p className="text-[10.5px] text-sky-200/75 leading-relaxed">
              Generates a crisp, vectorized A4 PDF document incorporating ISO timestamps, cryptographic SHA-256
              audit trail verification, multi-page table formatting, and regulatory compliance references (UU PDP No.
              27/2022 & GDPR Art. 17).
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-vsc-border bg-[#252526]">
          <Button
            variant="ghost"
            onClick={() => window.print()}
            className="text-xs text-vsc-muted hover:text-vsc-foreground flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Browser Print View</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} className="text-xs py-1.5">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDownload}
              disabled={isExporting}
              className="text-xs py-1.5 flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm"
            >
              {isExporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating Vector PDF...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Report Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Official PDF Report</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
