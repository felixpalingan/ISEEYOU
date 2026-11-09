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
  Globe,
  ShieldAlert,
  Camera,
  Crosshair,
  Radar,
  Fingerprint,
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
    if (selectedNode) {
      if (typeof selectedNode.metadata?.full_name === 'string' && selectedNode.metadata.full_name.trim()) {
        return selectedNode.metadata.full_name.trim();
      }
      if (
        (selectedNode.type === 'username' || selectedNode.type === 'associate') &&
        selectedNode.value.trim().includes(' ') &&
        !selectedNode.value.startsWith('http')
      ) {
        return selectedNode.value.trim();
      }
    }
    if (dossier.fullNames[0]) return dossier.fullNames[0];
    if (target.trim().includes(' ') && !target.includes('@')) return target.trim();
    return '';
  }, [selectedNode, dossier.fullNames, target]);

  const activeNameTokens = useMemo(() => {
    const raw = activeFullName.trim();
    if (!raw) return { firstName: '', surname: '', shortName: '' };
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { firstName: parts[0], surname: parts[0], shortName: parts[0] };
    }
    const firstName = parts[0];
    const surname =
      (selectedNode && typeof selectedNode.metadata?.surname === 'string' && selectedNode.metadata.surname) ||
      parts[parts.length - 1];
    const shortName =
      parts.length >= 3 ? `${parts[parts.length - 2]} ${surname}` : `${firstName} ${surname}`;
    return { firstName, surname, shortName };
  }, [activeFullName, selectedNode]);

  const activeOrg = useMemo(() => {
    if (selectedNode) {
      if (typeof selectedNode.metadata?.company === 'string' && selectedNode.metadata.company.trim()) {
        return selectedNode.metadata.company.trim();
      }
      if (selectedNode.type === 'organization' && selectedNode.value.trim()) {
        return selectedNode.value.trim();
      }
    }
    return dossier.organizations[0] || '';
  }, [selectedNode, dossier.organizations]);

  // Built-in Tactical Google Dorks (14 Formulas: Family/Clan Surname, Jabatan/Career, PDDIKTI/Kampus, Official SK/CV, & Private Social Bypass)
  const tacticalDorks = useMemo(() => {
    const h = activeHandle;
    const nm = activeFullName || h;
    const { firstName, surname, shortName } = activeNameTokens;
    const fam = surname || h;
    const org = activeOrg;
    const em = dossier.emails[0] || '';
    const nameOrShort =
      activeFullName && shortName && shortName.toLowerCase() !== activeFullName.toLowerCase()
        ? `"${activeFullName}" OR "${shortName}"`
        : `"${nm}"`;

    return [
      {
        id: 'family-clan-relatives',
        category: 'Family, Surname & Clan Lineage (Keluarga & Marga)',
        title: `Family & Relatives Sharing Surname ("${fam}")`,
        query: firstName && fam.toLowerCase() !== firstName.toLowerCase()
          ? `"${fam}" -"${firstName}" (site:linkedin.com/in/ OR site:instagram.com OR site:facebook.com OR site:ac.id OR site:go.id OR filetype:pdf)`
          : `"${fam}" (intext:"keluarga" OR intext:"marga" OR site:linkedin.com/in/ OR site:facebook.com)`,
        desc: 'Hunts parents, siblings, and relatives sharing the same family surname/clan across LinkedIn, social media, universities, and public PDFs.',
      },
      {
        id: 'family-lineage-graduation',
        category: 'Family, Surname & Clan Lineage (Keluarga & Marga)',
        title: 'Parents, Siblings, Graduation Books & Civil Lineage',
        query: `(${nameOrShort} OR "${fam}") (intext:"anak dari" OR intext:"putra dari" OR intext:"putri dari" OR intext:"bin" OR intext:"binti" OR intext:"suami" OR intext:"istri" OR intext:"wisuda")`,
        desc: 'Uncovers parent names (putra/putri dari, bin/binti), spouse mentions, university graduation books (buku wisuda), and family announcements.',
      },
      {
        id: 'career-jabatan-org',
        category: 'Career, Jabatan & Executive Roles',
        title: 'Jabatan, Structural Position, PT/CV & Organization Role',
        query: `(${nameOrShort})${org ? ` "${org}"` : ''} (intext:"Jabatan" OR intext:"Direktur" OR intext:"Komisaris" OR intext:"Manager" OR intext:"Ketua" OR intext:"Divisi" OR intext:"Pengurus" OR intext:"Staff")`,
        desc: 'Pinpoints job titles, organizational committee roles, corporate directorships (AHU/PT/CV), and structural appointments.',
      },
      {
        id: 'linkedin-pivot',
        category: 'Career, Jabatan & Executive Roles',
        title: 'LinkedIn Career & Education Identity Match',
        query: activeFullName
          ? `site:linkedin.com/in/ (${nameOrShort})${org ? ` "${org}"` : ''}`
          : `site:linkedin.com/in/ "${h}"`,
        desc: 'Locates professional LinkedIn profiles using Full Name, 2-word Short Name variations, and Company/University.',
      },
      {
        id: 'linkedin-activity',
        category: 'Career, Jabatan & Executive Roles',
        title: 'LinkedIn Public Post Comments & Colleague Tags',
        query: activeFullName
          ? `site:linkedin.com/posts/ (${nameOrShort} OR "${h}")`
          : `site:linkedin.com/posts/ "${h}"`,
        desc: 'Finds public LinkedIn posts where the target commented, congratulated colleagues, or was tagged by coworkers.',
      },
      {
        id: 'academic-pddikti-kampus',
        category: 'Academic, University & PDDIKTI Records',
        title: 'PDDIKTI, University Repository (.ac.id), NIM & Thesis/Skripsi',
        query: `(${nameOrShort} OR "${h}") (site:ac.id OR site:pddikti.kemdikbud.go.id OR intext:"NIM" OR intext:"NPM" OR intext:"Skripsi" OR intext:"Tesis" OR intext:"Program Studi")`,
        desc: 'Searches Indonesian & global university domains (.ac.id), PDDIKTI student/lecturer records, student IDs (NIM/NPM), and thesis repositories.',
      },
      {
        id: 'academic-scholar-garuda',
        category: 'Academic, University & PDDIKTI Records',
        title: 'Google Scholar, SINTA, Garuda & Thesis Advisors (Dosen Pembimbing)',
        query: `(${nameOrShort} OR "${fam}") (site:scholar.google.com OR site:garuda.kemdikbud.go.id OR site:sinta.kemdikbud.go.id OR intext:"Dosen Pembimbing" OR intext:"Jurusan" OR intext:"Fakultas")`,
        desc: 'Finds academic journals, co-authors, thesis supervisors (dosen pembimbing), and faculty affiliations.',
      },
      {
        id: 'gov-decrees-sk',
        category: 'Official Decrees (.go.id), Rosters & Leaked CVs',
        title: 'Government Decrees (.go.id), SK, Civil Service & Court Records',
        query: `(${nameOrShort} OR "${fam}") (site:go.id OR intext:"Surat Keputusan" OR intext:"Lampiran" OR intext:"Pengumuman" OR intext:"Daftar Peserta")`,
        desc: 'Hunts official government websites (.go.id), ministerial decrees (SK), CPNS/BUMN selection rosters, and public registries.',
      },
      {
        id: 'doc-roster-leak',
        category: 'Official Decrees (.go.id), Rosters & Leaked CVs',
        title: 'Indexed PDF / XLSX / DOCX CVs, Phone Numbers (+62/08) & Rosters',
        query: activeFullName
          ? `(${nameOrShort} OR "${h}"${em ? ` OR "${em}"` : ''}) (filetype:pdf OR filetype:xlsx OR filetype:docx)`
          : `"${h}" (filetype:pdf OR filetype:xlsx OR filetype:docx OR filetype:txt)`,
        desc: 'Hunts for leaked resumes/CVs, phone numbers, university student lists, event participant rosters, or employee spreadsheets.',
      },
      {
        id: 'ig-bypass',
        category: 'Private Account Comment & Tag Bypass',
        title: 'Instagram Private Account Public Comments & Mentions',
        query: `site:instagram.com "${h}" -inurl:instagram.com/${h}`,
        desc: 'Excludes the target profile URL so results are 100% public posts/comments from friends mentioning or replying to the private IG handle.',
      },
      {
        id: 'ig-posts-reels',
        category: 'Private Account Comment & Tag Bypass',
        title: 'Instagram Public Posts & Reels Comments / Friend Tags',
        query: `site:instagram.com/p/ "${h}" OR site:instagram.com/reel/ "${h}"`,
        desc: 'Finds public photo posts (/p/) and Reels (/reel/) where the target commented or was tagged in captions.',
      },
      {
        id: 'tiktok-bypass',
        category: 'Private Account Comment & Tag Bypass',
        title: 'TikTok Public Video Replies, Duets & Mentions',
        query: `site:tiktok.com "${h}" -inurl:"@${h}"`,
        desc: 'Finds public TikTok comment sections and video captions mentioning or replying to the handle.',
      },
      {
        id: 'x-bypass',
        category: 'Private Account Comment & Tag Bypass',
        title: 'X / Twitter External Replies to Protected Account',
        query: `(site:x.com OR site:twitter.com) "${h}" -inurl:${h}/status`,
        desc: 'Uncovers replies from public accounts talking to or tagging a protected/private X account.',
      },
      {
        id: 'paste-code-leak',
        category: 'Public Archives & Bio Aggregators',
        title: 'Linktree, Carrd, Pastebin & Forum Bio Leaks',
        query: `(site:linktr.ee OR site:carrd.co OR site:pastebin.com OR site:t.me OR site:reddit.com) (${activeFullName ? `${nameOrShort} OR "${h}"` : `"${h}"`})`,
        desc: 'Searches Linktree/Carrd bio hubs, Telegram channels, Reddit discussions, and paste sites for the target name or handle.',
      },
    ];
  }, [activeHandle, activeFullName, activeNameTokens, activeOrg, dossier.emails]);

  // Extractable sub-leads from the currently selected node for 1-click "+ Spawn on Board"
  const spawnableNodeLeads = useMemo(() => {
    if (!selectedNode?.metadata) return [];
    const meta = selectedNode.metadata;
    const leads: Array<{ key: string; label: string; value: string; type: EntityType }> = [];

    if (typeof meta.email === 'string' && meta.email.includes('@')) {
      leads.push({ key: 'email', label: 'Email', value: meta.email, type: 'email' });
    }
    if (typeof meta.twitter_username === 'string' && meta.twitter_username.trim()) {
      leads.push({
        key: 'twitter',
        label: 'X / Twitter Handle',
        value: meta.twitter_username.replace(/^@/, ''),
        type: 'username',
      });
    }
    if (typeof meta.blog === 'string' && meta.blog.trim()) {
      const cleanDom = meta.blog.replace(/^https?:\/\//i, '').split('/')[0];
      if (cleanDom.includes('.')) {
        leads.push({ key: 'blog', label: 'Personal Website', value: cleanDom, type: 'domain' });
      }
    }
    if (typeof meta.company === 'string' && meta.company.trim()) {
      leads.push({
        key: 'company',
        label: 'Organization / Campus',
        value: meta.company.trim(),
        type: 'organization',
      });
    }
    if (typeof meta.location === 'string' && meta.location.trim()) {
      leads.push({
        key: 'location',
        label: 'Location',
        value: meta.location.trim(),
        type: 'location',
      });
    }
    return leads;
  }, [selectedNode]);

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
      className="w-[380px] max-h-[calc(100vh-88px)] flex flex-col bg-[#0F1219]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden text-xs text-slate-200 z-20"
    >
      {/* Top Navigation Segmented Bar */}
      <div className="px-3 py-2 bg-[#131720] border-b border-white/[0.07] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 font-mono text-[10px] bg-[#090B10] p-0.5 rounded-lg border border-white/[0.06] flex-1">
          <button
            type="button"
            onClick={() => onTabChange('node')}
            className={`flex-1 py-1 px-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition-all ${
              activeTab === 'node'
                ? 'bg-white/[0.09] text-white border border-white/[0.08] shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Crosshair className="w-3 h-3 text-sky-400" />
            <span>Lead</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('dorks')}
            data-testid="tab-dork-matrix"
            className={`flex-1 py-1 px-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition-all ${
              activeTab === 'dorks'
                ? 'bg-white/[0.09] text-white border border-white/[0.08] shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Radar className="w-3 h-3 text-sky-400" />
            <span>Dork Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('ai')}
            data-testid="tab-ai-detective"
            className={`flex-1 py-1 px-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition-all ${
              activeTab === 'ai'
                ? 'bg-white/[0.09] text-white border border-white/[0.08] shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>AI</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('pin')}
            data-testid="tab-pin-clue"
            className={`flex-1 py-1 px-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition-all ${
              activeTab === 'pin'
                ? 'bg-white/[0.09] text-white border border-white/[0.08] shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Pin className="w-3 h-3 text-amber-400" />
            <span>Pin</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* TAB 1: NODE LEAD INSPECTOR & STICKY NOTES */}
        {activeTab === 'node' && (
          <>
            {selectedNode ? (
              <div className="space-y-3.5">
                {/* Node Identity Header */}
                <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2.5">
                  <div className="flex items-start gap-3">
                    {selectedAvatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedAvatar}
                        alt={selectedNode.label}
                        className="w-8 h-8 max-w-[32px] max-h-[32px] rounded-lg object-cover border border-white/[0.12] flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/25 font-medium">
                          {selectedNode.type}
                        </span>
                        {typeof selectedNode.metadata?.platform === 'string' && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/[0.07]">
                            {selectedNode.metadata.platform}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-100 mt-1 truncate">
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
                      className="flex-1 py-1.5 px-2.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 font-mono text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedKey === 'node-val' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy Value</span>
                        </>
                      )}
                    </button>
                    {selectedProfileUrl && (
                      <a
                        href={selectedProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 px-2.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-mono text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Profile</span>
                      </a>
                    )}
                  </div>

                  {/* Reverse Image Search if node has an avatar */}
                  {selectedAvatar && (
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                        <Camera className="w-3 h-3 text-sky-400" />
                        Reverse Photo:
                      </span>
                      <div className="flex items-center gap-1">
                        <a
                          href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(selectedAvatar)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-200 text-[10px] font-mono hover:bg-white/[0.08]"
                        >
                          Lens ↗
                        </a>
                        <a
                          href={`https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(selectedAvatar)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-200 text-[10px] font-mono hover:bg-white/[0.08]"
                        >
                          Yandex ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* 1-Click Lead-Chaining Actions on Selected Node */}
                <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <Play className="w-3 h-3 text-sky-400" />
                    <span>Chain Next OSINT Step From This Lead</span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {(selectedNode.type === 'username' ||
                      selectedNode.type === 'associate' ||
                      selectedNode.type === 'organization' ||
                      selectedNode.type === 'location') && (
                      <>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, [
                              'deep_profile_extractor',
                              'connection_mapper',
                              'social_presence_scanner',
                            ])
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 font-mono text-[11px] font-semibold flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                            <span>Full Deep Sweep (Profile, Family Clan, Academic & 66+ Sites)</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-sky-300" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, ['deep_profile_extractor'])
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Fingerprint className="w-3.5 h-3.5 text-sky-400" />
                            <span>Extract Deep Profile, Academic & Career Leads</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() => onRunModuleOnNode(selectedNode, ['connection_mapper'])}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Map Family Clan, Relatives & Mutual Circle</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, ['social_presence_scanner'])
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-sky-400" />
                            <span>Scan Handle / Derived Handles Across 66+ Platforms</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </>
                    )}

                    {selectedNode.type === 'email' && (
                      <>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() => onRunModuleOnNode(selectedNode, ['email_correlator'])}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-amber-400" />
                            <span>Lookup Gravatar, OpenPGP & GitHub</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, ['breach_credential_hunter'])
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            <span>Check Email in Data Breaches</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </>
                    )}

                    {(selectedNode.type === 'domain' || selectedNode.type === 'subdomain') && (
                      <button
                        type="button"
                        disabled={isScanning}
                        onClick={() =>
                          onRunModuleOnNode(selectedNode, [
                            'subdomain_dns_resolver',
                            'ip_threat_intel',
                          ])
                        }
                        className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-sky-400" />
                          <span>Enumerate Subdomains, DNS & Origin IPs</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onTabChange('dorks')}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Radar className="w-3.5 h-3.5 text-sky-400" />
                        <span>Generate Private Account Bypass Dorks</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Confidence Tagging & Investigator Sticky Notes */}
                <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <StickyNote className="w-3 h-3 text-amber-400" />
                    <span>Confidence Status & Detective Notes</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateNodeAnnotation(selectedNode.id, { confidence: 'verified' })
                      }
                      className={`py-1.5 px-2 rounded-md border flex items-center justify-center gap-1 font-medium transition-colors ${
                        selectedNode.confidence === 'verified'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#090B10] border-white/[0.06] text-slate-400 hover:text-slate-200'
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
                      className={`py-1.5 px-2 rounded-md border flex items-center justify-center gap-1 font-medium transition-colors ${
                        selectedNode.confidence === 'suspected'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-[#090B10] border-white/[0.06] text-slate-400 hover:text-slate-200'
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
                      className={`py-1.5 px-2 rounded-md border flex items-center justify-center gap-1 font-medium transition-colors ${
                        selectedNode.confidence === 'false_positive'
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          : 'bg-[#090B10] border-white/[0.06] text-slate-400 hover:text-slate-200'
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
                    className="w-full rounded-lg bg-[#090B10] border border-white/[0.08] focus:border-sky-400/60 outline-none p-2 text-[11px] text-slate-200 font-mono placeholder:text-slate-500"
                  />
                </div>

                {/* Extracted Sub-Leads with 1-Click "+ Spawn on Board" */}
                {spawnableNodeLeads.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                      Extracted Leads from This Node
                    </div>
                    <div className="space-y-1.5">
                      {spawnableNodeLeads.map((item) => (
                        <div
                          key={`${item.key}-${item.value}`}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#090B10] border border-white/[0.06]"
                        >
                          <div className="min-w-0">
                            <div className="text-[9px] font-mono text-slate-400 uppercase">
                              {item.label}
                            </div>
                            <div className="text-[11px] font-mono font-medium text-slate-100 truncate">
                              {item.value}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onAddManualLead(
                                item.type,
                                item.value,
                                `${item.label}: ${item.value}`,
                                selectedNode.id,
                                `Extracted from ${selectedNode.label}`
                              )
                            }
                            className="px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-mono text-[10px] font-medium flex-shrink-0 transition-colors"
                          >
                            + Spawn on Board
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Metadata Table */}
                {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                  <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
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
                            className="flex items-start justify-between gap-2 text-[10px] font-mono py-1 border-b border-white/[0.05] last:border-none"
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
              <div className="p-5 rounded-xl bg-[#131720]/70 border border-white/[0.06] text-center space-y-2">
                <Search className="w-5 h-5 text-sky-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-100">No Evidence Card Selected</div>
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
          <div className="space-y-3" data-testid="dork-matrix-panel">
            <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.08] space-y-2">
              <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5 text-sky-400" />
                <span>Tactical Google Dork Matrix</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Even if a target&apos;s Instagram, TikTok, or X account is <strong className="text-slate-200">Private</strong>,
                their comments on friends&apos; public posts and public tags remain indexed by Google.
              </p>
              <div className="pt-1">
                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                  Target Handle for Dork Injection:
                </label>
                <input
                  type="text"
                  value={customDorkHandle}
                  onChange={(e) => setCustomDorkHandle(e.target.value)}
                  placeholder={`Default: ${activeHandle}`}
                  className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {tacticalDorks.map((dork) => (
                <div
                  key={dork.id}
                  className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] hover:border-white/[0.14] space-y-2 transition-colors"
                >
                  <div className="text-[9px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                    {dork.category}
                  </div>
                  <div className="text-xs font-semibold text-slate-100">{dork.title}</div>
                  <div className="text-[10px] text-slate-400 leading-relaxed">{dork.desc}</div>
                  <div className="p-2 rounded-md bg-[#090B10] border border-white/[0.06] font-mono text-[10px] text-slate-200 break-all select-all">
                    {dork.query}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => copyText(dork.id, dork.query)}
                      className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 font-mono text-[10px] flex items-center gap-1 transition-colors"
                    >
                      {copiedKey === dork.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy Query</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => launchGoogleDork(dork.query)}
                      className="flex-1 py-1 px-2.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-mono text-[10px] font-medium flex items-center justify-center gap-1 transition-colors"
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
          <div className="space-y-3" data-testid="ai-detective-panel">
            {/* BYOK Token & Provider Bar */}
            <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-100">AI OSINT Detective</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowByokForm((prev) => !prev)}
                  data-testid="btn-toggle-byok"
                  className="px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.09] font-mono text-[10px] font-medium flex items-center gap-1 transition-colors"
                >
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  <span>{aiConfig.apiKey ? 'Key Active' : 'Set AI Token'}</span>
                </button>
              </div>

              {showByokForm && (
                <div className="p-2.5 rounded-lg bg-[#090B10] border border-white/[0.07] space-y-2">
                  <div className="text-[10px] font-mono text-slate-400">
                    Bring-Your-Own-Key (stored locally in your browser):
                  </div>
                  <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                    {(['gemini', 'groq', 'openai', 'ollama'] as AIProviderType[]).map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => onUpdateAiConfig({ ...aiConfig, provider: prov })}
                        className={`py-1 rounded border uppercase font-medium transition-colors ${
                          aiConfig.provider === prov
                            ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                            : 'bg-[#131720] border-white/[0.06] text-slate-400 hover:text-slate-200'
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
                      className="w-full px-2.5 py-1.5 rounded-md bg-[#131720] border border-white/[0.09] text-xs font-mono text-white outline-none focus:border-sky-400/60"
                    />
                  )}
                  <input
                    type="text"
                    value={aiConfig.modelOverride || ''}
                    onChange={(e) =>
                      onUpdateAiConfig({ ...aiConfig, modelOverride: e.target.value })
                    }
                    placeholder="Optional model override (e.g. llama-3.3-70b-versatile)"
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#131720] border border-white/[0.09] text-[11px] font-mono text-slate-200 outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                disabled={isAIAnalyzing}
                onClick={() => onRunAIAnalysis()}
                className="w-full py-1.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
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
                  <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                      Predicted Alternate Handles & Emails
                    </div>
                    <div className="space-y-1.5">
                      {aiReport.predictedLeads.map((lead, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#090B10] border border-white/[0.06]"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-semibold text-slate-100 truncate">
                              {lead.value}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate tabular-nums">
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
                            className="px-2 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-mono text-[10px] font-medium flex-shrink-0 transition-colors"
                          >
                            Hunt →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Suggested Custom Dorks */}
                {aiReport.suggestedDorks && aiReport.suggestedDorks.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                      AI-Crafted Tactical Dorks
                    </div>
                    <div className="space-y-2">
                      {aiReport.suggestedDorks.map((dork, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-[#090B10] border border-white/[0.06] space-y-1.5"
                        >
                          <div className="text-[11px] font-semibold text-slate-100">
                            {dork.title}
                          </div>
                          <div className="text-[10px] text-slate-400">{dork.description}</div>
                          <div className="font-mono text-[10px] text-sky-300 break-all select-all">
                            {dork.query}
                          </div>
                          <button
                            type="button"
                            onClick={() => launchGoogleDork(dork.query)}
                            className="w-full py-1 px-2 rounded bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-200 font-mono text-[10px] font-medium"
                          >
                            Launch Google Dork ↗
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Executive Dossier Synthesis */}
                <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="uppercase font-semibold text-sky-400">
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
            className="p-3.5 rounded-xl bg-[#131720] border border-white/[0.07] space-y-3"
          >
            <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
              <Pin className="w-3.5 h-3.5 text-amber-400" />
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
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
              >
                <option value="username">Username or Full Real Name (e.g. Almakius Felix...)</option>
                <option value="email">Email Address</option>
                <option value="associate">Associate / Family / Relative</option>
                <option value="organization">Company / University / Family Surname</option>
                <option value="location">City / Location</option>
                <option value="domain">Personal / Work Website</option>
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
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
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
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
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
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
              />
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-slate-100 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Pin className="w-3.5 h-3.5 text-amber-400" />
                <span>Pin Clue onto Board & Connect</span>
              </button>

              <button
                type="button"
                disabled={!pinValue.trim() || isScanning}
                onClick={() => {
                  const val = pinValue.trim();
                  if (!val) return;
                  onAddManualLead(
                    pinType,
                    val,
                    pinLabel || undefined,
                    selectedNode?.id,
                    pinNotes || undefined
                  );
                  setPinValue('');
                  setPinLabel('');
                  setPinNotes('');
                  onTabChange('node');
                  onPivotLead(val, pinType, undefined, selectedNode?.id);
                }}
                className="w-full py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Pin Clue & Immediately Chain Deep OSINT Scan →</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
