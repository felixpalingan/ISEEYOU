import { EntityNode, EntityEdge, VulnerabilityFinding, EntityType } from './entities.js';

export type AIProviderType = 'gemini' | 'groq' | 'openai' | 'ollama';

export interface AIConfig {
  provider: AIProviderType;
  apiKey: string;
  modelOverride?: string;
}

export interface PredictedLead {
  leadType: 'username' | 'email' | 'domain';
  value: string;
  reason: string;
  confidence: number;
}

export interface SuggestedDork {
  title: string;
  query: string;
  category: 'Private Account Bypass' | 'Cross-Platform Pivot' | 'Document & Roster Leak' | string;
  description: string;
}

export interface AttackChainStep {
  step: number;
  title: string;
  technique: string;
  targetAsset: string;
  description: string;
  impact: string;
}

export interface AIAnalysisReport {
  status: 'success' | 'fallback' | 'error';
  model: string;
  target: string;
  targetType: string;
  executiveSummary: string;
  threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  keyExposures: string[];
  attackChain: AttackChainStep[];
  mitreTechniques: string[];
  recommendations: string[];
  predictedLeads: PredictedLead[];
  suggestedDorks: SuggestedDork[];
  generatedAt: string;
}

export interface AIAnalysisRequest {
  target: string;
  targetType: EntityType;
  nodes: EntityNode[];
  edges: EntityEdge[];
  findings: VulnerabilityFinding[];
  riskScore: number;
  aiProvider?: AIProviderType;
  apiKey?: string;
  modelOverride?: string;
}
