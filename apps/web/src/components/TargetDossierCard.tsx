'use client';

import React, { useState } from 'react';
import {
  User,
  Mail,
  MapPin,
  Building2,
  Globe,
  Users,
  Clock,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowRight,
  Camera,
  Fingerprint,
  Layers,
  Radar,
  Copy,
  Check,
  ImagePlus,
} from 'lucide-react';
import { TargetDossier, EntityType } from '@iseeyou/shared-types';

interface TargetDossierCardProps {
  dossier: TargetDossier;
  targetType: EntityType;
  riskScore: number;
  isScanning: boolean;
  onPivotLead: (value: string, type: EntityType, modules?: string[]) => void;
  onOpenDorkMatrix: () => void;
  isCollapsedControlled?: boolean;
  onToggleCollapse?: () => void;
}

export function TargetDossierCard({
  dossier,
  targetType,
  riskScore,
  isScanning,
  onPivotLead,
  onOpenDorkMatrix,
  isCollapsedControlled,
  onToggleCollapse,
}: TargetDossierCardProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed =
    isCollapsedControlled !== undefined ? isCollapsedControlled : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const [activeTab, setActiveTab] = useState<'dossier' | 'circle' | 'timeline'>('dossier');
  const [selectedAvatarIdx, setSelectedAvatarIdx] = useState(0);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const activeAvatar =
    customPhotoUrl.trim() ||
    dossier.avatars[selectedAvatarIdx] ||
    dossier.avatars[0] ||
    null;
  const primaryName = dossier.fullNames[0] || dossier.primaryTarget;

  const openReverseImageSearch = (
    engine: 'lens' | 'yandex' | 'bing' | 'tineye',
    imageUrl: string
  ) => {
    const encoded = encodeURIComponent(imageUrl);
    const urls = {
      lens: `https://lens.google.com/uploadbyurl?url=${encoded}`,
      yandex: `https://yandex.com/images/search?rpt=imageview&url=${encoded}`,
      bing: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encoded}`,
      tineye: `https://tineye.com/search?url=${encoded}`,
    };
    window.open(urls[engine], '_blank', 'noopener,noreferrer');
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedItem(key);
    setTimeout(() => setCopiedItem(null), 1500);
  };

  return (
    <aside
      data-testid="target-dossier-card"
      className="w-[335px] max-h-[calc(100vh-88px)] flex flex-col bg-[#0F1219]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden text-xs text-slate-200 select-none z-20 transition-all"
    >
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-[#131720] border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Fingerprint className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
          <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-slate-100 truncate">
            Target Dossier
          </span>
          {isScanning && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono">
              ACTIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPhotoInput((prev) => !prev)}
            className={`p-1 rounded-md transition-colors ${
              showPhotoInput
                ? 'bg-sky-500/20 text-sky-300'
                : 'hover:bg-white/[0.06] text-slate-400 hover:text-white'
            }`}
            title="Paste custom target photo URL for Reverse Image Search"
          >
            <ImagePlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
            title={isCollapsed ? 'Expand Dossier' : 'Minimize Dossier'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Target Identity Hero Section */}
          <div className="p-3.5 border-b border-white/[0.06] bg-[#0B0E14]/60">
            <div className="flex items-start gap-3">
              {/* Avatar with Subtle Frame */}
              <div className="relative group flex-shrink-0">
                {activeAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeAvatar}
                    alt={primaryName}
                    className="w-13 h-13 rounded-lg object-cover border border-white/[0.14] shadow-md bg-[#131720]"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[#141821] border border-white/[0.09] flex items-center justify-center text-sky-300 font-semibold text-base font-mono">
                    {primaryName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-sm font-semibold text-slate-100 truncate">{primaryName}</div>
                  <button
                    type="button"
                    onClick={() => handleCopyText('primary-name', primaryName)}
                    className="p-0.5 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
                    title="Copy target name/handle"
                  >
                    {copiedItem === 'primary-name' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <div className="text-[11px] text-sky-400 font-mono truncate">
                  {targetType === 'username' ? `@${dossier.primaryTarget}` : dossier.primaryTarget}
                </div>

                {/* Discovered Aliases / Full Names */}
                {dossier.fullNames.length > 1 && (
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    AKA: {dossier.fullNames.slice(1).join(', ')}
                  </div>
                )}

                {/* Location & Affiliation Badges */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {dossier.locations.slice(0, 2).map((loc) => (
                    <span
                      key={loc}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.07]"
                    >
                      <MapPin className="w-2.5 h-2.5 text-slate-400" />
                      <span className="truncate max-w-[115px]">{loc}</span>
                    </span>
                  ))}
                  {dossier.organizations.slice(0, 2).map((org) => (
                    <span
                      key={org}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.07]"
                    >
                      <Building2 className="w-2.5 h-2.5 text-amber-400/80" />
                      <span className="truncate max-w-[115px]">{org}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Multi-Avatar Switcher (if multiple avatars discovered across platforms) */}
            {dossier.avatars.length > 1 && !customPhotoUrl && (
              <div className="mt-2.5 flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-slate-400">Avatars:</span>
                {dossier.avatars.slice(0, 5).map((av, idx) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setSelectedAvatarIdx(idx)}
                    className={`w-6 h-6 rounded overflow-hidden border transition-all ${
                      selectedAvatarIdx === idx
                        ? 'border-sky-400 ring-1 ring-sky-400/40'
                        : 'border-white/[0.1] opacity-60 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={av} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Optional Custom Photo URL Input for Reverse Image Search */}
            {showPhotoInput && (
              <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] space-y-1.5">
                <label className="block text-[10px] font-mono text-slate-400">
                  Paste Target Photo URL (IG / LinkedIn / Avatar):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    value={customPhotoUrl}
                    onChange={(e) => setCustomPhotoUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 px-2 py-1 rounded bg-[#090B10] border border-white/[0.1] text-[11px] font-mono text-slate-100 outline-none focus:border-sky-400/60"
                  />
                  {customPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomPhotoUrl('')}
                      className="px-2 py-1 rounded bg-white/[0.05] text-[10px] font-mono text-slate-400 hover:text-white"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 1-Click Reverse Image Search Bar */}
            {activeAvatar && (
              <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
                <div className="text-[10px] font-mono text-slate-400 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3 h-3 text-sky-400" />
                    <span>Reverse Avatar Lookup:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openReverseImageSearch('tineye', activeAvatar)}
                    className="text-[9px] text-sky-400 hover:underline"
                  >
                    TinEye ↗
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => openReverseImageSearch('lens', activeAvatar)}
                    className="px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 hover:text-white text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition-colors"
                    title="Find other accounts using this photo via Google Lens"
                  >
                    <Search className="w-2.5 h-2.5 text-sky-400" />
                    <span>Google Lens</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openReverseImageSearch('yandex', activeAvatar)}
                    className="px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 hover:text-white text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition-colors"
                    title="Face & photo matching via Yandex Images"
                  >
                    <Search className="w-2.5 h-2.5 text-amber-400" />
                    <span>Yandex</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openReverseImageSearch('bing', activeAvatar)}
                    className="px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 hover:text-white text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition-colors"
                    title="Visual search via Bing Images"
                  >
                    <Search className="w-2.5 h-2.5 text-slate-400" />
                    <span>Bing</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sub-Navigation Tabs: Leads | Circle | History */}
          <div className="grid grid-cols-3 border-b border-white/[0.07] bg-[#131720]/70 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('dossier')}
              className={`py-2 px-1 flex items-center justify-center gap-1.5 font-medium border-b-2 transition-colors tabular-nums ${
                activeTab === 'dossier'
                  ? 'border-sky-400 text-white bg-white/[0.03]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3 text-sky-400" />
              <span>Leads ({dossier.emails.length + dossier.socialProfiles.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('circle')}
              className={`py-2 px-1 flex items-center justify-center gap-1.5 font-medium border-b-2 transition-colors tabular-nums ${
                activeTab === 'circle'
                  ? 'border-sky-400 text-white bg-white/[0.03]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3 h-3 text-emerald-400" />
              <span>Circle ({dossier.associates.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`py-2 px-1 flex items-center justify-center gap-1.5 font-medium border-b-2 transition-colors tabular-nums ${
                activeTab === 'timeline'
                  ? 'border-sky-400 text-white bg-white/[0.03]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3 h-3 text-slate-400" />
              <span>History ({dossier.timeline.length})</span>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 select-text">
            {activeTab === 'dossier' && (
              <>
                {/* Bio Quotes */}
                {dossier.bios.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Captured Bio
                    </div>
                    {dossier.bios.slice(0, 2).map((b, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-[#131720] border border-white/[0.06] text-[11px] text-slate-300 leading-relaxed"
                      >
                        &ldquo;{b.text}&rdquo;
                        <span className="block text-[9px] text-slate-400 font-mono mt-1">
                          via {b.platform}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Extracted Emails (With 1-Click Trace / Pivot Button) */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-amber-400" />
                      Extracted Emails ({dossier.emails.length})
                    </span>
                  </div>
                  {dossier.emails.length === 0 ? (
                    <div className="text-[11px] text-slate-500 bg-[#131720]/50 rounded-lg p-2.5 border border-white/[0.05]">
                      No emails uncovered yet. Run <strong className="text-slate-300">Deep Profile</strong> to scan GitHub commits.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {dossier.emails.map((em) => (
                        <div
                          key={em}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#131720] border border-white/[0.08]"
                        >
                          <span className="font-mono text-[11px] text-amber-200/90 truncate">
                            {em}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyText(em, em)}
                              className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white"
                              title="Copy email"
                            >
                              {copiedItem === em ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onPivotLead(em, 'email', [
                                  'email_correlator',
                                  'breach_credential_hunter',
                                ])
                              }
                              className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-[10px] font-mono font-medium flex items-center gap-1 transition-colors"
                              title="Trace this email across Gravatar, PGP Keyservers, GitHub & HIBP Breaches"
                            >
                              <span>Trace</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Personal / Organization Domains */}
                {dossier.domains.length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1.5 flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-sky-400" />
                      <span>Linked Domains ({dossier.domains.length})</span>
                    </div>
                    <div className="space-y-1">
                      {dossier.domains.map((dom) => (
                        <div
                          key={dom}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#131720] border border-white/[0.08]"
                        >
                          <span className="font-mono text-[11px] text-sky-200 truncate">
                            {dom}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onPivotLead(dom, 'domain', [
                                'subdomain_dns_resolver',
                                'ip_threat_intel',
                              ])
                            }
                            className="px-2 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 text-[10px] font-mono font-medium flex items-center gap-1 transition-colors"
                          >
                            <span>Scan Web</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discovered Social & Community Profiles */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1.5 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-sky-400" />
                    <span>Confirmed Accounts ({dossier.socialProfiles.length})</span>
                  </div>
                  {dossier.socialProfiles.length === 0 ? (
                    <div className="text-[11px] text-slate-400 bg-[#131720]/50 rounded-lg p-2.5 border border-white/[0.05]">
                      Run a scan to enumerate social & developer profiles.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {dossier.socialProfiles.map((prof) => (
                        <a
                          key={prof.nodeId}
                          href={prof.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2 rounded-lg bg-[#131720] hover:bg-white/[0.05] border border-white/[0.07] hover:border-sky-500/30 transition-colors group"
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold text-slate-200 truncate">
                              {prof.platform}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono truncate">
                              @{prof.handle}
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-sky-400 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Button to Open Private Account Comment Bypass Dorks */}
                <button
                  type="button"
                  onClick={onOpenDorkMatrix}
                  className="w-full py-2 px-3 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 text-sky-300 font-mono text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                >
                  <Radar className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open Private Account Dork Matrix</span>
                </button>
              </>
            )}

            {activeTab === 'circle' && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">Mutuals & Co-Authors (Inner Circle):</strong> Click{' '}
                  <span className="text-emerald-400">Hunt</span> to pivot the investigation onto any close associate.
                </div>
                {dossier.associates.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-[#131720]/70 border border-white/[0.06] text-center space-y-2">
                    <Users className="w-5 h-5 text-slate-400 mx-auto" />
                    <div className="text-[11px] text-slate-400">
                      No mutual connections mapped yet.
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onPivotLead(dossier.primaryTarget, 'username', ['connection_mapper'])
                      }
                      className="px-3 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] text-slate-200 text-[10px] font-mono font-medium"
                    >
                      Run Mutual Circle Mapper
                    </button>
                  </div>
                ) : (
                  dossier.associates.map((assoc) => (
                    <div
                      key={assoc.handle}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#131720] border border-white/[0.07] hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {assoc.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={assoc.avatarUrl}
                            alt={assoc.handle}
                            className="w-7 h-7 rounded-full object-cover border border-white/[0.12] flex-shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                            {assoc.handle.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-slate-100 truncate">
                            @{assoc.handle}
                          </div>
                          <div className="text-[9px] text-emerald-400/90 font-mono truncate">
                            {assoc.relationship}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onPivotLead(assoc.handle, 'username', [
                            'deep_profile_extractor',
                            'social_presence_scanner',
                          ])
                        }
                        className="px-2.5 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-[10px] font-mono font-medium flex-shrink-0 transition-colors"
                      >
                        Hunt
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-2.5">
                <div className="text-[10px] font-mono text-slate-400">
                  Chronological Digital Footprint (earliest account creation to latest):
                </div>
                {dossier.timeline.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-[#131720]/70 border border-white/[0.06] text-center text-[11px] text-slate-400">
                    No account creation timestamps extracted yet. Run{' '}
                    <strong className="text-slate-200">Deep Profile</strong> to build the chronological footprint.
                  </div>
                ) : (
                  <div className="relative pl-4 border-l border-white/[0.12] space-y-3 py-1">
                    {dossier.timeline.map((item, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-sky-400 border-2 border-[#0F1219]" />
                        <div className="flex items-center justify-between text-[10px] font-mono text-sky-400 font-semibold tabular-nums">
                          <span>{item.year}</span>
                          {item.date && <span className="text-slate-400">{item.date}</span>}
                        </div>
                        <div className="text-[11px] text-slate-200 mt-0.5">{item.event}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Summary Strip */}
          <div className="px-3.5 py-2 bg-[#0B0E14] border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-rose-400/90" />
              <span>Breaches: {dossier.breachesCount}</span>
            </span>
            <span>Exposure Index: {riskScore}/100</span>
          </div>
        </>
      )}
    </aside>
  );
}
