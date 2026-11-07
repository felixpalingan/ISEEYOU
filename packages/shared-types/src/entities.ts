/**
 * Core entity classifications for ISEEYOU 2.0 OSINT & Reconnaissance Workbench
 */
export type EntityType =
  | 'domain'
  | 'subdomain'
  | 'ip'
  | 'email'
  | 'username'
  | 'breach'
  | 'port'
  | 'secret'
  | 'document'
  | 'associate'
  | 'organization'
  | 'location';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type NodeConfidence = 'verified' | 'suspected' | 'unverified' | 'false_positive';

export interface EntityNode {
  id: string;
  type: EntityType;
  value: string;
  label: string;
  severity: SeverityLevel;
  metadata: Record<string, unknown>;
  parentId?: string;
  parent_id?: string;
  isCluster?: boolean;
  clusterCount?: number;
  discoveredAt: string;
  confidence?: NodeConfidence;
  investigatorNotes?: string;
  timelineDate?: string;
  isManual?: boolean;
}

export interface TimelineEvent {
  year: string;
  date?: string;
  event: string;
  platform: string;
  nodeId?: string;
}

export interface TargetDossier {
  primaryTarget: string;
  fullNames: string[];
  handles: string[];
  emails: string[];
  avatars: string[];
  locations: string[];
  organizations: string[];
  domains: string[];
  bios: Array<{ platform: string; text: string }>;
  socialProfiles: Array<{
    platform: string;
    handle: string;
    url: string;
    category?: string;
    nodeId: string;
  }>;
  associates: Array<{
    handle: string;
    relationship: string;
    avatarUrl?: string;
    profileUrl?: string;
    nodeId: string;
  }>;
  breachesCount: number;
  timeline: TimelineEvent[];
}

export interface CaseFile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  seedInput: string;
  riskScore: number;
  nodes: EntityNode[];
  edges: EntityEdge[];
  findings: VulnerabilityFinding[];
  caseNotes?: string;
}

export interface ScanRequestPayload {
  seed_input: string;
  force_refresh?: boolean;
  enabled_modules?: string[];
}

export interface EntityEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  confidence: number;
}

export interface VulnerabilityFinding {
  id: string;
  nodeId?: string;
  node_id?: string;
  title: string;
  severity: SeverityLevel;
  cveId?: string;
  cve_id?: string;
  evidence: string;
  discoveredAt?: string;
  discovered_at?: string;
}

export interface RemediationAction {
  id: string;
  vulnerabilityId: string;
  type: 'firewall_rule' | 'google_deindex' | 'uupdp_takedown' | 'secret_revoke';
  title: string;
  playbookMarkdown: string;
  actionUrl?: string;
}

export interface ScanSession {
  id: string;
  seedInput: string;
  seedType: EntityType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  riskScore: number;
  startedAt: string;
  completedAt?: string;
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}
