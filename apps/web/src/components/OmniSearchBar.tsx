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
    shortLabel: '🧬 Deep Profile',
    description: 'Extracts Real Name, Avatar, Bio, Company, Location & hidden GitHub Commit Emails',
    modes: ['identity'],
  },
  {
    id: 'connection_mapper',
    label: 'Mutual Circle & Collaborators',
    shortLabel: '👥 Mutuals',
    description: 'Maps 2-way mutual connections (followers ∩ following), repo co-authors & orgs',
    modes: ['identity'],
  },
  {
    id: 'email_correlator',
    label: 'Email, Gravatar & PGP Lookup',
    shortLabel: '🪪 Gravatar/PGP',
    description: 'Pivots from Email to Gravatar profile/avatar, OpenPGP UID & GitHub commits',
    modes: ['identity'],
  },
  {
    id: 'social_presence_scanner',
    label: 'Social Accounts (16+ Sites)',
    shortLabel: '🌐 16+ Socials',
    description: 'Concurrent username reconnaissance across GitHub, Reddit, Keybase, Steam, etc.',
    modes: ['identity'],
  },
  {
    id: 'breach_credential_hunter',
    label: 'Breaches & Email Security',
    shortLabel: '🚨 Breaches',
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
  { value: 'octocat', type: 'username' as EntityType, label: 'Username (25 Socials)' },
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

  // Sync input when initialValue changes externally (e.g. pivot)
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
    }
  }, [initialValue]);

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
        // Keep at least 1 module active for current mode
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
    // If switching modes and current input doesn't match the mode, set a sensible default sample
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

    // Determine mode for the clean input
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
      {/* Operating Mode Pill Switcher */}
      <div
        data-testid="recon-mode-switcher"
        className="hidden xl:flex items-center bg-vsc-canvas border border-vsc-border rounded p-0.5 text-[10px] font-mono flex-shrink-0"
      >
        <button
          type="button"
          onClick={() => handleSwitchMode('web')}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded transition-colors font-semibold',
            currentMode === 'web'
              ? 'bg-sky-600/25 text-sky-300 border border-sky-500/40'
              : 'text-vsc-muted hover:text-vsc-bright'
          )}
          title="Web & Infrastructure Mode (Domain, Subdomain, IP, Ports, SPF/DMARC)"
        >
          <Globe className="w-3 h-3" />
          <span>Web & Infra</span>
        </button>
        <button
          type="button"
          onClick={() => handleSwitchMode('identity')}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded transition-colors font-semibold',
            currentMode === 'identity'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/40'
              : 'text-vsc-muted hover:text-vsc-bright'
          )}
          title="Identity & Footprint Mode (Username, Email, 25 Socials, Breaches)"
        >
          <User className="w-3 h-3" />
          <span>Identity</span>
        </button>
      </div>

      {/* Main Search Input Container */}
      <div className="relative w-[420px]">
        <div
          className={cn(
            'flex items-center bg-vsc-canvas border border-vsc-border rounded px-3 py-1 shadow-sm transition-all duration-150',
            isFocused
              ? 'border-vsc-borderFocus ring-1 ring-vsc-borderFocus'
              : 'hover:border-vsc-borderSubtle'
          )}
        >
          <Search className="w-3.5 h-3.5 text-vsc-muted mr-2 flex-shrink-0" />

          <input
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
            placeholder="Enter target: domain, IP, email, or username..."
            className="bg-transparent border-none outline-none text-xs text-vsc-bright w-full font-mono placeholder:text-vsc-muted"
          />

          {/* Clear Button */}
          {value.length > 0 && !isScanning && (
            <button
              type="button"
              onClick={() => setValue('')}
              className="text-vsc-muted hover:text-vsc-bright p-0.5 mr-1.5 transition-colors"
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
              className="mr-2 flex-shrink-0 flex items-center font-bold tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800"
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
              className="mr-2 flex-shrink-0 flex items-center font-bold tracking-wider"
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
            className="font-semibold px-2.5 py-1 tracking-wide flex-shrink-0"
          >
            {isScanning ? 'Scanning' : 'Scan'}
          </Button>
        </div>

        {/* Anti-SSRF Warning Banner */}
        {ssrfCheck.isBlocked && value.trim().length > 0 && (
          <div
            data-testid="ssrf-warning-banner"
            className="absolute top-full left-0 right-0 mt-1 p-2 bg-rose-950/95 border border-rose-800/80 rounded shadow-2xl z-50 text-[11px] text-rose-300 font-mono flex items-start gap-2 backdrop-blur-sm animate-in fade-in-50"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block text-rose-200 font-bold">Anti-SSRF Policy Active:</strong>
              <span className="text-[10px] leading-tight block text-rose-300/90">
                {ssrfCheck.reason}
              </span>
            </div>
          </div>
        )}

        {/* Quick Suggestions, Mode Switcher & Modular ON/OFF Dropdown */}
        {isFocused && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-vsc-sidebar border border-vsc-border rounded shadow-xl z-50 overflow-hidden font-mono text-xs animate-in fade-in-50 duration-100">
            {/* Mode Selector inside Dropdown */}
            <div className="px-3 py-2 bg-vsc-dropdown border-b border-vsc-borderSubtle flex items-center justify-between">
              <span className="text-[10px] text-vsc-muted uppercase font-bold flex items-center gap-1.5">
                <SlidersHorizontal className="w-3 h-3 text-vsc-accent-blue" />
                Active Mode & Modules
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('web')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] transition-colors',
                    currentMode === 'web'
                      ? 'bg-sky-600/30 text-sky-300 font-bold'
                      : 'text-vsc-muted hover:text-vsc-bright'
                  )}
                >
                  🌐 Web/Infra
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('identity')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] transition-colors',
                    currentMode === 'identity'
                      ? 'bg-purple-600/30 text-purple-300 font-bold'
                      : 'text-vsc-muted hover:text-vsc-bright'
                  )}
                >
                  👤 Identity
                </button>
              </div>
            </div>

            {/* Module ON/OFF Checkboxes */}
            <div className="p-2.5 border-b border-vsc-borderSubtle bg-[#1B1B1C] space-y-1.5">
              <div className="text-[10px] text-vsc-muted mb-1">
                Select which OSINT modules to run (toggle ON/OFF):
              </div>
              {modeModules.map((mod) => {
                const isEnabled = activeModuleIds.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleToggleModule(mod.id)}
                    className={cn(
                      'w-full flex items-start justify-between p-1.5 rounded border text-left transition-all',
                      isEnabled
                        ? 'bg-sky-950/25 border-sky-500/40 text-vsc-bright'
                        : 'bg-vsc-canvas/60 border-vsc-borderSubtle text-vsc-muted opacity-70 hover:opacity-100'
                    )}
                  >
                    <div className="flex items-start gap-2 pr-2">
                      <div
                        className={cn(
                          'w-3.5 h-3.5 rounded flex items-center justify-center mt-0.5 border flex-shrink-0',
                          isEnabled
                            ? 'bg-vsc-accent-blue border-vsc-accent-blue text-white'
                            : 'border-vsc-border bg-transparent'
                        )}
                      >
                        {isEnabled && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold">{mod.label}</div>
                        <div className="text-[9px] text-vsc-muted leading-tight">
                          {mod.description}
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0',
                        isEnabled
                          ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-700/50'
                          : 'bg-zinc-800 text-zinc-400'
                      )}
                    >
                      {isEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Target Presets */}
            <div className="px-3 py-1 bg-vsc-dropdown border-b border-vsc-borderSubtle text-[10px] text-vsc-muted uppercase font-bold flex items-center justify-between">
              <span>Quick {currentMode === 'identity' ? 'Identity' : 'Web'} Presets</span>
              <span className="text-[9px] lowercase text-vsc-text">press ↵ Enter to scan</span>
            </div>

            <div className="py-1">
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
                  className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-vsc-canvas text-vsc-text hover:text-vsc-bright group transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-vsc-muted group-hover:text-vsc-accent-blue transition-colors" />
                    <span className="font-semibold text-vsc-bright">{sample.value}</span>
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

      {/* Inline Quick Module Toggle Pills (Visible on Desktop) */}
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
                'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border transition-all',
                isEnabled
                  ? 'bg-emerald-950/30 border-emerald-600/50 text-emerald-300 hover:bg-emerald-950/50'
                  : 'bg-vsc-canvas border-vsc-borderSubtle text-vsc-muted opacity-60 hover:opacity-100'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isEnabled ? 'bg-emerald-400' : 'bg-zinc-600'
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
