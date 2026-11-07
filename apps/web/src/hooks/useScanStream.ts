'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  EntityType,
  EntityNode,
  EntityEdge,
  VulnerabilityFinding,
  NodeConfidence,
  TargetDossier,
  TimelineEvent,
  CaseFile,
} from '@iseeyou/shared-types';

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
  activeCaseName: string;
  caseNotes: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const CASES_STORAGE_KEY = 'iseeyou_osint_cases_v2';

/**
 * Normalizes a pivot or search target so social URLs are never turned into
 * generic domain scans (e.g., https://github.com/torvalds -> torvalds when type is username).
 */
export function normalizeTargetForType(rawInput: string, type: EntityType): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return trimmed;

  if ((type === 'username' || type === 'associate') && /^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const idParam = parsed.searchParams.get('id');
      if (idParam) return idParam.trim();

      const segments = parsed.pathname
        .split('/')
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length > 0 &&
            s !== 'about.json' &&
            s !== 'user' &&
            s !== 'users' &&
            s !== 'u' &&
            s !== 'id' &&
            s !== 'by' &&
            s !== 'member' &&
            s !== 'player' &&
            s !== 'pub' &&
            s !== 'v2'
        );

      if (segments.length > 0) {
        const last = segments[segments.length - 1].replace(/^@/, '').replace(/\.json$/i, '');
        if (last) return last;
      }
    } catch {
      // Fallback to raw input
    }
  }

  if (type === 'username' || type === 'associate') {
    return trimmed.replace(/^@/, '');
  }

  return trimmed;
}

/**
 * Real-Time Target Dossier & Chronological Digital Footprint Aggregator.
 * Synthesizes all discovered nodes (excluding false_positive nodes) into a single Dossier object.
 */
export function buildTargetDossier(
  target: string,
  targetType: EntityType,
  nodes: EntityNode[],
  findings: VulnerabilityFinding[]
): TargetDossier {
  const activeNodes = nodes.filter((n) => n.confidence !== 'false_positive');

  const fullNames = new Set<string>();
  const handles = new Set<string>();
  const emails = new Set<string>();
  const avatars = new Set<string>();
  const locations = new Set<string>();
  const organizations = new Set<string>();
  const domains = new Set<string>();
  const bios: Array<{ platform: string; text: string }> = [];
  const seenBios = new Set<string>();
  const socialProfiles: TargetDossier['socialProfiles'] = [];
  const seenProfileUrls = new Set<string>();
  const associates: TargetDossier['associates'] = [];
  const seenAssociates = new Set<string>();
  const timelineMap = new Map<string, TimelineEvent>();

  if (targetType === 'username') handles.add(target.replace(/^@/, ''));
  if (targetType === 'email' && target.includes('@')) {
    emails.add(target.toLowerCase());
    handles.add(target.split('@')[0]);
  }
  if (targetType === 'domain') domains.add(target.toLowerCase());

  let breachesCount = findings.filter((f) =>
    f.title.toLowerCase().includes('breach') || f.title.toLowerCase().includes('pwned')
  ).length;

  for (const node of activeNodes) {
    const meta = (node.metadata || {}) as Record<string, any>;

    if (node.type === 'breach') {
      breachesCount += 1;
    }

    // Full Names
    if (typeof meta.full_name === 'string' && meta.full_name.trim()) {
      fullNames.add(meta.full_name.trim());
    }
    if (Array.isArray(meta.full_names)) {
      for (const fn of meta.full_names) {
        if (typeof fn === 'string' && fn.trim()) fullNames.add(fn.trim());
      }
    }

    // Handles
    if (typeof meta.handle === 'string' && meta.handle.trim()) {
      handles.add(meta.handle.trim().replace(/^@/, ''));
    }
    if (Array.isArray(meta.handles)) {
      for (const h of meta.handles) {
        if (typeof h === 'string' && h.trim()) handles.add(h.trim().replace(/^@/, ''));
      }
    }
    if (node.type === 'username' && !node.value.startsWith('http') && !node.value.includes(' ')) {
      handles.add(node.value.replace(/^@/, ''));
    }

    // Emails
    if (node.type === 'email' && node.value.includes('@')) {
      emails.add(node.value.trim().toLowerCase());
    }
    if (Array.isArray(meta.commit_emails)) {
      for (const em of meta.commit_emails) {
        if (typeof em === 'string' && em.includes('@')) emails.add(em.trim().toLowerCase());
      }
    }
    if (Array.isArray(meta.emails)) {
      for (const em of meta.emails) {
        if (typeof em === 'string' && em.includes('@')) emails.add(em.trim().toLowerCase());
      }
    }

    // Avatars
    if (typeof meta.avatar_url === 'string' && meta.avatar_url.startsWith('http')) {
      avatars.add(meta.avatar_url);
    }
    if (Array.isArray(meta.avatars)) {
      for (const av of meta.avatars) {
        if (typeof av === 'string' && av.startsWith('http')) avatars.add(av);
      }
    }

    // Locations
    if (node.type === 'location' && node.value.trim()) {
      locations.add(node.value.trim());
    }
    if (typeof meta.location === 'string' && meta.location.trim()) {
      locations.add(meta.location.trim());
    }
    if (Array.isArray(meta.locations)) {
      for (const loc of meta.locations) {
        if (typeof loc === 'string' && loc.trim()) locations.add(loc.trim());
      }
    }

    // Organizations / Companies / Campuses
    if (node.type === 'organization' && node.value.trim()) {
      organizations.add(node.value.trim());
    }
    if (typeof meta.company === 'string' && meta.company.trim()) {
      organizations.add(meta.company.trim());
    }
    if (typeof meta.organization === 'string' && meta.organization.trim()) {
      organizations.add(meta.organization.trim());
    }
    if (Array.isArray(meta.organizations)) {
      for (const org of meta.organizations) {
        if (typeof org === 'string' && org.trim()) organizations.add(org.trim());
      }
    }

    // Domains
    if (node.type === 'domain' && node.value.includes('.')) {
      domains.add(node.value.trim().toLowerCase());
    }
    if (Array.isArray(meta.domains)) {
      for (const dom of meta.domains) {
        if (typeof dom === 'string' && dom.includes('.')) domains.add(dom.trim().toLowerCase());
      }
    }

    // Bios
    if (typeof meta.bio === 'string' && meta.bio.trim()) {
      const plat = String(meta.platform || 'Profile');
      const bioKey = `${plat}:${meta.bio.trim()}`;
      if (!seenBios.has(bioKey)) {
        seenBios.add(bioKey);
        bios.push({ platform: plat, text: meta.bio.trim() });
      }
    }
    if (Array.isArray(meta.bios)) {
      for (const b of meta.bios) {
        if (b && typeof b.text === 'string' && b.text.trim()) {
          const plat = String(b.platform || 'Profile');
          const bioKey = `${plat}:${b.text.trim()}`;
          if (!seenBios.has(bioKey)) {
            seenBios.add(bioKey);
            bios.push({ platform: plat, text: b.text.trim() });
          }
        }
      }
    }

    // Social Profiles
    if (node.type === 'username' && (meta.platform || meta.profile_url || node.value.startsWith('http'))) {
      const url = String(meta.profile_url || (node.value.startsWith('http') ? node.value : ''));
      const plat = String(meta.platform || node.label.split(' ')[0] || 'Account');
      const hdl = String(meta.handle || node.value);
      const key = url || `${plat}:${hdl}`;
      if (!seenProfileUrls.has(key)) {
        seenProfileUrls.add(key);
        socialProfiles.push({
          platform: plat,
          handle: hdl,
          url: url || `https://google.com/search?q=${encodeURIComponent(hdl)}`,
          category: typeof meta.category === 'string' ? meta.category : undefined,
          nodeId: node.id,
        });
      }
    }

    // Associates / Mutual Connections
    if (node.type === 'associate') {
      const hdl = String(meta.handle || node.value).replace(/^@/, '');
      if (hdl && !seenAssociates.has(hdl.toLowerCase())) {
        seenAssociates.add(hdl.toLowerCase());
        associates.push({
          handle: hdl,
          relationship: String(meta.relationship || 'Connected Associate'),
          avatarUrl: typeof meta.avatar_url === 'string' ? meta.avatar_url : undefined,
          profileUrl: typeof meta.profile_url === 'string' ? meta.profile_url : undefined,
          nodeId: node.id,
        });
      }
    }

    // Chronological Timeline Events
    if (typeof meta.created_year === 'string' && meta.created_year.trim()) {
      const plat = String(meta.platform || node.label);
      const tKey = `${meta.created_year}:${plat}`;
      if (!timelineMap.has(tKey)) {
        timelineMap.set(tKey, {
          year: meta.created_year.trim(),
          date: typeof meta.created_at === 'string' ? meta.created_at.slice(0, 10) : undefined,
          event: `Active on ${plat} (${meta.handle || node.value})`,
          platform: plat,
          nodeId: node.id,
        });
      }
    }
    if (Array.isArray(meta.timeline)) {
      for (const ev of meta.timeline) {
        if (ev && typeof ev.year === 'string' && typeof ev.event === 'string') {
          const tKey = `${ev.year}:${ev.platform || ev.event}`;
          if (!timelineMap.has(tKey)) {
            timelineMap.set(tKey, {
              year: ev.year,
              date: ev.date,
              event: ev.event,
              platform: String(ev.platform || 'OSINT'),
              nodeId: node.id,
            });
          }
        }
      }
    }
  }

  const timeline = Array.from(timelineMap.values()).sort((a, b) =>
    a.year.localeCompare(b.year)
  );

  return {
    primaryTarget: target,
    fullNames: Array.from(fullNames),
    handles: Array.from(handles),
    emails: Array.from(emails),
    avatars: Array.from(avatars),
    locations: Array.from(locations),
    organizations: Array.from(organizations),
    domains: Array.from(domains),
    bios,
    socialProfiles,
    associates,
    breachesCount,
    timeline,
  };
}

export function useScanStream() {
  const [state, setState] = useState<ScanStreamState>({
    sessionId: null,
    status: 'idle',
    target: 'torvalds',
    targetType: 'username',
    riskScore: 0,
    logs: [
      {
        id: 'init-1',
        timestamp: '00:00:00',
        module: 'system',
        level: 'info',
        message: 'ISEEYOU 2.0 OSINT Lead-Chaining Caseboard Ready. Enter a Username, Email, or Domain to begin hunting.',
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
    activeCaseName: 'Untitled Investigation',
    caseNotes: '',
  });

  const [savedCases, setSavedCases] = useState<CaseFile[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load saved cases from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(CASES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedCases(parsed);
      }
    } catch {
      // ignore storage parse errors
    }
  }, []);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      closeEventSource();
    };
  }, [closeEventSource]);

  const startScan = useCallback(
    async (
      rawTarget: string,
      rawType: EntityType,
      isPivot: boolean = false,
      enabledModules?: string[],
      parentNodeId?: string
    ) => {
      // Map 'associate' to 'username' so pivoting onto an associate hunts their username!
      const type: EntityType = rawType === 'associate' ? 'username' : rawType;

      // Guard against non-scannable endpoint attribute types
      if (
        type === 'port' ||
        type === 'breach' ||
        type === 'secret' ||
        type === 'document' ||
        type === 'organization' ||
        type === 'location'
      ) {
        setState((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            {
              id: `guard-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              module: 'orchestrator',
              level: 'warn',
              message: `Entity [${type.toUpperCase()}] (${rawTarget}) is a contextual lead — open the Tactical Dork Matrix to search documents/profiles for this lead.`,
            },
          ],
        }));
        return;
      }

      const target = normalizeTargetForType(rawTarget, type);
      if (!target) return;

      closeEventSource();

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
                  ? `[LEAD-CHAIN] Running [${enabledModules.join(', ')}] on [${type.toUpperCase()}] ${target}`
                  : `[PIVOT] Chaining investigation onto lead: [${type.toUpperCase()}] ${target}`,
              },
            ],
          };
        }

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
          activeCaseName: `Case: ${target}`,
          logs: [
            {
              id: `start-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              module: 'orchestrator',
              level: 'info',
              message: `Launching OSINT investigation for [${type.toUpperCase()}]: ${target}${
                enabledModules ? ` (Modules: ${enabledModules.join(', ')})` : ''
              }`,
            },
          ],
        };
      });

      try {
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
            const node: EntityNode =
              parentNodeId && !rawNode.parentId && !rawNode.parent_id
                ? { ...rawNode, parentId: parentNodeId, parent_id: parentNodeId }
                : rawNode;

            setState((prev) => {
              // If the backend sends an enriched root seed node with dossier metadata,
              // merge its metadata into a hidden or existing seed carrier if needed, or keep its fields
              if (
                node.value.toLowerCase() === prev.target.toLowerCase() &&
                (node.metadata?.role === 'seed' || node.metadata?.role === 'identity_seed')
              ) {
                // Check if any existing profile node can absorb timeline/dossier fields, or store as seed metadata carrier
                const hasRichMeta =
                  Array.isArray(node.metadata?.full_names) ||
                  Array.isArray(node.metadata?.timeline) ||
                  Array.isArray(node.metadata?.avatars);
                if (!hasRichMeta) {
                  return prev;
                }
              }

              const existingIdx = prev.nodes.findIndex(
                (n) =>
                  n.id === node.id ||
                  (n.type === node.type &&
                    n.value.trim().toLowerCase() === node.value.trim().toLowerCase())
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
                return {
                  ...prev,
                  nodes: nextNodes,
                  selectedNode:
                    prev.selectedNode?.id === updatedNode.id ? updatedNode : prev.selectedNode,
                };
              }

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
                    (ed.source === edge.source &&
                      ed.target === edge.target &&
                      ed.relation === edge.relation)
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

  /**
   * Manually pins a discovered clue onto the Caseboard (e.g., from a Google Dork or IG comment).
   */
  const addManualLead = useCallback(
    (
      type: EntityType,
      rawValue: string,
      customLabel?: string,
      parentNodeId?: string,
      notes?: string
    ) => {
      const value = rawValue.trim();
      if (!value) return null;

      const nodeId = `manual:${type}:${value.toLowerCase().replace(/\s+/g, '_')}`;
      const newNode: EntityNode = {
        id: nodeId,
        type,
        value,
        label: customLabel?.trim() || value,
        severity: 'info',
        parentId: parentNodeId,
        parent_id: parentNodeId,
        discoveredAt: new Date().toISOString(),
        confidence: 'verified',
        investigatorNotes: notes || 'Manually pinned investigator lead',
        isManual: true,
        metadata: {
          source: 'Investigator Manual Pin',
          handle: type === 'username' || type === 'associate' ? value.replace(/^@/, '') : undefined,
          location: type === 'location' ? value : undefined,
          organization: type === 'organization' ? value : undefined,
        },
      };

      setState((prev) => {
        const exists = prev.nodes.some((n) => n.id === nodeId);
        const nextNodes = exists
          ? prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...newNode } : n))
          : [...prev.nodes, newNode];

        const sourceId = parentNodeId || `root-${prev.target}`;
        const edgeId = `edge-manual-${sourceId}->${nodeId}`;
        const nextEdges = prev.edges.some((e) => e.id === edgeId)
          ? prev.edges
          : [
              ...prev.edges,
              {
                id: edgeId,
                source: sourceId,
                target: nodeId,
                relation: 'PINNED_CLUE',
                confidence: 1.0,
              },
            ];

        return {
          ...prev,
          nodes: nextNodes,
          edges: nextEdges,
          selectedNode: newNode,
          logs: [
            ...prev.logs,
            {
              id: `pin-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              module: 'caseboard',
              level: 'success',
              message: `[PINNED CLUE] Added manual [${type.toUpperCase()}] lead '${value}' to Caseboard.`,
            },
          ],
        };
      });

      return newNode;
    },
    []
  );

  /**
   * Updates investigator sticky notes or confidence status on a node.
   */
  const updateNodeAnnotation = useCallback(
    (
      nodeId: string,
      updates: { confidence?: NodeConfidence; investigatorNotes?: string }
    ) => {
      setState((prev) => {
        const nextNodes = prev.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                confidence: updates.confidence !== undefined ? updates.confidence : n.confidence,
                investigatorNotes:
                  updates.investigatorNotes !== undefined
                    ? updates.investigatorNotes
                    : n.investigatorNotes,
              }
            : n
        );
        const updatedSelected =
          prev.selectedNode?.id === nodeId
            ? nextNodes.find((n) => n.id === nodeId) || prev.selectedNode
            : prev.selectedNode;

        return {
          ...prev,
          nodes: nextNodes,
          selectedNode: updatedSelected,
        };
      });
    },
    []
  );

  const setCaseNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, caseNotes: notes }));
  }, []);

  /**
   * Saves the current investigation into localStorage & returns the CaseFile object.
   */
  const saveCase = useCallback(
    (customName?: string) => {
      const name = (customName || state.activeCaseName || `Case: ${state.target}`).trim();
      const now = new Date().toISOString();
      const caseFile: CaseFile = {
        id: `case-${state.target.toLowerCase().replace(/[^a-z0-9]/g, '_')}-${Date.now()}`,
        name,
        createdAt: now,
        updatedAt: now,
        seedInput: state.target,
        riskScore: state.riskScore,
        nodes: state.nodes,
        edges: state.edges,
        findings: state.findings,
        caseNotes: state.caseNotes,
      };

      setSavedCases((prev) => {
        const filtered = prev.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
        const next = [caseFile, ...filtered].slice(0, 25);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });

      setState((prev) => ({
        ...prev,
        activeCaseName: name,
        logs: [
          ...prev.logs,
          {
            id: `save-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            module: 'caseboard',
            level: 'success',
            message: `[CASE SAVED] Saved investigation '${name}' (${state.nodes.length} nodes).`,
          },
        ],
      }));

      return caseFile;
    },
    [state.activeCaseName, state.target, state.riskScore, state.nodes, state.edges, state.findings, state.caseNotes]
  );

  const loadCase = useCallback(
    (caseFile: CaseFile) => {
      closeEventSource();
      const inferredType: EntityType = caseFile.seedInput.includes('@')
        ? 'email'
        : caseFile.seedInput.includes('.')
        ? 'domain'
        : 'username';

      setState((prev) => ({
        ...prev,
        sessionId: null,
        status: 'completed',
        isScanning: false,
        target: caseFile.seedInput,
        targetType: inferredType,
        riskScore: caseFile.riskScore || 0,
        nodes: caseFile.nodes || [],
        edges: caseFile.edges || [],
        findings: caseFile.findings || [],
        selectedNode: null,
        selectedFinding: null,
        activeCaseName: caseFile.name,
        caseNotes: caseFile.caseNotes || '',
        logs: [
          ...prev.logs,
          {
            id: `load-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            module: 'caseboard',
            level: 'info',
            message: `[CASE LOADED] Restored case '${caseFile.name}' (${(caseFile.nodes || []).length} nodes).`,
          },
        ],
      }));
    },
    [closeEventSource]
  );

  const deleteCase = useCallback((caseId: string) => {
    setSavedCases((prev) => {
      const next = prev.filter((c) => c.id !== caseId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const exportCaseJson = useCallback(() => {
    const now = new Date().toISOString();
    const payload: CaseFile = {
      id: `case-${Date.now()}`,
      name: state.activeCaseName || `Case: ${state.target}`,
      createdAt: now,
      updatedAt: now,
      seedInput: state.target,
      riskScore: state.riskScore,
      nodes: state.nodes,
      edges: state.edges,
      findings: state.findings,
      caseNotes: state.caseNotes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.target.replace(/[^a-zA-Z0-9_-]/g, '_')}.case.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

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
      target: 'torvalds',
      targetType: 'username',
      riskScore: 0,
      logs: [
        {
          id: `reset-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          module: 'system',
          level: 'info',
          message: 'Caseboard cleared. Ready for new investigation.',
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
      activeCaseName: 'Untitled Investigation',
      caseNotes: '',
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

  // Real-time aggregated Target Dossier
  const dossier = useMemo(
    () =>
      buildTargetDossier(
        state.target,
        state.targetType,
        state.nodes,
        state.findings
      ),
    [state.target, state.targetType, state.nodes, state.findings]
  );

  // Visible nodes for the graph (exclude internal seed metadata carrier nodes so root isn't duplicated)
  const visibleNodes = useMemo(
    () =>
      state.nodes.filter(
        (n) =>
          !(
            n.value.toLowerCase() === state.target.toLowerCase() &&
            (n.metadata?.role === 'seed' || n.metadata?.role === 'identity_seed')
          )
      ),
    [state.nodes, state.target]
  );

  return {
    ...state,
    nodes: visibleNodes,
    allRawNodes: state.nodes,
    dossier,
    savedCases,
    startScan,
    cancelScan,
    clearLogs,
    selectFinding,
    selectNode,
    resetWorkspace,
    revertPivot,
    addManualLead,
    updateNodeAnnotation,
    setCaseNotes,
    saveCase,
    loadCase,
    deleteCase,
    exportCaseJson,
  };
}
