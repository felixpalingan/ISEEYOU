'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  EntityNode,
  EntityEdge,
  VulnerabilityFinding,
  EntityType,
  AIAnalysisReport,
  AIConfig,
  AIProviderType,
} from '@iseeyou/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const AI_CONFIG_STORAGE_KEY = 'iseeyou_ai_byok_config_v2';

interface UseAIAnalystProps {
  target: string;
  targetType: EntityType;
  nodes: EntityNode[];
  edges: EntityEdge[];
  findings: VulnerabilityFinding[];
  riskScore: number;
  isScanning: boolean;
}

export function useAIAnalyst({
  target,
  targetType,
  nodes,
  edges,
  findings,
  riskScore,
  isScanning,
}: UseAIAnalystProps) {
  const [report, setReport] = useState<AIAnalysisReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    apiKey: '',
    modelOverride: '',
  });

  const hasTriggeredRef = useRef<boolean>(false);
  const prevTargetRef = useRef<string>(target);

  // Load saved BYOK AI config from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setAiConfig({
            provider: (parsed.provider as AIProviderType) || 'gemini',
            apiKey: String(parsed.apiKey || ''),
            modelOverride: String(parsed.modelOverride || ''),
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const updateAiConfig = useCallback((nextConfig: AIConfig) => {
    setAiConfig(nextConfig);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
    }
  }, []);

  const runAnalysis = useCallback(
    async (overrideConfig?: AIConfig) => {
      const activeCfg = overrideConfig || aiConfig;
      setIsAnalyzing(true);
      setError(null);

      try {
        const payload = {
          target,
          target_type: targetType,
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            value: n.value,
            label: n.label,
            severity: n.severity,
            metadata: n.metadata,
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            relation: e.relation,
          })),
          findings: findings.map((f) => ({
            id: f.id,
            node_id: f.node_id || f.nodeId,
            title: f.title,
            severity: f.severity,
            cve_id: f.cve_id || f.cveId,
            evidence: f.evidence,
          })),
          risk_score: riskScore,
          ai_provider: activeCfg.provider,
          api_key: activeCfg.apiKey || undefined,
          model_override: activeCfg.modelOverride || undefined,
        };

        const resp = await fetch(`${API_BASE_URL}/api/v1/analyze/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: jsonSafeStringify(payload),
        });

        if (!resp.ok) {
          throw new Error(`AI analyst API returned HTTP ${resp.status}`);
        }

        const data = await resp.json();
        setReport({
          status: data.status || 'success',
          model: data.model || 'gemini-1.5-flash',
          target: data.target || target,
          targetType: data.target_type || targetType,
          executiveSummary: data.executive_summary || '',
          threatLevel: data.threat_level || 'HIGH',
          keyExposures: data.key_exposures || [],
          attackChain: (data.attack_chain || []).map((s: any) => ({
            step: s.step,
            title: s.title,
            technique: s.technique,
            targetAsset: s.target_asset || s.targetAsset,
            description: s.description,
            impact: s.impact,
          })),
          mitreTechniques: data.mitre_techniques || [],
          recommendations: data.recommendations || [],
          predictedLeads: (data.predicted_leads || []).map((l: any) => ({
            leadType: l.lead_type || l.leadType || 'username',
            value: l.value,
            reason: l.reason,
            confidence: l.confidence ?? 0.75,
          })),
          suggestedDorks: (data.suggested_dorks || []).map((d: any) => ({
            title: d.title,
            query: d.query,
            category: d.category || 'Cross-Platform Pivot',
            description: d.description || '',
          })),
          generatedAt: data.generated_at || new Date().toISOString(),
        });
      } catch (err: any) {
        console.error('Failed to run AI Recon Analyst:', err);
        setError(err?.message || 'AI analysis request failed.');
      } finally {
        setIsAnalyzing(false);
      }
    },
    [target, targetType, nodes, edges, findings, riskScore, aiConfig]
  );

  if (prevTargetRef.current !== target) {
    prevTargetRef.current = target;
    hasTriggeredRef.current = false;
  }

  useEffect(() => {
    if (!isScanning && !hasTriggeredRef.current && (nodes.length > 0 || findings.length > 0)) {
      hasTriggeredRef.current = true;
      runAnalysis();
    }
  }, [isScanning, nodes.length, findings.length, runAnalysis]);

  return {
    report,
    isAnalyzing,
    error,
    aiConfig,
    updateAiConfig,
    runAnalysis,
  };
}

function jsonSafeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return '{}';
  }
}
