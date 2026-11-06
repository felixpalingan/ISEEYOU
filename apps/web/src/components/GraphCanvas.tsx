'use client';

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  MarkerType,
  Position,
  Handle,
  NodeProps,
} from '@xyflow/react';
import {
  EntityNode as SharedEntityNode,
  EntityEdge as SharedEntityEdge,
  VulnerabilityFinding,
  EntityType,
  SeverityLevel,
} from '@iseeyou/shared-types';
import { Badge } from '@/components/ui/Badge';
import { GraphContextMenu, ContextMenuTarget } from '@/components/GraphContextMenu';
import {
  Globe,
  Server,
  Layers,
  Key,
  User,
  ShieldAlert,
  AlertCircle,
  Radio,
  Maximize2,
  RefreshCw,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Unlock,
  Sliders,
} from 'lucide-react';

interface GraphCanvasProps {
  nodes: SharedEntityNode[];
  edges: SharedEntityEdge[];
  findings?: VulnerabilityFinding[];
  target: string;
  targetType: EntityType;
  isScanning: boolean;
  selectedFindingId?: string;
  onSelectNode?: (node: SharedEntityNode) => void;
  onSelectFinding?: (finding: VulnerabilityFinding) => void;
  onPivot?: (target: string, type: EntityType) => void;
}

// -------------------------------------------------------------
// 1. CUSTOM NODE COMPONENTS (VS Code Dark Modern Aesthetic)
// -------------------------------------------------------------

/**
 * Root Node: The Seed Recon Entity (target.com / email / ip)
 */
function RootSeedNode({ data }: NodeProps) {
  const isScanning = Boolean(data.isScanning);
  const target = String(data.value || data.label || 'Target');
  const targetType = String(data.type || 'DOMAIN').toUpperCase();

  return (
    <div className="react-flow__node bg-vsc-card border-2 border-vsc-accent-blue rounded p-3 min-w-[220px] max-w-[280px] shadow-xl shadow-blue-950/30 select-none">
      <Handle type="target" position={Position.Top} className="!bg-vsc-accent-blue" />
      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-vsc-accent-blue mb-1">
        <span>ROOT SEED {targetType}</span>
        <Radio className={`w-3.5 h-3.5 text-vsc-accent-blue ${isScanning ? 'animate-pulse' : ''}`} />
      </div>
      <div className="font-mono text-sm font-bold text-vsc-bright truncate" title={target}>
        {target}
      </div>
      <div className="text-[10px] text-vsc-muted mt-1 font-mono flex items-center justify-between">
        <span>{isScanning ? 'Recon in progress...' : 'Seed Anchor'}</span>
        <span className="text-vsc-keyword font-semibold">Active</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-vsc-accent-blue" />
      <Handle type="source" position={Position.Right} className="!bg-vsc-accent-blue" />
      <Handle type="source" position={Position.Left} className="!bg-vsc-accent-blue" />
    </div>
  );
}

/**
 * Entity Node: Subdomains, IPs, Ports, Profiles, etc.
 * Features: Threat indicator pip, metadata preview, hover copy & pivot actions.
 */
function CustomEntityNode({ data }: NodeProps) {
  const node = data.node as SharedEntityNode | undefined;
  const value = String(data.value || data.label || '');
  const type = (data.type as EntityType) || 'domain';
  const severity = (data.severity as SeverityLevel) || 'info';
  const onPivot = data.onPivot as ((target: string, type: EntityType) => void) | undefined;

  const [copied, setCopied] = useState(false);

  const getTypeIcon = () => {
    switch (type) {
      case 'subdomain':
      case 'domain':
        return <Globe className="w-3.5 h-3.5 text-sky-400" />;
      case 'ip':
        return <Server className="w-3.5 h-3.5 text-emerald-400" />;
      case 'port':
        return <Layers className="w-3.5 h-3.5 text-cyan-300" />;
      case 'breach':
      case 'secret':
        return <Key className="w-3.5 h-3.5 text-amber-400" />;
      case 'username':
      case 'email':
        return <User className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-vsc-keyword" />;
    }
  };

  const getBorderColor = () => {
    if (severity === 'critical') return 'border-vsc-critical bg-red-950/30 ring-1 ring-vsc-critical/40';
    if (severity === 'high') return 'border-orange-500 bg-orange-950/30 ring-1 ring-orange-500/30';
    if (severity === 'medium') return 'border-yellow-500/80 bg-yellow-950/20';
    if (type === 'ip') return 'border-emerald-500/70 hover:border-emerald-400';
    if (type === 'subdomain') return 'border-sky-500/70 hover:border-sky-400';
    return 'border-vsc-borderSubtle hover:border-vsc-accent-blue';
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handlePivot = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPivot) {
      onPivot(value, type);
    }
  };

  return (
    <div
      className={`bg-vsc-card border rounded p-2.5 min-w-[190px] max-w-[250px] shadow-md transition-all select-none hover:shadow-xl group relative ${getBorderColor()}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-vsc-borderSubtle" />
      <Handle type="target" position={Position.Left} className="!bg-vsc-borderSubtle" />

      {/* Header: Icon, Type & Threat Pip */}
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {getTypeIcon()}
          <span className="text-[10px] font-mono uppercase font-bold text-vsc-muted truncate">
            {type}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Risk Indicator Pip */}
          <span
            className={`w-2 h-2 rounded-full ${
              severity === 'critical'
                ? 'bg-vsc-critical animate-ping'
                : severity === 'high'
                ? 'bg-orange-500'
                : severity === 'medium'
                ? 'bg-yellow-500'
                : severity === 'low'
                ? 'bg-blue-400'
                : 'bg-emerald-400'
            }`}
            title={`Risk Level: ${severity.toUpperCase()}`}
          />
          <Badge variant={severity as any} size="xs" className="uppercase font-mono font-bold">
            {severity}
          </Badge>
        </div>
      </div>

      {/* Node Value */}
      <div className="font-mono text-xs font-semibold text-vsc-bright truncate" title={value}>
        {value}
      </div>

      {/* Metadata Detail */}
      {node?.metadata && (
        <div className="text-[10px] font-mono text-vsc-muted mt-1 truncate">
          {type === 'ip' && String(node.metadata.city || node.metadata.isp || 'Resolved')}
          {type === 'subdomain' && String(node.metadata.source || 'crt.sh')}
          {type === 'port' && `Service: ${String(node.metadata.service || 'TCP')}`}
          {type === 'username' && String(node.metadata.platform || 'Profile')}
          {type === 'breach' && String(node.metadata.maskedPassword || 'Pwned')}
        </div>
      )}

      {/* Quick Action Bar (Visible on Hover) */}
      <div className="mt-2 pt-1.5 border-t border-vsc-border/60 flex items-center justify-between opacity-75 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="text-[10px] font-mono text-vsc-muted hover:text-vsc-bright flex items-center gap-1 hover:bg-vsc-panel px-1.5 py-0.5 rounded transition-colors"
          title="Copy node value"
        >
          {copied ? <Check className="w-3 h-3 text-vsc-success" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        {onPivot && (
          <button
            onClick={handlePivot}
            className="text-[10px] font-mono text-vsc-accent-blue hover:text-sky-300 flex items-center gap-1 hover:bg-vsc-panel px-1.5 py-0.5 rounded transition-colors"
            title={`Pivot reconnaissance on ${value}`}
          >
            <span>Pivot</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-vsc-accent-blue" />
      <Handle type="source" position={Position.Right} className="!bg-vsc-accent-blue" />
    </div>
  );
}

/**
 * Cluster Node (Folded / Collapsible):
 * Solves the "hairball problem" by grouping dense sets of subdomains/ports/profiles into an expandable container.
 */
function ClusterNode({ data }: NodeProps) {
  const clusterId = String(data.clusterId || '');
  const clusterType = String(data.clusterType || 'items');
  const count = Number(data.count || 0);
  const isExpanded = Boolean(data.isExpanded);
  const hasCritical = Boolean(data.hasCritical);
  const onToggle = data.onToggle as ((id: string) => void) | undefined;

  const getClusterIcon = () => {
    switch (clusterType) {
      case 'subdomain':
        return <Globe className="w-4 h-4 text-sky-400" />;
      case 'ip':
        return <Server className="w-4 h-4 text-emerald-400" />;
      case 'port':
        return <Layers className="w-4 h-4 text-cyan-300" />;
      case 'breach':
        return <Key className="w-4 h-4 text-amber-400" />;
      case 'username':
      case 'email':
        return <User className="w-4 h-4 text-purple-400" />;
      default:
        return <FolderTree className="w-4 h-4 text-vsc-keyword" />;
    }
  };

  return (
    <div
      data-testid="cluster-node"
      onClick={() => onToggle?.(clusterId)}
      className={`bg-vsc-card border-2 rounded p-3 min-w-[200px] max-w-[260px] shadow-xl transition-all cursor-pointer select-none group relative ${
        hasCritical
          ? 'border-vsc-critical bg-red-950/30 ring-2 ring-vsc-critical/40 shadow-red-950/40'
          : isExpanded
          ? 'border-vsc-accent-blue bg-vsc-panel ring-1 ring-vsc-accent-blue shadow-blue-950/30'
          : 'border-vsc-borderSubtle hover:border-vsc-accent-blue hover:bg-vsc-panel/70'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-vsc-accent-blue" />
      <Handle type="target" position={Position.Left} className="!bg-vsc-accent-blue" />

      {/* Header: Icon, Cluster Name & Count */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {getClusterIcon()}
          <span className="text-xs font-mono font-bold text-vsc-bright uppercase truncate">
            {clusterType}s
          </span>
        </div>

        <Badge
          variant={hasCritical ? 'critical' : 'info'}
          size="xs"
          className="font-mono font-bold"
        >
          {count} items
        </Badge>
      </div>

      {/* Cluster Description */}
      <div className="text-[11px] font-mono text-vsc-muted flex items-center justify-between">
        <span>{isExpanded ? 'Sub-cluster expanded' : 'Folded cluster'}</span>
        {hasCritical && (
          <span className="text-vsc-critical font-bold text-[10px] animate-pulse">
            ⚠️ Alert
          </span>
        )}
      </div>

      {/* Toggle button */}
      <div className="mt-2.5 pt-2 border-t border-vsc-border/60 flex items-center justify-between text-[11px] font-mono text-vsc-accent-blue group-hover:text-sky-300 font-semibold">
        <span>{isExpanded ? 'Collapse Cluster' : `Expand (+${count})`}</span>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 transition-transform" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 transition-transform" />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-vsc-accent-blue" />
      <Handle type="source" position={Position.Right} className="!bg-vsc-accent-blue" />
    </div>
  );
}

/**
 * Finding Node: High / Critical Vulnerability Exposures
 */
function FindingNode({ data }: NodeProps) {
  const finding = data.finding as VulnerabilityFinding | undefined;
  const title = String(data.title || finding?.title || 'Exposure');
  const severity = (data.severity as SeverityLevel) || 'critical';
  const cve = String(data.cveId || finding?.cve_id || finding?.cveId || '');

  return (
    <div
      data-testid="vuln-finding-card"
      className="bg-red-950/40 border-2 border-vsc-critical rounded p-3 min-w-[210px] max-w-[260px] shadow-lg shadow-red-950/40 cursor-pointer select-none hover:bg-red-950/60 transition-all ring-1 ring-vsc-critical/50"
    >
      <Handle type="target" position={Position.Top} className="!bg-vsc-critical" />
      <Handle type="target" position={Position.Left} className="!bg-vsc-critical" />

      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-vsc-critical mb-1">
        <span className="flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>VULNERABILITY</span>
        </span>
        <Badge variant={severity as any} size="xs" className="uppercase font-bold">
          {severity}
        </Badge>
      </div>

      <div className="font-mono text-xs font-bold text-vsc-bright truncate" title={title}>
        {title}
      </div>

      {cve && (
        <div className="text-[10px] font-mono text-cyan-300 mt-1 font-bold">
          {cve}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-vsc-critical" />
      <Handle type="source" position={Position.Right} className="!bg-vsc-critical" />
    </div>
  );
}

const nodeTypes = {
  rootSeed: RootSeedNode,
  customEntity: CustomEntityNode,
  clusterNode: ClusterNode,
  findingNode: FindingNode,
};

// -------------------------------------------------------------
// 2. LAYOUT ENGINE WITH CLUSTER VIRTUALIZATION & FOLDING
// -------------------------------------------------------------

const CLUSTER_THRESHOLD = 3; // Groups into a ClusterNode if items >= 3

function layoutGraphElements(
  nodes: SharedEntityNode[],
  edges: SharedEntityEdge[],
  findings: VulnerabilityFinding[] = [],
  target: string,
  targetType: EntityType,
  isScanning: boolean,
  expandedClusters: Set<string>,
  toggleCluster: (clusterId: string) => void,
  onPivot?: (target: string, type: EntityType) => void
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];

  const centerX = 500;
  const centerY = 400;

  // 1. Create Root Seed Node
  const rootId = `root-${target}`;
  flowNodes.push({
    id: rootId,
    type: 'rootSeed',
    position: { x: centerX - 120, y: centerY - 40 },
    data: {
      value: target,
      label: target,
      type: targetType,
      isScanning,
      color: '#007ACC',
    },
  });

  // 2. Classify items
  const groups: Record<string, SharedEntityNode[]> = {
    subdomain: nodes.filter((n) => n.type === 'subdomain'),
    ip: nodes.filter((n) => n.type === 'ip'),
    port: nodes.filter((n) => n.type === 'port'),
    breach: nodes.filter((n) => n.type === 'breach' || n.type === 'secret'),
    username: nodes.filter((n) => n.type === 'username' || n.type === 'email'),
  };

  // Angular sectors for each group
  const sectorAngles: Record<string, { start: number; end: number; radius: number }> = {
    subdomain: { start: -150, end: -30, radius: 290 },
    ip: { start: -15, end: 45, radius: 330 },
    port: { start: 50, end: 100, radius: 480 },
    breach: { start: 110, end: 175, radius: 310 },
    username: { start: 185, end: 245, radius: 320 },
  };

  // Process each group (Folded or Expanded)
  Object.entries(groups).forEach(([groupType, groupItems]) => {
    if (groupItems.length === 0) return;

    const clusterId = `cluster-${groupType}`;
    const shouldCluster = groupItems.length >= CLUSTER_THRESHOLD;
    const isExpanded = expandedClusters.has(clusterId);
    const sector = sectorAngles[groupType] || { start: -60, end: 60, radius: 300 };

    if (shouldCluster && !isExpanded) {
      // -------------------------------------------------------------
      // FOLDED: Render a single ClusterNode representing the group
      // -------------------------------------------------------------
      const midAngleDeg = (sector.start + sector.end) / 2;
      const midAngleRad = (midAngleDeg * Math.PI) / 180;
      const x = centerX + sector.radius * Math.cos(midAngleRad) - 100;
      const y = centerY + sector.radius * Math.sin(midAngleRad) - 40;

      const hasCritical = groupItems.some(
        (item) => item.severity === 'critical' || item.severity === 'high'
      );

      flowNodes.push({
        id: clusterId,
        type: 'clusterNode',
        position: { x, y },
        data: {
          clusterId,
          clusterType: groupType,
          count: groupItems.length,
          isExpanded: false,
          hasCritical,
          onToggle: toggleCluster,
          color: hasCritical ? '#F14C4C' : '#007ACC',
        },
      });

      flowEdges.push({
        id: `edge-${rootId}-${clusterId}`,
        source: rootId,
        target: clusterId,
        animated: isScanning,
        style: { stroke: hasCritical ? '#F14C4C' : '#007ACC', strokeWidth: 1.8 },
      });
    } else {
      // -------------------------------------------------------------
      // EXPANDED or UNDER THRESHOLD: Render individual EntityNodes
      // -------------------------------------------------------------
      // If was clustered and is now expanded, also place the cluster parent node as anchor
      let anchorNodeId = rootId;

      if (shouldCluster && isExpanded) {
        const midAngleDeg = (sector.start + sector.end) / 2;
        const midAngleRad = (midAngleDeg * Math.PI) / 180;
        const cx = centerX + (sector.radius - 80) * Math.cos(midAngleRad) - 100;
        const cy = centerY + (sector.radius - 80) * Math.sin(midAngleRad) - 40;

        flowNodes.push({
          id: clusterId,
          type: 'clusterNode',
          position: { x: cx, y: cy },
          data: {
            clusterId,
            clusterType: groupType,
            count: groupItems.length,
            isExpanded: true,
            hasCritical: groupItems.some((i) => i.severity === 'critical'),
            onToggle: toggleCluster,
            color: '#3B82F6',
          },
        });

        flowEdges.push({
          id: `edge-${rootId}-${clusterId}`,
          source: rootId,
          target: clusterId,
          style: { stroke: '#007ACC', strokeWidth: 1.5, strokeDasharray: '2 2' },
        });

        anchorNodeId = clusterId;
      }

      // Fan out individual child nodes in arc
      const count = groupItems.length;
      const angleStep = count === 1 ? 0 : (sector.end - sector.start) / (count - 1);

      groupItems.forEach((item, index) => {
        const angleDeg = count === 1 ? (sector.start + sector.end) / 2 : sector.start + index * angleStep;
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = centerX + sector.radius * Math.cos(angleRad) - 100;
        const y = centerY + sector.radius * Math.sin(angleRad) - 30;

        flowNodes.push({
          id: item.id,
          type: 'customEntity',
          position: { x, y },
          data: {
            node: item,
            value: item.value,
            label: item.label,
            type: item.type,
            severity: item.severity,
            onPivot,
            color:
              item.type === 'ip'
                ? '#10B981'
                : item.type === 'subdomain'
                ? '#38BDF8'
                : item.type === 'port'
                ? '#22D3EE'
                : '#A855F7',
          },
        });

        // Edge connecting from anchor (Cluster node if clustered, or Root node)
        flowEdges.push({
          id: `edge-${anchorNodeId}-${item.id}`,
          source: anchorNodeId,
          target: item.id,
          animated: isScanning,
          style: { stroke: '#007ACC', strokeWidth: 1.4 },
        });
      });
    }
  });

  // 3. Vulnerability findings nodes
  findings.forEach((finding, idx) => {
    const findingNodeId = `finding-${finding.id}`;
    const angleDeg = 65 + idx * 28;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = centerX + 400 * Math.cos(angleRad) - 110;
    const y = centerY + 400 * Math.sin(angleRad) - 40;

    flowNodes.push({
      id: findingNodeId,
      type: 'findingNode',
      position: { x, y },
      data: {
        finding,
        title: finding.title,
        severity: finding.severity,
        cveId: finding.cve_id || finding.cveId,
        color: '#F14C4C',
      },
    });

    const targetNodeId = finding.node_id || finding.nodeId;
    const sourceNode =
      targetNodeId && flowNodes.some((n) => n.id === targetNodeId) ? targetNodeId : rootId;

    flowEdges.push({
      id: `edge-${sourceNode}-${findingNodeId}`,
      source: sourceNode,
      target: findingNodeId,
      animated: true,
      style: { stroke: '#F14C4C', strokeWidth: 2, strokeDasharray: '4 4' },
    });
  });

  // 4. Transform Shared Edges
  edges.forEach((edge) => {
    const sourceExists = flowNodes.some((n) => n.id === edge.source);
    const targetExists = flowNodes.some((n) => n.id === edge.target);

    if (sourceExists && targetExists) {
      flowEdges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: isScanning,
        label: edge.relation ? edge.relation.toLowerCase() : undefined,
        labelStyle: { fill: '#858585', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#1E1E1E', fillOpacity: 0.8 },
        style: { stroke: '#007ACC', strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: '#007ACC',
        },
      });
    }
  });

  return { flowNodes, flowEdges };
}

// -------------------------------------------------------------
// 3. INNER REACT FLOW CANVAS WRAPPER (Uses useReactFlow)
// -------------------------------------------------------------

function FlowCanvasInner({
  nodes: sharedNodes,
  edges: sharedEdges,
  findings = [],
  target,
  targetType,
  isScanning,
  selectedFindingId,
  onSelectNode,
  onSelectFinding,
  onPivot,
}: GraphCanvasProps) {
  const { fitView } = useReactFlow();

  // State to manage which clusters are expanded (default: collapsed for clean initial graph)
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  // Toggle single cluster
  const toggleCluster = useCallback((clusterId: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  }, []);

  // Expand all / Collapse all helpers
  const handleExpandAll = useCallback(() => {
    setExpandedClusters(
      new Set([
        'cluster-subdomain',
        'cluster-ip',
        'cluster-port',
        'cluster-breach',
        'cluster-username',
      ])
    );
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpandedClusters(new Set());
  }, []);

  // Compute Layout with current expansion state
  const { initialFlowNodes, initialFlowEdges } = useMemo(() => {
    const { flowNodes, flowEdges } = layoutGraphElements(
      sharedNodes,
      sharedEdges,
      findings,
      target,
      targetType,
      isScanning,
      expandedClusters,
      toggleCluster,
      onPivot
    );
    return { initialFlowNodes: flowNodes, initialFlowEdges: flowEdges };
  }, [
    sharedNodes,
    sharedEdges,
    findings,
    target,
    targetType,
    isScanning,
    expandedClusters,
    toggleCluster,
    onPivot,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowEdges);

  // Sync state whenever props or expansion toggles change
  useEffect(() => {
    setNodes(initialFlowNodes);
    setEdges(initialFlowEdges);
  }, [initialFlowNodes, initialFlowEdges, setNodes, setEdges]);

  // Fit View with transition
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.25, duration: 500 });
    }, 150);
    return () => clearTimeout(timer);
  }, [sharedNodes.length, findings.length, expandedClusters.size, fitView]);

  // State for right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: ContextMenuTarget;
    hasFindings?: boolean;
  } | null>(null);

  // Handle right-click on canvas nodes to trigger context menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();

      let targetData: ContextMenuTarget;

      if (node.type === 'rootSeed') {
        targetData = {
          id: node.id,
          value: String(node.data?.value || target),
          type: (node.data?.type as EntityType) || targetType,
          severity: 'info',
          label: String(node.data?.label || target),
        };
      } else if (node.type === 'findingNode') {
        const f = node.data?.finding as VulnerabilityFinding | undefined;
        targetData = {
          id: node.id,
          value: String(node.data?.title || f?.title || 'Exposure'),
          type: 'domain',
          severity: (node.data?.severity as SeverityLevel) || 'critical',
          label: f?.cve_id || f?.cveId || 'Vulnerability',
        };
      } else if (node.type === 'clusterNode') {
        targetData = {
          id: node.id,
          value: `${node.data?.clusterType} cluster (${node.data?.count} items)`,
          type: (node.data?.clusterType as EntityType) || 'domain',
          severity: node.data?.hasCritical ? 'critical' : 'info',
        };
      } else {
        const entity = node.data?.node as SharedEntityNode | undefined;
        targetData = {
          id: node.id,
          value: String(node.data?.value || entity?.value || ''),
          type: (node.data?.type as EntityType) || entity?.type || 'domain',
          severity: (node.data?.severity as SeverityLevel) || entity?.severity || 'info',
          label: entity?.label,
          metadata: entity?.metadata,
        };
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: targetData,
        hasFindings: findings.some(
          (f) =>
            (f.node_id && f.node_id === targetData.id) ||
            (f.nodeId && f.nodeId === targetData.id)
        ),
      });
    },
    [target, targetType, findings]
  );

  // Handle node clicks
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setContextMenu(null);
      if (node.type === 'findingNode' && node.data?.finding) {
        onSelectFinding?.(node.data.finding as VulnerabilityFinding);
      } else if (node.type === 'customEntity' && node.data?.node) {
        onSelectNode?.(node.data.node as SharedEntityNode);
      }
    },
    [onSelectFinding, onSelectNode]
  );

  return (
    <div className="w-full h-full relative select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={() => setContextMenu(null)}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2.5}
        attributionPosition="bottom-left"
        className="bg-[#1E1E1E]"
      >
        {/* Dark Grid Background matching VS Code Dark Modern */}
        <Background
          color="#333333"
          gap={20}
          size={1}
          variant={BackgroundVariant.Dots}
          className="bg-[#1E1E1E]"
        />

        {/* Zoom & Navigation Controls */}
        <Controls
          position="bottom-left"
          showInteractive={false}
          className="!mb-8 !ml-3"
        />

        {/* Minimap positioned bottom-right */}
        <MiniMap
          position="bottom-right"
          className="!mb-8 !mr-3"
          nodeColor={(n) => (n.data?.color as string) || '#007ACC'}
          maskColor="rgba(24, 24, 24, 0.75)"
        />

        {/* Top Control Bar Panel */}
        <Panel position="top-right" className="!mt-3 !mr-3 flex items-center gap-2">
          {isScanning && (
            <div className="bg-vsc-card/90 backdrop-blur border border-vsc-accent-blue px-2.5 py-1 rounded text-[11px] font-mono text-vsc-accent-blue flex items-center gap-1.5 shadow-lg shadow-blue-950/20">
              <span className="w-2 h-2 rounded-full bg-vsc-accent-blue animate-ping" />
              <span>Streaming Recon Graph...</span>
            </div>
          )}

          {/* Cluster controls */}
          <div className="bg-vsc-sidebar/90 backdrop-blur border border-vsc-border p-0.5 rounded flex items-center gap-1 shadow-md">
            <button
              onClick={handleExpandAll}
              className="px-2 py-0.5 rounded text-[10px] font-mono text-vsc-muted hover:text-vsc-bright hover:bg-vsc-panel transition-colors"
              title="Expand all clusters"
            >
              Expand All
            </button>
            <span className="text-vsc-border">•</span>
            <button
              onClick={handleCollapseAll}
              className="px-2 py-0.5 rounded text-[10px] font-mono text-vsc-muted hover:text-vsc-bright hover:bg-vsc-panel transition-colors"
              title="Collapse all clusters to avoid hairball"
            >
              Fold All
            </button>
          </div>

          {/* Node and Edge Counter */}
          <div className="bg-vsc-sidebar/90 backdrop-blur border border-vsc-border px-3 py-1 rounded text-xs font-mono text-vsc-muted flex items-center gap-2 shadow-md">
            <span className="text-vsc-bright font-bold">{nodes.length} Visible</span>
            <span>•</span>
            <span>{edges.length} Links</span>
          </div>

          {/* Fit View Button */}
          <button
            onClick={() => fitView({ padding: 0.25, duration: 400 })}
            className="bg-vsc-sidebar hover:bg-vsc-card text-vsc-bright border border-vsc-border p-1.5 rounded text-xs font-mono shadow transition-colors flex items-center gap-1"
            title="Fit View"
          >
            <Maximize2 className="w-3.5 h-3.5 text-vsc-muted" />
          </button>

          {/* Reset Layout Button */}
          <button
            onClick={() => {
              setNodes(initialFlowNodes);
              setEdges(initialFlowEdges);
              fitView({ padding: 0.25, duration: 400 });
            }}
            className="bg-vsc-sidebar hover:bg-vsc-card text-vsc-bright border border-vsc-border p-1.5 rounded text-xs font-mono shadow transition-colors flex items-center gap-1"
            title="Reset Graph Layout"
          >
            <RefreshCw className="w-3.5 h-3.5 text-vsc-muted" />
          </button>
        </Panel>
      </ReactFlow>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <GraphContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          hasFindings={contextMenu.hasFindings}
          onClose={() => setContextMenu(null)}
          onPivot={(pTarget, pType) => onPivot?.(pTarget, pType)}
          onInspectFindings={() => {
            const matched = findings.find(
              (f) =>
                (f.node_id && f.node_id === contextMenu.target.id) ||
                (f.nodeId && f.nodeId === contextMenu.target.id)
            );
            if (matched) {
              onSelectFinding?.(matched);
            }
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 4. MAIN EXPORTED COMPONENT (Provides ReactFlowProvider)
// -------------------------------------------------------------

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-[#1E1E1E]">
      <ReactFlowProvider>
        <FlowCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
