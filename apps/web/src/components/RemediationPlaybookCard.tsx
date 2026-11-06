'use client';

import React, { useState } from 'react';
import {
  Shield,
  Server,
  FileCode,
  Cloud,
  Lock,
  Copy,
  Check,
  Download,
  Terminal,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { VulnerabilityFinding } from '@iseeyou/shared-types';
import {
  generateRemediationPack,
  RemediationPlatform,
  RemediationSnippet,
} from '@/lib/remediation';
import { Badge, Button } from '@/components/ui';

interface RemediationPlaybookCardProps {
  finding: VulnerabilityFinding | null;
  target: string;
  isCompact?: boolean;
}

export function RemediationPlaybookCard({
  finding,
  target,
  isCompact = false,
}: RemediationPlaybookCardProps) {
  const [activePlatform, setActivePlatform] = useState<RemediationPlatform>('ufw');
  const [copied, setCopied] = useState(false);

  const pack = generateRemediationPack(finding, target);
  const activeSnippet: RemediationSnippet = pack.snippets[activePlatform] || pack.snippets.ufw;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSnippet = () => {
    const blob = new Blob([activeSnippet.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeSnippet.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPlatformIcon = (platform: RemediationPlatform) => {
    switch (platform) {
      case 'ufw':
        return <Shield className="w-3.5 h-3.5 text-sky-400" />;
      case 'nginx':
        return <Server className="w-3.5 h-3.5 text-emerald-400" />;
      case 'apache':
        return <FileCode className="w-3.5 h-3.5 text-red-400" />;
      case 'cloudflare':
        return <Cloud className="w-3.5 h-3.5 text-amber-400" />;
      case 'dns':
        return <Lock className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-2.5 font-mono text-xs select-text">
      {/* 1. Platform Tabs Selector */}
      <div className="flex items-center gap-1 bg-vsc-panel p-1 rounded border border-vsc-border overflow-x-auto select-none">
        {(['ufw', 'nginx', 'apache', 'cloudflare', 'dns'] as RemediationPlatform[]).map((platform) => {
          const snippet = pack.snippets[platform];
          const isActive = activePlatform === platform;
          return (
            <button
              key={platform}
              type="button"
              onClick={() => setActivePlatform(platform)}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? 'bg-vsc-card text-vsc-bright shadow-sm border border-vsc-accent-blue/60 text-sky-300'
                  : 'text-vsc-muted hover:text-vsc-bright hover:bg-vsc-card/50'
              }`}
            >
              {getPlatformIcon(platform)}
              <span>{snippet.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Platform Description */}
      <div className="text-[11px] text-vsc-muted leading-tight flex items-start gap-1.5 pt-0.5">
        <span className="text-vsc-accent-blue font-bold">ℹ</span>
        <span>{activeSnippet.description}</span>
      </div>

      {/* 3. Code Block Container */}
      <div className="relative rounded border border-vsc-border bg-vsc-panel overflow-hidden group">
        {/* Filename & Action Buttons Bar */}
        <div className="h-7 px-2.5 bg-vsc-sidebar border-b border-vsc-border flex items-center justify-between text-[10px] select-none">
          <div className="flex items-center gap-1.5 text-vsc-muted">
            <Terminal className="w-3 h-3 text-vsc-keyword" />
            <span className="font-semibold text-vsc-bright">{activeSnippet.filename}</span>
            <span className="opacity-60 font-mono">({activeSnippet.language})</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy snippet to clipboard"
              className="p-1 text-vsc-muted hover:text-vsc-bright hover:bg-vsc-dropdown rounded transition-colors flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-vsc-success" />
                  <span className="text-vsc-success text-[10px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">Copy</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadSnippet}
              title={`Download ${activeSnippet.filename}`}
              className="p-1 text-vsc-muted hover:text-vsc-bright hover:bg-vsc-dropdown rounded transition-colors"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <pre className="p-2.5 text-[11px] leading-relaxed text-vsc-string overflow-x-auto max-h-56 select-all font-mono whitespace-pre">
          <code>{activeSnippet.code}</code>
        </pre>
      </div>

      {/* 4. Verification Command */}
      {activeSnippet.verificationCommand && (
        <div className="p-2 bg-vsc-canvas rounded border border-vsc-borderSubtle text-[10px] space-y-1">
          <div className="flex items-center gap-1 font-bold text-emerald-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Verify Mitigation Success:</span>
          </div>
          <div className="text-vsc-muted font-mono bg-vsc-panel/70 p-1 rounded border border-vsc-borderSubtle/60 break-all select-all">
            <code>{activeSnippet.verificationCommand}</code>
          </div>
        </div>
      )}
    </div>
  );
}
