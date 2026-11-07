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
  FileText,
  Printer,
  Download,
  Terminal,
} from 'lucide-react';
import { EntityNode, VulnerabilityFinding, AIAnalysisReport } from '@iseeyou/shared-types';
import { Button } from './ui';
import {
  downloadAuditReportPDF,
  downloadTargetDossierMarkdown,
  TLPLevel,
} from '@/lib/pdf_exporter';

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
    target ? `${target.toUpperCase()} OSINT Investigation` : 'Target Organization'
  );
  const [auditor, setAuditor] = useState('ISEEYOU 2.0 OSINT Caseboard');
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

  const handleDownloadMarkdown = () => {
    downloadTargetDossierMarkdown({
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
    });
  };

  const getTlpBadgeColor = (tlp: TLPLevel) => {
    switch (tlp) {
      case 'TLP:RED':
        return 'text-rose-300 border-rose-500/40 bg-rose-500/15';
      case 'TLP:AMBER':
        return 'text-amber-300 border-amber-500/40 bg-amber-500/15';
      case 'TLP:GREEN':
        return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15';
      case 'TLP:CLEAR':
      default:
        return 'text-slate-300 border-white/[0.12] bg-white/[0.05]';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        data-testid="export-pdf-modal"
        className="relative w-full max-w-2xl bg-[#0F1219] border border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] bg-[#131720]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileDown className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-100 tracking-wide">
                  Export Professional Security Audit Report
                </h2>
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded">
                  PDF & Markdown Dossier
                </span>
              </div>
              <p className="text-xs text-slate-400">
                OSINT Target Dossier, Lead-Chaining Register & Attack Surface Report
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-200">
          {/* Target & KPI Summary Banner */}
          <div className="grid grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#131720] border border-white/[0.07] tabular-nums">
            <div className="border-r border-white/[0.06] pr-2">
              <span className="text-[10px] text-slate-400 block mb-0.5">Target Scope</span>
              <span className="font-mono font-semibold text-sky-300 truncate block" title={target}>
                {target || 'N/A'}
              </span>
            </div>
            <div className="border-r border-white/[0.06] pr-2">
              <span className="text-[10px] text-slate-400 block mb-0.5">Exposure Index</span>
              <span
                className={`font-semibold ${
                  riskScore >= 70
                    ? 'text-rose-400'
                    : riskScore >= 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {riskScore}/100 {riskScore >= 70 ? '(Critical)' : riskScore >= 40 ? '(High)' : '(Low)'}
              </span>
            </div>
            <div className="border-r border-white/[0.06] pr-2">
              <span className="text-[10px] text-slate-400 block mb-0.5">Discovered Leads</span>
              <span className="font-mono text-slate-100">{nodes.length} Nodes</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">Exposures</span>
              <span className="font-mono text-amber-300">
                {findings.length} ({criticalCount} Crit / {highCount} High)
              </span>
            </div>
          </div>

          {/* Form Options Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Investigation / Case Name
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Target Organization"
                className="w-full bg-[#090B10] border border-white/[0.1] rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Lead Investigator / SecOps Team
              </label>
              <input
                type="text"
                value={auditor}
                onChange={(e) => setAuditor(e.target.value)}
                placeholder="Security Operations Team"
                className="w-full bg-[#090B10] border border-white/[0.1] rounded-md px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400/60"
              />
            </div>
          </div>

          {/* TLP Security Classification Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Traffic Light Protocol (TLP) Security Marking</span>
              </label>
              <span
                className={`text-[10px] px-2 py-0.5 rounded border font-mono ${getTlpBadgeColor(tlpLevel)}`}
              >
                {tlpLevel} Selected
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['TLP:CLEAR', 'TLP:GREEN', 'TLP:AMBER', 'TLP:RED'] as TLPLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setTlpLevel(level)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono border transition-all text-center ${
                    tlpLevel === level
                      ? getTlpBadgeColor(level)
                      : 'border-white/[0.07] bg-[#131720] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Report Sections Customizer Checklist */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">
              Dossier Sections & Confidentiality Settings
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#131720] border border-white/[0.07] cursor-pointer hover:border-white/[0.14]">
                <input
                  type="checkbox"
                  checked={includeAiNarrative}
                  onChange={(e) => setIncludeAiNarrative(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 accent-sky-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-slate-100 text-[11px]">
                    <Sparkles className="w-3 h-3 text-sky-400" />
                    <span>AI Detective Dossier Synthesis</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Identity correlation, predicted handles & hypothesis
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#131720] border border-white/[0.07] cursor-pointer hover:border-white/[0.14]">
                <input
                  type="checkbox"
                  checked={includeAssetInventory}
                  onChange={(e) => setIncludeAssetInventory(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 accent-sky-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-slate-100 text-[11px]">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    <span>Lead Register & Detective Notes</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    All profiles, emails, mutuals, confidence & sticky notes
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#131720] border border-white/[0.07] cursor-pointer hover:border-white/[0.14]">
                <input
                  type="checkbox"
                  checked={includeRemediationPlaybook}
                  onChange={(e) => setIncludeRemediationPlaybook(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 accent-sky-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-slate-100 text-[11px]">
                    <Terminal className="w-3 h-3 text-amber-400" />
                    <span>Statutory & Takedown Playbooks</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    UU PDP No. 27/2022, GDPR Art. 17 & hardening steps
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#131720] border border-white/[0.07] cursor-pointer hover:border-white/[0.14]">
                <input
                  type="checkbox"
                  checked={maskSensitiveData}
                  onChange={(e) => setMaskSensitiveData(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 accent-emerald-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-emerald-300 text-[11px]">
                    <ShieldAlert className="w-3 h-3 text-emerald-400" />
                    <span>Mandatory Credential Masking</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Redacts passwords and secrets (e.g. pa****ord123)
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Format & Specification Note */}
          <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] text-[11px] text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-sky-400">
              <FileText className="w-3.5 h-3.5" />
              <span>Report Deliverable Specifications</span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">
              Generates a vectorized A4 PDF or Markdown Target Dossier incorporating ISO timestamps,
              cryptographic SHA-256 audit trail verification, node confidence tags, investigator
              sticky notes, and statutory references (UU PDP No. 27/2022 & GDPR Art. 17).
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.07] bg-[#131720]">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              onClick={() => window.print()}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadMarkdown}
              className="text-xs flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>Export Markdown (.md)</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} className="text-xs py-1.5">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDownload}
              disabled={isExporting}
              className="text-xs py-1.5 flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  <span>Generating Vector PDF...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
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
