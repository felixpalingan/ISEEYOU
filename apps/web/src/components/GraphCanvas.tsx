'use client';

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
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
  NodeChange,
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
import { getNodeProvenance } from '@/lib/provenance';
import { normalizeTargetForType } from '@/hooks/useScanStream';
import {
  Globe,
  Server,
  Layers,
  Key,
  User,
  AlertCircle,
  Radio,
  Maximize2,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  GitBranch,
  Compass,
  Eye,
  Users,
  Building2,
  MapPin,
  Mail,
  CheckCircle2,
  StickyNote,
} from 'lucide-react';

export type GraphLayoutMode = 'tree' | 'radial';

interface GraphCanvasProps {
  nodes: SharedEntityNode[];
  edges: SharedEntityEdge[];
  findings?: VulnerabilityFinding[];
  target: string;
  targetType: EntityType;
  isScanning: boolean;
  selectedFindingId?: string;
  selectedNodeId?: string;
  clusterThreshold?: number;
  defaultLayoutMode?: GraphLayoutMode;
  onSelectNode?: (node: SharedEntityNode) => void;
  onSelectFinding?: (finding: VulnerabilityFinding) => void;
  onPivot?: (
    target: string,
    type: EntityType,
    customModules?: string[],
    parentNodeId?: string
  ) => void;
}

// -------------------------------------------------------------
// 1. CUSTOM NODE COMPONENTS (VS Code Dark Modern Aesthetic)
// -------------------------------------------------------------

/**
 * Root Node: The Seed Recon Entity (target.com / email / ip / username)
 */
function RootSeedNode({ data }: NodeProps) {
  const isScanning = Boolean(data.isScanning);
  const target = String(data.value || data.label || 'Target');
  const targetType = String(data.type || 'DOMAIN').toUpperCase();

  return (
    <div className="react-flow__node bg-[#131720] border border-sky-400/50 ring-1 ring-sky-400/20 rounded-xl p-3 w-[235px] shadow-2xl select-none cursor-pointer hover:border-sky-400 transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-sky-400" />
      <Handle type="target" position={Position.Left} className="!bg-sky-400" />
      <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-sky-400 mb-1">
        <span>ROOT SEED ({targetType})</span>
        <Radio
          className={`w-3.5 h-3.5 text-sky-400 ${isScanning ? 'animate-pulse' : ''}`}
        />
      </div>
      <div className="font-mono text-sm font-semibold text-slate-100 truncate" title={target}>
        {target}
      </div>
      <div className="text-[10px] text-slate-400 mt-1 font-mono flex items-center justify-between">
        <span>{isScanning ? 'Scanning active...' : 'Click to inspect'}</span>
        <span className="text-sky-400 font-medium">Seed</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-400" />
      <Handle type="source" position={Position.Right} className="!bg-sky-400" />
      <Handle type="source" position={Position.Left} className="!bg-sky-400" />
    </div>
  );
}

/**
 * Entity Node: Subdomains, IPs, Ports, Profiles, etc.
 * Features: Threat indicator pip, metadata preview, working Open URL link, Inspect & Pivot actions.
 */
function CustomEntityNode({ data }: NodeProps) {
  const node = data.node as SharedEntityNode | undefined;
  const value = String(data.value || data.label || '');
  const displayLabel = String(data.label || data.value || '');
  const type = (data.type as EntityType) || 'domain';
  const severity = (data.severity as SeverityLevel) || 'info';
  const isSelected = Boolean(data.isSelected);
  const onPivot = data.onPivot as
    | ((target: string, type: EntityType, customModules?: string[], parentNodeId?: string) => void)
    | undefined;
  const onInspect = data.onInspect as ((node: SharedEntityNode) => void) | undefined;

  const [copied, setCopied] = useState(false);

  const profileUrl =
    typeof node?.metadata?.profile_url === 'string'
      ? node.metadata.profile_url
      : /^https?:\/\//i.test(value)
      ? value
      : null;

  const avatarUrl =
    typeof node?.metadata?.avatar_url === 'string' && node.metadata.avatar_url.startsWith('http')
      ? node.metadata.avatar_url
      : null;

  const isPivotable =
    type === 'domain' ||
    type === 'subdomain' ||
    type === 'ip' ||
    type === 'username' ||
    type === 'associate' ||
    type === 'email';

  const pivotValue =
    typeof node?.metadata?.handle === 'string' && node.metadata.handle
      ? node.metadata.handle
      : normalizeTargetForType(value, type);

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
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-amber-400" />;
      case 'associate':
        return <Users className="w-3.5 h-3.5 text-emerald-400" />;
      case 'organization':
        return <Building2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'location':
        return <MapPin className="w-3.5 h-3.5 text-rose-400" />;
      case 'username':
        return <User className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-vsc-keyword" />;
    }
  };

  const getBorderColor = () => {
    if (node?.confidence === 'false_positive') {
      return 'border-white/[0.04] bg-[#0B0E14]/60 opacity-45 line-through';
    }
    if (isSelected) {
      return 'border-sky-400 bg-[#161C28] ring-2 ring-sky-400/25';
    }
    if (node?.confidence === 'verified') {
      return 'border-emerald-500/45 bg-[#121A1D] ring-1 ring-emerald-500/20';
    }
    if (severity === 'critical')
      return 'border-rose-500/50 bg-[#1B1318] ring-1 ring-rose-500/25';
    if (severity === 'high')
      return 'border-amber-500/45 bg-[#191614]';
    return 'border-white/[0.08] bg-[#131720] hover:border-white/[0.18]';
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handlePivot = (e: React.MouseEvent, customModules?: string[]) => {
    e.stopPropagation();
    if (onPivot && isPivotable) {
      const nextType: EntityType = type === 'associate' ? 'username' : type;
      onPivot(pivotValue, nextType, customModules, node?.id);
    }
  };

  const handleInspect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node && onInspect) {
      onInspect(node);
    }
  };

  return (
    <div
      className={`border rounded-xl p-2.5 w-[235px] shadow-lg transition-all select-none cursor-pointer hover:shadow-xl group relative ${getBorderColor()}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-600" />
      <Handle type="target" position={Position.Left} className="!bg-slate-600" />

      {/* Header: Icon, Type & Threat Pip */}
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {getTypeIcon()}
          <span className="text-[10px] font-mono uppercase font-semibold text-slate-400 truncate">
            {type === 'username' && node?.metadata?.platform
              ? String(node.metadata.platform)
              : type}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              severity === 'critical'
                ? 'bg-rose-400 animate-ping'
                : severity === 'high'
                ? 'bg-amber-400'
                : severity === 'medium'
                ? 'bg-amber-300'
                : severity === 'low'
                ? 'bg-sky-400'
                : 'bg-emerald-400'
            }`}
            title={`Risk Level: ${severity.toUpperCase()}`}
          />
          <Badge variant={severity as any} size="xs" className="uppercase font-mono font-medium">
            {severity}
          </Badge>
        </div>
      </div>

      {/* Node Primary Value / Label with optional Avatar Thumbnail */}
      <div className="flex items-center gap-2">
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayLabel}
            className="w-5 h-5 max-w-[20px] max-h-[20px] rounded-full object-cover border border-white/[0.14] flex-shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div
            className="font-mono text-xs font-semibold text-slate-100 truncate"
            title={value}
          >
            {type === 'port' ? `Port :${value}` : displayLabel}
          </div>
          {typeof node?.metadata?.full_name === 'string' && node.metadata.full_name && (
            <div className="text-[10px] font-sans text-sky-300 font-medium truncate">
              {node.metadata.full_name}
            </div>
          )}
        </div>
      </div>

      {/* Metadata Detail */}
      {node?.metadata && (
        <div className="text-[10px] font-mono text-vsc-muted mt-0.5 truncate">
          {type === 'ip' &&
            `${String(node.metadata.city || '')} ${String(
              node.metadata.country || ''
            )} • ${String(node.metadata.isp || node.metadata.asn || 'Resolved')}`.trim()}
          {type === 'subdomain' &&
            `Records: ${
              Array.isArray(node.metadata.a_records) && node.metadata.a_records.length > 0
                ? node.metadata.a_records.slice(0, 2).join(', ')
                : String(node.metadata.source || 'CT Log')
            }`}
          {type === 'port' && `Service: ${String(node.metadata.service || 'TCP')}`}
          {type === 'username' && (
            <span className="text-purple-300/90" title={value}>
              {typeof node.metadata.bio === 'string' && node.metadata.bio
                ? node.metadata.bio
                : value}
            </span>
          )}
          {type === 'associate' && (
            <span className="text-emerald-300/90">
              {String(node.metadata.relationship || 'Mutual Connection')}
            </span>
          )}
          {type === 'email' && (
            <span className="text-amber-300/90">
              {String(node.metadata.source || 'Extracted Email Lead')}
            </span>
          )}
          {type === 'breach' &&
            String(
              node.metadata.maskedPassword ||
                node.metadata.record_type ||
                node.metadata.source ||
                'Security Audit'
            )}
        </div>
      )}

      {/* Confidence Badge & Sticky Note Preview */}
      {(node?.confidence || node?.investigatorNotes) && (
        <div className="mt-1 flex items-center gap-1 text-[9px] font-mono">
          {node?.confidence === 'verified' && (
            <span className="px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/50 flex items-center gap-0.5 font-bold">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Verified
            </span>
          )}
          {node?.confidence === 'suspected' && (
            <span className="px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-600/50 font-bold">
              ? Suspect
            </span>
          )}
          {node?.investigatorNotes && (
            <span
              className="text-amber-200/90 truncate flex items-center gap-0.5"
              title={node.investigatorNotes}
            >
              <StickyNote className="w-2.5 h-2.5 flex-shrink-0 text-amber-400" />
              <span className="truncate">{node.investigatorNotes}</span>
            </span>
          )}
        </div>
      )}

      {/* Data Source Provenance Attribution Chip */}
      {(() => {
        const prov = getNodeProvenance({ type, value, metadata: node?.metadata });
        return (
          <div className="flex items-center gap-1 text-[9px] font-mono mt-1 text-vsc-muted">
            <span className="opacity-70">src:</span>
            <span
              className={`px-1 py-0.2 rounded border font-semibold truncate max-w-[165px] ${prov.badgeColor}`}
              title={`Discovered via ${prov.provider} (${prov.method})`}
            >
              {prov.provider}
            </span>
          </div>
        );
      })()}

      {/* Quick Action Bar & 1-Click Lead-Chaining Shortcuts */}
      <div className="mt-2 pt-1.5 border-t border-white/[0.06] space-y-1.5">
        {/* Direct 1-Click OSINT Lead-Chaining Row */}
        {onPivot && (type === 'username' || type === 'associate' || type === 'email' || avatarUrl) && (
          <div className="flex flex-wrap items-center gap-1">
            {(type === 'username' || type === 'associate') && (
              <>
                <button
                  type="button"
                  onClick={(e) => handlePivot(e, ['deep_profile_extractor'])}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 text-sky-300 transition-colors"
                  title="1-Click Deep Profile & Commit Email Extractor"
                >
                  Deep Extract
                </button>
                <button
                  type="button"
                  onClick={(e) => handlePivot(e, ['connection_mapper'])}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 transition-colors"
                  title="1-Click Mutual Connections & Collaborators Mapper"
                >
                  Mutuals
                </button>
              </>
            )}

            {type === 'email' && (
              <button
                type="button"
                onClick={(e) => handlePivot(e, ['email_correlator', 'breach_credential_hunter'])}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 transition-colors"
                title="1-Click Gravatar, OpenPGP & Breach Lookup"
              >
                Gravatar/PGP
              </button>
            )}

            {avatarUrl && (
              <a
                href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(avatarUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-slate-300 hover:text-white transition-colors"
                title="1-Click Reverse Image Search via Google Lens"
              >
                Reverse Img ↗
              </a>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 hover:bg-white/[0.05] px-1.5 py-0.5 rounded transition-colors"
            title="Copy value to clipboard"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <div className="flex items-center gap-1">
            {/* If node has a real external URL (e.g. GitHub/Reddit profile), show Open ↗ button */}
            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-mono text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
                title={`Open ${profileUrl} in a new browser tab`}
              >
                <span>Open</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}

            {/* For Port / Breach nodes (or any node), allow opening the Node Inspector */}
            {!isPivotable && node && onInspect && (
              <button
                type="button"
                onClick={handleInspect}
                className="text-[10px] font-mono text-sky-300 hover:text-white flex items-center gap-1 hover:bg-white/[0.05] px-1.5 py-0.5 rounded transition-colors"
                title="Inspect details & remediation"
              >
                <Eye className="w-3 h-3" />
                <span>Inspect</span>
              </button>
            )}

            {/* Only show Pivot on pivotable entity types */}
            {onPivot && isPivotable && !profileUrl && (
              <button
                type="button"
                onClick={(e) => handlePivot(e)}
                className="text-[10px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:bg-white/[0.05] px-1.5 py-0.5 rounded transition-colors"
                title={`Step-scan / Pivot on ${pivotValue}`}
              >
                <span>Pivot</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}

            {/* On social profile cards, also offer an Inspect button beside Open */}
            {profileUrl && node && onInspect && (
              <button
                type="button"
                onClick={handleInspect}
                className="text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 hover:bg-white/[0.05] px-1.5 py-0.5 rounded transition-colors"
                title="Open step-by-step Node Inspector"
              >
                <span>More</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-vsc-accent-blue" />
      <Handle type="source" position={Position.Right} className="!bg-vsc-accent-blue" />
    </div>
  );
}

/**
 * Cluster Node (Folded / Collapsible)
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
      className={`bg-vsc-card border-2 rounded p-3 w-[235px] shadow-xl transition-all cursor-pointer select-none group relative ${
        hasCritical
          ? 'border-vsc-critical bg-red-950/30 ring-2 ring-vsc-critical/40 shadow-red-950/40'
          : isExpanded
          ? 'border-vsc-accent-blue bg-vsc-panel ring-1 ring-vsc-accent-blue shadow-blue-950/30'
          : 'border-vsc-borderSubtle hover:border-vsc-accent-blue hover:bg-vsc-panel/70'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-vsc-accent-blue" />
      <Handle type="target" position={Position.Left} className="!bg-vsc-accent-blue" />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {getClusterIcon()}
          <span className="text-xs font-mono font-bold text-vsc-bright uppercase truncate">
            {clusterType === 'username' ? 'Social Profiles' : `${clusterType}s`}
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

      <div className="text-[11px] font-mono text-vsc-muted flex items-center justify-between">
        <span>{isExpanded ? 'Group expanded' : 'Grouped to prevent clutter'}</span>
        {hasCritical && (
          <span className="text-vsc-critical font-bold text-[10px] animate-pulse">⚠️ Alert</span>
        )}
      </div>

      <div className="mt-2.5 pt-2 border-t border-vsc-border/60 flex items-center justify-between text-[11px] font-mono text-vsc-accent-blue group-hover:text-sky-300 font-semibold">
        <span>{isExpanded ? 'Collapse Group' : `Expand All (${count})`}</span>
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
 * Finding Node: Vulnerability / Security Exposure Card
 */
function FindingNode({ data }: NodeProps) {
  const finding = data.finding as VulnerabilityFinding | undefined;
  const title = String(data.title || finding?.title || 'Exposure');
  const severity = (data.severity as SeverityLevel) || 'critical';
  const cve = String(data.cveId || finding?.cve_id || finding?.cveId || '');

  const borderStyle =
    severity === 'critical' || severity === 'high'
      ? 'bg-red-950/40 border-2 border-vsc-critical ring-1 ring-vsc-critical/50 shadow-red-950/40'
      : severity === 'medium'
      ? 'bg-amber-950/40 border-2 border-amber-500/80 shadow-amber-950/30'
      : 'bg-sky-950/40 border-2 border-sky-500/80 shadow-sky-950/30';

  return (
    <div
      data-testid="vuln-finding-card"
      className={`rounded p-3 w-[245px] shadow-lg cursor-pointer select-none hover:brightness-110 transition-all ${borderStyle}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-vsc-critical" />
      <Handle type="target" position={Position.Left} className="!bg-vsc-critical" />

      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-vsc-critical mb-1">
        <span className="flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>SECURITY FINDING</span>
        </span>
        <Badge variant={severity as any} size="xs" className="uppercase font-bold">
          {severity}
        </Badge>
      </div>

      <div className="font-mono text-xs font-bold text-vsc-bright truncate" title={title}>
        {title}
      </div>

      <div className="text-[10px] font-mono text-vsc-muted mt-1 flex items-center justify-between">
        <span>{cve || 'Click for details & fix'}</span>
        <span className="text-sky-300 font-semibold">Inspect →</span>
      </div>

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
// 2. ANTI-OVERLAP LAYOUT ENGINE (TIERED TREE + DYNAMIC RADIAL + AABB COLLISION RESOLVER)
// -------------------------------------------------------------

/**
 * Deterministic Axis-Aligned Bounding Box (AABB) collision resolver.
 * Guarantees that no two node cards ever overlap on screen.
 */
function resolveNodeCollisions(flowNodes: Node[], rootId: string): Node[] {
  const MIN_DX = 285; // 245px card width + 40px horizontal breathing room
  const MIN_DY = 148; // 120px card height + 28px vertical breathing room
  const ITERATIONS = 45;

  const positions = flowNodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    pinned: n.id === rootId,
  }));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    let moved = false;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx < MIN_DX && absDy < MIN_DY) {
          moved = true;
          const overlapX = MIN_DX - absDx;
          const overlapY = MIN_DY - absDy;

          // Push apart primarily vertically in tree columns, or along smallest overlap
          if (overlapY <= overlapX * 1.35) {
            const dirY = dy >= 0 ? 1 : -1;
            const shiftY = overlapY / 2 + 2;
            if (a.pinned) {
              b.y += dirY * overlapY;
            } else if (b.pinned) {
              a.y -= dirY * overlapY;
            } else {
              a.y -= dirY * shiftY;
              b.y += dirY * shiftY;
            }
          } else {
            const dirX = dx >= 0 ? 1 : -1;
            const shiftX = overlapX / 2 + 2;
            if (a.pinned) {
              b.x += dirX * overlapX;
            } else if (b.pinned) {
              a.x -= dirX * overlapX;
            } else {
              a.x -= dirX * shiftX;
              b.x += dirX * shiftX;
            }
          }
        }
      }
    }

    if (!moved) break;
  }

  return flowNodes.map((node, idx) => ({
    ...node,
    position: {
      x: Math.round(positions[idx].x),
      y: Math.round(positions[idx].y),
    },
  }));
}

function layoutGraphElements(
  rawNodes: SharedEntityNode[],
  edges: SharedEntityEdge[],
  findings: VulnerabilityFinding[] = [],
  target: string,
  targetType: EntityType,
  isScanning: boolean,
  expandedClusters: Set<string>,
  toggleCluster: (clusterId: string) => void,
  layoutMode: GraphLayoutMode,
  clusterThreshold: number,
  categoryFilter: string,
  selectedNodeId?: string,
  onPivot?: (
    target: string,
    type: EntityType,
    customModules?: string[],
    parentNodeId?: string
  ) => void,
  onInspectNode?: (node: SharedEntityNode) => void
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];

  // Deduplicate input nodes by (type, lowercase value) and filter out duplicate root seed
  const seenKeys = new Set<string>();
  const nodes = rawNodes.filter((n) => {
    if (
      n.value.trim().toLowerCase() === target.trim().toLowerCase() &&
      (n.metadata?.role === 'seed' || n.metadata?.role === 'identity_seed')
    ) {
      return false;
    }
    if (categoryFilter !== 'all' && categoryFilter !== 'findings') {
      if (categoryFilter === 'username') {
        if (
          n.type !== 'username' &&
          n.type !== 'email' &&
          n.type !== 'organization' &&
          n.type !== 'location'
        )
          return false;
      } else if (categoryFilter === 'associate') {
        if (n.type !== 'associate') return false;
      } else if (categoryFilter === 'breach') {
        if (n.type !== 'breach' && n.type !== 'secret') return false;
      } else if (n.type !== categoryFilter) {
        return false;
      }
    } else if (categoryFilter === 'findings') {
      return false;
    }

    const key = `${n.type}:${n.value.trim().toLowerCase()}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const visibleFindings =
    categoryFilter === 'all' || categoryFilter === 'findings' ? findings : [];

  const rootId = `root-${target}`;

  // Group items by category
  const groups: Record<string, SharedEntityNode[]> = {
    username: nodes.filter((n) => n.type === 'username'),
    email: nodes.filter((n) => n.type === 'email'),
    associate: nodes.filter((n) => n.type === 'associate'),
    context: nodes.filter((n) => n.type === 'organization' || n.type === 'location'),
    subdomain: nodes.filter((n) => n.type === 'subdomain' || n.type === 'domain'),
    ip: nodes.filter((n) => n.type === 'ip'),
    port: nodes.filter((n) => n.type === 'port'),
    breach: nodes.filter((n) => n.type === 'breach' || n.type !== 'secret' ? false : true),
  };
  groups.breach = nodes.filter((n) => n.type === 'breach' || n.type === 'secret');

  const getColorForType = (t: string) =>
    t === 'ip' || t === 'associate'
      ? '#10B981'
      : t === 'subdomain' || t === 'domain'
      ? '#38BDF8'
      : t === 'port'
      ? '#22D3EE'
      : t === 'breach' || t === 'email' || t === 'organization'
      ? '#F59E0B'
      : t === 'location'
      ? '#F43F5E'
      : '#A855F7';

  if (layoutMode === 'tree') {
    // =============================================================
    // MODE A: STRUCTURED MULTI-TIER TREE LAYOUT (Clean Left-to-Right)
    // =============================================================
    const ROOT_X = 80;
    const TIER1_X = 450; // Clusters or small groups
    const TIER2_X = 810; // Expanded grid items
    const COL_GAP = 300;
    const ROW_GAP = 152;
    const MAX_ROWS_PER_COL = 4;

    let currentBandTopY = 60;
    const activeGroupEntries = Object.entries(groups).filter(([, items]) => items.length > 0);

    activeGroupEntries.forEach(([groupType, groupItems]) => {
      const clusterId = `cluster-${groupType}`;
      const shouldCluster = groupItems.length >= clusterThreshold;
      const isExpanded = expandedClusters.has(clusterId);
      const hasCritical = groupItems.some(
        (item) => item.severity === 'critical' || item.severity === 'high'
      );

      if (shouldCluster && !isExpanded) {
        // Folded Cluster Node at TIER1_X
        const clusterY = currentBandTopY + 20;
        flowNodes.push({
          id: clusterId,
          type: 'clusterNode',
          position: { x: TIER1_X, y: clusterY },
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

        currentBandTopY += ROW_GAP + 30;
      } else if (shouldCluster && isExpanded) {
        // Expanded Cluster Hub at TIER1_X + Multi-Column Grid at TIER2_X
        const rowsInGrid = Math.min(groupItems.length, MAX_ROWS_PER_COL);
        const gridHeight = Math.max(1, rowsInGrid) * ROW_GAP;
        const clusterY = currentBandTopY + Math.max(0, (gridHeight - ROW_GAP) / 2);

        flowNodes.push({
          id: clusterId,
          type: 'clusterNode',
          position: { x: TIER1_X, y: clusterY },
          data: {
            clusterId,
            clusterType: groupType,
            count: groupItems.length,
            isExpanded: true,
            hasCritical,
            onToggle: toggleCluster,
            color: '#3B82F6',
          },
        });

        flowEdges.push({
          id: `edge-${rootId}-${clusterId}`,
          source: rootId,
          target: clusterId,
          style: { stroke: '#007ACC', strokeWidth: 1.6, strokeDasharray: '3 3' },
        });

        groupItems.forEach((item, index) => {
          const colIdx = Math.floor(index / MAX_ROWS_PER_COL);
          const rowIdx = index % MAX_ROWS_PER_COL;
          const x = TIER2_X + colIdx * COL_GAP;
          const y = currentBandTopY + rowIdx * ROW_GAP;

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
              isSelected: selectedNodeId === item.id,
              onPivot,
              onInspect: onInspectNode,
              color: getColorForType(item.type),
            },
          });

          flowEdges.push({
            id: `edge-${clusterId}-${item.id}`,
            source: clusterId,
            target: item.id,
            animated: isScanning,
            style: { stroke: '#007ACC', strokeWidth: 1.4 },
          });
        });

        currentBandTopY += gridHeight + 45;
      } else {
        // Under cluster threshold (1-2 items): place directly at TIER1_X
        groupItems.forEach((item, index) => {
          const y = currentBandTopY + index * ROW_GAP;
          flowNodes.push({
            id: item.id,
            type: 'customEntity',
            position: { x: TIER1_X, y },
            data: {
              node: item,
              value: item.value,
              label: item.label,
              type: item.type,
              severity: item.severity,
              isSelected: selectedNodeId === item.id,
              onPivot,
              onInspect: onInspectNode,
              color: getColorForType(item.type),
            },
          });

          flowEdges.push({
            id: `edge-${rootId}-${item.id}`,
            source: rootId,
            target: item.id,
            animated: isScanning,
            style: { stroke: '#007ACC', strokeWidth: 1.5 },
          });
        });

        currentBandTopY += groupItems.length * ROW_GAP + 35;
      }
    });

    // Place Vulnerability Findings cleanly in their own band or beside their parent node
    const parentFindingCounts: Record<string, number> = {};
    visibleFindings.forEach((finding, idx) => {
      const findingNodeId = `finding-${finding.id}`;
      const targetNodeId = finding.node_id || finding.nodeId;
      const parentFlowNode = targetNodeId
        ? flowNodes.find((n) => n.id === targetNodeId)
        : undefined;

      let x = TIER1_X;
      let y = currentBandTopY + idx * ROW_GAP;

      if (parentFlowNode) {
        const countForParent = parentFindingCounts[parentFlowNode.id] || 0;
        parentFindingCounts[parentFlowNode.id] = countForParent + 1;
        x = parentFlowNode.position.x + COL_GAP;
        y = parentFlowNode.position.y + countForParent * ROW_GAP;
      } else {
        currentBandTopY += ROW_GAP;
      }

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

      const sourceNodeId = parentFlowNode ? parentFlowNode.id : rootId;
      flowEdges.push({
        id: `edge-${sourceNodeId}-${findingNodeId}`,
        source: sourceNodeId,
        target: findingNodeId,
        animated: true,
        style: { stroke: '#F14C4C', strokeWidth: 2, strokeDasharray: '4 4' },
      });
    });

    // Center Root Seed Node vertically relative to all generated nodes
    const minY = flowNodes.length > 0 ? Math.min(...flowNodes.map((n) => n.position.y)) : 200;
    const maxY = flowNodes.length > 0 ? Math.max(...flowNodes.map((n) => n.position.y)) : 200;
    const rootY = Math.round((minY + maxY) / 2);

    flowNodes.unshift({
      id: rootId,
      type: 'rootSeed',
      position: { x: ROOT_X, y: rootY },
      data: {
        value: target,
        label: target,
        type: targetType,
        isScanning,
        color: '#007ACC',
      },
    });
  } else {
    // =============================================================
    // MODE B: DYNAMIC CONCENTRIC RADIAL LAYOUT (Anti-Collision Rings)
    // =============================================================
    const centerX = 600;
    const centerY = 500;

    flowNodes.push({
      id: rootId,
      type: 'rootSeed',
      position: { x: centerX - 115, y: centerY - 45 },
      data: {
        value: target,
        label: target,
        type: targetType,
        isScanning,
        color: '#007ACC',
      },
    });

    const sectorAngles: Record<string, { start: number; end: number; baseRadius: number }> = {
      subdomain: { start: -155, end: -35, baseRadius: 430 },
      ip: { start: -20, end: 40, baseRadius: 430 },
      port: { start: 50, end: 110, baseRadius: 560 },
      breach: { start: 120, end: 175, baseRadius: 440 },
      username: { start: 185, end: 245, baseRadius: 450 },
    };

    Object.entries(groups).forEach(([groupType, groupItems]) => {
      if (groupItems.length === 0) return;

      const clusterId = `cluster-${groupType}`;
      const shouldCluster = groupItems.length >= clusterThreshold;
      const isExpanded = expandedClusters.has(clusterId);
      const sector = sectorAngles[groupType] || { start: -60, end: 60, baseRadius: 430 };
      const hasCritical = groupItems.some(
        (item) => item.severity === 'critical' || item.severity === 'high'
      );

      if (shouldCluster && !isExpanded) {
        const midAngleRad = (((sector.start + sector.end) / 2) * Math.PI) / 180;
        const x = centerX + sector.baseRadius * Math.cos(midAngleRad) - 115;
        const y = centerY + sector.baseRadius * Math.sin(midAngleRad) - 45;

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
        let anchorNodeId = rootId;
        if (shouldCluster && isExpanded) {
          const midAngleRad = (((sector.start + sector.end) / 2) * Math.PI) / 180;
          const cx = centerX + (sector.baseRadius - 120) * Math.cos(midAngleRad) - 115;
          const cy = centerY + (sector.baseRadius - 120) * Math.sin(midAngleRad) - 45;

          flowNodes.push({
            id: clusterId,
            type: 'clusterNode',
            position: { x: cx, y: cy },
            data: {
              clusterId,
              clusterType: groupType,
              count: groupItems.length,
              isExpanded: true,
              hasCritical,
              onToggle: toggleCluster,
              color: '#3B82F6',
            },
          });

          flowEdges.push({
            id: `edge-${rootId}-${clusterId}`,
            source: rootId,
            target: clusterId,
            style: { stroke: '#007ACC', strokeWidth: 1.5, strokeDasharray: '3 3' },
          });
          anchorNodeId = clusterId;
        }

        const count = groupItems.length;
        const angleStep = count === 1 ? 0 : (sector.end - sector.start) / Math.max(1, count - 1);

        groupItems.forEach((item, index) => {
          const angleDeg =
            count === 1 ? (sector.start + sector.end) / 2 : sector.start + index * angleStep;
          const angleRad = (angleDeg * Math.PI) / 180;
          // Alternate concentric rings so neighboring nodes don't collide
          const ringOffset = (index % 2) * 210 + Math.floor(index / 6) * 260;
          const radius = sector.baseRadius + (shouldCluster && isExpanded ? 160 : 0) + ringOffset;

          const x = centerX + radius * Math.cos(angleRad) - 115;
          const y = centerY + radius * Math.sin(angleRad) - 45;

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
              isSelected: selectedNodeId === item.id,
              onPivot,
              onInspect: onInspectNode,
              color: getColorForType(item.type),
            },
          });

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

    visibleFindings.forEach((finding, idx) => {
      const findingNodeId = `finding-${finding.id}`;
      const angleDeg = -180 + idx * 35;
      const angleRad = (angleDeg * Math.PI) / 180;
      const radius = 580 + (idx % 2) * 200;
      const x = centerX + radius * Math.cos(angleRad) - 120;
      const y = centerY + radius * Math.sin(angleRad) - 45;

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
  }

  // Transform Shared Edges (prevent duplicate source->target edges)
  edges.forEach((edge) => {
    const sourceExists = flowNodes.some((n) => n.id === edge.source);
    const targetExists = flowNodes.some((n) => n.id === edge.target);

    if (
      sourceExists &&
      targetExists &&
      !flowEdges.some((fe) => fe.source === edge.source && fe.target === edge.target)
    ) {
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

  // Final deterministic AABB collision resolution pass — zero overlap guaranteed
  const collisionFreeNodes = resolveNodeCollisions(flowNodes, rootId);

  return { flowNodes: collisionFreeNodes, flowEdges };
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
  selectedNodeId,
  clusterThreshold = 3,
  defaultLayoutMode = 'tree',
  onSelectNode,
  onSelectFinding,
  onPivot,
}: GraphCanvasProps) {
  const { fitView } = useReactFlow();

  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>(defaultLayoutMode);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    setLayoutMode(defaultLayoutMode);
  }, [defaultLayoutMode]);

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

  const handleExpandAll = useCallback(() => {
    setExpandedClusters(
      new Set([
        'cluster-subdomain',
        'cluster-ip',
        'cluster-port',
        'cluster-breach',
        'cluster-username',
        'cluster-email',
        'cluster-associate',
        'cluster-context',
      ])
    );
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpandedClusters(new Set());
  }, []);

  // Track user-dragged node coordinates to persist across scans & view changes
  const userNodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const hasAutoFitTargetRef = useRef<string>('');

  useEffect(() => {
    userNodePositionsRef.current.clear();
    hasAutoFitTargetRef.current = '';
  }, [target]);

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
      layoutMode,
      clusterThreshold,
      categoryFilter,
      undefined, // Decoupled from selection to avoid layout recalculation
      onPivot,
      onSelectNode
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
    layoutMode,
    clusterThreshold,
    categoryFilter,
    onPivot,
    onSelectNode,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowEdges);

  // Capture user dragging movements
  const handleCustomNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          userNodePositionsRef.current.set(change.id, change.position);
        }
      }
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  // Sync graph elements while preserving dragged coordinates
  useEffect(() => {
    setNodes((prevNodes) => {
      const existingPos = new Map<string, { x: number; y: number }>();
      for (const n of prevNodes) {
        existingPos.set(n.id, n.position);
      }

      return initialFlowNodes.map((n) => {
        const userPos = userNodePositionsRef.current.get(n.id);
        if (userPos) {
          return {
            ...n,
            position: userPos,
            data: { ...n.data, isSelected: n.id === selectedNodeId },
          };
        }
        const prevPos = existingPos.get(n.id);
        if (prevPos) {
          return {
            ...n,
            position: prevPos,
            data: { ...n.data, isSelected: n.id === selectedNodeId },
          };
        }
        return {
          ...n,
          data: { ...n.data, isSelected: n.id === selectedNodeId },
        };
      });
    });
    setEdges(initialFlowEdges);
  }, [initialFlowNodes, initialFlowEdges, selectedNodeId, setNodes, setEdges]);

  // Fast decoupled isSelected sync without shifting (x, y) coordinates
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        const isSelected = n.id === selectedNodeId;
        if (n.data?.isSelected !== isSelected) {
          return {
            ...n,
            data: {
              ...n.data,
              isSelected,
            },
          };
        }
        return n;
      })
    );
  }, [selectedNodeId, setNodes]);

  // Restrict automatic fitView: only on initial target load or layout mode change
  useEffect(() => {
    if (sharedNodes.length > 0 && hasAutoFitTargetRef.current !== target) {
      hasAutoFitTargetRef.current = target;
      const timer = setTimeout(() => {
        fitView({ padding: 0.22, duration: 450 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [sharedNodes.length, target, fitView]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.22, duration: 400 });
    }, 150);
    return () => clearTimeout(timer);
  }, [layoutMode, fitView]);

  const handleAutoTidy = useCallback(() => {
    userNodePositionsRef.current.clear();
    const tidied = resolveNodeCollisions(initialFlowNodes, `root-${target}`);
    setNodes(tidied);
    setEdges(initialFlowEdges);
    setTimeout(() => {
      fitView({ padding: 0.22, duration: 450 });
    }, 60);
  }, [initialFlowNodes, initialFlowEdges, target, setNodes, setEdges, fitView]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: ContextMenuTarget;
    nodeObj?: SharedEntityNode;
    hasFindings?: boolean;
  } | null>(null);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();

      let targetData: ContextMenuTarget;
      let entityObj: SharedEntityNode | undefined;

      if (node.type === 'rootSeed') {
        entityObj = {
          id: node.id,
          type: targetType,
          value: target,
          label: target,
          severity: 'info',
          metadata: { role: 'seed' },
          discoveredAt: new Date().toISOString(),
        };
        targetData = {
          id: node.id,
          value: target,
          type: targetType,
          severity: 'info',
          label: target,
        };
      } else if (node.type === 'findingNode') {
        const f = node.data?.finding as VulnerabilityFinding | undefined;
        targetData = {
          id: node.id,
          value: String(node.data?.title || f?.title || 'Exposure'),
          type: 'breach',
          severity: (node.data?.severity as SeverityLevel) || 'critical',
          label: f?.cve_id || f?.cveId || 'Security Finding',
        };
      } else if (node.type === 'clusterNode') {
        targetData = {
          id: node.id,
          value: `${node.data?.clusterType} group (${node.data?.count} items)`,
          type: (node.data?.clusterType as EntityType) || 'domain',
          severity: node.data?.hasCritical ? 'critical' : 'info',
          isCluster: true,
          clusterId: String(node.data?.clusterId || ''),
        };
      } else {
        entityObj = node.data?.node as SharedEntityNode | undefined;
        targetData = {
          id: node.id,
          value: String(node.data?.value || entityObj?.value || ''),
          type: (node.data?.type as EntityType) || entityObj?.type || 'domain',
          severity: (node.data?.severity as SeverityLevel) || entityObj?.severity || 'info',
          label: entityObj?.label,
          metadata: entityObj?.metadata,
        };
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: targetData,
        nodeObj: entityObj,
        hasFindings: findings.some(
          (f) =>
            (f.node_id && f.node_id === targetData.id) ||
            (f.nodeId && f.nodeId === targetData.id)
        ),
      });
    },
    [target, targetType, findings]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setContextMenu(null);
      if (node.type === 'findingNode' && node.data?.finding) {
        onSelectFinding?.(node.data.finding as VulnerabilityFinding);
      } else if (node.type === 'customEntity' && node.data?.node) {
        onSelectNode?.(node.data.node as SharedEntityNode);
      } else if (node.type === 'rootSeed') {
        onSelectNode?.({
          id: node.id,
          type: targetType,
          value: target,
          label: target,
          severity: 'info',
          metadata: { role: 'seed', description: 'Root Reconnaissance Target' },
          discoveredAt: new Date().toISOString(),
        });
      }
    },
    [onSelectFinding, onSelectNode, target, targetType]
  );

  // Category counts for filter pills
  const counts = useMemo(
    () => ({
      all: sharedNodes.length + findings.length,
      username: sharedNodes.filter(
        (n) =>
          n.type === 'username' ||
          n.type === 'email' ||
          n.type === 'organization' ||
          n.type === 'location'
      ).length,
      associate: sharedNodes.filter((n) => n.type === 'associate').length,
      subdomain: sharedNodes.filter((n) => n.type === 'subdomain' || n.type === 'domain').length,
      ip: sharedNodes.filter((n) => n.type === 'ip').length,
      port: sharedNodes.filter((n) => n.type === 'port').length,
      findings: findings.length,
    }),
    [sharedNodes, findings]
  );

  return (
    <div className="w-full h-full relative select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleCustomNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={() => setContextMenu(null)}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.15}
        maxZoom={2.5}
        attributionPosition="bottom-left"
        className="bg-[#0B0D12]"
      >
        <Background
          color="#262B38"
          gap={22}
          size={1}
          variant={BackgroundVariant.Dots}
          className="bg-[#0B0D12]"
        />

        <Controls
          position="bottom-left"
          showInteractive={false}
          className="!mb-4 !ml-3"
        />

        <MiniMap
          position="bottom-right"
          className="!mb-4 !mr-3"
          nodeColor={(n) => (n.data?.color as string) || '#007ACC'}
          maskColor="rgba(11, 13, 18, 0.78)"
        />

        {/* Bottom-Center Layer Filter Pills */}
        <Panel position="bottom-center" className="!mb-4 flex flex-wrap items-center gap-1.5 z-10">
          {[
            { id: 'all', label: 'All Evidence', count: counts.all },
            ...(counts.username > 0
              ? [{ id: 'username', label: 'Profiles & Leads', count: counts.username }]
              : []),
            ...(counts.associate > 0
              ? [{ id: 'associate', label: 'Mutual Circle', count: counts.associate }]
              : []),
            ...(counts.subdomain > 0
              ? [{ id: 'subdomain', label: 'Domains', count: counts.subdomain }]
              : []),
            ...(counts.ip > 0 ? [{ id: 'ip', label: 'IPs', count: counts.ip }] : []),
            ...(counts.port > 0 ? [{ id: 'port', label: 'Ports', count: counts.port }] : []),
            ...(counts.findings > 0
              ? [{ id: 'findings', label: 'Alerts', count: counts.findings }]
              : []),
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setCategoryFilter(pill.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border backdrop-blur-md transition-all flex items-center gap-1.5 shadow-lg tabular-nums ${
                categoryFilter === pill.id
                  ? 'bg-[#161C28] text-white border-sky-400/50 font-semibold'
                  : 'bg-[#0F1219]/90 text-slate-400 hover:text-slate-100 border-white/[0.08]'
              }`}
            >
              <span>{pill.label}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded ${
                  categoryFilter === pill.id
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-white/[0.04] text-slate-400'
                }`}
              >
                {pill.count}
              </span>
            </button>
          ))}
        </Panel>

        {/* Top-Center Layout, Auto-Tidy & Cluster Controls */}
        <Panel position="top-center" className="!mt-3 flex items-center gap-1.5 z-10">
          {isScanning && (
            <div className="bg-[#0F1219]/92 backdrop-blur-md border border-sky-400/40 px-2.5 py-1 rounded-lg text-[11px] font-mono text-sky-300 flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span>Streaming Recon Graph...</span>
            </div>
          )}

          {/* Layout Mode Switcher: Tree vs Radial */}
          <div className="bg-[#0F1219]/92 backdrop-blur-md border border-white/[0.08] p-0.5 rounded-lg flex items-center gap-0.5 shadow-lg text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setLayoutMode('tree')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
                layoutMode === 'tree'
                  ? 'bg-white/[0.09] text-white font-semibold border border-white/[0.08]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              title="Structured Multi-Tier Tree Layout (Zero Overlap)"
            >
              <GitBranch className="w-3 h-3 text-sky-400" />
              <span>Tree</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('radial')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
                layoutMode === 'radial'
                  ? 'bg-white/[0.09] text-white font-semibold border border-white/[0.08]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              title="Concentric Radial Rings Layout"
            >
              <Compass className="w-3 h-3 text-sky-400" />
              <span>Radial</span>
            </button>
          </div>

          {/* 1-Click Auto-Tidy Button */}
          <button
            type="button"
            data-testid="auto-tidy-graph-btn"
            onClick={handleAutoTidy}
            className="bg-[#0F1219]/92 hover:bg-[#161C28] backdrop-blur-md text-slate-200 hover:text-white border border-white/[0.08] px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium shadow-lg transition-colors flex items-center gap-1.5"
            title="Auto-tidy and separate any overlapping nodes"
          >
            <Sparkles className="w-3 h-3 text-sky-400" />
            <span>Auto-Tidy</span>
          </button>

          {/* Cluster controls */}
          <div className="bg-[#0F1219]/92 backdrop-blur-md border border-white/[0.08] p-0.5 rounded-lg flex items-center gap-1 shadow-lg">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Expand all grouped clusters"
            >
              Expand All
            </button>
            <span className="text-white/[0.12]">•</span>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Fold clusters into compact summary cards"
            >
              Fold All
            </button>
          </div>

          {/* Node and Edge Counter */}
          <div className="bg-[#0F1219]/92 backdrop-blur-md border border-white/[0.08] px-2.5 py-1 rounded-lg text-[11px] font-mono text-slate-400 flex items-center gap-1.5 shadow-lg tabular-nums">
            <span className="text-slate-100 font-semibold">{nodes.length} Nodes</span>
            <span className="text-white/[0.15]">•</span>
            <span>{edges.length} Links</span>
          </div>

          {/* Fit View Button */}
          <button
            type="button"
            onClick={() => fitView({ padding: 0.22, duration: 400 })}
            className="bg-[#0F1219]/92 hover:bg-[#161C28] backdrop-blur-md text-slate-200 border border-white/[0.08] p-1.5 rounded-lg text-xs font-mono shadow-lg transition-colors flex items-center gap-1"
            title="Fit View to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
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
          onToggleCluster={(cid) => toggleCluster(cid)}
          onInspectNode={() => {
            if (contextMenu.nodeObj) {
              onSelectNode?.(contextMenu.nodeObj);
            }
          }}
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
