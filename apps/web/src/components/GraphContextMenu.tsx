'use client';

import React, { useEffect, useRef, useState } from 'react';
import { EntityType, SeverityLevel, EntityNode } from '@iseeyou/shared-types';
import { Badge } from '@/components/ui/Badge';
import {
  Zap,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Search,
  Globe,
  Server,
  Layers,
  Key,
  User,
  History,
  X,
  Radio,
} from 'lucide-react';

export interface ContextMenuTarget {
  id: string;
  value: string;
  type: EntityType;
  severity?: SeverityLevel;
  label?: string;
  metadata?: Record<string, unknown>;
}

interface GraphContextMenuProps {
  x: number;
  y: number;
  target: ContextMenuTarget;
  onClose: () => void;
  onPivot: (target: string, type: EntityType) => void;
  onInspectFindings?: () => void;
  hasFindings?: boolean;
}

export function GraphContextMenu({
  x,
  y,
  target,
  onClose,
  onPivot,
  onInspectFindings,
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
  const adjustedX = Math.min(Math.max(10, x), window.innerWidth - 270);
  const adjustedY = Math.min(Math.max(10, y), window.innerHeight - 380);

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
    onPivot(target.value, target.type);
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
                {target.type}
              </span>
              {target.severity && (
                <Badge variant={target.severity as any} size="xs" className="uppercase font-bold">
                  {target.severity}
                </Badge>
              )}
            </div>
            <div className="font-bold text-vsc-bright text-xs truncate max-w-[160px]" title={target.value}>
              {target.value}
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

      {/* 2. Primary Actions: Pivot & Copy */}
      <div className="p-1 space-y-0.5">
        {/* Pivot on this entity */}
        <button
          onClick={handleExecutePivot}
          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-vsc-accent-blue hover:text-white flex items-center justify-between group transition-colors"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Radio className="w-3.5 h-3.5 text-vsc-accent-blue group-hover:text-white animate-pulse" />
            <span>Pivot on this Entity</span>
          </span>
          <span className="text-[9px] bg-vsc-panel group-hover:bg-blue-900/60 text-vsc-muted group-hover:text-white px-1.5 py-0.5 rounded border border-vsc-border/40 font-bold">
            1-Click
          </span>
        </button>

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

      {/* 3. External OSINT Threat Intelligence Pivots */}
      <div className="p-1.5 bg-vsc-canvas/40">
        <div className="px-2 py-1 text-[10px] font-bold uppercase text-vsc-muted tracking-wider">
          External Threat Intel Pivots
        </div>

        <div className="space-y-0.5">
          {/* Shodan Intelligence */}
          <a
            href={`https://www.shodan.io/search?query=${encodeURIComponent(target.value)}`}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>Shodan Host Intel</span>
            </span>
            <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
          </a>

          {/* VirusTotal */}
          <a
            href={`https://www.virustotal.com/gui/search/${encodeURIComponent(target.value)}`}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>VirusTotal Scanner</span>
            </span>
            <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
          </a>

          {/* Wayback Machine */}
          <a
            href={`https://web.archive.org/web/*/${encodeURIComponent(target.value)}`}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className="px-2 py-1 rounded hover:bg-vsc-panel hover:text-vsc-bright flex items-center justify-between text-vsc-text transition-colors group"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Wayback History</span>
            </span>
            <ExternalLink className="w-3 h-3 text-vsc-muted group-hover:text-vsc-bright" />
          </a>

          {/* crt.sh if domain/subdomain */}
          {(target.type === 'domain' || target.type === 'subdomain') && (
            <a
              href={`https://crt.sh/?q=${encodeURIComponent(target.value)}`}
              target="_blank"
              rel="noreferrer"
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
              rel="noreferrer"
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
        </div>
      </div>
    </div>
  );
}

