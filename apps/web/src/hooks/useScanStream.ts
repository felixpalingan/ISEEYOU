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
  selectedNode: EntityNode | null;
  pivotHistory: { target: string; type: EntityType; timestamp: string }[];
  lastEnabledModules: string[] | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

/**
 * Normalizes a pivot or search target so social URLs are never turned into
 * generic domain scans (e.g., https://github.com/torvalds -> torvalds when type is username).
 */
export function normalizeTargetForType(rawInput: string, type: EntityType): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return trimmed;

  if (type === 'username' && /^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      // Check query param id (e.g. HackerNews user?id=xxx)
      const idParam = parsed.searchParams.get('id');
      if (idParam) return idParam.trim();

      const segments = parsed.pathname
        .split('/')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s !== 'about.json' && s !== 'user' && s !== 'users' && s !== 'u' && s !== 'id' && s !== 'by' && s !== 'member' && s !== 'player' && s !== 'pub' && s !== 'v2');

      if (segments.length > 0) {
        const last = segments[segments.length - 1].replace(/^@/, '').replace(/\.json$/i, '');
        if (last) return last;
      }
    } catch {
      // Fallback to raw input
    }
  }

  return trimmed;
}

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
        message: 'ISEEYOU Reconnaissance Command Center Initialized. Select mode & modules to begin.',
      },
    ],
    nodes: [],
    edges: [],
    findings: [],
    isScanning: false,
    selectedFinding: null,
    selectedNode: null,
    pivotHistory: [],
    lastEnabledModules: null,
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
    async (
      rawTarget: string,
      type: EntityType,
      isPivot: boolean = false,
      enabledModules?: string[],
      parentNodeId?: string
    ) => {
      // Guard against non-scannable entity types (e.g., port numbers or breach titles)
      if (type === 'port' || type === 'breach' || type === 'secret' || type === 'document') {
        setState((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            {
              id: `guard-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              module: 'orchestrator',
              level: 'warn',
              message: `Entity type [${type.toUpperCase()}] (${rawTarget}) is an endpoint attribute — open the Node Inspector to view details or remediate.`,
            },
          ],
        }));
        return;
      }

      const target = normalizeTargetForType(rawTarget, type);
      if (!target) return;

      closeEventSource();

      // Configure state for scan (retain graph if pivoting or running incremental module)
      setState((prev) => {
        if (isPivot) {
          const isSameTargetModuleRun = prev.target.toLowerCase() === target.toLowerCase();
          const newHistory = isSameTargetModuleRun
            ? prev.pivotHistory
            : [
                ...prev.pivotHistory,
                {
                  target: prev.target,
                  type: prev.targetType,
                  timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                },
              ];

          const sourceId = parentNodeId || `root-${prev.target}`;
          const targetId = `root-${target}`;
          const pivotEdgeExists = prev.edges.some(
            (e) => e.source === sourceId && e.target === targetId
          );

          const nextEdges =
            !isSameTargetModuleRun && !pivotEdgeExists
              ? [
                  ...prev.edges,
                  {
                    id: `edge-pivot-${Date.now()}`,
                    source: sourceId,
                    target: targetId,
                    relation: 'PIVOTED_TO',
                    confidence: 1.0,
                  },
                ]
              : prev.edges;

          return {
            ...prev,
            status: 'running',
            isScanning: true,
            target: isSameTargetModuleRun ? prev.target : target,
            targetType: isSameTargetModuleRun ? prev.targetType : type,
            pivotHistory: newHistory,
            edges: nextEdges,
            lastEnabledModules: enabledModules ?? prev.lastEnabledModules,
            logs: [
              ...prev.logs,
              {
                id: `pivot-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                module: 'orchestrator',
                level: 'info',
                message: enabledModules?.length
                  ? `[STEP-SCAN] Running module(s) [${enabledModules.join(', ')}] on [${type.toUpperCase()}] ${target}`
                  : `[PIVOT] Recursively pivoting recon investigation onto: [${type.toUpperCase()}] ${target}`,
              },
            ],
          };
        }

        // Full fresh scan session
        return {
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
          selectedNode: null,
          pivotHistory: [],
          lastEnabledModules: enabledModules ?? null,
          logs: [
            {
              id: `start-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              module: 'orchestrator',
              level: 'info',
              message: `Dispatching reconnaissance mission for [${type.toUpperCase()}]: ${target}${
                enabledModules ? ` (Active modules: ${enabledModules.join(', ')})` : ''
              }`,
            },
          ],
        };
      });

      try {
        // 1. Initialize scan session via POST
        const requestBody: {
          seed_input: string;
          force_refresh: boolean;
          enabled_modules?: string[];
        } = {
          seed_input: target,
          force_refresh: false,
        };
        if (enabledModules && enabledModules.length > 0) {
          requestBody.enabled_modules = enabledModules;
        }

        const res = await fetch(`${API_BASE_URL}/api/v1/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          let errDetail = `Backend returned HTTP ${res.status}`;
          try {
            const errJson = await res.json();
            if (errJson?.detail) errDetail = errJson.detail;
          } catch {
            // ignore
          }
          throw new Error(errDetail);
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
              timestamp:
                data.timestamp || new Date().toLocaleTimeString('en-US', { hour12: false }),
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
            const rawNode: EntityNode = JSON.parse(e.data);
            // Attach parentNodeId if this was a targeted node scan
            const node: EntityNode =
              parentNodeId && !rawNode.parentId && !rawNode.parent_id
                ? { ...rawNode, parentId: parentNodeId, parent_id: parentNodeId }
                : rawNode;

            setState((prev) => {
              // Skip if node matches the current root target seed itself
              if (
                node.value.toLowerCase() === prev.target.toLowerCase() &&
                (node.metadata?.role === 'seed' || node.metadata?.role === 'identity_seed')
              ) {
                return prev;
              }

              // Deduplicate nodes by ID OR by (type + normalized value)
              const existingIdx = prev.nodes.findIndex(
                (n) =>
                  n.id === node.id ||
                  (n.type === node.type && n.value.trim().toLowerCase() === node.value.trim().toLowerCase())
              );

              if (existingIdx !== -1) {
                const existing = prev.nodes[existingIdx];
                const updatedNode: EntityNode = {
                  ...existing,
                  metadata: { ...existing.metadata, ...node.metadata },
                  severity:
                    existing.severity === 'info' && node.severity !== 'info'
                      ? node.severity
                      : existing.severity,
                };
                const nextNodes = [...prev.nodes];
                nextNodes[existingIdx] = updatedNode;
                return { ...prev, nodes: nextNodes };
              }

              // If parentNodeId was specified, also create a direct edge from parentNodeId to this node
              const nextEdges = [...prev.edges];
              if (parentNodeId && parentNodeId !== node.id) {
                const edgeId = `edge-step-${parentNodeId}-${node.id}`;
                if (!nextEdges.some((ed) => ed.id === edgeId)) {
                  nextEdges.push({
                    id: edgeId,
                    source: parentNodeId,
                    target: node.id,
                    relation: 'DISCOVERED_FROM',
                    confidence: 1.0,
                  });
                }
              }

              return { ...prev, nodes: [...prev.nodes, node], edges: nextEdges };
            });
          } catch (err) {
            console.error('Failed to parse SSE node:', err);
          }
        });

        es.addEventListener('edge', (e: MessageEvent) => {
          try {
            const edge: EntityEdge = JSON.parse(e.data);
            setState((prev) => {
              if (
                prev.edges.some(
                  (ed) =>
                    ed.id === edge.id ||
                    (ed.source === edge.source && ed.target === edge.target && ed.relation === edge.relation)
                )
              ) {
                return prev;
              }
              return { ...prev, edges: [...prev.edges, edge] };
            });
          } catch (err) {
            console.error('Failed to parse SSE edge:', err);
          }
        });

        es.addEventListener('vuln', (e: MessageEvent) => {
          try {
            const rawFinding: VulnerabilityFinding = JSON.parse(e.data);
            const finding: VulnerabilityFinding =
              parentNodeId && !rawFinding.nodeId && !rawFinding.node_id
                ? { ...rawFinding, nodeId: parentNodeId, node_id: parentNodeId }
                : rawFinding;

            setState((prev) => {
              if (
                prev.findings.some(
                  (f) => f.id === finding.id || f.title.toLowerCase() === finding.title.toLowerCase()
                )
              ) {
                return prev;
              }
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
              riskScore: Math.max(prev.riskScore, sessionResult.risk_score ?? 0),
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
              message: `Scan request failed: ${error.message}`,
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

  const selectFinding = useCallback((finding: VulnerabilityFinding | null) => {
    setState((prev) => ({ ...prev, selectedFinding: finding }));
  }, []);

  const selectNode = useCallback((node: EntityNode | null) => {
    setState((prev) => ({ ...prev, selectedNode: node }));
  }, []);

  const resetWorkspace = useCallback(() => {
    closeEventSource();
    setState({
      sessionId: null,
      status: 'idle',
      target: 'example.com',
      targetType: 'domain',
      riskScore: 0,
      logs: [
        {
          id: `reset-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          module: 'system',
          level: 'info',
          message: 'Workspace cleared. Ready for new reconnaissance target.',
        },
      ],
      nodes: [],
      edges: [],
      findings: [],
      isScanning: false,
      selectedFinding: null,
      selectedNode: null,
      pivotHistory: [],
      lastEnabledModules: null,
    });
  }, [closeEventSource]);

  const revertPivot = useCallback(() => {
    setState((prev) => {
      if (prev.pivotHistory.length === 0) return prev;
      const prevItem = prev.pivotHistory[prev.pivotHistory.length - 1];
      const remainingHistory = prev.pivotHistory.slice(0, -1);
      return {
        ...prev,
        target: prevItem.target,
        targetType: prevItem.type,
        pivotHistory: remainingHistory,
        logs: [
          ...prev.logs,
          {
            id: `revert-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            module: 'orchestrator',
            level: 'info',
            message: `[PIVOT] Reverted investigation focus back to: [${prevItem.type.toUpperCase()}] ${prevItem.target}`,
          },
        ],
      };
    });
  }, []);

  return {
    ...state,
    startScan,
    cancelScan,
    clearLogs,
    selectFinding,
    selectNode,
    resetWorkspace,
    revertPivot,
  };
}
