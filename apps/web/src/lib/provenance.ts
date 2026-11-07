import { EntityNode, VulnerabilityFinding, EntityType } from '@iseeyou/shared-types';

export interface ProvenanceInfo {
  provider: string;
  type: string;
  method: string;
  badgeColor: string;
  url: string;
  compliance: string;
  description: string;
}

export const PROVENANCE_PROVIDERS: Record<string, ProvenanceInfo> = {
  shodan: {
    provider: 'Shodan InternetDB',
    type: 'Zero-Auth Port & CVE Engine',
    method: 'Passive Banner & CVE Analysis',
    badgeColor: 'border-white/[0.07] text-slate-400 bg-white/[0.02]',
    url: 'https://internetdb.shodan.io',
    compliance: '100% Passive, Zero-Authentication, Legal Reconnaissance',
    description: 'Queries Shodan InternetDB for open ports, CPE services, and known CVE signatures without touching the target network directly.',
  },
  crtsh: {
    provider: 'crt.sh & Cloudflare DoH',
    type: 'Certificate Transparency Logs',
    method: 'Append-Only SSL/TLS Logs & DoH',
    badgeColor: 'border-white/[0.07] text-slate-400 bg-white/[0.02]',
    url: 'https://crt.sh',
    compliance: 'RFC 6962 Public Certificate Transparency, Zero Target Impact',
    description: 'Extracts historical and active subdomains from cryptographic Certificate Transparency logs submitted by Certificate Authorities (CAs).',
  },
  hibp: {
    provider: 'HaveIBeenPwned',
    type: 'k-Anonymity SHA-1 Breach DB',
    method: 'k-Anonymity 5-Char Hash Prefix',
    badgeColor: 'border-white/[0.07] text-slate-400 bg-white/[0.02]',
    url: 'https://haveibeenpwned.com',
    compliance: 'Zero-Knowledge Privacy-Preserving k-Anonymity Model',
    description: 'Searches 12+ billion breached passwords without sending actual credentials over the wire, using 5-character SHA-1 prefix matching.',
  },
  ipapi: {
    provider: 'ip-api.com',
    type: 'BGP & ASN Geolocation',
    method: 'BGP Table & Autonomous System Registry',
    badgeColor: 'border-white/[0.07] text-slate-400 bg-white/[0.02]',
    url: 'https://ip-api.com',
    compliance: 'Public RIR (ARIN, RIPE, APNIC, LACNIC, AFRINIC) Registry',
    description: 'Identifies origin network ownership, autonomous system number (ASN), organization name, and physical datacenter coordinates.',
  },
  social: {
    provider: 'Direct Identity Probes',
    type: 'Public Social Presence Scanner',
    method: 'HTTP Status Probing (GET/HEAD)',
    badgeColor: 'border-white/[0.07] text-slate-400 bg-white/[0.02]',
    url: 'https://github.com',
    compliance: 'Public User Endpoint Status Code Resolution',
    description: 'Checks public profile availability across GitHub, GitLab, DockerHub, Reddit, Twitter, and Gravatar.',
  },
  engine: {
    provider: 'ISEEYOU Recon Engine',
    type: 'Multi-Source OSINT Synthesis',
    method: 'Correlation & Attack Graph Analysis',
    badgeColor: 'border-white/[0.07] text-slate-400 bg-white/[0.02]',
    url: 'https://github.com/flx/ISEEYOU',
    compliance: 'Deterministic Graph Correlation Algorithm',
    description: 'Synthesizes multi-source OSINT telemetry into unified attack surface graphs and actionable remediation playbooks.',
  },
};

/**
 * Derives provenance information for a vulnerability finding
 */
export function getFindingProvenance(finding: VulnerabilityFinding): ProvenanceInfo {
  const text = `${finding.title} ${finding.evidence} ${finding.id}`.toLowerCase();

  if (
    text.includes('shodan') ||
    text.includes('port') ||
    text.includes('cve-') ||
    text.includes('service') ||
    text.includes('protocol') ||
    text.includes('mysql') ||
    text.includes('postgres') ||
    text.includes('redis') ||
    text.includes('telnet') ||
    text.includes('smb')
  ) {
    return PROVENANCE_PROVIDERS.shodan;
  }

  if (
    text.includes('crt.sh') ||
    text.includes('subdomain') ||
    text.includes('cname') ||
    text.includes('takeover') ||
    text.includes('dns')
  ) {
    return PROVENANCE_PROVIDERS.crtsh;
  }

  if (
    text.includes('pwned') ||
    text.includes('breach') ||
    text.includes('credential') ||
    text.includes('password') ||
    text.includes('hibp')
  ) {
    return PROVENANCE_PROVIDERS.hibp;
  }

  if (text.includes('asn') || text.includes('isp') || text.includes('geolocation') || text.includes('ip-api')) {
    return PROVENANCE_PROVIDERS.ipapi;
  }

  return PROVENANCE_PROVIDERS.engine;
}

/**
 * Derives provenance information for an entity node
 */
export function getNodeProvenance(node: {
  type: string;
  value?: string;
  label?: string;
  metadata?: Record<string, unknown>;
}): ProvenanceInfo {
  switch (node.type) {
    case 'subdomain':
      return PROVENANCE_PROVIDERS.crtsh;
    case 'domain':
      return {
        ...PROVENANCE_PROVIDERS.crtsh,
        provider: 'Cloudflare DoH 1.1.1.1',
        type: 'DNS over HTTPS Resolver',
        method: 'RFC 8484 Secure DNS Lookup',
        url: 'https://cloudflare-dns.com',
      };
    case 'ip':
      return PROVENANCE_PROVIDERS.ipapi;
    case 'port':
      return PROVENANCE_PROVIDERS.shodan;
    case 'breach':
      return PROVENANCE_PROVIDERS.hibp;
    case 'username':
    case 'email':
      if (node.metadata?.platform) {
        return {
          ...PROVENANCE_PROVIDERS.social,
          provider: `${String(node.metadata.platform)} Endpoint`,
        };
      }
      return PROVENANCE_PROVIDERS.social;
    default:
      return PROVENANCE_PROVIDERS.engine;
  }
}

