import { EntityNode, EntityEdge, VulnerabilityFinding, EntityType, SeverityLevel } from './entities.js';

export interface AttackChainStep {
  step: number;
  title: string;
  technique: string; // e.g. "MITRE ATT&CK T1596: Search Open Technical Databases"
  targetAsset: string;
  description: string;
  impact: string;
}

export interface AIAnalysisReport {
  status: 'success' | 'fallback' | 'error';
  model: string; // e.g. "gemini-1.5-flash" or "heuristic-expert-engine"
  target: string;
  targetType: string;
  executiveSummary: string;
  threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  keyExposures: string[];
  attackChain: AttackChainStep[];
  mitreTechniques: string[];
  recommendations: string[];
  generatedAt: string;
}

export interface AIAnalysisRequest {
  target: string;
  targetType: EntityType;
  nodes: EntityNode[];
  edges: EntityEdge[];
  findings: VulnerabilityFinding[];
  riskScore: number;
}
