'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Globe,
  Network,
  Mail,
  User,
  X,
  ArrowRight,
  ShieldAlert,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import { EntityType, sanitizeTargetInput, isBlockedInternalTarget } from '@iseeyou/shared-types';
import { classifyTarget, ENTITY_BADGE_CONFIGS } from '@/lib/classifier';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export type ReconOperatingMode = 'web' | 'identity';

export interface ModuleConfigItem {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  modes: ReconOperatingMode[];
}

export const AVAILABLE_OSINT_MODULES: ModuleConfigItem[] = [
  {
    id: 'deep_profile_extractor',
    label: 'Deep Profile & Commit Emails',
    shortLabel: 'Deep Profile',
    description: 'Extracts Real Name, Avatar, Bio, Company, Location & hidden GitHub Commit Emails',
    modes: ['identity'],
  },
  {
    id: 'connection_mapper',
    label: 'Mutual Circle & Collaborators',
    shortLabel: 'Mutuals',
    description: 'Maps 2-way mutual connections (followers ∩ following), repo co-authors & orgs',
    modes: ['identity'],
  },
  {
    id: 'email_correlator',
    label: 'Email, Gravatar & PGP Lookup',
    shortLabel: 'Gravatar/PGP',
    description: 'Pivots from Email to Gravatar profile/avatar, OpenPGP UID & GitHub commits',
    modes: ['identity'],
  },
  {
    id: 'social_presence_scanner',
    label: 'Social Accounts (16+ Sites)',
    shortLabel: '16+ Socials',
    description: 'Concurrent username reconnaissance across GitHub, Reddit, Keybase, Steam, etc.',
    modes: ['identity'],
  },
  {
    id: 'breach_credential_hunter',
    label: 'Breaches & Email Security',
    shortLabel: 'Breaches',
    description: 'Identity Mode: HIBP k-anonymity leaks | Web Mode: SPF & DMARC anti-spoofing',
    modes: ['web', 'identity'],
  },
  {
    id: 'subdomain_dns_resolver',
    label: 'Subdomains & DNS',
    shortLabel: 'DNS / Subdomains',
    description: 'CertSpotter & crt.sh CT logs + Cloudflare DoH A/AAAA/CNAME/MX',
    modes: ['web'],
  },
  {
    id: 'ip_threat_intel',
    label: 'IP & Open Ports',
    shortLabel: 'IP & Ports',
    description: 'GeoIP ASN lookup + Shodan InternetDB open ports & CVEs',
    modes: ['web'],
  },
];

interface OmniSearchBarProps {
  onScan: (target: string, type: EntityType, enabledModules?: string[]) => void;
  isScanning?: boolean;
  initialValue?: string;
  activeMode?: ReconOperatingMode;
  onModeChange?: (mode: ReconOperatingMode) => void;
  enabledModules?: string[];
  onToggleModule?: (moduleId: string) => void;
  className?: string;
}

const WEB_SAMPLE_TARGETS = [
  { value: 'example.com', type: 'domain' as EntityType, label: 'Domain (Web & DNS)' },
  { value: '1.1.1.1', type: 'ip' as EntityType, label: 'Public IP (Ports & GeoIP)' },
];

const IDENTITY_SAMPLE_TARGETS = [
  { value: 'octocat', type: 'username' as EntityType, label: 'Username (16+ Socials)' },
  { value: 'admin@corp.io', type: 'email' as EntityType, label: 'Email (Breach & Identity)' },
];

export function OmniSearchBar({
  onScan,
  isScanning = false,
  initialValue = 'example.com',
  activeMode: controlledMode,
  onModeChange,
  enabledModules: controlledModules,
  onToggleModule,
  className,
}: OmniSearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [internalMode, setInternalMode] = useState<ReconOperatingMode>('identity');
  const [internalModules, setInternalModules] = useState<string[]>([
    'deep_profile_extractor',
    'connection_mapper',
    'email_correlator',
    'social_presence_scanner',
    'breach_credential_hunter',
    'subdomain_dns_resolver',
    'ip_threat_intel',
  ]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input when initialValue changes externally (e.g. pivot)
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
    }
  }, [initialValue]);

  // Global "/" shortcut to focus the search input
  useEffect(() => {
    const handleGlobalSlash = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalSlash);
    return () => window.removeEventListener('keydown', handleGlobalSlash);
  }, []);

  // Instant deterministic entity classification
  const detectedType = useMemo(() => classifyTarget(value), [value]);
  const badgeConfig = ENTITY_BADGE_CONFIGS[detectedType] || ENTITY_BADGE_CONFIGS.domain;

  // Determine operating mode based on detectedType or manual switch
  const currentMode: ReconOperatingMode = useMemo(() => {
    if (controlledMode) return controlledMode;
    if (detectedType === 'username' || detectedType === 'email') return 'identity';
    if (detectedType === 'domain' || detectedType === 'subdomain' || detectedType === 'ip') {
      return 'web';
    }
    return internalMode;
  }, [controlledMode, detectedType, internalMode]);

  const activeModuleIds = controlledModules ?? internalModules;

  const handleToggleModule = (modId: string) => {
    if (onToggleModule) {
      onToggleModule(modId);
      return;
    }
    setInternalModules((prev) => {
      if (prev.includes(modId)) {
        const modeMods = AVAILABLE_OSINT_MODULES.filter((m) => m.modes.includes(currentMode)).map(
          (m) => m.id
        );
        const remainingInMode = prev.filter((id) => id !== modId && modeMods.includes(id));
        if (remainingInMode.length === 0) return prev;
        return prev.filter((id) => id !== modId);
      }
      return [...prev, modId];
    });
  };

  const handleSwitchMode = (mode: ReconOperatingMode) => {
    setInternalMode(mode);
    onModeChange?.(mode);
    if (mode === 'identity' && (detectedType === 'domain' || detectedType === 'ip')) {
      setValue('octocat');
    } else if (mode === 'web' && (detectedType === 'username' || detectedType === 'email')) {
      setValue('example.com');
    }
  };

  // Real-time Anti-SSRF & sanitization security check
  const ssrfCheck = useMemo(() => isBlockedInternalTarget(value), [value]);

  const modeModules = useMemo(
    () => AVAILABLE_OSINT_MODULES.filter((m) => m.modes.includes(currentMode)),
    [currentMode]
  );

  // Render icon corresponding to entity type
  const renderIcon = () => {
    switch (badgeConfig.iconName) {
      case 'Globe':
        return <Globe className="w-3 h-3 mr-1" />;
      case 'Network':
        return <Network className="w-3 h-3 mr-1" />;
      case 'Mail':
        return <Mail className="w-3 h-3 mr-1" />;
      case 'User':
        return <User className="w-3 h-3 mr-1" />;
      default:
        return null;
    }
  };

  const handleTriggerScan = () => {
    const clean = sanitizeTargetInput(value);
    if (!clean || isScanning) return;
    const check = isBlockedInternalTarget(clean);
    if (check.isBlocked) return;
    setIsFocused(false);

    const targetMode: ReconOperatingMode =
      detectedType === 'username' || detectedType === 'email' ? 'identity' : 'web';
    const validModulesForTarget = AVAILABLE_OSINT_MODULES.filter((m) =>
      m.modes.includes(targetMode)
    ).map((m) => m.id);
    const selectedForTarget = activeModuleIds.filter((id) => validModulesForTarget.includes(id));

    onScan(
      clean,
      detectedType,
      selectedForTarget.length > 0 ? selectedForTarget : validModulesForTarget
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTriggerScan();
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const samples = currentMode === 'identity' ? IDENTITY_SAMPLE_TARGETS : WEB_SAMPLE_TARGETS;

  return (
    <div ref={containerRef} className={cn('relative flex items-center gap-2', className)}>
      {/* Operating Mode Segmented Control */}
      <div
        data-testid="recon-mode-switcher"
        className="hidden xl:flex items-center bg-[#0B0E14] border border-white/[0.08] rounded-lg p-0.5 text-[11px] font-mono flex-shrink-0"
      >
        <button
          type="button"
          onClick={() => handleSwitchMode('web')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium',
            currentMode === 'web'
              ? 'bg-white/[0.08] text-white border border-white/[0.08] shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          )}
          title="Web & Infrastructure Mode (Domain, Subdomain, IP, Ports, SPF/DMARC)"
        >
          <Globe className={cn('w-3 h-3', currentMode === 'web' ? 'text-sky-400' : 'text-slate-500')} />
          <span>Web & Infra</span>
        </button>
        <button
          type="button"
          onClick={() => handleSwitchMode('identity')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium',
            currentMode === 'identity'
              ? 'bg-white/[0.08] text-white border border-white/[0.08] shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          )}
          title="Identity & Footprint Mode (Username, Email, 16+ Socials, Breaches)"
        >
          <User className={cn('w-3 h-3', currentMode === 'identity' ? 'text-sky-400' : 'text-slate-500')} />
          <span>Identity</span>
        </button>
      </div>

      {/* Main Search Input Container */}
      <div className="relative w-[390px] xl:w-[410px]">
        <div
          className={cn(
            'flex items-center bg-[#0B0E14] border rounded-lg px-3 py-1 transition-all duration-150',
            isFocused
              ? 'border-sky-400/60 ring-2 ring-sky-400/15'
              : 'border-white/[0.09] hover:border-white/[0.16]'
          )}
        >
          <Search className="w-3.5 h-3.5 text-slate-500 mr-2 flex-shrink-0" />

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              const nextVal = e.target.value;
              setValue(nextVal);
              const nextType = classifyTarget(nextVal);
              if (nextType === 'username' || nextType === 'email') {
                onModeChange?.('identity');
              } else if (nextType === 'domain' || nextType === 'ip') {
                onModeChange?.('web');
              }
            }}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Enter target: domain, IP, email, or username... (/)"
            className="bg-transparent border-none outline-none text-xs text-slate-100 w-full font-mono placeholder:text-slate-500"
          />

          {/* Clear Button */}
          {value.length > 0 && !isScanning && (
            <button
              type="button"
              onClick={() => setValue('')}
              className="text-slate-500 hover:text-slate-200 p-0.5 mr-1.5 transition-colors"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dynamic Entity Classification / Anti-SSRF Alert Badge */}
          {ssrfCheck.isBlocked ? (
            <Badge
              variant="critical"
              size="xs"
              data-testid="ssrf-blocked-badge"
              className="mr-2 flex-shrink-0 flex items-center font-semibold tracking-wider"
              title={ssrfCheck.reason}
            >
              <ShieldAlert className="w-3 h-3 mr-1 text-rose-400" />
              <span>SSRF BLOCKED</span>
            </Badge>
          ) : (
            <Badge
              variant={detectedType}
              size="xs"
              data-testid="detected-entity-badge"
              className="mr-2 flex-shrink-0 flex items-center font-medium tracking-wider"
            >
              {renderIcon()}
              <span>{badgeConfig.label}</span>
            </Badge>
          )}

          {/* Scan Button */}
          <Button
            variant="primary"
            size="xs"
            isLoading={isScanning}
            onClick={handleTriggerScan}
            disabled={!value.trim() || ssrfCheck.isBlocked}
            title={ssrfCheck.isBlocked ? ssrfCheck.reason : undefined}
            className="px-3 py-1 tracking-wide flex-shrink-0"
          >
            {isScanning ? 'Scanning' : 'Scan'}
          </Button>
        </div>

        {/* Anti-SSRF Warning Banner */}
        {ssrfCheck.isBlocked && value.trim().length > 0 && (
          <div
            data-testid="ssrf-warning-banner"
            className="absolute top-full left-0 right-0 mt-1.5 p-2.5 bg-[#141118]/98 border border-rose-500/40 rounded-lg shadow-2xl z-50 text-[11px] text-rose-200 font-mono flex items-start gap-2 backdrop-blur-md"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block text-rose-200 font-semibold">Anti-SSRF Policy Active:</strong>
              <span className="text-[10px] leading-tight block text-rose-300/80 mt-0.5">
                {ssrfCheck.reason}
              </span>
            </div>
          </div>
        )}

        {/* Quick Suggestions, Mode Switcher & Modular ON/OFF Dropdown */}
        {isFocused && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0F1219]/98 backdrop-blur-xl border border-white/[0.09] rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs">
            {/* Mode Selector inside Dropdown */}
            <div className="px-3 py-2 bg-[#141821] border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3 h-3 text-sky-400" />
                Active Mode & Modules
              </span>
              <div className="flex items-center gap-1 bg-[#090B10] p-0.5 rounded-md border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('web')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] transition-colors flex items-center gap-1',
                    currentMode === 'web'
                      ? 'bg-white/[0.09] text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <Globe className="w-2.5 h-2.5 text-sky-400" />
                  <span>Web/Infra</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('identity')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] transition-colors flex items-center gap-1',
                    currentMode === 'identity'
                      ? 'bg-white/[0.09] text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <User className="w-2.5 h-2.5 text-sky-400" />
                  <span>Identity</span>
                </button>
              </div>
            </div>

            {/* Module ON/OFF Checkboxes */}
            <div className="p-2.5 border-b border-white/[0.06] bg-[#0B0E14] space-y-1.5">
              <div className="text-[10px] text-slate-400 mb-1">
                Select active OSINT extractors for this scan:
              </div>
              {modeModules.map((mod) => {
                const isEnabled = activeModuleIds.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleToggleModule(mod.id)}
                    className={cn(
                      'w-full flex items-start justify-between p-2 rounded-lg border text-left transition-all',
                      isEnabled
                        ? 'bg-white/[0.04] border-white/[0.1] text-slate-100'
                        : 'bg-transparent border-white/[0.04] text-slate-500 hover:text-slate-300'
                    )}
                  >
                    <div className="flex items-start gap-2.5 pr-2">
                      <div
                        className={cn(
                          'w-3.5 h-3.5 rounded flex items-center justify-center mt-0.5 border flex-shrink-0 transition-colors',
                          isEnabled
                            ? 'bg-sky-500 border-sky-400 text-slate-950'
                            : 'border-white/[0.15] bg-transparent'
                        )}
                      >
                        {isEnabled && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold">{mod.label}</div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5 font-sans">
                          {mod.description}
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase flex-shrink-0',
                        isEnabled
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          : 'bg-white/[0.03] text-slate-500 border border-white/[0.06]'
                      )}
                    >
                      {isEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Target Presets */}
            <div className="px-3 py-1.5 bg-[#141821] border-b border-white/[0.06] text-[10px] text-slate-400 uppercase font-semibold tracking-wider flex items-center justify-between">
              <span>Quick {currentMode === 'identity' ? 'Identity' : 'Web'} Presets</span>
              <span className="text-[9px] lowercase text-slate-500">↵ enter to scan</span>
            </div>

            <div className="py-1 bg-[#0F1219]">
              {samples.map((sample) => (
                <button
                  key={sample.value}
                  type="button"
                  onClick={() => {
                    setValue(sample.value);
                    setIsFocused(false);
                    const validMods = modeModules.map((m) => m.id);
                    const activeForMode = activeModuleIds.filter((id) => validMods.includes(id));
                    onScan(
                      sample.value,
                      sample.type,
                      activeForMode.length > 0 ? activeForMode : validMods
                    );
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-white/[0.04] text-slate-300 hover:text-white group transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
                    <span className="font-medium text-slate-100">{sample.value}</span>
                  </div>
                  <Badge variant={sample.type} size="xs">
                    {sample.label}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline Quick Module Toggle Pills (Quiet Monochrome Surface + Crisp Sky Active Dot) */}
      <div
        data-testid="module-toggle-pills"
        className="hidden 2xl:flex items-center gap-1 flex-shrink-0"
      >
        {modeModules.map((mod) => {
          const isEnabled = activeModuleIds.includes(mod.id);
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => handleToggleModule(mod.id)}
              title={`${mod.label}: ${mod.description} (Click to toggle ON/OFF)`}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono border transition-all',
                isEnabled
                  ? 'bg-white/[0.04] border-white/[0.1] text-slate-200 hover:bg-white/[0.07]'
                  : 'bg-transparent border-white/[0.04] text-slate-500 hover:text-slate-300'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  isEnabled ? 'bg-sky-400' : 'bg-slate-700'
                )}
              />
              <span>{mod.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
