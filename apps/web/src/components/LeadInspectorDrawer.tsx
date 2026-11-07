'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Sparkles,
  KeyRound,
  Pin,
  ExternalLink,
  Check,
  Copy,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  StickyNote,
  Play,
  Users,
  Mail,
  UserCheck,
  Globe,
  ShieldAlert,
  Camera,
} from 'lucide-react';
import {
  EntityNode,
  EntityType,
  NodeConfidence,
  TargetDossier,
  AIAnalysisReport,
  AIConfig,
  AIProviderType,
} from '@iseeyou/shared-types';

export type InspectorDrawerTab = 'node' | 'dorks' | 'ai' | 'pin';

interface LeadInspectorDrawerProps {
  isOpen: boolean;
  activeTab: InspectorDrawerTab;
  onTabChange: (tab: InspectorDrawerTab) => void;
  onClose: () => void;
  selectedNode: EntityNode | null;
  target: string;
  targetType: EntityType;
  dossier: TargetDossier;
  isScanning: boolean;
  onRunModuleOnNode: (node: EntityNode | null, moduleIds: string[]) => void;
  onPivotLead: (value: string, type: EntityType, modules?: string[], parentNodeId?: string) => void;
  onUpdateNodeAnnotation: (
    nodeId: string,
    updates: { confidence?: NodeConfidence; investigatorNotes?: string }
  ) => void;
  onAddManualLead: (
    type: EntityType,
    value: string,
    label?: string,
    parentNodeId?: string,
    notes?: string
  ) => void;
  aiReport: AIAnalysisReport | null;
  isAIAnalyzing: boolean;
  aiConfig: AIConfig;
  onUpdateAiConfig: (cfg: AIConfig) => void;
  onRunAIAnalysis: (overrideCfg?: AIConfig) => void;
}

export function LeadInspectorDrawer({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  selectedNode,
  target,
  targetType,
  dossier,
  isScanning,
  onRunModuleOnNode,
  onPivotLead,
  onUpdateNodeAnnotation,
  onAddManualLead,
  aiReport,
  isAIAnalyzing,
  aiConfig,
  onUpdateAiConfig,
  onRunAIAnalysis,
}: LeadInspectorDrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Manual Pin Clue Form State
  const [pinType, setPinType] = useState<EntityType>('username');
  const [pinValue, setPinValue] = useState('');
  const [pinLabel, setPinLabel] = useState('');
  const [pinNotes, setPinNotes] = useState('');

  // Custom Dork Handle Override
  const [customDorkHandle, setCustomDorkHandle] = useState('');

  // BYOK AI Settings Local State
  const [showByokForm, setShowByokForm] = useState(false);

  // Active handle & name for Tactical Dork Matrix
  const activeHandle = useMemo(() => {
    if (customDorkHandle.trim()) return customDorkHandle.trim().replace(/^@/, '');
    if (selectedNode) {
      const h = selectedNode.metadata?.handle;
      if (typeof h === 'string' && h.trim()) return h.trim().replace(/^@/, '');
      if (selectedNode.type === 'username' || selectedNode.type === 'associate') {
        if (!selectedNode.value.startsWith('http')) return selectedNode.value.replace(/^@/, '');
      }
    }
    return dossier.handles[0] || target.split('@')[0].replace(/^@/, '');
  }, [customDorkHandle, selectedNode, dossier.handles, target]);

  const activeFullName = useMemo(() => {
    if (selectedNode && typeof selectedNode.metadata?.full_name === 'string') {
      return selectedNode.metadata.full_name;
    }
    return dossier.fullNames[0] || '';
  }, [selectedNode, dossier.fullNames]);

  const activeOrg = useMemo(() => {
    if (selectedNode && typeof selectedNode.metadata?.company === 'string') {
      return selectedNode.metadata.company;
    }
    return dossier.organizations[0] || '';
  }, [selectedNode, dossier.organizations]);

  // Built-in Tactical Google Dorks (Private Account Comment/Tag Bypass + Pivots)
  const tacticalDorks = useMemo(() => {
    const h = activeHandle;
    const nm = activeFullName;
    const org = activeOrg;
    const list = [
      {
        id: 'ig-bypass',
        category: '🔓 Private Account Comment & Tag Bypass',
        title: 'Instagram Private Account Public Comments & Mentions',
        query: `site:instagram.com "${h}" -inurl:instagram.com/${h}`,
        desc: 'Extracts public posts, reels, and comment threads where this private IG handle commented or was tagged by friends.',
      },
      {
        id: 'tiktok-bypass',
        category: '🔓 Private Account Comment & Tag Bypass',
        title: 'TikTok Public Replies, Duets & Mentions',
        query: `site:tiktok.com "${h}" -inurl:"@${h}"`,
        desc: 'Finds public TikTok comment sections and video captions mentioning the handle.',
      },
      {
        id: 'x-bypass',
        category: '🔓 Private Account Comment & Tag Bypass',
        title: 'X / Twitter External Replies & Thread Mentions',
        query: `(site:x.com OR site:twitter.com) "${h}" -inurl:${h}/status`,
        desc: 'Uncovers replies from public accounts talking to or tagging a protected/private X account.',
      },
      {
        id: 'linkedin-pivot',
        category: '🧭 Cross-Platform Identity Pivot',
        title: 'LinkedIn Career & Education Match',
        query: nm
          ? `site:linkedin.com/in/ "${nm}"${org ? ` "${org}"` : ''}`
          : `site:linkedin.com/in/ "${h}"`,
        desc: 'Locates professional LinkedIn profile using discovered Real Name and Company/University.',
      },
      {
        id: 'doc-roster-leak',
        category: '📄 Leaked Documents & University/Company Rosters',
        title: 'Indexed PDF / XLSX / DOCX Rosters, CVs & Directories',
        query: nm
          ? `("${nm}" OR "${h}") (filetype:pdf OR filetype:xlsx OR filetype:docx)`
          : `"${h}" (filetype:pdf OR filetype:xlsx OR filetype:docx OR filetype:txt)`,
        desc: 'Hunts for leaked resumes, university student lists, event participant rosters, or employee spreadsheets.',
      },
      {
        id: 'paste-code-leak',
        category: '📄 Leaked Documents & University/Company Rosters',
        title: 'Public Pastebins, Telegram & Forum Mentions',
        query: `"${h}" (site:pastebin.com OR site:t.me OR site:reddit.com OR site:medium.com)`,
        desc: 'Searches public Telegram channels, Reddit discussions, and paste sites for the target handle.',
      },
    ];
    return list;
  }, [activeHandle, activeFullName, activeOrg]);

  if (!isOpen) return null;

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const launchGoogleDork = (query: string) => {
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const selectedAvatar =
    typeof selectedNode?.metadata?.avatar_url === 'string'
      ? selectedNode.metadata.avatar_url
      : null;

  const selectedProfileUrl =
    typeof selectedNode?.metadata?.profile_url === 'string'
      ? selectedNode.metadata.profile_url
      : selectedNode?.value.startsWith('http')
      ? selectedNode.value
      : null;

  return (
    <aside
      data-testid="lead-inspector-drawer"
      className="w-[380px] max-h-[calc(100vh-88px)] flex flex-col bg-[#111318]/95 backdrop-blur-xl border border-slate-800/90 rounded-xl shadow-2xl overflow-hidden text-xs text-slate-200 z-20"
    >
      {/* Top Navigation Tabs */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1 font-mono text-[10px]">
          <button
            type="button"
            onClick={() => onTabChange('node')}
            className={`px-2 py-1 rounded font-bold transition-colors ${
              activeTab === 'node'
                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔎 Lead
          </button>
          <button
            type="button"
            onClick={() => onTabChange('dorks')}
            data-testid="tab-dork-matrix"
            className={`px-2 py-1 rounded font-bold transition-colors ${
              activeTab === 'dorks'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🕵️ Dork Matrix
          </button>
          <button
            type="button"
            onClick={() => onTabChange('ai')}
            data-testid="tab-ai-detective"
            className={`px-2 py-1 rounded font-bold transition-colors ${
              activeTab === 'ai'
                ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🤖 AI Detective
          </button>
          <button
            type="button"
            onClick={() => onTabChange('pin')}
            data-testid="tab-pin-clue"
            className={`px-2 py-1 rounded font-bold transition-colors ${
              activeTab === 'pin'
                ? 'bg-amber-600/30 text-amber-200 border border-amber-500/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📌 Pin Clue
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* TAB 1: NODE LEAD INSPECTOR & STICKY NOTES */}
        {activeTab === 'node' && (
          <>
            {selectedNode ? (
              <div className="space-y-3.5">
                {/* Node Identity Header */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                  <div className="flex items-start gap-3">
                    {selectedAvatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedAvatar}
                        alt={selectedNode.label}
                        className="w-12 h-12 rounded-xl object-cover border border-indigo-500/40 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50 font-bold">
                          {selectedNode.type}
                        </span>
                        {typeof selectedNode.metadata?.platform === 'string' && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {selectedNode.metadata.platform}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-white mt-1 truncate">
                        {selectedNode.label}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 break-all">
                        {selectedNode.value}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Copy & Open Profile */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => copyText('node-val', selectedNode.value)}
                      className="flex-1 py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedKey === 'node-val' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Value</span>
                        </>
                      )}
                    </button>
                    {selectedProfileUrl && (
                      <a
                        href={selectedProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 px-2.5 rounded bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Profile ↗</span>
                      </a>
                    )}
                  </div>

                  {/* Reverse Image Search if node has an avatar */}
                  {selectedAvatar && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Camera className="w-3 h-3 text-sky-400" />
                        Reverse Photo:
                      </span>
                      <div className="flex items-center gap-1">
                        <a
                          href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(selectedAvatar)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded bg-sky-950/70 border border-sky-700/50 text-sky-200 text-[10px] font-mono hover:bg-sky-900"
                        >
                          Lens ↗
                        </a>
                        <a
                          href={`https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(selectedAvatar)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-700/50 text-amber-200 text-[10px] font-mono hover:bg-amber-900"
                        >
                          Yandex ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* 1-Click Lead-Chaining Actions on Selected Node */}
                <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 font-bold flex items-center gap-1.5">
                    <Play className="w-3 h-3" />
                    <span>Chain Next OSINT Step From This Lead</span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {(selectedNode.type === 'username' || selectedNode.type === 'associate') && (
                      <>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, ['deep_profile_extractor'])
                          }
                          className="w-full py-1.5 px-2.5 rounded bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-600/50 text-indigo-200 font-mono text-[11px] font-semibold flex items-center justify-between disabled:opacity-50"
                        >
                          <span>🧬 Extract Deep Profile, Bio & Commit Emails</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() => onRunModuleOnNode(selectedNode, ['connection_mapper'])}
                          className="w-full py-1.5 px-2.5 rounded bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-600/50 text-emerald-200 font-mono text-[11px] font-semibold flex items-center justify-between disabled:opacity-50"
                        >
                          <span>👥 Map Mutual Circle (&ldquo;Dia kenal siapa aja&rdquo;)</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, ['social_presence_scanner'])
                          }
                          className="w-full py-1.5 px-2.5 rounded bg-purple-950/70 hover:bg-purple-900/80 border border-purple-600/50 text-purple-200 font-mono text-[11px] font-semibold flex items-center justify-between disabled:opacity-50"
                        >
                          <span>🌐 Scan Handle Across 16+ Social Platforms</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {selectedNode.type === 'email' && (
                      <>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() => onRunModuleOnNode(selectedNode, ['email_correlator'])}
                          className="w-full py-1.5 px-2.5 rounded bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-600/50 text-indigo-200 font-mono text-[11px] font-semibold flex items-center justify-between disabled:opacity-50"
                        >
                          <span>🪪 Lookup Gravatar, OpenPGP Key & GitHub Account</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, ['breach_credential_hunter'])
                          }
                          className="w-full py-1.5 px-2.5 rounded bg-amber-950/70 hover:bg-amber-900/80 border border-amber-600/50 text-amber-200 font-mono text-[11px] font-semibold flex items-center justify-between disabled:opacity-50"
                        >
                          <span>🚨 Check Email in Data Breaches (k-Anonymity)</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {(selectedNode.type === 'domain' || selectedNode.type === 'subdomain') && (
                      <>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, [
                              'subdomain_dns_resolver',
                              'ip_threat_intel',
                            ])
                          }
                          className="w-full py-1.5 px-2.5 rounded bg-sky-950/70 hover:bg-sky-900/80 border border-sky-600/50 text-sky-200 font-mono text-[11px] font-semibold flex items-center justify-between disabled:opacity-50"
                        >
                          <span>🌐 Enumerate Subdomains, DNS & Origin IPs</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => onTabChange('dorks')}
                      className="w-full py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[11px] font-semibold flex items-center justify-between"
                    >
                      <span>🕵️ Generate Private Account Bypass Dorks</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Confidence Tagging & Investigator Sticky Notes */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                    <StickyNote className="w-3 h-3 text-amber-400" />
                    <span>Confidence Status & Detective Notes</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateNodeAnnotation(selectedNode.id, { confidence: 'verified' })
                      }
                      className={`py-1 px-2 rounded border flex items-center justify-center gap-1 font-bold transition-colors ${
                        selectedNode.confidence === 'verified'
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Verified</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateNodeAnnotation(selectedNode.id, { confidence: 'suspected' })
                      }
                      className={`py-1 px-2 rounded border flex items-center justify-center gap-1 font-bold transition-colors ${
                        selectedNode.confidence === 'suspected'
                          ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Suspect</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateNodeAnnotation(selectedNode.id, { confidence: 'false_positive' })
                      }
                      className={`py-1 px-2 rounded border flex items-center justify-center gap-1 font-bold transition-colors ${
                        selectedNode.confidence === 'false_positive'
                          ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span>False Pos</span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={selectedNode.investigatorNotes || ''}
                    onChange={(e) =>
                      onUpdateNodeAnnotation(selectedNode.id, {
                        investigatorNotes: e.target.value,
                      })
                    }
                    placeholder="Write investigator sticky notes for this lead (e.g. 'Confirmed same person via IG bio link')..."
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 outline-none p-2 text-[11px] text-slate-200 font-mono placeholder:text-slate-600"
                  />
                </div>

                {/* Extracted Metadata Table */}
                {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Raw Intelligence Attributes
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {Object.entries(selectedNode.metadata)
                        .filter(
                          ([k, v]) =>
                            v !== null &&
                            v !== undefined &&
                            v !== '' &&
                            k !== 'timeline' &&
                            k !== 'bios'
                        )
                        .map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-start justify-between gap-2 text-[10px] font-mono py-1 border-b border-slate-800/60 last:border-none"
                          >
                            <span className="text-slate-400 flex-shrink-0">{k}:</span>
                            <span className="text-slate-200 text-right break-all">
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                <Search className="w-6 h-6 text-indigo-400 mx-auto" />
                <div className="text-xs font-bold text-white">No Evidence Card Selected</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Click any node card on the Caseboard to inspect its extracted metadata, chain
                  deeper OSINT modules, or tag its confidence level.
                </p>
              </div>
            )}
          </>
        )}

        {/* TAB 2: TACTICAL GOOGLE DORK MATRIX (PRIVATE ACCOUNT COMMENT BYPASS) */}
        {activeTab === 'dorks' && (
          <div className="space-y-3.5" data-testid="dork-matrix-panel">
            <div className="p-3 rounded-xl bg-purple-950/25 border border-purple-500/40 space-y-2">
              <div className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                <span>🕵️ Tactical Google Dork Matrix</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Even if a target&apos;s Instagram, TikTok, or X account is <strong>Private</strong>,
                their comments on friends&apos; public posts and public tags are indexed by Google.
              </p>
              <div className="pt-1">
                <label className="block text-[10px] font-mono text-purple-300 mb-1">
                  Target Handle for Dork Injection:
                </label>
                <input
                  type="text"
                  value={customDorkHandle}
                  onChange={(e) => setCustomDorkHandle(e.target.value)}
                  placeholder={`Default: ${activeHandle}`}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-purple-700/50 text-xs font-mono text-white outline-none focus:border-purple-400"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {tacticalDorks.map((dork) => (
                <div
                  key={dork.id}
                  className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 space-y-2 transition-colors"
                >
                  <div className="text-[9px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                    {dork.category}
                  </div>
                  <div className="text-xs font-bold text-white">{dork.title}</div>
                  <div className="text-[10px] text-slate-400 leading-relaxed">{dork.desc}</div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-emerald-300 break-all select-all">
                    {dork.query}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => copyText(dork.id, dork.query)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] flex items-center gap-1"
                    >
                      {copiedKey === dork.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Query</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => launchGoogleDork(dork.query)}
                      className="flex-1 py-1 px-2.5 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 font-mono text-[10px] font-bold flex items-center justify-center gap-1"
                    >
                      <span>Launch Google Dork ↗</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: AI DETECTIVE & BYOK TOKEN SETTINGS */}
        {activeTab === 'ai' && (
          <div className="space-y-3.5" data-testid="ai-detective-panel">
            {/* BYOK Token & Provider Bar */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">AI OSINT Detective</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowByokForm((prev) => !prev)}
                  data-testid="btn-toggle-byok"
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/40 font-mono text-[10px] font-semibold flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>{aiConfig.apiKey ? '🔑 Key Active' : '🔑 Set AI Token'}</span>
                </button>
              </div>

              {showByokForm && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-[10px] font-mono text-slate-400">
                    Bring-Your-Own-Key (stored locally in your browser):
                  </div>
                  <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                    {(['gemini', 'groq', 'openai', 'ollama'] as AIProviderType[]).map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => onUpdateAiConfig({ ...aiConfig, provider: prov })}
                        className={`py-1 rounded border uppercase font-bold ${
                          aiConfig.provider === prov
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {prov}
                      </button>
                    ))}
                  </div>
                  {aiConfig.provider !== 'ollama' && (
                    <input
                      type="password"
                      value={aiConfig.apiKey}
                      onChange={(e) =>
                        onUpdateAiConfig({ ...aiConfig, apiKey: e.target.value })
                      }
                      placeholder={`Paste ${aiConfig.provider.toUpperCase()} API Key...`}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white outline-none focus:border-emerald-400"
                    />
                  )}
                  <input
                    type="text"
                    value={aiConfig.modelOverride || ''}
                    onChange={(e) =>
                      onUpdateAiConfig({ ...aiConfig, modelOverride: e.target.value })
                    }
                    placeholder="Optional model override (e.g. llama-3.3-70b-versatile)"
                    className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-200 outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                disabled={isAIAnalyzing}
                onClick={() => onRunAIAnalysis()}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-200 font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isAIAnalyzing
                    ? 'Synthesizing Leads & Hypotheses...'
                    : 'Run AI Lead Correlation & Hypothesis'}
                </span>
              </button>
            </div>

            {aiReport && (
              <div className="space-y-3">
                {/* Predicted Alternate Handles / Emails */}
                {aiReport.predictedLeads && aiReport.predictedLeads.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                      🔮 Predicted Alternate Handles & Emails
                    </div>
                    <div className="space-y-1.5">
                      {aiReport.predictedLeads.map((lead, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-bold text-white truncate">
                              {lead.value}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {lead.reason} ({Math.round(lead.confidence * 100)}%)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onPivotLead(
                                lead.value,
                                (lead.leadType as EntityType) || 'username'
                              )
                            }
                            className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-800 border border-emerald-600/50 text-emerald-200 font-mono text-[10px] font-bold flex-shrink-0"
                          >
                            Hunt →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Executive Dossier Synthesis */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="uppercase font-bold text-indigo-300">
                      Detective Synthesis
                    </span>
                    <span>Model: {aiReport.model}</span>
                  </div>
                  <p className="text-[11px] text-slate-200 whitespace-pre-line leading-relaxed">
                    {aiReport.executiveSummary}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PIN MANUAL CLUE FORM */}
        {activeTab === 'pin' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pinValue.trim()) return;
              onAddManualLead(
                pinType,
                pinValue,
                pinLabel || undefined,
                selectedNode?.id,
                pinNotes || undefined
              );
              setPinValue('');
              setPinLabel('');
              setPinNotes('');
              onTabChange('node');
            }}
            className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3"
          >
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Pin className="w-3.5 h-3.5" />
              <span>Pin Manual Clue to Caseboard</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Found a username, email, company, or friend&apos;s handle from an Instagram story or
              Google Dork? Pin it directly onto the board and chain your next scan from it.
            </p>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Clue Type:
              </label>
              <select
                value={pinType}
                onChange={(e) => setPinType(e.target.value as EntityType)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white outline-none"
              >
                <option value="username">👤 Username / Social Handle</option>
                <option value="email">📧 Email Address</option>
                <option value="associate">🤝 Associate / Known Friend</option>
                <option value="organization">🏢 Company / University</option>
                <option value="location">📍 City / Location</option>
                <option value="domain">🌐 Personal / Work Website</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Clue Value (Required):
              </label>
              <input
                type="text"
                required
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                placeholder="e.g. budi.santoso99 or budi@company.com"
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Custom Label (Optional):
              </label>
              <input
                type="text"
                value={pinLabel}
                onChange={(e) => setPinLabel(e.target.value)}
                placeholder="e.g. Private IG found in friend's comment"
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Detective Notes:
              </label>
              <textarea
                rows={2}
                value={pinNotes}
                onChange={(e) => setPinNotes(e.target.value)}
                placeholder="Where did you find this clue?"
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 px-3 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/60 text-amber-200 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Pin className="w-3.5 h-3.5" />
              <span>Pin Clue onto Board & Connect</span>
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}

