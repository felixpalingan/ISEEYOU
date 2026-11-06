'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Globe, Network, Mail, User, X, Loader2, ArrowRight } from 'lucide-react';
import { EntityType } from '@iseeyou/shared-types';
import { classifyTarget, ENTITY_BADGE_CONFIGS } from '@/lib/classifier';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface OmniSearchBarProps {
  onScan: (target: string, type: EntityType) => void;
  isScanning?: boolean;
  initialValue?: string;
  className?: string;
}

const SAMPLE_TARGETS = [
  { value: 'example.com', type: 'domain' as EntityType, label: 'Domain (ASM)' },
  { value: '1.1.1.1', type: 'ip' as EntityType, label: 'Public IP (Threat Intel)' },
  { value: 'admin@corp.io', type: 'email' as EntityType, label: 'Email (Breach Check)' },
  { value: 'octocat', type: 'username' as EntityType, label: 'Username (Social)' },
];

export function OmniSearchBar({
  onScan,
  isScanning = false,
  initialValue = 'example.com',
  className,
}: OmniSearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Instant deterministic entity classification
  const detectedType = useMemo(() => classifyTarget(value), [value]);
  const badgeConfig = ENTITY_BADGE_CONFIGS[detectedType] || ENTITY_BADGE_CONFIGS.domain;

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
    const trimmed = value.trim();
    if (!trimmed || isScanning) return;
    setIsFocused(false);
    onScan(trimmed, detectedType);
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

  return (
    <div ref={containerRef} className={cn('relative w-[460px]', className)}>
      {/* VS Code Quick-Open styled search bar */}
      <div
        className={cn(
          'flex items-center bg-vsc-canvas border border-vsc-border rounded px-3 py-1 shadow-sm transition-all duration-150',
          isFocused ? 'border-vsc-borderFocus ring-1 ring-vsc-borderFocus' : 'hover:border-vsc-borderSubtle'
        )}
      >
        <Search className="w-3.5 h-3.5 text-vsc-muted mr-2 flex-shrink-0" />

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
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

        {/* Instant Dynamic Entity Classification Badge */}
        <Badge
          variant={detectedType}
          size="xs"
          className="mr-2 flex-shrink-0 flex items-center font-bold tracking-wider"
        >
          {renderIcon()}
          <span>{badgeConfig.label}</span>
        </Badge>

        {/* Scan Button */}
        <Button
          variant="primary"
          size="xs"
          isLoading={isScanning}
          onClick={handleTriggerScan}
          disabled={!value.trim()}
          className="font-semibold px-2.5 py-1 tracking-wide flex-shrink-0"
        >
          {isScanning ? 'Scanning' : 'Scan'}
        </Button>
      </div>

      {/* Quick Suggestions & Seed Presets Dropdown */}
      {isFocused && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-vsc-sidebar border border-vsc-border rounded shadow-xl z-50 overflow-hidden font-mono text-xs animate-in fade-in-50 duration-100">
          <div className="px-3 py-1.5 bg-vsc-dropdown border-b border-vsc-borderSubtle text-[10px] text-vsc-muted uppercase font-bold flex items-center justify-between">
            <span>Quick Target Presets</span>
            <span className="text-[9px] lowercase text-vsc-text">press ↵ Enter to scan</span>
          </div>

          <div className="py-1">
            {SAMPLE_TARGETS.map((sample) => (
              <button
                key={sample.value}
                type="button"
                onClick={() => {
                  setValue(sample.value);
                  setIsFocused(false);
                  onScan(sample.value, sample.type);
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
  );
}
