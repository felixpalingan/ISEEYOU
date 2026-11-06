'use client';

import React, { useEffect, useRef, useState } from 'react';
import { EntityType, SeverityLevel } from '@iseeyou/shared-types';
import { Badge } from '@/components/ui/Badge';
import { normalizeTargetForType } from '@/hooks/useScanStream';
import {
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Globe,
  Server,
  Layers,
  Key,
  User,
  X,
  Radio,
  FolderOpen,
  Eye,
} from 'lucide-react';

export interface ContextMenuTarget {
  id: string;
  value: string;
  type: EntityType;
  severity?: SeverityLevel;
  label?: string;
  metadata?: Record<string, unknown>;
  isCluster?: boolean;
  clusterId?: string;
}

interface GraphContextMenuProps {
  x: number;
  y: number;
  target: ContextMenuTarget;
  onClose: () => void;
  onPivot: (target: string, type: EntityType) => void;
  onInspectFindings?: () => void;
  onInspectNode?: () => void;
  onToggleCluster?: (clusterId: string) => void;
  hasFindings?: boolean;
}

export function GraphContextMenu({
  x,
  y,
  target,
  onClose,
  onPivot,
  onInspectFindings,
  onInspectNode,
  onToggleCluster,
  hasFindings = false,
}: GraphContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to avoid screen edge clipping
  const adjustedX =
    typeof window !== 'undefined' ? Math.min(Math.max(10, x), window.innerWidth - 280) : x;
  const adjustedY =
    typeof window !== 'undefined' ? Math.min(Math.max(10, y), window.innerHeight - 380) : y;

  const profileUrl =
    typeof target.metadata?.profile_url === 'string'
      ? target.metadata.profile_url
      : /^https?:\/\//i.test(target.value)
      ? target.value
      : null;

  const isPivotableType =
    !target.isCluster &&
    (target.type === 'domain' ||
      target.type === 'subdomain' ||
      target.type === 'ip' ||
      target.type === 'username' ||
      target.type === 'email');

  const pivotTargetValue =
    typeof target.metadata?.handle === 'string' && target.metadata.handle
      ? target.metadata.handle
      : normalizeTargetForType(target.value, target.type);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(target.value);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 900);
  };

  const handleExecutePivot = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (target.isCluster && target.clusterId && onToggleCluster) {
      onToggleCluster(target.clusterId);
      onClose();
      return;
    }
    if (isPivotableType) {
      onPivot(pivotTargetValue, target.type);
    } else {
      onInspectNode?.();
    }
    onClose();
  };

  const getTypeIcon = () => {
    switch (target.type) {
      case 'subdomain':
      case 'domain':
        return <Globe className="w-4 h-4 text-sky-400" />;
      case 'ip':
        return <Server className="w-4 h-4 text-emerald-400" />;
      case 'port':
        return <Layers className="w-4 h-4 text-cyan-300" />;
      case 'breach':
      case 'secret':
        return <Key className="w-4 h-4 text-amber-400" />;
      case 'username':
      case 'email':
        return <User className="w-4 h-4 text-purple-400" />;
      default:
        return <Globe className="w-4 h-4 text-vsc-keyword" />;
    }
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-64 bg-vsc-dropdown border border-vsc-border rounded shadow-2xl shadow-black/80 font-mono text-xs text-vsc-text select-none animate-in fade-in duration-150 overflow-hidden divide-y divide-vsc-border/60"
    >
      {/* 1. Header: Entity Target Preview */}
      <div className="p-2.5 bg-vsc-sidebar flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-vsc-canvas border border-vsc-borderSubtle">
            {getTypeIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-vsc-muted truncate">
                {target.isCluster ? 'cluster' : target.type}
              </span>
              {target.severity && (
                <Badge variant={target.severity as any} size="xs" className="uppercase font-bold">
                  {target.severity}
                </Badge>
              )}
            </div>
            <div
              className="font-bold text-vsc-bright text-xs truncate max-w-[160px]"
              title={target.value}
            >
              {target.label || target.value}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-vsc-muted hover:text-vsc-bright p-0.5 rounded hover:bg-vsc-panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Primary Actions */}
      <div className="p-1 space-y-0.5">
        {/* Direct Open URL if social profile / web URL */}
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full text-left px-2.5 py-1.5 rounded bg-emerald-950/40 hover:bg-emerald-600 text-emerald-300 hover:text-white flex items-center justify-between group transition-colors border border-emerald-700/40"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Profile in Browser</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/30 font-bold">URL ↗</span>
          </a>
        )}

        {/* Cluster Toggle OR Inspect Node OR Pivot */}
        {target.isCluster && target.clusterId ? (
          <button
            onClick={handleExecutePivot}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-vsc-accent-blue hover:text-white flex items-center justify-between group transition-colors"
          >
            <span className="flex items-center gap-2 font-semibold">
              <FolderOpen className="w-3.5 h-3.5 text-sky-400 group-hover:text-white" />
              <span>Expand / Collapse Cluster</span>
            </span>
          </button>
        ) : (
          <>
            {onInspectNode && (
              <button
                onClick={() => {
                  onInspectNode();
                  onClose();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between group transition-colors"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>Inspect Node & Step Modules</span>
                </span>
              </button>
            )}

            {isPivotableType && (
              <button
                onClick={handleExecutePivot}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-vsc-accent-blue hover:text-white flex items-center justify-between group transition-colors"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Radio className="w-3.5 h-3.5 text-vsc-accent-blue group-hover:text-white animate-pulse" />
                  <span>Pivot on this Entity</span>
                </span>
                <span className="text-[9px] bg-vsc-panel group-hover:bg-blue-900/60 text-vsc-muted group-hover:text-white px-1.5 py-0.5 rounded border border-vsc-border/40 font-bold">
                  {pivotTargetValue.slice(0, 12)}
                </span>
              </button>
            )}
          </>
        )}

        {/* Copy value */}
        <button
          onClick={handleCopy}
          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center gap-2 transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-vsc-success" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-vsc-muted" />
          )}
          <span>{copied ? 'Copied to Clipboard!' : 'Copy Entity Value'}</span>
        </button>

        {/* Inspect findings if available */}
        {hasFindings && onInspectFindings && (
          <button
            onClick={() => {
              onInspectFindings();
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-vsc-panel hover:text-vsc-critical flex items-center gap-2 transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-vsc-critical" />
            <span className="font-semibold">Inspect Findings & Playbook</span>
          </button>
        )}
      </div>

      {/* 3. External OSINT Threat Intelligence Pivots (Context-Aware) */}
      {!target.isCluster && (
        <div className="p-1.5 bg-vsc-canvas/40">
          <div className="px-2 py-1 text-[10px] font-bold uppercase text-vsc-muted tracking-wider">
            External Threat Intel Links
          </div>

          <div className="space-y-0.5">
            {/* Domain / Subdomain / IP External Links */}
            {(target.type === 'domain' || target.type === 'subdomain' || target.type === 'ip') && (
              <>
                <a
                  href={`https://www.shodan.io/search?query=${encodeURIComponent(target.value)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span>Shodan Host Intel</span>
                  </span>
                  <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
                </a>

                <a
                  href={`https://www.virustotal.com/gui/search/${encodeURIComponent(target.value)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>VirusTotal Scanner</span>
                  </span>
                  <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
                </a>
              </>
            )}

            {/* Domain / Subdomain / Profile URL Wayback History */}
            {(target.type === 'domain' || target.type === 'subdomain' || profileUrl) && (
              <a
                href={`https://web.archive.org/web/*/${encodeURIComponent(
                  profileUrl || target.value
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Wayback Machine Archive</span>
                </span>
                <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
              </a>
            )}

            {/* crt.sh if domain/subdomain */}
            {(target.type === 'domain' || target.type === 'subdomain') && (
              <a
                href={`https://crt.sh/?q=${encodeURIComponent(target.value)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>crt.sh Certificates</span>
                </span>
                <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
              </a>
            )}

            {/* BGP View if IP */}
            {target.type === 'ip' && (
              <a
                href={`https://bgp.he.net/ip/${encodeURIComponent(target.value)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>HE BGP Toolkit</span>
                </span>
                <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
              </a>
            )}

            {/* Username / Email OSINT Dorks */}
            {(target.type === 'username' || target.type === 'email') && (
              <>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(
                    `"${pivotTargetValue}"`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>Google Exact Handle Dork</span>
                  </span>
                  <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
                </a>
                <a
                  href={`https://github.com/search?q=${encodeURIComponent(
                    pivotTargetValue
                  )}&type=users`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>GitHub User Search</span>
                  </span>
                  <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
                </a>
              </>
            )}

            {/* Port Reference Links */}
            {target.type === 'port' && (
              <a
                href={`https://www.speedguide.net/port.php?port=${encodeURIComponent(
                  target.value.replace(/\D/g, '')
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>SpeedGuide Port {target.value} DB</span>
                </span>
                <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
