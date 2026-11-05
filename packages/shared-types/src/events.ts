import { EntityNode, EntityEdge, SeverityLevel, VulnerabilityFinding } from './entities.js';

/**
 * Server-Sent Events (SSE) contract for Live Telemetry streaming
 */
export type SSEEventType =
  | 'scan_started'
  | 'module_progress'
  | 'node_discovered'
  | 'edge_discovered'
  | 'vulnerability_found'
  | 'risk_score_updated'
  | 'scan_completed'
  | 'scan_error';

export interface SSELogEvent {
  timestamp: string;
  module: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface SSENodeDiscoveredEvent {
  node: EntityNode;
  edge?: EntityEdge;
}

export interface SSEVulnerabilityEvent {
  finding: VulnerabilityFinding;
  riskScore: number;
}
