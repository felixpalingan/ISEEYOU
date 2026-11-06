'use client';

import React, { useState, useMemo } from 'react';
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
  Network,
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
  Sparkles,
  ArrowRight,
  Scale,
  FileDown,
  Play,
  Link2,
  RotateCcw,
  KeyRound,
  UserCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  OmniSearchBar,
  ReconOperatingMode,
  AVAILABLE_OSINT_MODULES,
} from '@/components/OmniSearchBar';
import { TelemetryTerminal } from '@/components/TelemetryTerminal';
import { StructuredDataView } from '@/components/StructuredDataView';
import { GraphCanvas, GraphLayoutMode } from '@/components/GraphCanvas';
import { RiskGauge } from '@/components/RiskGauge';
import { AIAnalystCard } from '@/components/AIAnalystCard';
import { RemediationPlaybookCard } from '@/components/RemediationPlaybookCard';
import { LegalTakedownModal } from '@/components/LegalTakedownModal';
import { ExportReportModal } from '@/components/ExportReportModal';
import { Badge, Button, StatusIndicator } from '@/components/ui';
import { useScanStream, normalizeTargetForType } from '@/hooks/useScanStream';
import { useAIAnalyst } from '@/hooks/useAIAnalyst';
import { classifyTarget } from '@/lib/classifier';
import { EntityNode, EntityType } from '@iseeyou/shared-types';
import {
  getFindingProvenance,
  getNodeProvenance,
  PROVENANCE_PROVIDERS,
  ProvenanceInfo,
} from '@/lib/provenance';

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<'graph' | 'table' | 'ai'>('graph');
  const [bottomTab, setBottomTab] = useState<'terminal' | 'problems'>('terminal');
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Operating Mode & Modular Scan Toggles
  const [manualMode, setManualMode] = useState<ReconOperatingMode | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([
    'subdomain_dns_resolver',
    'ip_threat_intel',
    'breach_credential_hunter',
    'social_presence_scanner',
  ]);

  // Graph Layout & Clustering Preferences (Configurable in Settings Modal)
  const [defaultLayoutMode, setDefaultLayoutMode] = useState<GraphLayoutMode>('tree');
  const [clusterThreshold, setClusterThreshold] = useState<number>(3);

  // Cross-Entity Bridge Pivot Input inside Contextual Inspector
  const [crossPivotInput, setCrossPivotInput] = useState('');
  const [nodeCopied, setNodeCopied] = useState(false);

  // Interactive Sidebar Explorer Folder States (Fixes dead folder headers & "+X more")
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    root: true,
    subdomains: true,
    ips: true,
    ports: true,
    breaches: true,
    profiles: true,
  });
  const [showAllSubdomains, setShowAllSubdomains] = useState(false);
  const [showAllProfiles, setShowAllProfiles] = useState(false);

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Window Layout & Resizing States (VS Code Parity)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);
  const [rightDrawerWidth, setRightDrawerWidth] = useState(320);
  const [isBottomTerminalOpen, setIsBottomTerminalOpen] = useState(true);
  const [bottomTerminalHeight, setBottomTerminalHeight] = useState(175);
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
      const newWidth = Math.max(240, Math.min(560, startWidth - (moveEvent.clientX - startX)));
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
    selectedNode,
    pivotHistory,
    startScan,
    revertPivot,
    clearLogs,
    selectFinding,
    selectNode,
    resetWorkspace,
  } = useScanStream();

  // Active Operating Mode (Web & Infrastructure vs Identity & Footprint)
  const activeMode: ReconOperatingMode = useMemo(() => {
    if (manualMode) return manualMode;
    if (targetType === 'username' || targetType === 'email') return 'identity';
    return 'web';
  }, [manualMode, targetType]);

  const handleToggleModule = (modId: string) => {
    setEnabledModules((prev) => {
      if (prev.includes(modId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== modId);
      }
      return [...prev, modId];
    });
  };

  // AI Recon Analyst Copilot hook
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

  // Provenance data source for currently selected node or finding
  const activeProvenance: ProvenanceInfo = useMemo(() => {
    if (selectedNode) {
      return getNodeProvenance({
        type: selectedNode.type,
        value: selectedNode.value,
        label: selectedNode.label,
        metadata: selectedNode.metadata,
      });
    }
    if (selectedFinding) {
      return getFindingProvenance(selectedFinding);
    }
    return activeMode === 'identity' ? PROVENANCE_PROVIDERS.social : PROVENANCE_PROVIDERS.shodan;
  }, [selectedNode, selectedFinding, activeMode]);

  const handleInspectNode = (node: EntityNode) => {
    selectNode(node);
    setIsRightDrawerOpen(true);
  };

  const handleInspectFinding = (finding: any) => {
    selectFinding(finding);
    selectNode(null);
    setIsRightDrawerOpen(true);
  };

  // Step-by-step targeted module execution on a specific node
  const handleRunModuleOnNode = (node: EntityNode | null, moduleIds: string[]) => {
    const rawVal = node
      ? typeof node.metadata?.handle === 'string' && node.metadata.handle
        ? node.metadata.handle
        : node.value
      : target;
    const nodeType: EntityType = node ? node.type : targetType;
    const cleanVal = normalizeTargetForType(rawVal, nodeType);
    startScan(cleanVal, nodeType, true, moduleIds, node?.id);
  };

  // Cross-Entity Bridge Pivot (e.g. found personal domain on GitHub profile, or username on website)
  const handleCrossPivotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = crossPivotInput.trim();
    if (!raw || isScanning) return;
    const detected = classifyTarget(raw);
    const nextMode: ReconOperatingMode =
      detected === 'username' || detected === 'email' ? 'identity' : 'web';
    setManualMode(nextMode);

    const validModsForMode = AVAILABLE_OSINT_MODULES.filter((m) =>
      m.modes.includes(nextMode)
    ).map((m) => m.id);
    const chosenMods = enabledModules.filter((id) => validModsForMode.includes(id));

    startScan(
      raw,
      detected,
      true,
      chosenMods.length > 0 ? chosenMods : validModsForMode,
      selectedNode?.id || `root-${target}`
    );
    setCrossPivotInput('');
  };

  // Selected node external URL (if social profile or web link)
  const selectedNodeUrl = useMemo(() => {
    if (!selectedNode) return null;
    if (typeof selectedNode.metadata?.profile_url === 'string') {
      return selectedNode.metadata.profile_url;
    }
    if (/^https?:\/\//i.test(selectedNode.value)) {
      return selectedNode.value;
    }
    return null;
  }, [selectedNode]);

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
          <span className="hidden lg:inline-block text-xs text-vsc-muted px-2 py-0.5 rounded bg-vsc-dropdown border border-vsc-borderSubtle">
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
            <span className="text-[10px] text-emerald-400 font-bold font-mono">
              {enabledModules.length}/4 Active
            </span>
          </button>
        </div>

        {/* Center Omni-Search with Mode Switcher & Modular ON/OFF Toggles */}
        <OmniSearchBar
          onScan={(t, type, mods) => {
            setManualMode(type === 'username' || type === 'email' ? 'identity' : 'web');
            startScan(t, type, false, mods);
          }}
          isScanning={isScanning}
          initialValue={target}
          activeMode={activeMode}
          onModeChange={(m) => setManualMode(m)}
          enabledModules={enabledModules}
          onToggleModule={handleToggleModule}
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
              title={
                isLeftSidebarOpen
                  ? 'Hide Primary Side Bar (Ctrl+B)'
                  : 'Show Primary Side Bar (Ctrl+B)'
              }
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
              title={
                isBottomTerminalOpen
                  ? 'Hide Bottom Panel (Ctrl+J)'
                  : 'Show Bottom Panel (Ctrl+J)'
              }
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
              title={
                isZenMode ? 'Exit Zen Mode (Restore Panels)' : 'Zen Mode: Maximize Graph Canvas'
              }
              className={`p-1 rounded transition-colors ${
                isZenMode
                  ? 'text-vsc-accent-blue bg-vsc-panel font-bold'
                  : 'text-vsc-muted hover:text-vsc-text'
              }`}
            >
              {isZenMode ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
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
            aria-label="Structured Table & Exposures"
            data-testid="btn-activity-table"
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
            aria-label="AI Recon Analyst Copilot"
            data-testid="btn-activity-ai"
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
            aria-label="Remediation Playbooks & Problems"
            data-testid="btn-activity-problems"
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
            aria-label="Legal Takedown & Privacy Assistant"
            data-testid="btn-activity-legal"
            onClick={() => setIsLegalModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-emerald-400 mb-1 transition-colors"
          >
            <Scale className="w-5 h-5" />
          </button>
          <button
            title="Export Professional PDF Audit Report (Task 4.4)"
            aria-label="Export Professional PDF Audit Report"
            data-testid="btn-activity-export-pdf"
            onClick={() => setIsExportModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-sky-400 mb-1 transition-colors"
          >
            <FileDown className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button
            title="Inspect Data Provenance & Methodology"
            aria-label="Inspect Data Provenance & Methodology"
            data-testid="btn-activity-provenance"
            onClick={() => setIsProvenanceModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-vsc-bright"
          >
            <Database className="w-5 h-5" />
          </button>
          {/* Settings Button — Now Fully Interactive */}
          <button
            title="Workspace & Scan Settings"
            aria-label="Workspace & Scan Settings"
            data-testid="btn-activity-settings"
            onClick={() => setIsSettingsModalOpen(true)}
            className={`w-10 h-10 flex items-center justify-center transition-colors ${
              isSettingsModalOpen
                ? 'text-vsc-bright bg-vsc-canvas border-l-2 border-vsc-accent-blue'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </aside>

        {/* Sidebar Explorer (Resizable, Collapsible, Interactive Tree) */}
        {isLeftSidebarOpen && (
          <>
            <aside
              style={{ width: `${leftSidebarWidth}px` }}
              className="bg-vsc-sidebar border-r border-vsc-border flex flex-col text-xs flex-shrink-0 relative select-none"
            >
              <div className="h-8 px-3 flex items-center justify-between text-[11px] font-bold tracking-wider text-vsc-muted uppercase border-b border-vsc-border">
                <span className="truncate">Target Explorer</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-vsc-bright font-mono">
                    {nodes.length} nodes
                  </span>
                  <button
                    onClick={() => setIsLeftSidebarOpen(false)}
                    title="Collapse Side Bar (Ctrl+B)"
                    className="p-1 text-vsc-muted hover:text-vsc-bright hover:bg-vsc-dropdown rounded transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Interactive Tree Structure */}
              <div className="flex-1 p-2 overflow-y-auto font-mono text-[12px] space-y-1 select-text">
                {/* Root Target Folder */}
                <div
                  onClick={() => toggleFolder('root')}
                  className="flex items-center justify-between text-vsc-bright font-semibold py-1 px-1 rounded hover:bg-vsc-card cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {expandedFolders.root ? (
                      <ChevronDown className="w-3.5 h-3.5 text-vsc-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-vsc-muted flex-shrink-0" />
                    )}
                    {activeMode === 'identity' ? (
                      <User className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-vsc-keyword flex-shrink-0" />
                    )}
                    <span className="truncate">{target}</span>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
                      activeMode === 'identity'
                        ? 'bg-purple-950/60 text-purple-300 border border-purple-700/50'
                        : 'bg-sky-950/60 text-sky-300 border border-sky-700/50'
                    }`}
                  >
                    {activeMode}
                  </span>
                </div>

                {expandedFolders.root && (
                  <div className="pl-3 space-y-1">
                    {/* Subdomains Group */}
                    {(activeMode === 'web' || subdomains.length > 0) && (
                      <>
                        <div
                          onClick={() => toggleFolder('subdomains')}
                          className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            {expandedFolders.subdomains ? (
                              <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-vsc-muted" />
                            )}
                            <span>📁 subdomains ({subdomains.length})</span>
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded border border-sky-800 text-sky-400 bg-sky-950/60 font-mono">
                            CT/DoH
                          </span>
                        </div>
                        {expandedFolders.subdomains && (
                          <div className="pl-5 space-y-0.5 text-vsc-muted text-[11px]">
                            {(showAllSubdomains ? subdomains : subdomains.slice(0, 5)).map((s) => (
                              <div
                                key={s.id}
                                onClick={() => handleInspectNode(s)}
                                title={`Click to inspect ${s.value}`}
                                className={`hover:text-sky-300 cursor-pointer truncate flex items-center justify-between group py-0.5 px-1 rounded ${
                                  selectedNode?.id === s.id
                                    ? 'bg-sky-950/40 text-sky-300 font-semibold'
                                    : ''
                                }`}
                              >
                                <span className="truncate">├─ {s.value}</span>
                                <span className="opacity-0 group-hover:opacity-100 text-[9px] text-vsc-accent-blue font-bold flex-shrink-0 ml-1">
                                  Inspect
                                </span>
                              </div>
                            ))}
                            {subdomains.length > 5 && (
                              <button
                                type="button"
                                onClick={() => setShowAllSubdomains((prev) => !prev)}
                                className="text-vsc-info hover:text-sky-300 hover:underline text-[10px] py-0.5 block text-left"
                              >
                                {showAllSubdomains
                                  ? '└─ Show less'
                                  : `└─ +${subdomains.length - 5} more... (Click to expand)`}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* IPs & Infrastructure */}
                    {ips.length > 0 && (
                      <>
                        <div
                          onClick={() => toggleFolder('ips')}
                          className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            {expandedFolders.ips ? (
                              <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-vsc-muted" />
                            )}
                            <span>🌐 origin IPs ({ips.length})</span>
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded border border-emerald-800 text-emerald-400 bg-emerald-950/60 font-mono">
                            ip-api
                          </span>
                        </div>
                        {expandedFolders.ips && (
                          <div className="pl-5 space-y-0.5 text-emerald-400 text-[11px]">
                            {ips.map((ip) => (
                              <div
                                key={ip.id}
                                onClick={() => handleInspectNode(ip)}
                                title={`Click to inspect ${ip.value}`}
                                className={`hover:text-emerald-200 cursor-pointer truncate flex items-center justify-between group py-0.5 px-1 rounded ${
                                  selectedNode?.id === ip.id
                                    ? 'bg-emerald-950/40 text-emerald-200 font-semibold'
                                    : ''
                                }`}
                              >
                                <span className="truncate">├─ {ip.value}</span>
                                <span className="opacity-0 group-hover:opacity-100 text-[9px] text-emerald-300 font-bold flex-shrink-0 ml-1">
                                  Inspect
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Open Ports */}
                    {ports.length > 0 && (
                      <>
                        <div
                          onClick={() => toggleFolder('ports')}
                          className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            {expandedFolders.ports ? (
                              <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-vsc-muted" />
                            )}
                            <span>🔌 open ports ({ports.length})</span>
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded border border-cyan-800 text-cyan-400 bg-cyan-950/60 font-mono">
                            Shodan
                          </span>
                        </div>
                        {expandedFolders.ports && (
                          <div className="pl-5 space-y-0.5 text-cyan-300 text-[11px]">
                            {ports.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => handleInspectNode(p)}
                                title={`Click to inspect Port ${p.value}`}
                                className={`hover:text-cyan-100 cursor-pointer truncate flex items-center justify-between group py-0.5 px-1 rounded ${
                                  selectedNode?.id === p.id
                                    ? 'bg-cyan-950/40 text-cyan-100 font-semibold'
                                    : ''
                                }`}
                              >
                                <span className="truncate">├─ {p.label || `:${p.value}`}</span>
                                <span className="opacity-0 group-hover:opacity-100 text-[9px] text-cyan-300 font-bold flex-shrink-0 ml-1">
                                  Inspect
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Breaches & Security Audits */}
                    {breaches.length > 0 && (
                      <>
                        <div
                          onClick={() => toggleFolder('breaches')}
                          className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            {expandedFolders.breaches ? (
                              <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-vsc-muted" />
                            )}
                            <span>🚨 exposures ({breaches.length})</span>
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded border border-amber-800 text-amber-400 bg-amber-950/60 font-mono">
                            Audit
                          </span>
                        </div>
                        {expandedFolders.breaches && (
                          <div className="pl-5 space-y-0.5 text-vsc-critical text-[11px]">
                            {breaches.map((b) => (
                              <div
                                key={b.id}
                                onClick={() => handleInspectNode(b)}
                                title={`Click to inspect ${b.value}`}
                                className="hover:text-red-300 cursor-pointer truncate flex items-center justify-between group py-0.5 px-1 rounded"
                              >
                                <span className="truncate">├─ {b.value}</span>
                                <span className="opacity-0 group-hover:opacity-100 text-[9px] text-amber-300 font-bold flex-shrink-0 ml-1">
                                  Inspect
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Social Profiles */}
                    {profiles.length > 0 && (
                      <>
                        <div
                          onClick={() => toggleFolder('profiles')}
                          className="flex items-center justify-between text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            {expandedFolders.profiles ? (
                              <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-vsc-muted" />
                            )}
                            <span>👤 social profiles ({profiles.length})</span>
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded border border-purple-800 text-purple-400 bg-purple-950/60 font-mono">
                            Direct
                          </span>
                        </div>
                        {expandedFolders.profiles && (
                          <div className="pl-5 space-y-0.5 text-purple-300 text-[11px]">
                            {(showAllProfiles ? profiles : profiles.slice(0, 6)).map((prof) => {
                              const profUrl =
                                typeof prof.metadata?.profile_url === 'string'
                                  ? prof.metadata.profile_url
                                  : prof.value;
                              return (
                                <div
                                  key={prof.id}
                                  onClick={() => handleInspectNode(prof)}
                                  className={`hover:text-purple-100 cursor-pointer truncate flex items-center justify-between group py-0.5 px-1 rounded ${
                                    selectedNode?.id === prof.id
                                      ? 'bg-purple-950/40 text-purple-100 font-semibold'
                                      : ''
                                  }`}
                                >
                                  <span className="truncate">
                                    ├─ {String(prof.metadata?.platform || prof.label || prof.value)}
                                  </span>
                                  <a
                                    href={profUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title={`Open ${profUrl} in new tab`}
                                    className="text-[10px] text-emerald-400 hover:text-emerald-200 px-1 rounded hover:bg-emerald-950/60 flex items-center gap-0.5 flex-shrink-0"
                                  >
                                    <span>Open</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              );
                            })}
                            {profiles.length > 6 && (
                              <button
                                type="button"
                                onClick={() => setShowAllProfiles((prev) => !prev)}
                                className="text-vsc-info hover:text-purple-300 hover:underline text-[10px] py-0.5 block text-left"
                              >
                                {showAllProfiles
                                  ? '└─ Show less'
                                  : `└─ +${profiles.length - 6} more profiles...`}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Active Modules Quick Toggle Box */}
              <div className="p-2 border-t border-vsc-border bg-vsc-panel text-[11px]">
                <div className="text-vsc-muted uppercase font-bold text-[10px] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-vsc-bright">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>
                      {activeMode === 'identity' ? 'Identity Modules' : 'Web/Infra Modules'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="text-[9px] text-sky-400 hover:underline font-mono"
                  >
                    Configure
                  </button>
                </div>
                <div className="space-y-1 font-mono text-[10px]">
                  {AVAILABLE_OSINT_MODULES.filter((m) => m.modes.includes(activeMode)).map(
                    (mod) => {
                      const isOn = enabledModules.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => handleToggleModule(mod.id)}
                          className="w-full flex items-center justify-between py-0.5 px-1 rounded hover:bg-vsc-canvas transition-colors text-left"
                        >
                          <span className={isOn ? 'text-vsc-text' : 'text-vsc-muted line-through'}>
                            • {mod.shortLabel}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1 rounded ${
                              isOn
                                ? 'text-emerald-400 bg-emerald-950/60'
                                : 'text-zinc-500 bg-zinc-900'
                            }`}
                          >
                            {isOn ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Mode-Aware 1-Click External Pivots */}
              <div className="p-2 border-t border-vsc-border bg-vsc-panel text-[11px]">
                <div className="text-vsc-muted uppercase font-bold text-[10px] mb-1.5">
                  1-Click External Pivots
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  {activeMode === 'identity' ? (
                    <>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(
                          `"${target}"`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between text-vsc-text hover:text-vsc-bright hover:underline"
                      >
                        <span>Google Handle Dork</span>
                        <ExternalLink className="w-3 h-3 text-vsc-muted" />
                      </a>
                      <a
                        href={`https://github.com/search?q=${encodeURIComponent(
                          target
                        )}&type=users`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between text-vsc-text hover:text-vsc-bright hover:underline"
                      >
                        <span>GitHub User Search</span>
                        <ExternalLink className="w-3 h-3 text-vsc-muted" />
                      </a>
                    </>
                  ) : (
                    <>
                      <a
                        href={`https://web.archive.org/web/*/${encodeURIComponent(target)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between text-vsc-text hover:text-vsc-bright hover:underline"
                      >
                        <span>Wayback Machine</span>
                        <ExternalLink className="w-3 h-3 text-vsc-muted" />
                      </a>
                      <a
                        href={`https://www.shodan.io/search?query=${encodeURIComponent(target)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between text-vsc-text hover:text-vsc-bright hover:underline"
                      >
                        <span>Shodan Web Search</span>
                        <ExternalLink className="w-3 h-3 text-vsc-muted" />
                      </a>
                    </>
                  )}
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
              data-testid="tab-workspace-graph"
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
              data-testid="tab-workspace-table"
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
              data-testid="tab-workspace-ai"
              className={`h-full px-4 flex items-center gap-2 border-r border-vsc-border text-xs transition-colors flex-shrink-0 ${
                activeTab === 'ai'
                  ? 'bg-vsc-canvas text-vsc-bright font-medium border-t-2 border-vsc-accent-blue'
                  : 'bg-vsc-sidebar text-vsc-muted hover:text-vsc-bright'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-vsc-keyword" />
              <span>AI Recon Analyst [Copilot ⚡]</span>
              {isAIAnalyzing && (
                <span className="w-1.5 h-1.5 rounded-full bg-vsc-accent-blue animate-ping" />
              )}
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

          {/* Breadcrumb Bar with Working Links & Pivot Trail */}
          <div className="h-6 bg-vsc-canvas border-b border-vsc-border flex items-center justify-between px-3 text-[11px] font-mono text-vsc-muted select-none flex-shrink-0">
            <div className="flex items-center gap-1 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('graph');
                  selectNode(null);
                }}
                className="hover:text-vsc-bright hover:underline cursor-pointer"
                title="Return to Graph Canvas root view"
              >
                workspace
              </button>
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
              <button
                type="button"
                onClick={() => {
                  selectNode({
                    id: `root-${target}`,
                    type: targetType,
                    value: target,
                    label: target,
                    severity: 'info',
                    metadata: { role: 'seed' },
                    discoveredAt: new Date().toISOString(),
                  });
                  setIsRightDrawerOpen(true);
                }}
                className="text-vsc-bright font-bold hover:text-sky-300 hover:underline"
                title="Inspect Root Target Node"
              >
                {target}
              </button>
              <span>&gt;</span>
              <span
                className={`uppercase font-bold ${
                  activeMode === 'identity' ? 'text-purple-400' : 'text-vsc-keyword'
                }`}
              >
                {activeMode === 'identity' ? `IDENTITY (${targetType})` : `WEB/INFRA (${targetType})`}
              </span>
              <span>&gt;</span>
              <span className="text-sky-400 font-bold uppercase">
                {activeTab === 'graph'
                  ? 'GRAPH CANVAS'
                  : activeTab === 'table'
                  ? 'STRUCTURED TABLE'
                  : 'AI COPILOT REPORT'}
              </span>
              {selectedNode && (
                <>
                  <span>&gt;</span>
                  <span className="text-emerald-400 font-bold truncate max-w-xs">
                    {selectedNode.label || selectedNode.value}
                  </span>
                </>
              )}
              {!selectedNode && selectedFinding && (
                <>
                  <span>&gt;</span>
                  <span className="text-vsc-critical font-bold truncate max-w-xs">
                    {selectedFinding.title}
                  </span>
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

          {/* Main Workspace Display */}
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
                onSelectFinding={handleInspectFinding}
                onSelectNode={handleInspectNode}
                onPivot={(pTarget, pType) => startScan(pTarget, pType, true, enabledModules)}
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
                selectedNodeId={selectedNode?.id}
                clusterThreshold={clusterThreshold}
                defaultLayoutMode={defaultLayoutMode}
                onSelectNode={handleInspectNode}
                onSelectFinding={handleInspectFinding}
                onPivot={(pTarget, pType) => startScan(pTarget, pType, true, enabledModules)}
              />
            )}
          </div>

          {/* Integrated Live Telemetry Terminal & Problems Drawer */}
          {isBottomTerminalOpen && (
            <TelemetryTerminal
              logs={logs}
              findings={findings}
              isScanning={isScanning}
              activeTab={bottomTab}
              onTabChange={setBottomTab}
              onClearLogs={clearLogs}
              onSelectFinding={handleInspectFinding}
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

        {/* Right Drawer: Mode-Aware Contextual Node Inspector, Step-by-Step Pivot & Defense */}
        {isRightDrawerOpen && (
          <aside
            style={{ width: `${rightDrawerWidth}px` }}
            className="bg-vsc-sidebar border-l border-vsc-border p-4 flex flex-col justify-between text-xs flex-shrink-0 select-none overflow-y-auto"
          >
            <div>
              {/* Header with Mode / Severity Badge and Close Button */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      selectedFinding
                        ? (selectedFinding.severity.toLowerCase() as any)
                        : selectedNode
                        ? (selectedNode.severity.toLowerCase() as any)
                        : 'info'
                    }
                    size="sm"
                    className="font-bold"
                  >
                    {selectedFinding
                      ? `${selectedFinding.severity.toUpperCase()} SEVERITY`
                      : 'AUDIT READY'}
                  </Badge>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-bold ${
                      activeMode === 'identity'
                        ? 'bg-purple-950/60 text-purple-300 border-purple-700/50'
                        : 'bg-sky-950/60 text-sky-300 border-sky-700/50'
                    }`}
                  >
                    {activeMode === 'identity' ? '👤 IDENTITY MODE' : '🌐 WEB & INFRA'}
                  </span>
                </div>

                <button
                  onClick={() => setIsRightDrawerOpen(false)}
                  title="Close Inspector"
                  className="p-1 text-vsc-muted hover:text-vsc-bright hover:bg-vsc-dropdown rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1. SELECTED NODE IDENTITY & STEP-BY-STEP MODULE ACTIONS */}
              <div className="mb-3.5 p-3 rounded bg-vsc-panel border border-vsc-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-sky-400 flex items-center gap-1.5">
                    <Radio className="w-3 h-3" />
                    <span>
                      {selectedNode
                        ? `Selected Node (${selectedNode.type})`
                        : `Active Target (${targetType})`}
                    </span>
                  </span>
                  {selectedNode && (
                    <button
                      type="button"
                      onClick={() => selectNode(null)}
                      className="text-[10px] text-vsc-muted hover:text-vsc-bright font-mono"
                    >
                      Reset to Root
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 bg-vsc-canvas p-2 rounded border border-vsc-borderSubtle">
                  <div className="font-mono text-xs font-bold text-vsc-bright truncate select-text">
                    {selectedNode ? selectedNode.label || selectedNode.value : target}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedNode ? selectedNode.value : target);
                      setNodeCopied(true);
                      setTimeout(() => setNodeCopied(false), 1200);
                    }}
                    className="p-1 rounded hover:bg-vsc-panel text-vsc-muted hover:text-vsc-bright flex-shrink-0"
                    title="Copy value"
                  >
                    {nodeCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* If Selected Node is a Social Profile / Web URL -> Show Direct Open Button */}
                {selectedNodeUrl && (
                  <a
                    href={selectedNodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 px-3 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow"
                  >
                    <span>Open Profile / URL in Browser</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {/* Step-by-Step Module Runner Buttons for Selected Node */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-mono text-vsc-muted uppercase font-bold">
                    ⚡ Step-by-Step Scan on This Node:
                  </div>

                  {(() => {
                    const effectiveType = selectedNode ? selectedNode.type : targetType;
                    if (effectiveType === 'domain' || effectiveType === 'subdomain') {
                      return (
                        <div className="grid grid-cols-1 gap-1.5">
                          <button
                            type="button"
                            disabled={isScanning}
                            onClick={() =>
                              handleRunModuleOnNode(selectedNode, ['subdomain_dns_resolver'])
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-vsc-canvas hover:bg-sky-950/50 border border-vsc-border hover:border-sky-500/60 text-left font-mono text-[11px] text-vsc-bright flex items-center justify-between transition-colors disabled:opacity-50"
                          >
                            <span className="flex items-center gap-1.5">
                              <Play className="w-3 h-3 text-sky-400" />
                              <span>+ Discover Subdomains & DNS</span>
                            </span>
                            <span className="text-[9px] text-sky-400">CT/DoH</span>
                          </button>
                          <button
                            type="button"
                            disabled={isScanning}
                            onClick={() => handleRunModuleOnNode(selectedNode, ['ip_threat_intel'])}
                            className="w-full px-2.5 py-1.5 rounded bg-vsc-canvas hover:bg-emerald-950/50 border border-vsc-border hover:border-emerald-500/60 text-left font-mono text-[11px] text-vsc-bright flex items-center justify-between transition-colors disabled:opacity-50"
                          >
                            <span className="flex items-center gap-1.5">
                              <Play className="w-3 h-3 text-emerald-400" />
                              <span>+ Resolve IP & Scan Open Ports</span>
                            </span>
                            <span className="text-[9px] text-emerald-400">Shodan</span>
                          </button>
                          <button
                            type="button"
                            disabled={isScanning}
                            onClick={() =>
                              handleRunModuleOnNode(selectedNode, ['breach_credential_hunter'])
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-vsc-canvas hover:bg-amber-950/50 border border-vsc-border hover:border-amber-500/60 text-left font-mono text-[11px] text-vsc-bright flex items-center justify-between transition-colors disabled:opacity-50"
                          >
                            <span className="flex items-center gap-1.5">
                              <Play className="w-3 h-3 text-amber-400" />
                              <span>+ Audit Email SPF & DMARC</span>
                            </span>
                            <span className="text-[9px] text-amber-400">DNS TXT</span>
                          </button>
                        </div>
                      );
                    }
                    if (effectiveType === 'ip') {
                      return (
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() => handleRunModuleOnNode(selectedNode, ['ip_threat_intel'])}
                          className="w-full px-2.5 py-1.5 rounded bg-vsc-canvas hover:bg-emerald-950/50 border border-vsc-border hover:border-emerald-500/60 text-left font-mono text-[11px] text-vsc-bright flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-1.5">
                            <Play className="w-3 h-3 text-emerald-400" />
                            <span>+ Scan Open Ports, ASN & CVEs</span>
                          </span>
                          <span className="text-[9px] text-emerald-400">Shodan</span>
                        </button>
                      );
                    }
                    if (effectiveType === 'username' || effectiveType === 'email') {
                      return (
                        <div className="grid grid-cols-1 gap-1.5">
                          <button
                            type="button"
                            disabled={isScanning}
                            onClick={() =>
                              handleRunModuleOnNode(selectedNode, ['social_presence_scanner'])
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-vsc-canvas hover:bg-purple-950/50 border border-vsc-border hover:border-purple-500/60 text-left font-mono text-[11px] text-vsc-bright flex items-center justify-between transition-colors disabled:opacity-50"
                          >
                            <span className="flex items-center gap-1.5">
                              <Play className="w-3 h-3 text-purple-400" />
                              <span>+ Scan 25 Social Platforms</span>
                            </span>
                            <span className="text-[9px] text-purple-400">25 Sites</span>
                          </button>
                          <button
                            type="button"
                            disabled={isScanning}
                            onClick={() =>
                              handleRunModuleOnNode(selectedNode, ['breach_credential_hunter'])
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-vsc-canvas hover:bg-amber-950/50 border border-vsc-border hover:border-amber-500/60 text-left font-mono text-[11px] text-vsc-bright flex items-center justify-between transition-colors disabled:opacity-50"
                          >
                            <span className="flex items-center gap-1.5">
                              <Play className="w-3 h-3 text-amber-400" />
                              <span>+ Check Credential Breaches</span>
                            </span>
                            <span className="text-[9px] text-amber-400">HIBP</span>
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="text-[11px] text-vsc-muted font-mono">
                        Endpoint attribute node ({effectiveType}). See details & defense options
                        below.
                      </div>
                    );
                  })()}
                </div>

                {/* Cross-Entity Bridge Pivot Input (e.g. Username -> Personal Website, or Website -> Username) */}
                <form
                  onSubmit={handleCrossPivotSubmit}
                  className="pt-2 border-t border-vsc-borderSubtle space-y-1.5"
                >
                  <label className="text-[10px] font-mono text-vsc-muted uppercase font-bold flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-vsc-accent-blue" />
                    <span>Bridge Pivot (Link Found Domain / Username):</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={crossPivotInput}
                      onChange={(e) => setCrossPivotInput(e.target.value)}
                      placeholder={
                        activeMode === 'identity'
                          ? 'Found personal web? (e.g. blog.dev)'
                          : 'Found username/email? (e.g. admin)'
                      }
                      className="flex-1 bg-vsc-canvas border border-vsc-border rounded px-2 py-1 text-[11px] font-mono text-vsc-bright outline-none focus:border-vsc-accent-blue"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="xs"
                      disabled={!crossPivotInput.trim() || isScanning}
                      className="px-2 py-1 text-[10px] font-mono font-bold flex-shrink-0"
                    >
                      Pivot ↗
                    </Button>
                  </div>
                </form>
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
                  <span>
                    {aiReport ? `${aiReport.threatLevel} Attack Chain` : 'View Analysis'}
                  </span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <h3 className="text-sm font-bold text-vsc-bright mb-1 select-text">
                {selectedFinding
                  ? selectedFinding.title
                  : activeMode === 'identity'
                  ? 'Identity Footprint & Privacy Protection'
                  : 'Incident Remediation Engine'}
              </h3>
              <p className="text-vsc-muted text-xs leading-relaxed mb-3 select-text">
                {selectedFinding
                  ? selectedFinding.evidence
                  : activeMode === 'identity'
                  ? 'Inspect discovered social accounts and credential leaks. Use the privacy tools below to remove exposed personal data under UU PDP / GDPR.'
                  : 'Select any vulnerability finding or graph node to inspect origin data provenance, step-scan modules, and infrastructure firewall playbooks.'}
              </p>

              {/* Explicit Data Source & Provenance Card */}
              <div className="mb-4 bg-vsc-panel p-2.5 rounded border border-vsc-border text-xs">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-vsc-borderSubtle">
                  <div className="flex items-center gap-1.5 font-bold text-vsc-bright font-mono text-[11px]">
                    <Database className="w-3.5 h-3.5 text-vsc-keyword" />
                    <span>Data Source Provenance</span>
                  </div>
                  <a
                    href={activeProvenance.url}
                    target="_blank"
                    rel="noopener noreferrer"
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
                    <span className="text-vsc-bright font-semibold">
                      {activeProvenance.provider}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-vsc-muted">
                    <span>Method:</span>
                    <span className="text-sky-400">{activeProvenance.method}</span>
                  </div>
                  <div className="flex items-center justify-between text-vsc-muted">
                    <span>Pipeline:</span>
                    <span className="text-emerald-400 font-semibold">
                      {activeProvenance.compliance}
                    </span>
                  </div>
                </div>
              </div>

              {/* MODE-AWARE REMEDIATION SECTION */}
              {activeMode === 'web' ? (
                /* WEB & INFRASTRUCTURE MODE: Show Firewall / WAF / DNS Playbooks */
                <div className="mb-4">
                  <div className="text-[10px] font-bold uppercase text-vsc-muted mb-1.5 font-mono flex items-center justify-between">
                    <span>1-Click Remediation Playbook:</span>
                    <span className="text-[9px] text-sky-400 font-mono">5 Platforms</span>
                  </div>
                  <RemediationPlaybookCard finding={selectedFinding} target={target} />
                </div>
              ) : (
                /* IDENTITY & USERNAME MODE: Show Privacy, De-Indexing & Account Security (NO SHELL/UFW SCRIPTS) */
                <div className="mb-4 bg-vsc-panel p-3 rounded border border-purple-800/50 space-y-2.5 font-mono">
                  <div className="text-[10px] font-bold uppercase text-purple-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                      <span>Identity & Privacy Playbook</span>
                    </span>
                    <span className="text-[9px] text-emerald-400">OPSEC</span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <a
                      href="https://search.google.com/search-console/remove-outdated-content"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full p-2 rounded bg-vsc-canvas hover:bg-vsc-dropdown border border-vsc-border flex items-center justify-between text-vsc-bright transition-colors"
                    >
                      <span>1. Google Search De-Index Request</span>
                      <ExternalLink className="w-3 h-3 text-sky-400" />
                    </a>
                    <a
                      href="https://haveibeenpwned.com/NotifyMe"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full p-2 rounded bg-vsc-canvas hover:bg-vsc-dropdown border border-vsc-border flex items-center justify-between text-vsc-bright transition-colors"
                    >
                      <span>2. HIBP Breach Alert Watchlist</span>
                      <ExternalLink className="w-3 h-3 text-amber-400" />
                    </a>
                    <div className="p-2 rounded bg-vsc-canvas border border-vsc-borderSubtle text-[10px] text-vsc-muted space-y-1">
                      <div className="font-bold text-vsc-bright flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-emerald-400" />
                        <span>Recommended Identity Hardening:</span>
                      </div>
                      <p>• Rotate reused handles across public developer & social forums.</p>
                      <p>• Enable FIDO2/Passkey MFA on primary identity accounts.</p>
                      <p>• Use unique email aliases per platform to prevent correlation.</p>
                    </div>
                  </div>
                </div>
              )}
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
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="hover:underline"
            title="Configure active OSINT modules"
          >
            Active Modules: {enabledModules.length}/4
          </button>
          <span className="opacity-75">|</span>
          <span>ISEEYOU v0.1.0</span>
        </div>
      </footer>

      {/* 4. OSINT DATA PROVENANCE MODAL DIALOG */}
      {isProvenanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            data-testid="provenance-modal"
            className="bg-vsc-card border border-vsc-border w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[85vh]"
          >
            <div className="h-10 bg-vsc-sidebar px-4 border-b border-vsc-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-vsc-keyword" />
                <span className="font-bold text-sm text-vsc-bright">
                  OSINT Data Sources & Provenance Architecture
                </span>
              </div>
              <button
                onClick={() => setIsProvenanceModalOpen(false)}
                className="p-1 text-vsc-muted hover:text-vsc-bright rounded hover:bg-vsc-panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 select-text">
              <p className="text-vsc-muted text-xs leading-relaxed">
                ISEEYOU beroperasi dengan prinsip <strong>100% Passive Reconnaissance</strong>.
                Sistem tidak melakukan intrusi, port scan agresif, atau eksploitasi langsung ke
                host target, melainkan menyinkronkan data dari register publik, transparansi
                sertifikat kriptografi, dan intelijen ancaman zero-auth:
              </p>

              <div className="space-y-2.5 pt-1">
                {Object.entries(PROVENANCE_PROVIDERS).map(([key, prov]) => (
                  <div
                    key={key}
                    className="p-3 bg-vsc-panel rounded border border-vsc-border hover:border-vsc-borderSubtle transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-bold ${prov.badgeColor}`}
                        >
                          {prov.provider}
                        </span>
                        <span className="text-vsc-bright font-bold">{prov.type}</span>
                      </div>
                      <a
                        href={prov.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-vsc-accent-blue hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>Official Endpoint</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[11px] text-vsc-muted leading-relaxed mb-2">
                      {prov.description}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-vsc-muted pt-1.5 border-t border-vsc-borderSubtle">
                      <span>
                        Method: <strong className="text-sky-300">{prov.method}</strong>
                      </span>
                      <span className="text-emerald-400 font-semibold">✓ {prov.compliance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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

      {/* 5. WORKSPACE & SCAN PREFERENCES MODAL (Fixes Dead Settings Button) */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            data-testid="settings-modal"
            className="bg-vsc-card border border-vsc-border w-full max-w-lg rounded-lg shadow-2xl overflow-hidden font-mono text-xs flex flex-col"
          >
            <div className="h-10 bg-vsc-sidebar px-4 border-b border-vsc-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-sm text-vsc-bright">
                  Workspace & Modular Scan Settings
                </span>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 text-vsc-muted hover:text-vsc-bright rounded hover:bg-vsc-panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 1. Active OSINT Modules */}
              <div>
                <div className="text-[11px] font-bold uppercase text-vsc-bright mb-2">
                  1. Enabled OSINT Modules (ON / OFF)
                </div>
                <div className="space-y-1.5">
                  {AVAILABLE_OSINT_MODULES.map((mod) => {
                    const isOn = enabledModules.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleToggleModule(mod.id)}
                        className={`w-full p-2.5 rounded border text-left flex items-center justify-between transition-colors ${
                          isOn
                            ? 'bg-sky-950/25 border-sky-500/50 text-vsc-bright'
                            : 'bg-vsc-panel border-vsc-border text-vsc-muted'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs">{mod.label}</div>
                          <div className="text-[10px] text-vsc-muted">{mod.description}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOn
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {isOn ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Default Graph Layout & Anti-Overlap Threshold */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-vsc-borderSubtle">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-vsc-muted mb-1.5">
                    Default Graph Layout
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDefaultLayoutMode('tree')}
                      className={`flex-1 py-1.5 px-2 rounded border text-[11px] font-bold ${
                        defaultLayoutMode === 'tree'
                          ? 'bg-vsc-accent-blue text-white border-sky-400'
                          : 'bg-vsc-panel text-vsc-muted border-vsc-border'
                      }`}
                    >
                      🌿 Tree
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultLayoutMode('radial')}
                      className={`flex-1 py-1.5 px-2 rounded border text-[11px] font-bold ${
                        defaultLayoutMode === 'radial'
                          ? 'bg-vsc-accent-blue text-white border-sky-400'
                          : 'bg-vsc-panel text-vsc-muted border-vsc-border'
                      }`}
                    >
                      🎯 Radial
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-vsc-muted mb-1.5">
                    Cluster Fold Threshold
                  </label>
                  <div className="flex gap-1">
                    {[2, 3, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setClusterThreshold(num)}
                        className={`flex-1 py-1.5 rounded border text-[11px] font-bold ${
                          clusterThreshold === num
                            ? 'bg-vsc-accent-blue text-white border-sky-400'
                            : 'bg-vsc-panel text-vsc-muted border-vsc-border'
                        }`}
                      >
                        ≥{num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Workspace Reset */}
              <div className="pt-2 border-t border-vsc-borderSubtle flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-vsc-bright">Clear Current Graph</div>
                  <div className="text-[10px] text-vsc-muted">
                    Reset all discovered nodes, edges, and findings
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    resetWorkspace();
                    setIsSettingsModalOpen(false);
                  }}
                  className="text-rose-400 border-rose-800/60 hover:bg-rose-950/40 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Workspace</span>
                </Button>
              </div>
            </div>

            <div className="h-10 bg-vsc-sidebar px-4 border-t border-vsc-border flex items-center justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-xs h-7 px-4"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. LEGAL TAKEDOWN & PRIVACY ASSISTANT MODAL (TASK 4.3) */}
      <LegalTakedownModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        target={target}
        findings={findings}
        nodes={nodes}
      />

      {/* 7. PROFESSIONAL PDF AUDIT REPORT EXPORTER MODAL (TASK 4.4) */}
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
