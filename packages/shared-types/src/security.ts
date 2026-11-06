import { z } from 'zod';
import { EntityType } from './entities.js';

// Security Defense Constants: Blocked SSRF & Internal IP ranges
export const BLOCKED_IP_PREFIXES = [
  '0.',          // Current network (RFC 1122)
  '10.',         // Private Class A (RFC 1918)
  '127.',        // Loopback (RFC 1122)
  '169.254.',    // Link-local / Cloud Metadata (RFC 3927, AWS/GCP/Azure)
  '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.',
  '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
  '172.30.', '172.31.', // Private Class B & Docker Networks (RFC 1918)
  '192.168.',    // Private Class C (RFC 1918)
  '198.18.', '198.19.', // Benchmark testing (RFC 2544)
  '224.', '225.', '226.', '227.', '228.', '229.', '230.', '231.',
  '232.', '233.', '234.', '235.', '236.', '237.', '238.', '239.', // Multicast (RFC 5771)
  '240.', '255.', // Reserved (RFC 1112 / RFC 919)
];

export const BLOCKED_IPV6_PREFIXES = [
  '::',
  '::1',
  'fe80:',
  'fc00:',
  'fd00:',
  'ff00:',
];

export const BLOCKED_INTERNAL_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'instance-data',
];

/**
 * Sanitizes raw target input string:
 * - Strips protocol schemes (http://, https://, ftp://, etc.)
 * - Strips URL paths, query parameters, and hashes
 * - Strips credentials (user:pass@)
 * - Strips trailing slashes and port numbers if appended to host
 * - Strips null bytes and control characters
 */
export function sanitizeTargetInput(raw: string): string {
  if (!raw) return '';

  let sanitized = raw.trim();

  // Remove null bytes and control chars
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Strip protocol schemes (e.g. https://, http://, ftp://)
  sanitized = sanitized.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');

  // Strip user authentication (e.g. admin:pass@target.com)
  if (sanitized.includes('@') && sanitized.includes('/')) {
    const atIdx = sanitized.indexOf('@');
    const slashIdx = sanitized.indexOf('/');
    if (atIdx < slashIdx) {
      sanitized = sanitized.substring(atIdx + 1);
    }
  }

  // Strip paths, query strings, and hashes (e.g. target.com/path?query=1#frag)
  sanitized = sanitized.split('/')[0].split('?')[0].split('#')[0];

  // Strip port number from hostname (e.g. target.com:8080 -> target.com)
  // Only if it's not an IPv6 literal (contains multiple colons)
  if (sanitized.includes(':') && sanitized.indexOf(':') === sanitized.lastIndexOf(':')) {
    sanitized = sanitized.split(':')[0];
  }

  return sanitized.trim();
}

/**
 * Validates whether a target input attempts SSRF or targets private/internal infrastructure.
 */
export function isBlockedInternalTarget(target: string): { isBlocked: boolean; reason?: string } {
  const clean = sanitizeTargetInput(target).toLowerCase();

  if (!clean) {
    return { isBlocked: true, reason: 'Target cannot be empty' };
  }

  // 1. Check blocked exact hostnames
  if (BLOCKED_INTERNAL_HOSTNAMES.includes(clean)) {
    return {
      isBlocked: true,
      reason: `Direct scanning of internal host '${clean}' is prohibited by SSRF security policy.`,
    };
  }

  // 2. Check internal hostname suffixes (.local, .internal, .lan, etc.)
  const internalSuffixes = ['.local', '.internal', '.lan', '.home', '.corp', '.localhost'];
  for (const suffix of internalSuffixes) {
    if (clean.endsWith(suffix)) {
      return {
        isBlocked: true,
        reason: `Scanning internal TLD '${suffix}' is blocked to prevent local network reconnaissance.`,
      };
    }
  }

  // 3. Check IPv4 Blocked Prefixes
  for (const prefix of BLOCKED_IP_PREFIXES) {
    if (clean.startsWith(prefix)) {
      return {
        isBlocked: true,
        reason: `Target IP ${clean} resides in private, loopback, or link-local range (${prefix}*). Scanning is blocked.`,
      };
    }
  }

  // 4. Check IPv6 Blocked Prefixes
  for (const prefix of BLOCKED_IPV6_PREFIXES) {
    if (clean.startsWith(prefix)) {
      return {
        isBlocked: true,
        reason: `Target IPv6 ${clean} resides in private or loopback range (${prefix}*). Scanning is blocked.`,
      };
    }
  }

  // 5. Check DNS Rebinding wildcard domains pointing to loopback/private IPs (e.g. 127.0.0.1.nip.io)
  const rebindingPatterns = [
    /(?:^|\.)127\.\d+\.\d+\.\d+\.(?:nip|sslip|xip)\.io$/i,
    /(?:^|\.)10\.\d+\.\d+\.\d+\.(?:nip|sslip|xip)\.io$/i,
    /(?:^|\.)192\.168\.\d+\.\d+\.(?:nip|sslip|xip)\.io$/i,
    /(?:^|\.)172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+\.(?:nip|sslip|xip)\.io$/i,
    /(?:^|\.)169\.254\.\d+\.\d+\.(?:nip|sslip|xip)\.io$/i,
  ];

  for (const pattern of rebindingPatterns) {
    if (pattern.test(clean)) {
      return {
        isBlocked: true,
        reason: `DNS Rebinding target '${clean}' resolving to private network is blocked.`,
      };
    }
  }

  return { isBlocked: false };
}

/**
 * Zod Schema for Target Input Validation & Sanitization
 */
export const TargetInputSchema = z
  .string()
  .min(1, 'Target input cannot be empty')
  .max(253, 'Target exceeds maximum domain/hostname length of 253 characters')
  .transform((val) => sanitizeTargetInput(val))
  .superRefine((val, ctx) => {
    if (/[<>"'`;|&$]/.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Target contains forbidden shell metacharacters or HTML injection tokens',
      });
    }

    const check = isBlockedInternalTarget(val);
    if (check.isBlocked) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.reason || 'Target is blocked by Anti-SSRF policy',
      });
    }
  });

export type TargetInput = z.infer<typeof TargetInputSchema>;
