'use client';

import React, { useState, useMemo } from 'react';
import {
  EntityNode,
  EntityEdge,
  VulnerabilityFinding,
  SeverityLevel,
  EntityType,
} from '@iseeyou/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  Info,
  Server,
  Globe,
  Database,
  User,
  Key,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  Check,
  Copy,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  FileJson,
  XCircle,
  Radio,
} from 'lucide-react';

interface StructuredDataViewProps {
  nodes: EntityNode[];
  edges: EntityEdge[];
  findings: VulnerabilityFinding[];
  target: string;
  targetType: EntityType;
  riskScore: number;
  riskLevel: string;
  isScanning: boolean;
  selectedFindingId?: string;
  onSelectFinding: (finding: VulnerabilityFinding) => void;
  onPivot?: (target: string, type: EntityType) => void;
}

type TabMode = 'findings' | 'assets' | 'edges';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SortField = 'severity' | 'name' | 'time';
type SortDirection = 'asc' | 'desc';

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export function StructuredDataView({
  nodes,
  edges,
  findings,
  target,
  targetType,
  riskScore,
  riskLevel,
  isScanning,
  selectedFindingId,
  onSelectFinding,
  onPivot,
}: StructuredDataViewProps) {
  // Navigation & Filter State
  const [activeTab, setActiveTab] = useState<TabMode>('findings');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Compute Metrics
  const criticalCount = useMemo(
    () => findings.filter((f) => f.severity.toLowerCase() === 'critical').length,
    [findings]
  );
  const highCount = useMemo(
    () => findings.filter((f) => f.severity.toLowerCase() === 'high').length,
    [findings]
  );
  const mediumCount = useMemo(
    () => findings.filter((f) => f.severity.toLowerCase() === 'medium').length,
    [findings]
  );
  const lowCount = useMemo(
    () => findings.filter((f) => f.severity.toLowerCase() === 'low' || f.severity.toLowerCase() === 'info').length,
    [findings]
  );

  const subdomainsCount = useMemo(
    () => nodes.filter((n) => n.type === 'subdomain').length,
    [nodes]
  );
  const ipsCount = useMemo(
    () => nodes.filter((n) => n.type === 'ip').length,
    [nodes]
  );
  const portsCount = useMemo(
    () => nodes.filter((n) => n.type === 'port').length,
    [nodes]
  );
  const breachesCount = useMemo(
    () => nodes.filter((n) => n.type === 'breach' || n.type === 'secret').length,
    [nodes]
  );
  const profilesCount = useMemo(
    () => nodes.filter((n) => n.type === 'username' || n.type === 'email').length,
    [nodes]
  );

  // Filtered & Sorted Findings
  const filteredFindings = useMemo(() => {
    return findings
      .filter((finding) => {
        if (severityFilter !== 'all' && finding.severity.toLowerCase() !== severityFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = finding.title.toLowerCase().includes(q);
          const matchCve = (finding.cve_id || finding.cveId || '').toLowerCase().includes(q);
          const matchEvidence = finding.evidence.toLowerCase().includes(q);
          if (!matchTitle && !matchCve && !matchEvidence) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'severity') {
          const weightA = SEVERITY_WEIGHTS[a.severity.toLowerCase()] ?? 0;
          const weightB = SEVERITY_WEIGHTS[b.severity.toLowerCase()] ?? 0;
          return sortDirection === 'desc' ? weightB - weightA : weightA - weightB;
        }
        if (sortField === 'name') {
          return sortDirection === 'desc'
            ? b.title.localeCompare(a.title)
            : a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [findings, severityFilter, searchQuery, sortField, sortDirection]);

  // Filtered & Sorted Nodes
  const filteredNodes = useMemo(() => {
    return nodes
      .filter((node) => {
        if (typeFilter !== 'all' && node.type !== typeFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchVal = node.value.toLowerCase().includes(q);
          const matchLabel = node.label.toLowerCase().includes(q);
          const matchMeta = JSON.stringify(node.metadata || {}).toLowerCase().includes(q);
          if (!matchVal && !matchLabel && !matchMeta) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        return a.value.localeCompare(b.value);
      });
  }, [nodes, typeFilter, searchQuery]);

  // Export handlers
  const handleExportJSON = () => {
    const data = {
      target,
      targetType,
      riskScore,
      riskLevel,
      generatedAt: new Date().toISOString(),
      findingsSummary: {
        total: findings.length,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
      },
      assetsSummary: {
        total: nodes.length,
        subdomains: subdomainsCount,
        ips: ipsCount,
        ports: portsCount,
        breaches: breachesCount,
        profiles: profilesCount,
      },
      findings,
      assets: nodes,
      topology: edges,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iseeyou_recon_${target.replace(/[^a-zA-Z0-9.-]/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    // CSV export for findings
    const headers = ['ID', 'Severity', 'Title', 'CVE ID', 'Evidence'];
    const rows = findings.map((f) => [
      f.id,
      f.severity.toUpperCase(),
      `"${f.title.replace(/"/g, '""')}"`,
      f.cve_id || f.cveId || 'N/A',
      `"${f.evidence.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iseeyou_findings_${target.replace(/[^a-zA-Z0-9.-]/g, '_')}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-vsc-canvas overflow-hidden select-text">
      {/* 1. TOP RISK METRICS CARDS GRID */}
      <div className="p-4 border-b border-vsc-border bg-vsc-sidebar/40 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Risk Assessment Gauge */}
          <div className="bg-vsc-card border border-vsc-border rounded p-3 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-vsc-muted mb-1">
              <span className="font-semibold uppercase tracking-wider">Attack Surface Risk</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  riskScore >= 70
                    ? 'bg-vsc-critical animate-ping'
                    : riskScore >= 40
                    ? 'bg-vsc-warning'
                    : 'bg-vsc-success'
                }`}
              />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-vsc-bright">{riskScore}</span>
              <span className="text-xs font-mono text-vsc-muted">/ 100</span>
              <Badge
                variant={
                  riskScore >= 70
                    ? 'critical'
                    : riskScore >= 40
                    ? 'high'
                    : riskScore > 0
                    ? 'low'
                    : 'success'
                }
                size="xs"
                className="ml-auto font-mono uppercase"
              >
                {riskLevel}
              </Badge>
            </div>
            {/* Visual Progress Bar */}
            <div className="w-full h-1.5 bg-vsc-panel rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  riskScore >= 70
                    ? 'bg-vsc-critical'
                    : riskScore >= 40
                    ? 'bg-vsc-warning'
                    : 'bg-vsc-success'
                }`}
                style={{ width: `${Math.max(riskScore, 4)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Total Discovered Assets */}
          <div className="bg-vsc-card border border-vsc-border rounded p-3 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-vsc-muted mb-1">
              <span className="font-semibold uppercase tracking-wider">Discovered Assets</span>
              <Layers className="w-3.5 h-3.5 text-vsc-keyword" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-vsc-bright">{nodes.length}</span>
              <span className="text-xs font-mono text-vsc-muted">Unique Nodes</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px] font-mono text-vsc-muted">
              <span className="text-sky-400">📁 {subdomainsCount} subs</span>
              <span>•</span>
              <span className="text-emerald-400">🌐 {ipsCount} IPs</span>
              <span>•</span>
              <span className="text-cyan-300">🔌 {portsCount} ports</span>
            </div>
          </div>

          {/* Card 3: Vulnerabilities & CVE Exposures */}
          <div className="bg-vsc-card border border-vsc-border rounded p-3 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-vsc-muted mb-1">
              <span className="font-semibold uppercase tracking-wider">Security Exposures</span>
              <ShieldAlert className="w-3.5 h-3.5 text-vsc-critical" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-vsc-bright">{findings.length}</span>
              <span className="text-xs font-mono text-vsc-muted">Findings</span>
              {criticalCount > 0 && (
                <Badge variant="critical" size="xs" className="ml-auto animate-pulse">
                  {criticalCount} CRITICAL
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono">
              <span className="text-red-400 font-bold">{criticalCount} Crit</span>
              <span className="text-vsc-muted">•</span>
              <span className="text-orange-400 font-semibold">{highCount} High</span>
              <span className="text-vsc-muted">•</span>
              <span className="text-yellow-400">{mediumCount} Med</span>
              <span className="text-vsc-muted">•</span>
              <span className="text-blue-300">{lowCount} Low</span>
            </div>
          </div>

          {/* Card 4: Identity & Credential Leaks */}
          <div className="bg-vsc-card border border-vsc-border rounded p-3 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-vsc-muted mb-1">
              <span className="font-semibold uppercase tracking-wider">Identity & Breaches</span>
              <Key className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-vsc-bright">
                {breachesCount + profilesCount}
              </span>
              <span className="text-xs font-mono text-vsc-muted">Identities</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-vsc-muted">
              <span className={breachesCount > 0 ? 'text-vsc-critical font-bold' : 'text-emerald-400'}>
                {breachesCount > 0 ? `⚠️ ${breachesCount} breach leaks` : '✓ 0 breaches'}
              </span>
              <span>•</span>
              <span className="text-purple-300">👤 {profilesCount} profiles</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOOLBAR (Search, View Tabs, Filters, and Export Buttons) */}
      <div className="h-11 px-4 border-b border-vsc-border bg-vsc-sidebar flex items-center justify-between gap-3 flex-shrink-0">
        {/* Left: Tab Switcher */}
        <div className="flex items-center gap-1 bg-vsc-panel p-0.5 rounded border border-vsc-border">
          <button
            onClick={() => setActiveTab('findings')}
            className={`px-3 py-1 rounded text-xs font-medium font-mono transition-all flex items-center gap-1.5 ${
              activeTab === 'findings'
                ? 'bg-vsc-card text-vsc-bright shadow-sm font-semibold'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-vsc-critical" />
            <span>Exposures ({findings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-3 py-1 rounded text-xs font-medium font-mono transition-all flex items-center gap-1.5 ${
              activeTab === 'assets'
                ? 'bg-vsc-card text-vsc-bright shadow-sm font-semibold'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Asset Inventory ({nodes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('edges')}
            className={`px-3 py-1 rounded text-xs font-medium font-mono transition-all flex items-center gap-1.5 ${
              activeTab === 'edges'
                ? 'bg-vsc-card text-vsc-bright shadow-sm font-semibold'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Network Links ({edges.length})</span>
          </button>
        </div>

        {/* Center: Search input */}
        <div className="flex-1 max-w-sm relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-vsc-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'findings'
                ? 'Filter findings by title, CVE, evidence...'
                : 'Filter assets by hostname, IP, ASN...'
            }
            className="w-full bg-vsc-canvas border border-vsc-border rounded pl-8 pr-7 py-1 text-xs text-vsc-bright font-mono placeholder:text-vsc-muted focus:outline-none focus:border-vsc-accent-blue"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-vsc-muted hover:text-vsc-bright"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Export & Severity Filters */}
        <div className="flex items-center gap-2">
          {activeTab === 'findings' && (
            <div className="hidden lg:flex items-center gap-1 bg-vsc-panel p-0.5 rounded border border-vsc-border text-[11px] font-mono">
              {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] transition-colors ${
                    severityFilter === sev
                      ? sev === 'critical'
                        ? 'bg-red-950 text-red-300 border border-vsc-critical'
                        : sev === 'high'
                        ? 'bg-orange-950 text-orange-300 border border-orange-500'
                        : sev === 'medium'
                        ? 'bg-yellow-950 text-yellow-300 border border-yellow-500'
                        : sev === 'low'
                        ? 'bg-blue-950 text-blue-300 border border-blue-400'
                        : 'bg-vsc-card text-vsc-bright border border-vsc-border'
                      : 'text-vsc-muted hover:text-vsc-bright'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="hidden lg:flex items-center gap-1 bg-vsc-panel p-0.5 rounded border border-vsc-border text-[11px] font-mono">
              {(['all', 'subdomain', 'ip', 'port', 'breach', 'username'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] transition-colors ${
                    typeFilter === t
                      ? 'bg-vsc-card text-vsc-bright border border-vsc-border'
                      : 'text-vsc-muted hover:text-vsc-bright'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Export Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              title="Export Findings to CSV"
              className="h-7 px-2 text-[11px] font-mono flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportJSON}
              title="Export Full Intelligence to JSON"
              className="h-7 px-2 text-[11px] font-mono flex items-center gap-1"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">JSON</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 3. CONTENT AREA: TAB 1 - FINDINGS & EXPOSURES */}
      {activeTab === 'findings' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
          {filteredFindings.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-vsc-border rounded bg-vsc-card/50">
              <ShieldAlert className="w-10 h-10 text-vsc-muted mb-2 opacity-50" />
              <div className="text-sm font-bold text-vsc-bright">No Vulnerability Findings Found</div>
              <p className="text-xs text-vsc-muted max-w-sm mt-1">
                {findings.length === 0
                  ? isScanning
                    ? 'Recon modules are currently querying threat intelligence sources in real-time...'
                    : 'Target appears clean or no active CVEs were reported by the current scan modules.'
                  : 'No findings match your current severity or search criteria.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-xs text-vsc-accent-blue hover:underline"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFindings.map((finding) => {
                const isSelected = selectedFindingId === finding.id;
                const cve = finding.cve_id || finding.cveId;
                const sev = finding.severity.toLowerCase();

                return (
                  <div
                    key={finding.id}
                    data-testid="vuln-finding-card"
                    onClick={() => onSelectFinding(finding)}
                    className={`p-3.5 rounded border transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-vsc-card border-vsc-accent-blue ring-1 ring-vsc-accent-blue shadow-md'
                        : 'bg-vsc-card/80 border-vsc-border hover:border-vsc-borderSubtle hover:bg-vsc-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Badges line */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <Badge
                            variant={sev as any}
                            size="sm"
                            className="font-bold uppercase tracking-wider"
                          >
                            {finding.severity.toUpperCase()}
                          </Badge>
                          {cve && (
                            <Badge variant="default" size="sm" className="font-mono text-cyan-300">
                              {cve}
                            </Badge>
                          )}
                          <span className="text-[10px] text-vsc-muted font-mono">
                            ID: {finding.id.slice(0, 12)}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-sm font-bold text-vsc-bright group-hover:text-vsc-keyword transition-colors truncate">
                          {finding.title}
                        </h4>

                        {/* Evidence preview */}
                        <p className="text-xs text-vsc-muted mt-1 leading-relaxed line-clamp-2 bg-vsc-panel/50 p-2 rounded border border-vsc-border/50 text-[11px] font-mono">
                          {finding.evidence}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <Button
                          variant={isSelected ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFinding(finding);
                          }}
                          className="text-[10px] h-6 px-2 flex items-center gap-1 font-mono"
                        >
                          <span>Remediate</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(
                              `${finding.title} (${cve || 'N/A'})\nSeverity: ${finding.severity}\nEvidence: ${finding.evidence}`,
                              finding.id
                            );
                          }}
                          className="text-vsc-muted hover:text-vsc-bright text-[10px] flex items-center gap-1 py-0.5 px-1 rounded hover:bg-vsc-panel font-mono"
                          title="Copy finding details"
                        >
                          {copiedId === finding.id ? (
                            <>
                              <Check className="w-3 h-3 text-vsc-success" />
                              <span className="text-vsc-success">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. CONTENT AREA: TAB 2 - DISCOVERED ASSET INVENTORY TABLE */}
      {activeTab === 'assets' && (
        <div className="flex-1 overflow-y-auto p-4 font-mono">
          <div className="border border-vsc-border rounded overflow-hidden bg-vsc-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-vsc-sidebar border-b border-vsc-border text-vsc-muted text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Asset Value</th>
                  <th className="py-2.5 px-3">Risk Level</th>
                  <th className="py-2.5 px-3">Intelligence & Context</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vsc-border text-vsc-text">
                {filteredNodes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-vsc-muted">
                      No assets found matching the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredNodes.map((node) => {
                    const isCopied = copiedId === node.id;
                    return (
                      <tr
                        key={node.id}
                        className="hover:bg-vsc-panel/60 transition-colors group"
                      >
                        {/* Type Badge */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <Badge variant={node.type as any} size="xs" className="uppercase font-bold">
                            {node.type}
                          </Badge>
                        </td>

                        {/* Value */}
                        <td className="py-2 px-3 font-bold text-vsc-bright max-w-xs truncate">
                          <span title={node.value}>{node.value}</span>
                        </td>

                        {/* Severity */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <Badge
                            variant={node.severity as any}
                            size="xs"
                            className="uppercase font-mono"
                          >
                            {node.severity}
                          </Badge>
                        </td>

                        {/* Intelligence metadata */}
                        <td className="py-2 px-3 text-[11px] text-vsc-muted max-w-sm truncate">
                          {node.type === 'ip' && (
                            <span>
                              {String(node.metadata?.city || '')}{' '}
                              {String(node.metadata?.country || '')} •{' '}
                              {String(node.metadata?.isp || node.metadata?.asn || 'Resolved')}
                            </span>
                          )}
                          {node.type === 'subdomain' && (
                            <span>
                              DNS Resolved: {String(node.metadata?.source || 'crt.sh')}
                              {node.metadata?.danglingCname
                                ? ` ⚠️ Dangling: ${String(node.metadata?.danglingCname)}`
                                : ''}
                            </span>
                          )}
                          {node.type === 'port' && (
                            <span className="text-cyan-300">
                              Port {node.value} ({String(node.metadata?.service || 'TCP')})
                            </span>
                          )}
                          {node.type === 'breach' && (
                            <span className="text-red-400">
                              HIBP Breach Match: {String(node.metadata?.maskedPassword || 'Masked Hash')}
                            </span>
                          )}
                          {node.type === 'username' && (
                            <span className="text-purple-300">
                              Platform: {String(node.metadata?.platform || 'Profile')}
                            </span>
                          )}
                          {!['ip', 'subdomain', 'port', 'breach', 'username'].includes(node.type) && (
                            <span>{node.label || 'Asset node'}</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                            <button
                              onClick={() => handleCopy(node.value, node.id)}
                              className="p-1 rounded hover:bg-vsc-border text-vsc-muted hover:text-vsc-bright"
                              title="Copy asset value"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-vsc-success" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {onPivot && (
                              <button
                                onClick={() => onPivot(node.value, node.type)}
                                className="px-1.5 py-0.5 rounded border border-vsc-border hover:border-vsc-accent-blue text-[10px] text-vsc-muted hover:text-vsc-accent-blue"
                                title={`Pivot scan on ${node.value}`}
                              >
                                Pivot ↗
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. CONTENT AREA: TAB 3 - NETWORK EDGES & TOPOLOGY */}
      {activeTab === 'edges' && (
        <div className="flex-1 overflow-y-auto p-4 font-mono">
          <div className="border border-vsc-border rounded overflow-hidden bg-vsc-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-vsc-sidebar border-b border-vsc-border text-vsc-muted text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Relation</th>
                  <th className="py-2.5 px-3">Source Node</th>
                  <th className="py-2.5 px-3">Target Node</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3 text-right">Edge ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vsc-border text-vsc-text">
                {edges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-vsc-muted">
                      No network topology edges recorded yet.
                    </td>
                  </tr>
                ) : (
                  edges.map((edge) => (
                    <tr key={edge.id} className="hover:bg-vsc-panel/60 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-vsc-keyword font-semibold uppercase text-[10px] px-1.5 py-0.5 bg-vsc-panel rounded border border-vsc-border">
                          {edge.relation}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-vsc-bright max-w-xs truncate">
                        {edge.source}
                      </td>
                      <td className="py-2 px-3 font-mono text-vsc-bright max-w-xs truncate">
                        {edge.target}
                      </td>
                      <td className="py-2 px-3 text-vsc-muted">
                        {Math.round((edge.confidence ?? 1.0) * 100)}%
                      </td>
                      <td className="py-2 px-3 text-right text-[10px] text-vsc-muted font-mono">
                        {edge.id.slice(0, 10)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

