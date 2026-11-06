'use client';

import React, { useState, useMemo } from 'react';
import {
  Scale,
  X,
  Copy,
  Check,
  Download,
  Mail,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  Search,
} from 'lucide-react';
import { VulnerabilityFinding, EntityNode } from '@iseeyou/shared-types';
import {
  LegalJurisdiction,
  LegalTakedownParams,
  generateTakedownDraft,
  OFFICIAL_REMOVAL_RESOURCES,
} from '@/lib/legal_takedown';
import { Badge, Button } from '@/components/ui';

interface LegalTakedownModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: string;
  findings: VulnerabilityFinding[];
  nodes: EntityNode[];
}

export function LegalTakedownModal({
  isOpen,
  onClose,
  target,
  findings,
  nodes,
}: LegalTakedownModalProps) {
  const [jurisdiction, setJurisdiction] = useState<LegalJurisdiction>('uupdp');
  const [subjectName, setSubjectName] = useState('');
  const [subjectEmail, setSubjectEmail] = useState('');
  const [controllerName, setControllerName] = useState('');
  const [controllerEmail, setControllerEmail] = useState('');
  const [copied, setCopied] = useState(false);

  // Auto-extract exposed credentials and identities from scan results
  const detectedExposures = useMemo(() => {
    const list: string[] = [];

    // Breached passwords & credentials
    findings
      .filter((f) => {
        const t = f.title.toLowerCase();
        return t.includes('breach') || t.includes('credential') || t.includes('password') || t.includes('pwned');
      })
      .forEach((f) => list.push(`[Breached Account/Password]: ${f.title} (${f.evidence})`));

    // Exposed user profiles
    nodes
      .filter((n) => n.type === 'username' || n.type === 'email')
      .slice(0, 5)
      .forEach((n) => list.push(`[Public Profile/Email]: ${n.value} (${String(n.metadata?.platform || 'Identity')})`));

    // Open database or sensitive ports
    findings
      .filter((f) => {
        const t = f.title.toLowerCase();
        return t.includes('mysql') || t.includes('postgres') || t.includes('redis') || t.includes('cname');
      })
      .forEach((f) => list.push(`[Insecure Host Exposure]: ${f.title}`));

    if (list.length === 0) {
      list.push(`Data identitas dan jejak digital yang terafiliasi dengan domain/host: ${target}`);
    }

    return list;
  }, [findings, nodes, target]);

  const draftParams: LegalTakedownParams = {
    subjectName: subjectName || 'Subjek Data Pemohon',
    subjectEmail: subjectEmail || `privacy-request@${target}`,
    controllerName: controllerName || `PT / Manajemen Pengendali ${target}`,
    controllerEmail: controllerEmail || `dpo@${target}`,
    target,
    exposedDataItems: detectedExposures,
    evidenceUrls: [`https://${target}`],
  };

  const draftResult = generateTakedownDraft(jurisdiction, draftParams);

  if (!isOpen) return null;

  const handleCopyNotice = () => {
    navigator.clipboard.writeText(draftResult.letterBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadNotice = () => {
    const filename = `legal-takedown-${jurisdiction}-${target.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    const blob = new Blob([draftResult.letterBody], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 md:p-6 select-none font-mono">
      <div className="bg-vsc-card border border-vsc-border w-full max-w-4xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 1. Modal Header */}
        <div className="h-11 bg-vsc-sidebar px-4 border-b border-vsc-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-vsc-keyword" />
            <span className="font-bold text-sm text-vsc-bright">
              Legal Takedown & Privacy Assistant (UU PDP & GDPR)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-vsc-dropdown border border-vsc-borderSubtle text-emerald-400 font-bold">
              Task 4.3 Active
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-vsc-muted hover:text-vsc-bright rounded hover:bg-vsc-panel transition-colors"
            title="Close Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Jurisdiction Tabs */}
        <div className="px-4 py-2 bg-vsc-panel border-b border-vsc-border flex items-center gap-2 overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setJurisdiction('uupdp')}
            className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              jurisdiction === 'uupdp'
                ? 'bg-vsc-card text-sky-300 border border-vsc-accent-blue/70 shadow-sm'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <span>🇮🇩</span>
            <span>UU PDP No. 27/2022 (Indonesia)</span>
          </button>

          <button
            onClick={() => setJurisdiction('gdpr')}
            className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              jurisdiction === 'gdpr'
                ? 'bg-vsc-card text-sky-300 border border-vsc-accent-blue/70 shadow-sm'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <span>🇪🇺</span>
            <span>GDPR Article 17 (Right to Erasure)</span>
          </button>

          <button
            onClick={() => setJurisdiction('dmca')}
            className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              jurisdiction === 'dmca'
                ? 'bg-vsc-card text-sky-300 border border-vsc-accent-blue/70 shadow-sm'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <span>🇺🇸</span>
            <span>DMCA / Credential Abuse Notice</span>
          </button>
        </div>

        {/* 3. Main Modal Body (Customizer inputs + Live Letter Preview) */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs select-text">
          {/* Left Column: Parameters Customizer & De-index Tools (4 cols) */}
          <div className="lg:col-span-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase text-vsc-muted tracking-wider">
                Parameter Subjek & Pengendali:
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-vsc-muted block mb-0.5">Nama Pemohon (Subjek Data):</label>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="e.g. John Doe / Security Officer"
                    className="w-full bg-vsc-canvas border border-vsc-border rounded px-2.5 py-1 text-xs text-vsc-bright focus:outline-none focus:border-vsc-accent-blue"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-vsc-muted block mb-0.5">Email Pemohon:</label>
                  <input
                    type="email"
                    value={subjectEmail}
                    onChange={(e) => setSubjectEmail(e.target.value)}
                    placeholder="e.g. user@target.com"
                    className="w-full bg-vsc-canvas border border-vsc-border rounded px-2.5 py-1 text-xs text-vsc-bright focus:outline-none focus:border-vsc-accent-blue"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-vsc-muted block mb-0.5">Nama Pengendali Data / DPO Target:</label>
                  <input
                    type="text"
                    value={controllerName}
                    onChange={(e) => setControllerName(e.target.value)}
                    placeholder={`e.g. DPO ${target}`}
                    className="w-full bg-vsc-canvas border border-vsc-border rounded px-2.5 py-1 text-xs text-vsc-bright focus:outline-none focus:border-vsc-accent-blue"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-vsc-muted block mb-0.5">Email DPO / Legal Target:</label>
                  <input
                    type="email"
                    value={controllerEmail}
                    onChange={(e) => setControllerEmail(e.target.value)}
                    placeholder={`e.g. dpo@${target}`}
                    className="w-full bg-vsc-canvas border border-vsc-border rounded px-2.5 py-1 text-xs text-vsc-bright focus:outline-none focus:border-vsc-accent-blue"
                  />
                </div>
              </div>

              {/* Detected Exposures Chips */}
              <div className="pt-2 border-t border-vsc-borderSubtle">
                <div className="flex items-center justify-between text-[10px] text-vsc-muted mb-1 font-bold uppercase">
                  <span>Data Bocor Terdeteksi:</span>
                  <span className="text-vsc-keyword font-mono">{detectedExposures.length} item</span>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {detectedExposures.map((exp, idx) => (
                    <div
                      key={`exp-${idx}`}
                      className="p-1.5 rounded bg-vsc-panel border border-vsc-borderSubtle text-[10px] text-vsc-muted leading-tight truncate"
                      title={exp}
                    >
                      {exp}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 1-Click Search Engine De-index Tools Box */}
            <div className="p-3 bg-vsc-panel rounded border border-vsc-border space-y-2 mt-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-vsc-bright">
                <Search className="w-3.5 h-3.5 text-sky-400" />
                <span>1-Click Search De-indexing</span>
              </div>
              <p className="text-[10px] text-vsc-muted leading-relaxed">
                Hapus hasil pencarian dan cache URL bocor secara instan dari Google dan Bing Search:
              </p>
              <div className="space-y-1.5">
                <a
                  href={draftResult.googleDeindexUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1 px-2.5 rounded bg-vsc-card hover:bg-vsc-dropdown border border-vsc-border flex items-center justify-between text-[11px] text-vsc-bright hover:underline transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <span>Google PII Removal Tool</span>
                  </span>
                  <ExternalLink className="w-3 h-3 text-vsc-muted" />
                </a>

                <a
                  href={OFFICIAL_REMOVAL_RESOURCES.googleOutdatedContent}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1 px-2.5 rounded bg-vsc-card hover:bg-vsc-dropdown border border-vsc-border flex items-center justify-between text-[11px] text-vsc-bright hover:underline transition-colors"
                >
                  <span>Google Outdated Cache Removal</span>
                  <ExternalLink className="w-3 h-3 text-vsc-muted" />
                </a>

                <a
                  href={draftResult.bingDeindexUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1 px-2.5 rounded bg-vsc-card hover:bg-vsc-dropdown border border-vsc-border flex items-center justify-between text-[11px] text-vsc-bright hover:underline transition-colors"
                >
                  <span>Bing Content Removal Tool</span>
                  <ExternalLink className="w-3 h-3 text-vsc-muted" />
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Live Statutory Letter Preview (8 cols) */}
          <div className="lg:col-span-8 flex flex-col justify-between space-y-3">
            <div>
              {/* Compliance & Statutory Deadline Banner */}
              <div className="p-2.5 rounded bg-vsc-panel border border-vsc-border mb-2.5 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-vsc-muted">Batas Waktu Tanggapan Resmi:</span>
                  <strong className="text-amber-300 font-bold">{draftResult.statutoryDeadline}</strong>
                </div>
                <Badge variant="success" size="xs" className="font-mono font-bold">
                  RESMI & BERKEKUATAN HUKUM
                </Badge>
              </div>

              {/* Document Paper Container */}
              <div className="relative rounded border border-vsc-border bg-vsc-canvas overflow-hidden">
                <div className="h-7 px-3 bg-vsc-sidebar border-b border-vsc-border flex items-center justify-between text-[10px] select-none">
                  <div className="flex items-center gap-1.5 text-vsc-muted truncate">
                    <FileText className="w-3 h-3 text-vsc-keyword" />
                    <span className="font-semibold text-vsc-bright truncate">{draftResult.title}</span>
                  </div>
                  <span className="text-[9px] text-vsc-muted font-mono">Governing: {draftResult.governingLaw}</span>
                </div>

                <pre className="p-3 text-[11px] leading-relaxed text-vsc-text font-mono overflow-y-auto max-h-[380px] whitespace-pre-wrap select-all bg-vsc-canvas/80">
                  <code>{draftResult.letterBody}</code>
                </pre>
              </div>
            </div>

            {/* Action Buttons Bar */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-vsc-border flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCopyNotice}
                  className="text-xs h-8 px-3 flex items-center gap-1.5 font-mono"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-vsc-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Teks Berhasil Disalin!' : 'Salin Surat Resmi'}</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadNotice}
                  className="text-xs h-8 px-3 flex items-center gap-1.5 font-mono"
                  title="Unduh draf surat format .txt"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Surat (.txt)</span>
                </Button>
              </div>

              <a
                href={draftResult.mailtoUrl}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3 rounded bg-vsc-accent-blue hover:bg-sky-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors font-mono"
                title="Buka email client default dengan draf terisi lengkap"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Kirim via Email Client</span>
              </a>
            </div>
          </div>
        </div>

        {/* 4. Modal Footer */}
        <div className="h-9 bg-vsc-sidebar px-4 border-t border-vsc-border flex items-center justify-between text-vsc-muted text-[10px] flex-shrink-0">
          <span>ISEEYOU Privacy Engine: Menjamin hak asasi perlindungan data pribadi subjek sesuai hukum yang berlaku.</span>
          <button
            onClick={onClose}
            className="text-vsc-muted hover:text-vsc-bright hover:underline"
          >
            Tutup Jendela
          </button>
        </div>
      </div>
    </div>
  );
}
