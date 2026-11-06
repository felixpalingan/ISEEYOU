import { EntityType } from '@iseeyou/shared-types';

// RFC-compliant regular expressions matching the Python backend orchestrator
const RE_EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const RE_IPV4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const RE_DOMAIN = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

/**
 * Deterministic client-side classification of raw target seeds.
 * Identical logic with backend Python `classify_input()`.
 */
export function classifyTarget(input: string): EntityType {
  const target = input.trim();
  if (!target) return 'domain';

  if (RE_EMAIL.test(target)) {
    return 'email';
  }

  if (RE_IPV4.test(target)) {
    return 'ip';
  }

  if (RE_DOMAIN.test(target)) {
    return 'domain';
  }

  return 'username';
}

export interface EntityBadgeConfig {
  type: EntityType;
  label: string;
  colorClass: string;
  iconName: 'Globe' | 'Network' | 'Mail' | 'User';
}

export const ENTITY_BADGE_CONFIGS: Record<EntityType, EntityBadgeConfig> = {
  domain: {
    type: 'domain',
    label: 'DOMAIN',
    colorClass: 'text-vsc-keyword border-vsc-borderSubtle bg-vsc-dropdown',
    iconName: 'Globe',
  },
  subdomain: {
    type: 'subdomain',
    label: 'SUBDOMAIN',
    colorClass: 'text-sky-400 border-vsc-borderSubtle bg-vsc-dropdown',
    iconName: 'Globe',
  },
  ip: {
    type: 'ip',
    label: 'IP ADDRESS',
    colorClass: 'text-emerald-400 border-vsc-borderSubtle bg-vsc-dropdown',
    iconName: 'Network',
  },
  email: {
    type: 'email',
    label: 'EMAIL',
    colorClass: 'text-amber-400 border-vsc-borderSubtle bg-vsc-dropdown',
    iconName: 'Mail',
  },
  username: {
    type: 'username',
    label: 'USERNAME',
    colorClass: 'text-purple-400 border-vsc-borderSubtle bg-vsc-dropdown',
    iconName: 'User',
  },
  port: {
    type: 'port',
    label: 'PORT',
    colorClass: 'text-cyan-300 border-vsc-borderSubtle bg-vsc-dropdown',
    iconName: 'Network',
  },
  breach: {
    type: 'breach',
    label: 'BREACH',
    colorClass: 'text-vsc-critical border-vsc-critical bg-red-950/70',
    iconName: 'Globe',
  },
  secret: {
    type: 'secret',
    label: 'SECRET',
    colorClass: 'text-rose-400 border-rose-500 bg-rose-950/70',
    iconName: 'Globe',
  },
  document: {
    type: 'document',
    label: 'DOCUMENT',
    colorClass: 'text-vsc-text border-vsc-border bg-vsc-dropdown',
    iconName: 'Globe',
  },
};

