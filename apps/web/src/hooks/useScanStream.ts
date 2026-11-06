'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { EntityType, EntityNode, EntityEdge, VulnerabilityFinding } from '@iseeyou/shared-types';

export interface TelemetryLogLine {
  id: string;
  timestamp: string;
  module: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface ScanStreamState {
  sessionId: string | null;
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'error';
  target: string;
  targetType: EntityType;
  riskScore: number;
  logs: TelemetryLogLine[];
  nodes: EntityNode[];
  edges: EntityEdge[];
  findings: VulnerabilityFinding[];
  isScanning: boolean;
  selectedFinding: VulnerabilityFinding | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export function useScanStream() {
  const [state, setState] = useState<ScanStreamState>({
    sessionId: null,
    status: 'idle',
    target: 'example.com',
    targetType: 'domain',
    riskScore: 0,
    logs: [
      {
        id: 'init-1',
        timestamp: '00:00:00',
        module: 'system',
        level: 'info',
        message: 'ISEEYOU Reconnaissance Command Center Initialized. Ready for target stream.',
      },
    ],
    nodes: [],
    edges: [],
    findings: [],
    isScanning: false,
    selectedFinding: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  // Terminate active EventSource connection
  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeEventSource();
    };
  }, [closeEventSource]);

  const startScan = useCallback(
    async (target: string, type: EntityType) => {
      closeEventSource();

      // Reset state for new scan session
      setState((prev) => ({
        ...prev,
        status: 'running',
        isScanning: true,
        target,
        targetType: type,
        riskScore: 0,
        nodes: [],
        edges: [],
        findings: [],
        selectedFinding: null,
        logs: [
          {
            id: `start-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            module: 'orchestrator',
            level: 'info',
            message: `Dispatching reconnaissance mission for [${type.toUpperCase()}]: ${target}`,
          },
        ],
      }));

      try {
        // 1. Initialize scan session via POST
        const res = await fetch(`${API_BASE_URL}/api/v1/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seed_input: target, force_refresh: false }),
        });

        if (!res.ok) {
          throw new Error(`Backend returned HTTP ${res.status}`);
        }

        const session = await res.json();
        const sessionId = session.session_id;

        setState((prev) => ({ ...prev, sessionId }));

        // 2. Connect to Server-Sent Events (SSE) Stream
        const sseUrl = `${API_BASE_URL}/api/v1/scan/${sessionId}/stream`;
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.addEventListener('log', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const line: TelemetryLogLine = {
              id: `log-${Date.now()}-${Math.random()}`,
              timestamp: data.timestamp || new Date().toLocaleTimeString('en-US', { hour12: false }),
              module: data.module || 'engine',
              level: data.level || 'info',
              message: data.message || '',
            };
            setState((prev) => ({ ...prev, logs: [...prev.logs, line] }));
          } catch (err) {
            console.error('Failed to parse SSE log:', err);
          }
        });

        es.addEventListener('node', (e: MessageEvent) => {
          try {
            const node: EntityNode = JSON.parse(e.data);
            setState((prev) => {
              // Deduplicate nodes by id
              if (prev.nodes.some((n) => n.id === node.id)) return prev;
              return { ...prev, nodes: [...prev.nodes, node] };
            });
          } catch (err) {
            console.error('Failed to parse SSE node:', err);
          }
        });

        es.addEventListener('edge', (e: MessageEvent) => {
          try {
            const edge: EntityEdge = JSON.parse(e.data);
            setState((prev) => {
              if (prev.edges.some((ed) => ed.id === edge.id)) return prev;
              return { ...prev, edges: [...prev.edges, edge] };
            });
          } catch (err) {
            console.error('Failed to parse SSE edge:', err);
          }
        });

        es.addEventListener('vuln', (e: MessageEvent) => {
          try {
            const finding: VulnerabilityFinding = JSON.parse(e.data);
            setState((prev) => {
              if (prev.findings.some((f) => f.id === finding.id)) return prev;
              return {
                ...prev,
                findings: [...prev.findings, finding],
                selectedFinding: prev.selectedFinding || finding,
              };
            });
          } catch (err) {
            console.error('Failed to parse SSE vuln finding:', err);
          }
        });

        es.addEventListener('summary', (e: MessageEvent) => {
          try {
            const summary = JSON.parse(e.data);
            const impact = summary.risk_score_impact || 0;
            setState((prev) => ({
              ...prev,
              riskScore: Math.min(100, prev.riskScore + impact),
            }));
          } catch (err) {
            console.error('Failed to parse SSE summary:', err);
          }
        });

        es.addEventListener('scan_completed', (e: MessageEvent) => {
          try {
            const sessionResult = JSON.parse(e.data);
            setState((prev) => ({
              ...prev,
              status: 'completed',
              isScanning: false,
              riskScore: sessionResult.risk_score ?? prev.riskScore,
            }));
            closeEventSource();
          } catch (err) {
            console.error('Failed to parse scan_completed:', err);
          }
        });

        es.addEventListener('scan_error', (e: MessageEvent) => {
          try {
            const errData = JSON.parse(e.data);
            setState((prev) => ({
              ...prev,
              status: 'error',
              isScanning: false,
              logs: [
                ...prev.logs,
                {
                  id: `err-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                  module: 'orchestrator',
                  level: 'error',
                  message: errData.message || 'Scan error occurred upstream.',
                },
              ],
            }));
            closeEventSource();
          } catch (err) {
            console.error('Failed to parse scan_error:', err);
          }
        });

        es.onerror = () => {
          // If connection drops, conclude scanning gracefully
          setState((prev) => ({
            ...prev,
            isScanning: false,
            status: prev.status === 'running' ? 'completed' : prev.status,
          }));
          closeEventSource();
        };
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          isScanning: false,
          logs: [
            ...prev.logs,
            {
              id: `fetch-err-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              module: 'network',
              level: 'error',
              message: `Could not reach backend at ${API_BASE_URL}: ${error.message}. Ensure FastAPI is running on port 8000.`,
            },
          ],
        }));
      }
    },
    [closeEventSource]
  );

  const cancelScan = useCallback(async () => {
    if (state.sessionId) {
      try {
        await fetch(`${API_BASE_URL}/api/v1/scan/${state.sessionId}/cancel`, {
          method: 'POST',
        });
      } catch (e) {
        console.error('Cancel scan request failed:', e);
      }
    }
    closeEventSource();
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      isScanning: false,
      logs: [
        ...prev.logs,
        {
          id: `cancel-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          module: 'orchestrator',
          level: 'warn',
          message: 'Scan cancelled by user.',
        },
      ],
    }));
  }, [state.sessionId, closeEventSource]);

  const clearLogs = useCallback(() => {
    setState((prev) => ({ ...prev, logs: [] }));
  }, []);

  const selectFinding = useCallback((finding: VulnerabilityFinding) => {
    setState((prev) => ({ ...prev, selectedFinding: finding }));
  }, []);

  return {
    ...state,
    startScan,
    cancelScan,
    clearLogs,
    selectFinding,
  };
}
