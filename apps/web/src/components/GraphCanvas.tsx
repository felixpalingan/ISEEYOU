'use client';

import React, { useMemo, useCallback, useEffect } from 'react';
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
  Zap,
  ExternalLink,
  Lock,
  Unlock,
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
 */
function CustomEntityNode({ data }: NodeProps) {
  const node = data.node as SharedEntityNode | undefined;
  const value = String(data.value || data.label || '');
  const type = (data.type as EntityType) || 'domain';
  const severity = (data.severity as SeverityLevel) || 'info';

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
    if (severity === 'critical') return 'border-vsc-critical bg-red-950/20 shadow-red-950/20';
    if (severity === 'high') return 'border-orange-500 bg-orange-950/20 shadow-orange-950/20';
    if (severity === 'medium') return 'border-yellow-500/80 bg-yellow-950/20';
    if (type === 'ip') return 'border-emerald-500/70 hover:border-emerald-400';
    if (type === 'subdomain') return 'border-sky-500/70 hover:border-sky-400';
    return 'border-vsc-borderSubtle hover:border-vsc-accent-blue';
  };

  return (
    <div
      className={`bg-vsc-card border rounded p-2.5 min-w-[180px] max-w-[240px] shadow-md transition-all select-none hover:shadow-lg ${getBorderColor()}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-vsc-borderSubtle" />
      <Handle type="target" position={Position.Left} className="!bg-vsc-borderSubtle" />

      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {getTypeIcon()}
          <span className="text-[10px] font-mono uppercase font-bold text-vsc-muted truncate">
            {type}
          </span>
        </div>
        <Badge variant={severity as any} size="xs" className="uppercase font-mono font-bold">
          {severity}
        </Badge>
      </div>

      <div className="font-mono text-xs font-semibold text-vsc-bright truncate" title={value}>
        {value}
      </div>

      {node?.metadata && (
        <div className="text-[10px] font-mono text-vsc-muted mt-1 truncate">
          {type === 'ip' && String(node.metadata.city || node.metadata.isp || 'Resolved')}
          {type === 'subdomain' && String(node.metadata.source || 'crt.sh')}
          {type === 'port' && `Service: ${String(node.metadata.service || 'TCP')}`}
          {type === 'username' && String(node.metadata.platform || 'Profile')}
          {type === 'breach' && String(node.metadata.maskedPassword || 'Pwned')}
        </div>
      )}

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
  findingNode: FindingNode,
};

// -------------------------------------------------------------
// 2. RADIAL / HIERARCHICAL LAYOUT COMPUTATION
// -------------------------------------------------------------

function layoutGraphElements(
  nodes: SharedEntityNode[],
  edges: SharedEntityEdge[],
  findings: VulnerabilityFinding[] = [],
  target: string,
  targetType: EntityType,
  isScanning: boolean
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];

  const centerX = 450;
  const centerY = 350;

  // 1. Create Root Node
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

  // 2. Separate nodes by classification
  const subdomains = nodes.filter((n) => n.type === 'subdomain');
  const ips = nodes.filter((n) => n.type === 'ip');
  const ports = nodes.filter((n) => n.type === 'port');
  const breaches = nodes.filter((n) => n.type === 'breach' || n.type === 'secret');
  const profiles = nodes.filter((n) => n.type === 'username' || n.type === 'email');
  const others = nodes.filter(
    (n) => !['subdomain', 'ip', 'port', 'breach', 'secret', 'username', 'email'].includes(n.type)
  );

  // Helper to place items along an angular arc
  const placeArc = (
    items: SharedEntityNode[],
    startAngleDeg: number,
    endAngleDeg: number,
    radius: number
  ) => {
    const count = items.length;
    if (count === 0) return;

    const angleStep =
      count === 1
        ? 0
        : (endAngleDeg - startAngleDeg) / (count - 1);

    items.forEach((item, index) => {
      const angleDeg = count === 1 ? (startAngleDeg + endAngleDeg) / 2 : startAngleDeg + index * angleStep;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = centerX + radius * Math.cos(angleRad) - 100;
      const y = centerY + radius * Math.sin(angleRad) - 30;

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

      // Default root edge if no explicit parent edge
      const hasParentEdge = edges.some((e) => e.target === item.id || e.source === item.id);
      if (!hasParentEdge) {
        flowEdges.push({
          id: `edge-root-${item.id}`,
          source: rootId,
          target: item.id,
          animated: isScanning,
          style: { stroke: '#007ACC', strokeWidth: 1.5 },
        });
      }
    });
  };

  // Subdomains: Upper Arc (-140° to -40°, radius 280)
  placeArc(subdomains, -140, -40, 280);

  // IPs: Right Arc (-20° to 45°, radius 320)
  placeArc(ips, -20, 45, 320);

  // Ports: Further Right Outer Arc (50° to 90°, radius 480)
  placeArc(ports, 50, 95, 480);

  // Breaches / Secrets: Bottom Arc (105° to 170°, radius 300)
  placeArc(breaches, 105, 170, 300);

  // Profiles: Left Arc (185° to 240°, radius 310)
  placeArc(profiles, 185, 240, 310);

  // Others: Left Outer Arc (245° to 280°, radius 340)
  placeArc(others, 245, 280, 340);

  // 3. Vulnerability findings nodes (Placed prominently near related IP/subdomain or bottom)
  findings.forEach((finding, idx) => {
    const findingNodeId = `finding-${finding.id}`;
    const angleDeg = 70 + idx * 25;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = centerX + 360 * Math.cos(angleRad) - 110;
    const y = centerY + 360 * Math.sin(angleRad) - 40;

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
    const sourceNode = targetNodeId && flowNodes.some((n) => n.id === targetNodeId) ? targetNodeId : rootId;

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
    // Only add if source and target exist in flowNodes
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
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Layout conversion
  const { initialFlowNodes, initialFlowEdges } = useMemo(() => {
    const { flowNodes, flowEdges } = layoutGraphElements(
      sharedNodes,
      sharedEdges,
      findings,
      target,
      targetType,
      isScanning
    );
    return { initialFlowNodes: flowNodes, initialFlowEdges: flowEdges };
  }, [sharedNodes, sharedEdges, findings, target, targetType, isScanning]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowEdges);

  // Sync when props change
  useEffect(() => {
    setNodes(initialFlowNodes);
    setEdges(initialFlowEdges);
  }, [initialFlowNodes, initialFlowEdges, setNodes, setEdges]);

  // Auto-fit on initial render or node count change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 600 });
    }, 150);
    return () => clearTimeout(timer);
  }, [sharedNodes.length, findings.length, fitView]);

  // Handle node clicks
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
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
        fitView
        fitViewOptions={{ padding: 0.2 }}
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
              <span>Streaming Graph Nodes...</span>
            </div>
          )}

          <div className="bg-vsc-sidebar/90 backdrop-blur border border-vsc-border px-3 py-1 rounded text-xs font-mono text-vsc-muted flex items-center gap-2 shadow-md">
            <span className="text-vsc-bright font-bold">{nodes.length} Nodes</span>
            <span>•</span>
            <span>{edges.length} Links</span>
          </div>

          <button
            onClick={() => fitView({ padding: 0.2, duration: 400 })}
            className="bg-vsc-sidebar hover:bg-vsc-card text-vsc-bright border border-vsc-border p-1.5 rounded text-xs font-mono shadow transition-colors flex items-center gap-1"
            title="Fit View"
          >
            <Maximize2 className="w-3.5 h-3.5 text-vsc-muted" />
          </button>

          <button
            onClick={() => {
              setNodes(initialFlowNodes);
              setEdges(initialFlowEdges);
              fitView({ padding: 0.2, duration: 400 });
            }}
            className="bg-vsc-sidebar hover:bg-vsc-card text-vsc-bright border border-vsc-border p-1.5 rounded text-xs font-mono shadow transition-colors flex items-center gap-1"
            title="Reset Graph Layout"
          >
            <RefreshCw className="w-3.5 h-3.5 text-vsc-muted" />
          </button>
        </Panel>
      </ReactFlow>
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
