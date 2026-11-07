'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Scale,
  FileDown,
  RotateCcw,
  Pin,
  Radar,
  FolderOpen,
  Table,
  Network,
  Terminal,
  X,
} from 'lucide-react';
import {
  OmniSearchBar,
  ReconOperatingMode,
  AVAILABLE_OSINT_MODULES,
} from '@/components/OmniSearchBar';
import { StructuredDataView } from '@/components/StructuredDataView';
import { GraphCanvas, GraphLayoutMode } from '@/components/GraphCanvas';
import { AIAnalystCard } from '@/components/AIAnalystCard';
import { LegalTakedownModal } from '@/components/LegalTakedownModal';
import { ExportReportModal } from '@/components/ExportReportModal';
import { TargetDossierCard } from '@/components/TargetDossierCard';
import { LeadInspectorDrawer, InspectorDrawerTab } from '@/components/LeadInspectorDrawer';
import { CaseManagerModal } from '@/components/CaseManagerModal';
import { useScanStream, normalizeTargetForType } from '@/hooks/useScanStream';
import { useAIAnalyst } from '@/hooks/useAIAnalyst';
import { EntityNode, EntityType } from '@iseeyou/shared-types';

export default function WorkspacePage() {
  const [activeView, setActiveView] = useState<'caseboard' | 'table' | 'ai'>('caseboard');
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorDrawerTab>('dorks');
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);

  // Operating Mode & Modular Scan Toggles (Defaulting to Identity OSINT Lead-Chaining)
  const [manualMode, setManualMode] = useState<ReconOperatingMode | null>('identity');
  const [enabledModules, setEnabledModules] = useState<string[]>([
    'deep_profile_extractor',
    'connection_mapper',
    'email_correlator',
    'social_presence_scanner',
    'breach_credential_hunter',
    'subdomain_dns_resolver',
    'ip_threat_intel',
  ]);

  const [defaultLayoutMode] = useState<GraphLayoutMode>('tree');
  const [clusterThreshold] = useState<number>(4);

  // Real-time OSINT Caseboard Stream Hook
  const {
    target,
    targetType,
    riskScore,
    logs,
    nodes,
    edges,
    findings,
    dossier,
    savedCases,
    activeCaseName,
    caseNotes,
    isScanning,
    selectedFinding,
    selectedNode,
    pivotHistory,
    startScan,
    revertPivot,
    clearLogs,
    selectFinding,
    selectNode,
    addManualLead,
    updateNodeAnnotation,
    setCaseNotes,
    saveCase,
    loadCase,
    deleteCase,
    exportCaseJson,
  } = useScanStream();

  const activeMode: ReconOperatingMode = useMemo(() => {
    if (manualMode) return manualMode;
    if (targetType === 'username' || targetType === 'email' || targetType === 'associate') {
      return 'identity';
    }
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

  // Hybrid AI Detective Hook (with BYOK Token Support)
  const {
    report: aiReport,
    isAnalyzing: isAIAnalyzing,
    aiConfig,
    updateAiConfig,
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

  const handleInspectNode = (node: EntityNode) => {
    selectNode(node);
    setInspectorTab('node');
    setIsRightDrawerOpen(true);
  };

  const handleInspectFinding = (finding: any) => {
    selectFinding(finding);
    setIsRightDrawerOpen(true);
  };

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

  const handlePivotLead = (
    rawVal: string,
    type: EntityType,
    customModules?: string[],
    parentNodeId?: string
  ) => {
    const nextMode: ReconOperatingMode =
      type === 'username' || type === 'email' || type === 'associate' ? 'identity' : 'web';
    setManualMode(nextMode);

    const validModsForMode = AVAILABLE_OSINT_MODULES.filter((m) =>
      m.modes.includes(nextMode)
    ).map((m) => m.id);
    const chosenMods =
      customModules && customModules.length > 0
        ? customModules
        : enabledModules.filter((id) => validModsForMode.includes(id));

    startScan(
      rawVal,
      type,
      true,
      chosenMods.length > 0 ? chosenMods : validModsForMode,
      parentNodeId || selectedNode?.id || `root-${target}`
    );
  };

  const latestLog = logs[logs.length - 1];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090B10] text-slate-200 font-sans antialiased overflow-hidden select-none">
      {/* 1. FLOATING TOP INVESTIGATION COMMAND BAR (Quiet Carbon Obsidian Surface) */}
      <header className="h-14 bg-[#0F1219]/95 backdrop-blur-xl border-b border-white/[0.07] flex items-center justify-between px-4 z-30">
        {/* Left Brand & Active Case Badge */}
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ISEEYOU" className="w-6 h-6" />
          <div>
            <div className="font-semibold text-xs tracking-wider text-slate-100 font-mono flex items-center gap-1.5">
              <span>ISEEYOU 2.0</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-300 font-medium">
                OSINT CASEBOARD
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
              <span>Target:</span>
              <strong className="text-slate-100 font-medium">{target}</strong>
              {pivotHistory.length > 0 && (
                <button
                  type="button"
                  onClick={revertPivot}
                  className="ml-1 px-1.5 py-0.2 rounded bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-amber-300 text-[9px] flex items-center gap-0.5 transition-colors"
                  title="Step back to previous lead in chain"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Back ({pivotHistory.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Center Omni-Search with Identity / Web Mode & 7 Modular Extractor Toggles */}
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

        {/* Right Tactical Actions Bar (Unified Quiet Surface + Crisp Icon Accents) */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <button
            type="button"
            data-testid="btn-open-pin-clue"
            onClick={() => {
              setInspectorTab('pin');
              setIsRightDrawerOpen(true);
            }}
            className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              isRightDrawerOpen && inspectorTab === 'pin'
                ? 'bg-white/[0.09] border-sky-400/50 text-white'
                : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08] text-slate-200'
            }`}
            title="Pin a manually discovered clue onto the Caseboard"
          >
            <Pin className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Pin Clue</span>
          </button>

          <button
            type="button"
            data-testid="btn-open-dork-matrix"
            onClick={() => {
              setInspectorTab('dorks');
              setIsRightDrawerOpen(true);
            }}
            className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              isRightDrawerOpen && inspectorTab === 'dorks'
                ? 'bg-white/[0.09] border-sky-400/50 text-white'
                : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08] text-slate-200'
            }`}
            title="Open Tactical Google Dork Matrix (Private IG/TikTok/X Comment Bypass)"
          >
            <Radar className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">Dork Matrix</span>
          </button>

          <button
            type="button"
            data-testid="btn-activity-ai"
            onClick={() => {
              setInspectorTab('ai');
              setIsRightDrawerOpen(true);
              if (!aiReport && !isAIAnalyzing) {
                runAIAnalysis();
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              isRightDrawerOpen && inspectorTab === 'ai'
                ? 'bg-white/[0.09] border-sky-400/50 text-white'
                : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08] text-slate-200'
            }`}
            title="Open AI OSINT Detective & BYOK Token Settings"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">AI Detective</span>
          </button>

          <button
            type="button"
            data-testid="btn-open-case-manager"
            onClick={() => setIsCaseModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-medium flex items-center gap-1.5 transition-colors"
            title="Save, Load, or Export Investigation (.case.json)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden xl:inline">Cases</span>
          </button>

          {/* View Switcher: Caseboard Graph vs Structured Table */}
          <div className="flex items-center bg-[#090B10] border border-white/[0.08] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveView('caseboard')}
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all ${
                activeView === 'caseboard'
                  ? 'bg-white/[0.09] text-white font-semibold border border-white/[0.08]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              title="Interactive Infinite OSINT Caseboard"
            >
              <Network className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden 2xl:inline">Board</span>
            </button>
            <button
              type="button"
              data-testid="btn-activity-table"
              onClick={() => setActiveView('table')}
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all ${
                activeView === 'table'
                  ? 'bg-white/[0.09] text-white font-semibold border border-white/[0.08]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              title="Structured Evidence Table & Matrix"
            >
              <Table className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden 2xl:inline">Table</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="btn-activity-export-pdf"
            onClick={() => setIsExportModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-medium flex items-center gap-1.5 transition-colors"
            title="Export Target Dossier Report (PDF / JSON / Markdown)"
          >
            <FileDown className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden xl:inline">Dossier PDF</span>
          </button>

          <button
            type="button"
            data-testid="btn-activity-legal"
            onClick={() => setIsLegalModalOpen(true)}
            className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-400 hover:text-slate-100 transition-colors"
            title="Privacy & Legal Takedown Generator (UU PDP & GDPR)"
          >
            <Scale className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. FULL-SCREEN INVESTIGATION WORKSPACE */}
      <main className="flex-1 relative overflow-hidden flex">
        {activeView === 'caseboard' && (
          <div className="flex-1 w-full h-full relative">
            {/* Full-Viewport Infinite React Flow Caseboard */}
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
              onPivot={(pivotTarget, pivotType) => handlePivotLead(pivotTarget, pivotType)}
            />

            {/* Floating Left Panel: Live Target Dossier, Reverse Image Search & Chronological Timeline */}
            <div className="absolute top-3 left-3 z-20">
              <TargetDossierCard
                dossier={dossier}
                targetType={targetType}
                riskScore={riskScore}
                isScanning={isScanning}
                onPivotLead={(val, type, mods) => handlePivotLead(val, type, mods)}
                onOpenDorkMatrix={() => {
                  setInspectorTab('dorks');
                  setIsRightDrawerOpen(true);
                }}
              />
            </div>

            {/* Floating Right Panel: Slide-Over Lead Inspector, Tactical Dork Matrix & AI Detective */}
            <div className="absolute top-3 right-3 z-20">
              <LeadInspectorDrawer
                isOpen={isRightDrawerOpen}
                activeTab={inspectorTab}
                onTabChange={(t) => setInspectorTab(t)}
                onClose={() => setIsRightDrawerOpen(false)}
                selectedNode={selectedNode}
                target={target}
                targetType={targetType}
                dossier={dossier}
                isScanning={isScanning}
                onRunModuleOnNode={handleRunModuleOnNode}
                onPivotLead={handlePivotLead}
                onUpdateNodeAnnotation={updateNodeAnnotation}
                onAddManualLead={addManualLead}
                aiReport={aiReport}
                isAIAnalyzing={isAIAnalyzing}
                aiConfig={aiConfig}
                onUpdateAiConfig={updateAiConfig}
                onRunAIAnalysis={runAIAnalysis}
              />
            </div>

            {/* Subtle Floating Activity Log Pill (Bottom-Left above Zoom Controls) */}
            <div className="absolute bottom-3 left-14 z-20 max-w-md">
              {isActivityLogOpen ? (
                <div className="w-[420px] max-h-56 bg-[#0F1219]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col font-mono text-[11px]">
                  <div className="px-3 py-1.5 bg-[#131720] border-b border-white/[0.07] flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 tabular-nums">
                      <Terminal className="w-3.5 h-3.5 text-sky-400" />
                      Live OSINT Stream ({logs.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={clearLogs}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsActivityLogOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-1 select-text">
                    {logs.slice(-25).map((l) => (
                      <div key={l.id} className="leading-snug">
                        <span className="text-slate-500 tabular-nums">[{l.timestamp}]</span>{' '}
                        <span className="text-sky-400 font-medium">[{l.module}]</span>{' '}
                        <span
                          className={
                            l.level === 'error'
                              ? 'text-rose-400'
                              : l.level === 'warn'
                              ? 'text-amber-300'
                              : l.level === 'success'
                              ? 'text-emerald-300'
                              : 'text-slate-300'
                          }
                        >
                          {l.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsActivityLogOpen(true)}
                  className="px-3 py-1.5 rounded-full bg-[#0F1219]/92 backdrop-blur-md border border-white/[0.08] hover:border-white/[0.18] text-[11px] font-mono text-slate-300 flex items-center gap-2 shadow-lg max-w-sm truncate transition-colors"
                  title="Click to expand live OSINT telemetry log"
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isScanning ? 'bg-sky-400 animate-ping' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="truncate">
                    {latestLog ? latestLog.message : 'Ready for investigation'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {activeView === 'table' && (
          <div className="flex-1 overflow-auto p-6 bg-[#090B10]">
            <StructuredDataView
              nodes={nodes}
              edges={edges}
              findings={findings}
              target={target}
              targetType={targetType}
              riskScore={riskScore}
              riskLevel={
                riskScore >= 70
                  ? 'CRITICAL'
                  : riskScore >= 40
                  ? 'HIGH'
                  : riskScore >= 15
                  ? 'MEDIUM'
                  : 'LOW'
              }
              isScanning={isScanning}
              selectedFindingId={selectedFinding?.id}
              onSelectNode={(n) => {
                handleInspectNode(n);
                setActiveView('caseboard');
              }}
              onSelectFinding={(f) => {
                handleInspectFinding(f);
              }}
              onPivot={(t, type) => {
                handlePivotLead(t, type);
                setActiveView('caseboard');
              }}
              onExportPDF={() => setIsExportModalOpen(true)}
            />
          </div>
        )}

        {activeView === 'ai' && (
          <div className="flex-1 overflow-auto p-6 bg-[#090B10]">
            <AIAnalystCard
              report={aiReport}
              isAnalyzing={isAIAnalyzing}
              onRefresh={() => runAIAnalysis()}
              target={target}
            />
          </div>
        )}
      </main>

      {/* 3. MODALS: CASE MANAGER, PDF DOSSIER EXPORT, LEGAL TAKEDOWN */}
      <CaseManagerModal
        isOpen={isCaseModalOpen}
        onClose={() => setIsCaseModalOpen(false)}
        activeCaseName={activeCaseName}
        caseNotes={caseNotes}
        onCaseNotesChange={setCaseNotes}
        savedCases={savedCases}
        onSaveCase={saveCase}
        onLoadCase={loadCase}
        onDeleteCase={deleteCase}
        onExportCaseJson={exportCaseJson}
      />

      <LegalTakedownModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        target={target}
        findings={findings}
        nodes={nodes}
      />

      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        target={target}
        targetType={targetType}
        riskScore={riskScore}
        nodes={nodes}
        findings={findings}
        aiReport={aiReport}
      />
    </div>
  );
}
