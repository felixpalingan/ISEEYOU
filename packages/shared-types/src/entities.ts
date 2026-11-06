/**
 * Core entity classifications for ISEEYOU Reconnaissance
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
  | 'document';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface EntityNode {
  id: string;
  type: EntityType;
  value: string;
  label: string;
  severity: SeverityLevel;
  metadata: Record<string, unknown>;
  parentId?: string;
  isCluster?: boolean;
  clusterCount?: number;
  discoveredAt: string;
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
