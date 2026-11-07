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
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Camera,
} from 'lucide-react';
import { TargetDossier, EntityType } from '@iseeyou/shared-types';

interface TargetDossierCardProps {
  dossier: TargetDossier;
  targetType: EntityType;
  riskScore: number;
  isScanning: boolean;
  onPivotLead: (value: string, type: EntityType, modules?: string[]) => void;
  onOpenDorkMatrix: () => void;
}

export function TargetDossierCard({
  dossier,
  targetType,
  riskScore,
  isScanning,
  onPivotLead,
  onOpenDorkMatrix,
}: TargetDossierCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'dossier' | 'circle' | 'timeline'>('dossier');

  const primaryAvatar = dossier.avatars[0] || null;
  const primaryName = dossier.fullNames[0] || dossier.primaryTarget;

  const openReverseImageSearch = (engine: 'lens' | 'yandex' | 'bing', imageUrl: string) => {
    const encoded = encodeURIComponent(imageUrl);
    const urls = {
      lens: `https://lens.google.com/uploadbyurl?url=${encoded}`,
      yandex: `https://yandex.com/images/search?rpt=imageview&url=${encoded}`,
      bing: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encoded}`,
    };
    window.open(urls[engine], '_blank', 'noopener,noreferrer');
  };

  return (
    <aside
      data-testid="target-dossier-card"
      className="w-[330px] max-h-[calc(100vh-88px)] flex flex-col bg-[#111318]/92 backdrop-blur-xl border border-slate-800/90 rounded-xl shadow-2xl overflow-hidden text-xs text-slate-200 select-none z-20 transition-all"
    >
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-indigo-950/60 via-slate-900/90 to-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-indigo-300 truncate">
            🪪 Target Dossier
          </span>
          {isScanning && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-700/60 text-sky-300 font-mono">
              HUNTING...
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title={isCollapsed ? 'Expand Dossier' : 'Minimize Dossier'}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Target Identity Hero Section */}
          <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex items-start gap-3">
              {/* Avatar with Reverse Image Search Trigger */}
              <div className="relative group flex-shrink-0">
                {primaryAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={primaryAvatar}
                    alt={primaryName}
                    className="w-14 h-14 rounded-xl object-cover border-2 border-indigo-500/50 shadow-lg bg-slate-900"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-indigo-950/50 border border-indigo-700/40 flex items-center justify-center text-indigo-300 font-bold text-lg font-mono">
                    {primaryName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{primaryName}</div>
                <div className="text-[11px] text-indigo-300 font-mono truncate">
                  {targetType === 'username' ? `@${dossier.primaryTarget}` : dossier.primaryTarget}
                </div>

                {/* Location & Affiliation Badges */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {dossier.locations.slice(0, 1).map((loc) => (
                    <span
                      key={loc}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700"
                    >
                      <MapPin className="w-2.5 h-2.5 text-rose-400" />
                      <span className="truncate max-w-[115px]">{loc}</span>
                    </span>
                  ))}
                  {dossier.organizations.slice(0, 1).map((org) => (
                    <span
                      key={org}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800/50"
                    >
                      <Building2 className="w-2.5 h-2.5 text-amber-400" />
                      <span className="truncate max-w-[115px]">{org}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 1-Click Reverse Image Search Bar (When Avatar is Discovered) */}
            {primaryAvatar && (
              <div className="mt-3 pt-2.5 border-t border-slate-800/70">
                <div className="text-[10px] font-mono text-slate-400 mb-1.5 flex items-center gap-1">
                  <Camera className="w-3 h-3 text-sky-400" />
                  <span>1-Click Avatar Reverse Image Search:</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => openReverseImageSearch('lens', primaryAvatar)}
                    className="px-2 py-1 rounded bg-sky-950/50 hover:bg-sky-900/70 border border-sky-700/50 text-sky-200 text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors"
                    title="Find other accounts using this photo via Google Lens"
                  >
                    <Search className="w-2.5 h-2.5" />
                    <span>Google Lens</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openReverseImageSearch('yandex', primaryAvatar)}
                    className="px-2 py-1 rounded bg-amber-950/50 hover:bg-amber-900/70 border border-amber-700/50 text-amber-200 text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors"
                    title="Face & photo matching via Yandex Images"
                  >
                    <Search className="w-2.5 h-2.5" />
                    <span>Yandex</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openReverseImageSearch('bing', primaryAvatar)}
                    className="px-2 py-1 rounded bg-indigo-950/50 hover:bg-indigo-900/70 border border-indigo-700/50 text-indigo-200 text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors"
                    title="Visual search via Bing Images"
                  >
                    <Search className="w-2.5 h-2.5" />
                    <span>Bing</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sub-Navigation Tabs: Dossier | Inner Circle | Timeline */}
          <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-900/70 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('dossier')}
              className={`py-2 text-center font-semibold border-b-2 transition-colors ${
                activeTab === 'dossier'
                  ? 'border-indigo-400 text-white bg-indigo-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              📋 Leads ({dossier.emails.length + dossier.socialProfiles.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('circle')}
              className={`py-2 text-center font-semibold border-b-2 transition-colors ${
                activeTab === 'circle'
                  ? 'border-indigo-400 text-white bg-indigo-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              👥 Circle ({dossier.associates.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`py-2 text-center font-semibold border-b-2 transition-colors ${
                activeTab === 'timeline'
                  ? 'border-indigo-400 text-white bg-indigo-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              ⏳ History ({dossier.timeline.length})
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 select-text">
            {activeTab === 'dossier' && (
              <>
                {/* Bio Quotes */}
                {dossier.bios.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Captured Bio / Status
                    </div>
                    {dossier.bios.slice(0, 2).map((b, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 italic"
                      >
                        &ldquo;{b.text}&rdquo;
                        <span className="block not-italic text-[9px] text-indigo-400 font-mono mt-0.5">
                          — via {b.platform}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Extracted Emails (With 1-Click Trace / Pivot Button) */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-amber-400" />
                      Extracted Emails ({dossier.emails.length})
                    </span>
                  </div>
                  {dossier.emails.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic bg-slate-900/40 rounded p-2 border border-slate-800/60">
                      No emails uncovered yet. Run <strong>🧬 Deep Profile</strong> to scan GitHub commits.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {dossier.emails.map((em) => (
                        <div
                          key={em}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-950/25 border border-amber-700/40"
                        >
                          <span className="font-mono text-[11px] text-amber-200 truncate">
                            {em}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onPivotLead(em, 'email', [
                                'email_correlator',
                                'breach_credential_hunter',
                              ])
                            }
                            className="px-2 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-[10px] font-mono font-bold flex items-center gap-1 flex-shrink-0 transition-colors"
                            title="Trace this email across Gravatar, PGP Keyservers, GitHub & HIBP Breaches"
                          >
                            <span>Trace</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Personal / Organization Domains */}
                {dossier.domains.length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-sky-400" />
                      <span>Linked Domains ({dossier.domains.length})</span>
                    </div>
                    <div className="space-y-1">
                      {dossier.domains.map((dom) => (
                        <div
                          key={dom}
                          className="flex items-center justify-between p-1.5 rounded bg-sky-950/25 border border-sky-800/40"
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
                            className="px-2 py-0.5 rounded bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 text-[10px] font-mono font-semibold flex items-center gap-1"
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
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                    <User className="w-3 h-3 text-purple-400" />
                    <span>Confirmed Accounts ({dossier.socialProfiles.length})</span>
                  </div>
                  {dossier.socialProfiles.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic bg-slate-900/40 rounded p-2 border border-slate-800/60">
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
                          className="flex items-center justify-between p-1.5 rounded bg-slate-900/90 hover:bg-indigo-950/50 border border-slate-800 hover:border-indigo-500/40 transition-colors group"
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-slate-200 truncate">
                              {prof.platform}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono truncate">
                              @{prof.handle}
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-indigo-300 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Button to Open Private Account Comment Bypass Dorks */}
                <button
                  type="button"
                  onClick={onOpenDorkMatrix}
                  className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-500/50 text-indigo-200 font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                  <span>🕵️ Open Private Account Dork Matrix</span>
                </button>
              </>
            )}

            {activeTab === 'circle' && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-slate-400 leading-relaxed">
                  <strong>Mutuals & Co-Authors (&ldquo;Dia kenal siapa aja&rdquo;):</strong> Click{' '}
                  <span className="text-emerald-300">Hunt</span> to pivot the investigation onto any close associate.
                </div>
                {dossier.associates.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-center space-y-2">
                    <Users className="w-5 h-5 text-slate-500 mx-auto" />
                    <div className="text-[11px] text-slate-400">
                      No mutual connections mapped yet.
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onPivotLead(dossier.primaryTarget, 'username', ['connection_mapper'])
                      }
                      className="px-3 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-200 text-[10px] font-mono font-bold"
                    >
                      👥 Run Mutual Circle Mapper
                    </button>
                  </div>
                ) : (
                  dossier.associates.map((assoc) => (
                    <div
                      key={assoc.handle}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-emerald-600/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {assoc.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={assoc.avatarUrl}
                            alt={assoc.handle}
                            className="w-7 h-7 rounded-full object-cover border border-emerald-500/40 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {assoc.handle.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">
                            @{assoc.handle}
                          </div>
                          <div className="text-[9px] text-emerald-400 font-mono truncate">
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
                        className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-800/80 border border-emerald-600/50 text-emerald-200 text-[10px] font-mono font-bold flex-shrink-0 transition-colors"
                      >
                        🎯 Hunt
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
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-center text-[11px] text-slate-400">
                    No account creation timestamps extracted yet. Run{' '}
                    <strong>🧬 Deep Profile</strong> to build the chronological footprint.
                  </div>
                ) : (
                  <div className="relative pl-4 border-l-2 border-indigo-500/40 space-y-3 py-1">
                    {dossier.timeline.map((item, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-400 border-2 border-[#111318]" />
                        <div className="flex items-center justify-between text-[10px] font-mono text-indigo-300 font-bold">
                          <span>{item.year}</span>
                          {item.date && <span className="text-slate-500">{item.date}</span>}
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
          <div className="px-3.5 py-2 bg-slate-950/90 border-t border-slate-800/90 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span>Breaches: {dossier.breachesCount}</span>
            </span>
            <span>Exposure Index: {riskScore}/100</span>
          </div>
        </>
      )}
    </aside>
  );
}

