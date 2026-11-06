'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  EntityNode,
  EntityEdge,
  VulnerabilityFinding,
  EntityType,
  AIAnalysisReport,
} from '@iseeyou/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

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
  const hasTriggeredRef = useRef<boolean>(false);
  const prevTargetRef = useRef<string>(target);

  const runAnalysis = useCallback(async () => {
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
        generatedAt: data.generated_at || new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Failed to run AI Recon Analyst:', err);
      setError(err?.message || 'AI analysis request failed.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [target, targetType, nodes, edges, findings, riskScore]);

  // Reset trigger state when target changes
  if (prevTargetRef.current !== target) {
    prevTargetRef.current = target;
    hasTriggeredRef.current = false;
  }

  // Automatically trigger AI analysis when scan finishes and findings or nodes exist
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
