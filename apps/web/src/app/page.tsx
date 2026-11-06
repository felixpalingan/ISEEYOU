'use client';

import React, { useState } from 'react';
import {
  FolderTree,
  ShieldAlert,
  BookOpen,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  Globe,
  Radio,
  FileCode,
  Copy,
  Check,
  AlertCircle,
  Network,
  Lock,
  User,
  Table,
  PanelLeft,
  PanelBottom,
  PanelRight,
  Maximize2,
  Minimize2,
  X,
  Database,
  ShieldCheck,
  Info,
  Sparkles,
  Bot,
  ArrowRight,
  Scale,
  FileDown,
} from 'lucide-react';
import { OmniSearchBar } from '@/components/OmniSearchBar';
import { TelemetryTerminal } from '@/components/TelemetryTerminal';
import { StructuredDataView } from '@/components/StructuredDataView';
import { GraphCanvas } from '@/components/GraphCanvas';
import { RiskGauge } from '@/components/RiskGauge';
import { AIAnalystCard } from '@/components/AIAnalystCard';
import { RemediationPlaybookCard } from '@/components/RemediationPlaybookCard';
import { LegalTakedownModal } from '@/components/LegalTakedownModal';
import { ExportReportModal } from '@/components/ExportReportModal';
import { Badge, Button, Card, StatusIndicator } from '@/components/ui';
import { useScanStream } from '@/hooks/useScanStream';
import { useAIAnalyst } from '@/hooks/useAIAnalyst';
import { VulnerabilityFinding } from '@iseeyou/shared-types';
import { getFindingProvenance, PROVENANCE_PROVIDERS, ProvenanceInfo } from '@/lib/provenance';

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<'graph' | 'table' | 'ai'>('graph');
  const [bottomTab, setBottomTab] = useState<'terminal' | 'problems'>('terminal');
  const [copied, setCopied] = useState(false);
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Window Layout & Resizing States (VS Code Parity)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);
  const [rightDrawerWidth, setRightDrawerWidth] = useState(300);
  const [isBottomTerminalOpen, setIsBottomTerminalOpen] = useState(true);
  const [bottomTerminalHeight, setBottomTerminalHeight] = useState(200);
  const [isBottomTerminalMaximized, setIsBottomTerminalMaximized] = useState(false);

  // Zen Mode: all 3 panels collapsed for distraction-free full-canvas graph exploration
  const isZenMode = !isLeftSidebarOpen && !isRightDrawerOpen && !isBottomTerminalOpen;
  const toggleZenMode = () => {
    if (isZenMode) {
      setIsLeftSidebarOpen(true);
      setIsRightDrawerOpen(true);
      setIsBottomTerminalOpen(true);
    } else {
      setIsLeftSidebarOpen(false);
      setIsRightDrawerOpen(false);
      setIsBottomTerminalOpen(false);
    }
  };

  // Drag-to-resize handlers
  const startResizingLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(160, Math.min(480, startWidth + (moveEvent.clientX - startX)));
      setLeftSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startResizingRight = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightDrawerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(220, Math.min(550, startWidth - (moveEvent.clientX - startX)));
      setRightDrawerWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startResizingBottom = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomTerminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = Math.max(70, Math.min(600, startHeight - (moveEvent.clientY - startY)));
      setBottomTerminalHeight(newHeight);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Real-time scan stream hook connecting to FastAPI backend
  const {
    target,
    targetType,
    riskScore,
    logs,
    nodes,
    edges,
    findings,
    isScanning,
    selectedFinding,
    pivotHistory,
    startScan,
    revertPivot,
    clearLogs,
    selectFinding,
  } = useScanStream();

  // AI Recon Analyst Copilot hook (Gemini Flash API & Heuristic Security Engine)
  const {
    report: aiReport,
    isAnalyzing: isAIAnalyzing,
    runAnalysis: runAIAnalysis,
  } = useAIAnalyst({
    target,
    targetType,
    nodes,
    edges,
    findings,
    riskScore,
    isScanning,
  });

  // Group discovered nodes by entity type for Target Explorer
  const subdomains = nodes.filter((n) => n.type === 'subdomain');
  const ips = nodes.filter((n) => n.type === 'ip');
  const ports = nodes.filter((n) => n.type === 'port');
  const breaches = nodes.filter((n) => n.type === 'breach');
  const profiles = nodes.filter((n) => n.type === 'username' && n.id.startsWith('profile:'));

  const riskLevel =
    riskScore >= 70 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : riskScore >= 15 ? 'MEDIUM' : 'LOW';

  // Selected finding provenance data source
  const findingProvenance: ProvenanceInfo = selectedFinding
    ? getFindingProvenance(selectedFinding)
    : PROVENANCE_PROVIDERS.shodan;

  // Dynamic remediation playbook generator based on selected finding
  const getRemediationCommand = (finding: VulnerabilityFinding | null) => {
    if (!finding) return 'sudo ufw status verbose';
    const title = finding.title.toLowerCase();
    if (title.includes('mysql') || title.includes('3306')) {
      return 'sudo ufw deny 3306/tcp && sudo ufw allow from 10.0.0.0/8 to any port 3306';
    } else if (title.includes('postgres') || title.includes('5432')) {
      return 'sudo ufw deny 5432/tcp && sudo ufw allow from 10.0.0.0/8 to any port 5432';
    } else if (title.includes('redis') || title.includes('6379')) {
      return 'sudo ufw deny 6379/tcp && sed -i "s/# requirepass/requirepass SecureVaultPass2026/g" /etc/redis/redis.conf';
    } else if (title.includes('takeover') || title.includes('cname')) {
      return `dig +short CNAME ${target} # Verify and remove stale dangling pointer in DNS provider`;
    } else if (title.includes('credential') || title.includes('breach')) {
      return 'vault-cli revoke-tokens --expired && identity-manager enforce-mfa --all-users';
    }
    return `echo "Review incident: ${finding.id}" >> /var/log/iseeyou_audit.log`;
  };

  const handleCopyRemediation = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-vsc-canvas text-vsc-text font-sans antialiased overflow-hidden">
      {/* 1. TOP HEADER & COMMAND PALETTE / OMNI-SEARCH */}
      <header className="h-10 bg-vsc-sidebar border-b border-vsc-border flex items-center justify-between px-3 select-none z-20">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ISEEYOU" className="w-5 h-5" />
          <span className="font-bold text-xs tracking-wider text-vsc-bright font-mono">
            ISEEYOU // COMMAND_CENTER
          </span>
          <span className="text-xs text-vsc-muted px-2 py-0.5 rounded bg-vsc-dropdown border border-vsc-borderSubtle">
            Session: <strong className="text-vsc-bright">{target}</strong>
          </span>

          {/* Clickable OSINT Sources Provenance Pill */}
          <button
            type="button"
            onClick={() => setIsProvenanceModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 text-xs text-vsc-muted hover:text-vsc-bright px-2 py-0.5 rounded bg-vsc-dropdown hover:bg-vsc-panel border border-vsc-borderSubtle transition-colors cursor-pointer group"
            title="Inspect Upstream OSINT Data Sources & Methodology"
          >
            <Database className="w-3.5 h-3.5 text-vsc-keyword group-hover:text-sky-400 transition-colors" />
            <span className="font-mono text-[11px]">Sources:</span>
            <span className="text-[10px] text-emerald-400 font-bold font-mono">4 Active</span>
          </button>
        </div>

        {/* Center Omni-Search with instant auto-classification */}
        <OmniSearchBar
          onScan={(t, type) => startScan(t, type)}
          isScanning={isScanning}
          initialValue={target}
        />

        {/* Right Status & Layout Controls: Risk Gauge + VS Code Panel Toggles */}
        <div className="flex items-center gap-3">
          <RiskGauge
            score={riskScore}
            level={riskLevel}
            findings={findings}
            isScanning={isScanning}
            onInspectFindings={() => {
              setActiveTab('table');
              setBottomTab('problems');
              setIsBottomTerminalOpen(true);
            }}
          />

          {/* VS Code Window Panel Layout Controls */}
          <div className="flex items-center bg-vsc-dropdown rounded border border-vsc-borderSubtle p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setIsLeftSidebarOpen((prev) => !prev)}
              title={isLeftSidebarOpen ? 'Hide Primary Side Bar (Ctrl+B)' : 'Show Primary Side Bar (Ctrl+B)'}
              className={`p-1 rounded transition-colors ${
                isLeftSidebarOpen
                  ? 'text-vsc-bright bg-vsc-panel'
                  : 'text-vsc-muted hover:text-vsc-text'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsBottomTerminalOpen((prev) => !prev)}
              title={isBottomTerminalOpen ? 'Hide Bottom Panel (Ctrl+J)' : 'Show Bottom Panel (Ctrl+J)'}
              className={`p-1 rounded transition-colors ${
                isBottomTerminalOpen
                  ? 'text-vsc-bright bg-vsc-panel'
                  : 'text-vsc-muted hover:text-vsc-text'
              }`}
            >
              <PanelBottom className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsRightDrawerOpen((prev) => !prev)}
              title={isRightDrawerOpen ? 'Hide Secondary Inspector' : 'Show Secondary Inspector'}
              className={`p-1 rounded transition-colors ${
                isRightDrawerOpen
                  ? 'text-vsc-bright bg-vsc-panel'
                  : 'text-vsc-muted hover:text-vsc-text'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3 bg-vsc-borderSubtle mx-0.5" />
            <button
              type="button"
              onClick={toggleZenMode}
              title={isZenMode ? 'Exit Zen Mode (Restore Panels)' : 'Zen Mode: Maximize Graph Canvas'}
              className={`p-1 rounded transition-colors ${
                isZenMode
                  ? 'text-vsc-accent-blue bg-vsc-panel font-bold'
                  : 'text-vsc-muted hover:text-vsc-text'
              }`}
            >
              {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN 3-PANE WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Activity Bar (Left 48px rail) */}
        <aside className="w-12 bg-vsc-activityBar flex flex-col items-center py-2 border-r border-vsc-border z-10 flex-shrink-0">
          <button
            title="Toggle Target Explorer & Graph Canvas"
            onClick={() => {
              if (activeTab === 'graph') {
                setIsLeftSidebarOpen((prev) => !prev);
              } else {
                setActiveTab('graph');
                setIsLeftSidebarOpen(true);
              }
            }}
            className={`w-10 h-10 flex items-center justify-center mb-1 transition-colors ${
              activeTab === 'graph' && isLeftSidebarOpen
                ? 'text-vsc-bright border-l-2 border-vsc-accent-blue bg-vsc-canvas'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <FolderTree className="w-5 h-5" />
          </button>
          <button
            title="Structured Table & Exposures"
            onClick={() => {
              setActiveTab('table');
              setBottomTab('problems');
              setIsBottomTerminalOpen(true);
            }}
            className={`w-10 h-10 flex items-center justify-center mb-1 transition-colors ${
              activeTab === 'table'
                ? 'text-vsc-bright border-l-2 border-vsc-accent-blue bg-vsc-canvas'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </button>
          <button
            title="AI Recon Analyst Copilot"
            onClick={() => {
              setActiveTab('ai');
              if (!aiReport && !isAIAnalyzing) {
                runAIAnalysis();
              }
            }}
            className={`w-10 h-10 flex items-center justify-center mb-1 transition-colors relative ${
              activeTab === 'ai'
                ? 'text-vsc-bright border-l-2 border-vsc-accent-blue bg-vsc-canvas'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <Sparkles className="w-5 h-5 text-vsc-keyword" />
            {isAIAnalyzing && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-vsc-accent-blue animate-pulse" />
            )}
          </button>
          <button
            title="Remediation Playbooks & Problems"
            onClick={() => {
              setBottomTab('problems');
              setIsBottomTerminalOpen(true);
              setIsRightDrawerOpen(true);
            }}
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-vsc-bright mb-1"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            title="Legal Takedown & Privacy Assistant (UU PDP & GDPR)"
            onClick={() => setIsLegalModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-emerald-400 mb-1 transition-colors"
          >
            <Scale className="w-5 h-5" />
          </button>
          <button
            title="Export Professional PDF Audit Report (Task 4.4)"
            onClick={() => setIsExportModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-sky-400 mb-1 transition-colors"
          >
            <FileDown className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button
            title="Inspect Data Provenance & Methodology"
            onClick={() => setIsProvenanceModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-vsc-bright"
          >
            <Database className="w-5 h-5" />
          </button>
          <button
            title="Settings"
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-vsc-bright"
          >
            <Settings className="w-5 h-5" />
          </button>
        </aside>

        {/* Sidebar Explorer (Resizable & Collapsible) */}
        {isLeftSidebarOpen && (
          <>
            <aside
              style={{ width: `${leftSidebarWidth}px` }}
              className="bg-vsc-sidebar border-r border-vsc-border flex flex-col text-xs flex-shrink-0 relative select-none"
            >
              <div className="h-8 px-3 flex items-center justify-between text-[11px] font-bold tracking-wider text-vsc-muted uppercase border-b border-vsc-border">
                <span className="truncate">Target Explorer</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-vsc-bright font-mono">{nodes.length} nodes</span>
                  <button
                    onClick={() => setIsLeftSidebarOpen(false)}
                    title="Collapse Side Bar (Ctrl+B)"
                    className="p-1 text-vsc-muted hover:text-vsc-bright hover:bg-vsc-dropdown rounded transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Dynamic Tree Structure */}
              <div className="flex-1 p-2 overflow-y-auto font-mono text-[12px] space-y-1 select-text">
                <div className="flex items-center gap-1.5 text-vsc-bright font-semibold py-1 px-1 rounded hover:bg-vsc-card cursor-pointer">
                  <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                  <Globe className="w-3.5 h-3.5 text-vsc-keyword" />
                  <span className="truncate">{target}</span>
                </div>

                <div className="pl-4 space-y-1">
                  {/* Subdomains Group */}
                  <div className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                      <span>📁 subdomains ({subdomains.length})</span>
                    </div>
                    <span className="text-[9px] px-1 py-0.2 rounded border border-sky-800 text-sky-400 bg-sky-950/60 font-mono">
                      crt.sh
                    </span>
                  </div>
                  <div className="pl-5 space-y-0.5 text-vsc-muted text-[11px]">
                    {subdomains.slice(0, 5).map((s) => (
                      <div
                        key={s.id}
                        onClick={() => startScan(s.value, 'subdomain', true)}
                        title={`Click to pivot on ${s.value}`}
                        className="hover:text-sky-300 hover:underline cursor-pointer truncate flex items-center justify-between group"
                      >
                        <span>├─ {s.value}</span>
                        <span className="opacity-0 group-hover:opacity-100 text-[9px] text-vsc-accent-blue font-bold">
                          Pivot ↗
                        </span>
                      </div>
                    ))}
                    {subdomains.length > 5 && (
                      <div className="text-vsc-info text-[10px]">└─ +{subdomains.length - 5} more...</div>
                    )}
                  </div>

                  {/* IPs & Infrastructure */}
                  {ips.length > 0 && (
                    <>
                      <div className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                          <span>🌐 origin IPs ({ips.length})</span>
                        </div>
                        <span className="text-[9px] px-1 py-0.2 rounded border border-emerald-800 text-emerald-400 bg-emerald-950/60 font-mono">
                          ip-api
                        </span>
                      </div>
                      <div className="pl-5 space-y-0.5 text-emerald-400 text-[11px]">
                        {ips.map((ip) => (
                          <div
                            key={ip.id}
                            onClick={() => startScan(ip.value, 'ip', true)}
                            title={`Click to pivot on ${ip.value}`}
                            className="hover:text-emerald-200 hover:underline cursor-pointer truncate flex items-center justify-between group"
                          >
                            <span>├─ {ip.value}</span>
                            <span className="opacity-0 group-hover:opacity-100 text-[9px] text-emerald-400 font-bold">
                              Pivot ↗
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Open Ports */}
                  {ports.length > 0 && (
                    <>
                      <div className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                          <span>🔌 open ports ({ports.length})</span>
                        </div>
                        <span className="text-[9px] px-1 py-0.2 rounded border border-cyan-800 text-cyan-400 bg-cyan-950/60 font-mono">
                          Shodan
                        </span>
                      </div>
                      <div className="pl-5 space-y-0.5 text-cyan-300 text-[11px]">
                        {ports.map((p) => (
                          <div key={p.id} className="hover:text-cyan-200 cursor-pointer truncate">
                            ├─ {p.label}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Breaches & Credentials */}
                  {breaches.length > 0 && (
                    <>
                      <div className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                          <span>🚨 breach exposures ({breaches.length})</span>
                        </div>
                        <span className="text-[9px] px-1 py-0.2 rounded border border-amber-800 text-amber-400 bg-amber-950/60 font-mono">
                          HIBP
                        </span>
                      </div>
                      <div className="pl-5 space-y-0.5 text-vsc-critical text-[11px]">
                        {breaches.map((b) => (
                          <div key={b.id} className="hover:text-red-400 cursor-pointer truncate">
                            ├─ {b.value}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Social Profiles */}
                  {profiles.length > 0 && (
                    <>
                      <div className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                          <span>👤 social profiles ({profiles.length})</span>
                        </div>
                        <span className="text-[9px] px-1 py-0.2 rounded border border-purple-800 text-purple-400 bg-purple-950/60 font-mono">
                          Direct
                        </span>
                      </div>
                      <div className="pl-5 space-y-0.5 text-purple-300 text-[11px]">
                        {profiles.slice(0, 4).map((prof) => (
                          <div key={prof.id} className="hover:text-purple-200 cursor-pointer truncate">
                            ├─ {String(prof.metadata?.platform || prof.value)}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Data Provenance Pipeline Info Box */}
              <div className="p-2 border-t border-vsc-border bg-vsc-panel text-[11px]">
                <div className="text-vsc-muted uppercase font-bold text-[10px] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-vsc-bright">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Telemetry Sources</span>
                  </span>
                  <span className="text-[9px] text-emerald-400 font-mono">100% Passive</span>
                </div>
                <div className="space-y-1 font-mono text-[10px] text-vsc-muted">
                  <div className="flex items-center justify-between">
                    <span>• Subdomains:</span>
                    <span className="text-sky-400">crt.sh Logs</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>• Origin ASN:</span>
                    <span className="text-emerald-400">ip-api.com</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>• Open Ports:</span>
                    <span className="text-cyan-300">Shodan InternetDB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>• Breached PWD:</span>
                    <span className="text-amber-400">HaveIBeenPwned</span>
                  </div>
                </div>
              </div>

              {/* Quick External Pivots */}
              <div className="p-2 border-t border-vsc-border bg-vsc-panel text-[11px]">
                <div className="text-vsc-muted uppercase font-bold text-[10px] mb-1.5">
                  1-Click External Pivots
                </div>
                <div className="space-y-1 font-mono">
                  <a
                    href={`https://web.archive.org/web/*/${target}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between text-vsc-text hover:text-vsc-bright hover:underline"
                  >
                    <span>Wayback Machine</span>
                    <ExternalLink className="w-3 h-3 text-vsc-muted" />
                  </a>
                  <a
                    href={`https://www.shodan.io/search?query=${target}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between text-vsc-text hover:text-vsc-bright hover:underline"
                  >
                    <span>Shodan Web Search</span>
                    <ExternalLink className="w-3 h-3 text-vsc-muted" />
                  </a>
                </div>
              </div>
            </aside>

            {/* Draggable Resizer Handle for Left Sidebar */}
            <div
              onMouseDown={startResizingLeft}
              className="w-1 cursor-col-resize hover:bg-vsc-accent-blue active:bg-vsc-accent-blue bg-transparent transition-all z-20 group relative -mr-1 flex items-center justify-center flex-shrink-0 select-none"
              title="Drag to resize Target Explorer"
            >
              <div className="w-0.5 h-8 bg-vsc-border group-hover:bg-vsc-accent-blue transition-colors rounded-full" />
            </div>
          </>
        )}

        {/* Center Workspace (Tabs, Breadcrumbs, Canvas, and Live Telemetry Terminal) */}
        <main className="flex-1 flex flex-col bg-vsc-canvas overflow-hidden min-w-0">
          {/* Tabs Bar */}
          <div className="h-9 bg-vsc-sidebar flex items-center border-b border-vsc-border overflow-x-auto flex-shrink-0">
            <button
              onClick={() => setActiveTab('graph')}
              className={`h-full px-4 flex items-center gap-2 border-r border-vsc-border text-xs transition-colors flex-shrink-0 ${
                activeTab === 'graph'
                  ? 'bg-vsc-canvas text-vsc-bright font-medium border-t-2 border-vsc-accent-blue'
                  : 'bg-vsc-sidebar text-vsc-muted hover:text-vsc-bright'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-vsc-keyword" />
              <span>{target} [Graph Canvas]</span>
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`h-full px-4 flex items-center gap-2 border-r border-vsc-border text-xs transition-colors flex-shrink-0 ${
                activeTab === 'table'
                  ? 'bg-vsc-canvas text-vsc-bright font-medium border-t-2 border-vsc-accent-blue'
                  : 'bg-vsc-sidebar text-vsc-muted hover:text-vsc-bright'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-sky-400" />
              <span>Structured Intel & Findings ({findings.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('ai');
                if (!aiReport && !isAIAnalyzing) {
                  runAIAnalysis();
                }
              }}
              className={`h-full px-4 flex items-center gap-2 border-r border-vsc-border text-xs transition-colors flex-shrink-0 ${
                activeTab === 'ai'
                  ? 'bg-vsc-canvas text-vsc-bright font-medium border-t-2 border-vsc-accent-blue'
                  : 'bg-vsc-sidebar text-vsc-muted hover:text-vsc-bright'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-vsc-keyword" />
              <span>AI Recon Analyst [Copilot ⚡]</span>
              {isAIAnalyzing && <span className="w-1.5 h-1.5 rounded-full bg-vsc-accent-blue animate-ping" />}
              {aiReport && !isAIAnalyzing && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-vsc-dropdown text-sky-400 border border-vsc-borderSubtle font-mono">
                  {aiReport.threatLevel}
                </span>
              )}
            </button>
            <div
              onClick={() => {
                setBottomTab('terminal');
                setIsBottomTerminalOpen(true);
              }}
              className="h-full bg-vsc-sidebar px-4 flex items-center gap-2 text-xs text-vsc-muted border-r border-vsc-border hover:bg-vsc-canvas/50 cursor-pointer flex-shrink-0"
              title="Click to open telemetry stream terminal"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>telemetry_stream.log ({logs.length})</span>
            </div>
          </div>

          {/* Breadcrumb Bar with Pivot Investigation Trail */}
          <div className="h-6 bg-vsc-canvas border-b border-vsc-border flex items-center justify-between px-3 text-[11px] font-mono text-vsc-muted select-none flex-shrink-0">
            <div className="flex items-center gap-1 overflow-hidden">
              <span className="hover:text-vsc-bright cursor-pointer">workspace</span>
              <span>&gt;</span>
              {pivotHistory.map((item, idx) => (
                <React.Fragment key={`pivot-${idx}`}>
                  <span
                    onClick={() => revertPivot()}
                    className="hover:text-sky-300 hover:underline cursor-pointer text-vsc-muted truncate max-w-[120px]"
                    title={`Click to revert to ${item.target}`}
                  >
                    {item.target}
                  </span>
                  <span>&gt;</span>
                </React.Fragment>
              ))}
              <span className="text-vsc-bright font-bold">{target}</span>
              <span>&gt;</span>
              <span className="text-vsc-keyword uppercase font-bold">{targetType}</span>
              <span>&gt;</span>
              <span className="text-sky-400 font-bold uppercase">
                {activeTab === 'graph' ? 'GRAPH CANVAS' : activeTab === 'table' ? 'STRUCTURED TABLE' : 'AI COPILOT REPORT'}
              </span>
              {selectedFinding && (
                <>
                  <span>&gt;</span>
                  <span className="text-vsc-critical font-bold truncate max-w-xs">{selectedFinding.title}</span>
                </>
              )}
            </div>

            {pivotHistory.length > 0 && (
              <button
                onClick={() => revertPivot()}
                className="text-[10px] text-vsc-accent-blue hover:text-sky-300 flex items-center gap-1 hover:underline ml-2 flex-shrink-0"
                title="Return to parent reconnaissance pivot"
              >
                <span>↶ Revert Pivot</span>
              </button>
            )}
          </div>

          {/* Main Workspace Display: Toggle between Graph Canvas, Structured Data View, and AI Analyst */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'ai' ? (
              <AIAnalystCard
                report={aiReport}
                isAnalyzing={isAIAnalyzing}
                onRefresh={runAIAnalysis}
                target={target}
              />
            ) : activeTab === 'table' ? (
              <StructuredDataView
                nodes={nodes}
                edges={edges}
                findings={findings}
                target={target}
                targetType={targetType}
                riskScore={riskScore}
                riskLevel={riskLevel}
                isScanning={isScanning}
                selectedFindingId={selectedFinding?.id}
                onSelectFinding={selectFinding}
                onPivot={(pTarget, pType) => startScan(pTarget, pType, true)}
                onExportPDF={() => setIsExportModalOpen(true)}
              />
            ) : (
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                findings={findings}
                target={target}
                targetType={targetType}
                isScanning={isScanning}
                selectedFindingId={selectedFinding?.id}
                onSelectFinding={selectFinding}
                onPivot={(pTarget, pType) => startScan(pTarget, pType, true)}
              />
            )}
          </div>

          {/* Integrated Live Telemetry Terminal & Problems Drawer (Resizable & Collapsible) */}
          {isBottomTerminalOpen && (
            <TelemetryTerminal
              logs={logs}
              findings={findings}
              isScanning={isScanning}
              activeTab={bottomTab}
              onTabChange={setBottomTab}
              onClearLogs={clearLogs}
              onSelectFinding={selectFinding}
              selectedFindingId={selectedFinding?.id}
              height={bottomTerminalHeight}
              isMaximized={isBottomTerminalMaximized}
              onToggleMaximize={() => setIsBottomTerminalMaximized((prev) => !prev)}
              onClose={() => setIsBottomTerminalOpen(false)}
              onStartResize={startResizingBottom}
            />
          )}
        </main>

        {/* Draggable Resizer Handle for Right Drawer */}
        {isRightDrawerOpen && (
          <div
            onMouseDown={startResizingRight}
            className="w-1 cursor-col-resize hover:bg-vsc-accent-blue active:bg-vsc-accent-blue bg-transparent transition-all z-20 group relative -ml-1 flex items-center justify-center flex-shrink-0 select-none"
            title="Drag to resize Inspector"
          >
            <div className="w-0.5 h-8 bg-vsc-border group-hover:bg-vsc-accent-blue transition-colors rounded-full" />
          </div>
        )}

        {/* Right Drawer: Finding Inspector & Remediation Playbook (Resizable & Collapsible) */}
        {isRightDrawerOpen && (
          <aside
            style={{ width: `${rightDrawerWidth}px` }}
            className="bg-vsc-sidebar border-l border-vsc-border p-4 flex flex-col justify-between text-xs flex-shrink-0 select-none overflow-y-auto"
          >
            <div>
              {/* Header with Severity Badge and Close Button */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={selectedFinding ? (selectedFinding.severity.toLowerCase() as any) : 'info'}
                    size="sm"
                    className="font-bold"
                  >
                    {selectedFinding ? `${selectedFinding.severity.toUpperCase()} SEVERITY` : 'AUDIT READY'}
                  </Badge>
                  {(selectedFinding?.cve_id || selectedFinding?.cveId) && (
                    <span className="text-vsc-muted text-[11px] font-mono">
                      {selectedFinding.cve_id || selectedFinding.cveId}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setIsRightDrawerOpen(false)}
                  title="Close Inspector"
                  className="p-1 text-vsc-muted hover:text-vsc-bright hover:bg-vsc-dropdown rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick AI Threat Forecast Pill */}
              <div className="mb-3 p-2 rounded bg-vsc-panel border border-vsc-border flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-vsc-bright">
                  <Sparkles className="w-3.5 h-3.5 text-vsc-keyword" />
                  <span>AI Threat Forecast:</span>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('ai');
                    if (!aiReport && !isAIAnalyzing) {
                      runAIAnalysis();
                    }
                  }}
                  className="text-[10px] text-vsc-accent-blue hover:text-sky-300 hover:underline flex items-center gap-1 font-mono font-bold"
                >
                  <span>{aiReport ? `${aiReport.threatLevel} Attack Chain` : 'View Analysis'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <h3 className="text-sm font-bold text-vsc-bright mb-1 select-text">
                {selectedFinding ? selectedFinding.title : 'Incident Remediation Engine'}
              </h3>
              <p className="text-vsc-muted text-xs leading-relaxed mb-4 select-text">
                {selectedFinding
                  ? selectedFinding.evidence
                  : 'Select any vulnerability finding from the PROBLEMS drawer or graph nodes to inspect origin data provenance, telemetry signatures, and mitigation playbooks.'}
              </p>

              {/* Explicit Data Source & Provenance Card */}
              <div className="mb-4 bg-vsc-panel p-2.5 rounded border border-vsc-border text-xs">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-vsc-borderSubtle">
                  <div className="flex items-center gap-1.5 font-bold text-vsc-bright font-mono text-[11px]">
                    <Database className="w-3.5 h-3.5 text-vsc-keyword" />
                    <span>Data Source Provenance</span>
                  </div>
                  <a
                    href={findingProvenance.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-vsc-accent-blue hover:text-sky-300 hover:underline flex items-center gap-1 font-mono"
                    title="Verify upstream OSINT source"
                  >
                    <span>Verify</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-vsc-muted">
                    <span>Provider:</span>
                    <span className="text-vsc-bright font-semibold">{findingProvenance.provider}</span>
                  </div>
                  <div className="flex items-center justify-between text-vsc-muted">
                    <span>Method:</span>
                    <span className="text-sky-400">{findingProvenance.method}</span>
                  </div>
                  <div className="flex items-center justify-between text-vsc-muted">
                    <span>Pipeline:</span>
                    <span className="text-emerald-400 font-semibold">{findingProvenance.compliance}</span>
                  </div>
                  <div className="text-[10px] text-vsc-muted pt-1 border-t border-vsc-borderSubtle/60 leading-tight">
                    {findingProvenance.description}
                  </div>
                </div>
              </div>

              {/* 1-Click Multi-Platform Remediation Generator (Task 4.2) */}
              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase text-vsc-muted mb-1.5 font-mono flex items-center justify-between">
                  <span>1-Click Remediation Playbook:</span>
                  <span className="text-[9px] text-sky-400 font-mono">5 Platforms</span>
                </div>
                <RemediationPlaybookCard finding={selectedFinding} target={target} />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-vsc-border">
              <Button
                variant="primary"
                onClick={() => setIsLegalModalOpen(true)}
                className="w-full py-1.5 font-semibold text-xs flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Draft Legal Takedown (UU PDP)</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsExportModalOpen(true)}
                className="w-full py-1.5 text-xs flex items-center justify-center gap-2 border-sky-600/40 hover:border-sky-500 hover:text-sky-300 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5 text-sky-400" />
                <span>Export Audit Report (PDF)</span>
              </Button>
            </div>
          </aside>
        )}
      </div>

      {/* 3. VS CODE STATUS BAR (Bottom 24px) */}
      <footer className="h-6 bg-vsc-blue text-white flex items-center justify-between px-3 text-[11px] font-mono select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-bold">
            <StatusIndicator status={isScanning ? 'running' : 'success'} />
            <span>{isScanning ? 'SCANNING ACTIVE...' : 'SYSTEM READY'}</span>
          </span>
          <span className="opacity-75">|</span>
          <span>Target: {target}</span>
          <span className="opacity-75">|</span>
          <span className="font-bold">Risk: {riskScore}/100</span>
          <span className="opacity-75">|</span>
          <span>Nodes: {nodes.length}</span>
          {aiReport && (
            <>
              <span className="opacity-75">|</span>
              <span className="text-amber-200 font-bold">AI Threat: {aiReport.threatLevel}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Clickable Terminal Toggle Status Indicator */}
          <button
            onClick={() => setIsBottomTerminalOpen((prev) => !prev)}
            className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors"
            title={isBottomTerminalOpen ? 'Hide Terminal / Problems' : 'Show Terminal / Problems'}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Terminal: {logs.length}</span>
            <span className="opacity-75">|</span>
            <span className={findings.length > 0 ? 'text-amber-300 font-bold' : ''}>
              Problems: {findings.length}
            </span>
          </button>
          <span className="opacity-75">|</span>
          <span>Active Modules: 4/4</span>
          <span className="opacity-75">|</span>
          <span>UTF-8</span>
          <span className="opacity-75">|</span>
          <span>TypeScript</span>
          <span className="opacity-75">|</span>
          <span>ISEEYOU v0.1.0</span>
        </div>
      </footer>

      {/* 4. OSINT DATA PROVENANCE MODAL DIALOG */}
      {isProvenanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-vsc-card border border-vsc-border w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="h-10 bg-vsc-sidebar px-4 border-b border-vsc-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-vsc-keyword" />
                <span className="font-bold text-sm text-vsc-bright">OSINT Data Sources & Provenance Architecture</span>
              </div>
              <button
                onClick={() => setIsProvenanceModalOpen(false)}
                className="p-1 text-vsc-muted hover:text-vsc-bright rounded hover:bg-vsc-panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 select-text">
              <p className="text-vsc-muted text-xs leading-relaxed">
                ISEEYOU beroperasi dengan prinsip <strong>100% Passive Reconnaissance</strong>. Sistem tidak melakukan intrusi, port scan agresif, atau eksploitasi langsung ke host target, melainkan menyinkronkan data dari register publik, transparansi sertifikat kriptografi, dan intelijen ancaman zero-auth:
              </p>

              <div className="space-y-2.5 pt-1">
                {Object.entries(PROVENANCE_PROVIDERS).map(([key, prov]) => (
                  <div
                    key={key}
                    className="p-3 bg-vsc-panel rounded border border-vsc-border hover:border-vsc-borderSubtle transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${prov.badgeColor}`}>
                          {prov.provider}
                        </span>
                        <span className="text-vsc-bright font-bold">{prov.type}</span>
                      </div>
                      <a
                        href={prov.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-vsc-accent-blue hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>Official Endpoint</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[11px] text-vsc-muted leading-relaxed mb-2">{prov.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-vsc-muted pt-1.5 border-t border-vsc-borderSubtle">
                      <span>Method: <strong className="text-sky-300">{prov.method}</strong></span>
                      <span className="text-emerald-400 font-semibold">✓ {prov.compliance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="h-10 bg-vsc-sidebar px-4 border-t border-vsc-border flex items-center justify-between text-vsc-muted text-[11px]">
              <span>Zero-knowledge & RFC 6962 compliance guarantee</span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsProvenanceModalOpen(false)}
                className="text-xs h-7 px-3"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. LEGAL TAKEDOWN & PRIVACY ASSISTANT MODAL (TASK 4.3) */}
      <LegalTakedownModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        target={target}
        findings={findings}
        nodes={nodes}
      />

      {/* 6. PROFESSIONAL PDF AUDIT REPORT EXPORTER MODAL (TASK 4.4) */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        target={target}
        targetType={targetType}
        riskScore={riskScore}
        findings={findings}
        nodes={nodes}
        aiReport={aiReport}
      />
    </div>
  );
}
