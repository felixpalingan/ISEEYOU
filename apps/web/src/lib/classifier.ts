import { EntityType } from '@iseeyou/shared-types';

// RFC-compliant regular expressions matching the Python backend orchestrator
const RE_EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const RE_IPV4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const RE_DOMAIN = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

/**
 * Standard registry of recognized Public TLDs (generic, ccTLD, and modern gTLDs).
 * Usernames containing dots (e.g. 'john.doe', 'bariq.hkp', 'budi.santoso') are NOT domains
 * because '.doe', '.hkp', '.santoso' are not legitimate TLDs.
 */
export const KNOWN_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'ai', 'co', 'id', 'dev', 'app', 'me',
  'info', 'biz', 'tech', 'xyz', 'cloud', 'site', 'online', 'store', 'top', 'pro', 'live', 'club',
  'space', 'agency', 'digital', 'life', 'network', 'world', 'global', 'media', 'news', 'press',
  'cc', 'tv', 'ws', 'fm', 'to', 'gg', 'is', 'sh', 'ly', 'so',
  'uk', 'us', 'ca', 'de', 'fr', 'jp', 'au', 'ru', 'cn', 'in', 'br', 'nl', 'se', 'ch', 'es',
  'sg', 'my', 'kr', 'vn', 'th', 'ph', 'nz', 'za', 'mx', 'ar', 'cl', 'it', 'pl', 'eu', 'no',
  'fi', 'dk', 'be', 'at', 'cz', 'ro', 'gr', 'pt', 'tr', 'ua', 'hk', 'tw', 'ie', 'il',
]);

/**
 * Deterministic client-side classification of raw target seeds.
 * Supports optional operating mode guidance ('web' | 'identity').
 */
export function classifyTarget(input: string, mode?: 'web' | 'identity'): EntityType {
  const target = input.trim();
  if (!target) return mode === 'identity' ? 'username' : 'domain';

  // Explicit handle prefix: @bariq.hkp -> always username
  if (target.startsWith('@')) {
    return 'username';
  }

  // Full name / phrase with spaces: ALMAKIUS FELIX BARIQ -> always username
  if (target.includes(' ')) {
    return 'username';
  }

  // Email format check: user@domain.com
  if (RE_EMAIL.test(target)) {
    return 'email';
  }

  // IPv4 format check: 1.1.1.1
  if (RE_IPV4.test(target)) {
    return 'ip';
  }

  // Explicit URL schemes: http:// or https:// -> domain
  if (/^https?:\/\//i.test(target)) {
    return 'domain';
  }

  // Domain syntax check: must match domain regex AND have a recognized public TLD
  if (RE_DOMAIN.test(target)) {
    const parts = target.split('.');
    const last = parts[parts.length - 1].toLowerCase();
    // If the ending is a known TLD, it is a DOMAIN
    if (KNOWN_TLDS.has(last)) {
      return 'domain';
    }
    // Dotted usernames (e.g. john.doe, budi.santoso, bariq.hkp) are not domains
    return 'username';
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
  associate: {
    type: 'associate',
    label: 'ASSOCIATE',
    colorClass: 'text-emerald-300 border-emerald-700/50 bg-emerald-950/60',
    iconName: 'User',
  },
  organization: {
    type: 'organization',
    label: 'ORG / CAMPUS',
    colorClass: 'text-amber-300 border-amber-700/50 bg-amber-950/60',
    iconName: 'Globe',
  },
  location: {
    type: 'location',
    label: 'LOCATION',
    colorClass: 'text-rose-300 border-rose-700/50 bg-rose-950/60',
    iconName: 'Globe',
  },
};

