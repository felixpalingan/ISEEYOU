'use client';

import React, { useState } from 'react';
import {
  FolderTree,
  ShieldAlert,
  BookOpen,
  Settings,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Globe,
  Radio,
  FileCode,
  Copy,
  Check,
  AlertCircle,
  Network,
  Lock,
  User,
  Table,
} from 'lucide-react';
import { OmniSearchBar } from '@/components/OmniSearchBar';
import { TelemetryTerminal } from '@/components/TelemetryTerminal';
import { StructuredDataView } from '@/components/StructuredDataView';
import { GraphCanvas } from '@/components/GraphCanvas';
import { Badge, Button, Card, StatusIndicator } from '@/components/ui';
import { useScanStream } from '@/hooks/useScanStream';
import { VulnerabilityFinding } from '@iseeyou/shared-types';

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<'graph' | 'table'>('graph');
  const [bottomTab, setBottomTab] = useState<'terminal' | 'problems'>('terminal');
  const [copied, setCopied] = useState(false);

  // Real-time scan stream hook connecting to FastAPI backend
  const {
    target,
    targetType,
    riskScore,
    logs,
    nodes,
    edges,
    findings,
    isScanning,
    selectedFinding,
    pivotHistory,
    startScan,
    revertPivot,
    clearLogs,
    selectFinding,
  } = useScanStream();

  // Group discovered nodes by entity type for Target Explorer
  const subdomains = nodes.filter((n) => n.type === 'subdomain');
  const ips = nodes.filter((n) => n.type === 'ip');
  const ports = nodes.filter((n) => n.type === 'port');
  const breaches = nodes.filter((n) => n.type === 'breach');
  const profiles = nodes.filter((n) => n.type === 'username' && n.id.startsWith('profile:'));

  const riskLevel =
    riskScore >= 70 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : riskScore >= 15 ? 'MEDIUM' : 'LOW';

  const riskBadgeClass =
    riskScore >= 70
      ? 'bg-red-950/70 border-vsc-critical text-vsc-critical'
      : riskScore >= 40
      ? 'bg-orange-950/70 border-orange-500 text-orange-400'
      : riskScore >= 15
      ? 'bg-yellow-950/70 border-vsc-warning text-vsc-warning'
      : 'bg-emerald-950/60 border-vsc-success text-vsc-success';

  // Dynamic remediation playbook generator based on selected finding
  const getRemediationCommand = (finding: VulnerabilityFinding | null) => {
    if (!finding) return 'sudo ufw status verbose';
    const title = finding.title.toLowerCase();
    if (title.includes('mysql') || title.includes('3306')) {
      return 'sudo ufw deny 3306/tcp && sudo ufw allow from 10.0.0.0/8 to any port 3306';
    } else if (title.includes('postgres') || title.includes('5432')) {
      return 'sudo ufw deny 5432/tcp && sudo ufw allow from 10.0.0.0/8 to any port 5432';
    } else if (title.includes('redis') || title.includes('6379')) {
      return 'sudo ufw deny 6379/tcp && sed -i "s/# requirepass/requirepass SecureVaultPass2026/g" /etc/redis/redis.conf';
    } else if (title.includes('takeover') || title.includes('cname')) {
      return `dig +short CNAME ${target} # Verify and remove stale dangling pointer in DNS provider`;
    } else if (title.includes('credential') || title.includes('breach')) {
      return 'vault-cli revoke-tokens --expired && identity-manager enforce-mfa --all-users';
    }
    return `echo "Review incident: ${finding.id}" >> /var/log/iseeyou_audit.log`;
  };

  const handleCopyRemediation = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-vsc-canvas text-vsc-text font-sans antialiased overflow-hidden">
      {/* 1. TOP HEADER & COMMAND PALETTE / OMNI-SEARCH */}
      <header className="h-10 bg-vsc-sidebar border-b border-vsc-border flex items-center justify-between px-3 select-none z-20">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ISEEYOU" className="w-5 h-5" />
          <span className="font-bold text-xs tracking-wider text-vsc-bright font-mono">
            ISEEYOU // COMMAND_CENTER
          </span>
          <span className="text-xs text-vsc-muted px-2 py-0.5 rounded bg-vsc-dropdown border border-vsc-borderSubtle">
            Session: <strong className="text-vsc-bright">{target}</strong>
          </span>
        </div>

        {/* Center Omni-Search with instant auto-classification */}
        <OmniSearchBar
          onScan={(t, type) => startScan(t, type)}
          isScanning={isScanning}
          initialValue={target}
        />

        {/* Right Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-0.5 rounded border ${riskBadgeClass}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                riskScore >= 40 ? 'bg-vsc-critical animate-pulse' : 'bg-vsc-success'
              }`}
            />
            RISK: {riskScore}/100 ({riskLevel})
          </span>
        </div>
      </header>

      {/* 2. MAIN 3-PANE WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar (Left 48px rail) */}
        <aside className="w-12 bg-vsc-activityBar flex flex-col items-center py-2 border-r border-vsc-border z-10 flex-shrink-0">
          <button
            title="Graph Canvas"
            onClick={() => setActiveTab('graph')}
            className={`w-10 h-10 flex items-center justify-center mb-1 transition-colors ${
              activeTab === 'graph'
                ? 'text-vsc-bright border-l-2 border-vsc-accent-blue bg-vsc-canvas'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <FolderTree className="w-5 h-5" />
          </button>
          <button
            title="Structured Table & Exposures"
            onClick={() => {
              setActiveTab('table');
              setBottomTab('problems');
            }}
            className={`w-10 h-10 flex items-center justify-center mb-1 transition-colors ${
              activeTab === 'table'
                ? 'text-vsc-bright border-l-2 border-vsc-accent-blue bg-vsc-canvas'
                : 'text-vsc-muted hover:text-vsc-bright'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </button>
          <button
            title="Remediation Playbooks"
            onClick={() => setBottomTab('problems')}
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-vsc-bright mb-1"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button
            title="Settings"
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-vsc-bright"
          >
            <Settings className="w-5 h-5" />
          </button>
        </aside>

        {/* Sidebar Explorer (240px) */}
        <aside className="w-60 bg-vsc-sidebar border-r border-vsc-border flex flex-col text-xs flex-shrink-0">
          <div className="h-8 px-3 flex items-center justify-between text-[11px] font-bold tracking-wider text-vsc-muted uppercase border-b border-vsc-border">
            <span>Target Explorer</span>
            <span className="text-[10px] text-vsc-bright font-mono">{nodes.length} nodes</span>
          </div>

          {/* Dynamic Tree Structure */}
          <div className="flex-1 p-2 overflow-y-auto font-mono text-[12px] space-y-1">
            <div className="flex items-center gap-1.5 text-vsc-bright font-semibold py-1 px-1 rounded hover:bg-vsc-card cursor-pointer">
              <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
              <Globe className="w-3.5 h-3.5 text-vsc-keyword" />
              <span className="truncate">{target}</span>
            </div>

            <div className="pl-4 space-y-1">
              {/* Subdomains Group */}
              <div className="flex items-center gap-1.5 text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                <span>📁 subdomains ({subdomains.length})</span>
              </div>
              <div className="pl-5 space-y-0.5 text-vsc-muted text-[11px]">
                {subdomains.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => startScan(s.value, 'subdomain', true)}
                    title={`Click to pivot on ${s.value}`}
                    className="hover:text-sky-300 hover:underline cursor-pointer truncate flex items-center justify-between group"
                  >
                    <span>├─ {s.value}</span>
                    <span className="opacity-0 group-hover:opacity-100 text-[9px] text-vsc-accent-blue font-bold">
                      Pivot ↗
                    </span>
                  </div>
                ))}
                {subdomains.length > 5 && (
                  <div className="text-vsc-info text-[10px]">└─ +{subdomains.length - 5} more...</div>
                )}
              </div>

              {/* IPs & Infrastructure */}
              {ips.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                    <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                    <span>🌐 origin IPs ({ips.length})</span>
                  </div>
                  <div className="pl-5 space-y-0.5 text-emerald-400 text-[11px]">
                    {ips.map((ip) => (
                      <div
                        key={ip.id}
                        onClick={() => startScan(ip.value, 'ip', true)}
                        title={`Click to pivot on ${ip.value}`}
                        className="hover:text-emerald-200 hover:underline cursor-pointer truncate flex items-center justify-between group"
                      >
                        <span>├─ {ip.value}</span>
                        <span className="opacity-0 group-hover:opacity-100 text-[9px] text-emerald-400 font-bold">
                          Pivot ↗
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Open Ports */}
              {ports.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                    <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                    <span>🔌 open ports ({ports.length})</span>
                  </div>
                  <div className="pl-5 space-y-0.5 text-cyan-300 text-[11px]">
                    {ports.map((p) => (
                      <div key={p.id} className="hover:text-cyan-200 cursor-pointer truncate">
                        ├─ {p.label}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Breaches & Credentials */}
              {breaches.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                    <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                    <span>🚨 breach exposures ({breaches.length})</span>
                  </div>
                  <div className="pl-5 space-y-0.5 text-vsc-critical text-[11px]">
                    {breaches.map((b) => (
                      <div key={b.id} className="hover:text-red-400 cursor-pointer truncate">
                        ├─ {b.value}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Social Profiles */}
              {profiles.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                    <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                    <span>👤 social profiles ({profiles.length})</span>
                  </div>
                  <div className="pl-5 space-y-0.5 text-purple-300 text-[11px]">
                    {profiles.slice(0, 4).map((prof) => (
                      <div key={prof.id} className="hover:text-purple-200 cursor-pointer truncate">
                        ├─ {String(prof.metadata?.platform || prof.value)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick External Pivots */}
          <div className="p-2 border-t border-vsc-border bg-vsc-panel text-[11px]">
            <div className="text-vsc-muted uppercase font-bold text-[10px] mb-1.5">
              1-Click External Pivots
            </div>
            <div className="space-y-1 font-mono">
              <a
                href={`https://web.archive.org/web/*/${target}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between text-vsc-text hover:text-vsc-bright hover:underline"
              >
                <span>Wayback Machine</span>
                <ExternalLink className="w-3 h-3 text-vsc-muted" />
              </a>
              <a
                href={`https://www.shodan.io/search?query=${target}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between text-vsc-text hover:text-vsc-bright hover:underline"
              >
                <span>Shodan Web Search</span>
                <ExternalLink className="w-3 h-3 text-vsc-muted" />
              </a>
            </div>
          </div>
        </aside>

        {/* Center Workspace (Tabs, Breadcrumbs, Canvas, and Live Telemetry Terminal) */}
        <main className="flex-1 flex flex-col bg-vsc-canvas overflow-hidden">
          {/* Tabs Bar */}
          <div className="h-9 bg-vsc-sidebar flex items-center border-b border-vsc-border overflow-x-auto flex-shrink-0">
            <button
              onClick={() => setActiveTab('graph')}
              className={`h-full px-4 flex items-center gap-2 border-r border-vsc-border text-xs transition-colors ${
                activeTab === 'graph'
                  ? 'bg-vsc-canvas text-vsc-bright font-medium border-t-2 border-vsc-accent-blue'
                  : 'bg-vsc-sidebar text-vsc-muted hover:text-vsc-bright'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-vsc-keyword" />
              <span>{target} [Graph Canvas]</span>
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`h-full px-4 flex items-center gap-2 border-r border-vsc-border text-xs transition-colors ${
                activeTab === 'table'
                  ? 'bg-vsc-canvas text-vsc-bright font-medium border-t-2 border-vsc-accent-blue'
                  : 'bg-vsc-sidebar text-vsc-muted hover:text-vsc-bright'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-sky-400" />
              <span>Structured Intel & Findings ({findings.length})</span>
            </button>
            <div
              onClick={() => setBottomTab('terminal')}
              className="h-full bg-vsc-sidebar px-4 flex items-center gap-2 text-xs text-vsc-muted border-r border-vsc-border hover:bg-vsc-canvas/50 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>telemetry_stream.log ({logs.length})</span>
            </div>
          </div>

          {/* Breadcrumb Bar with Pivot Investigation Trail */}
          <div className="h-6 bg-vsc-canvas border-b border-vsc-border flex items-center justify-between px-3 text-[11px] font-mono text-vsc-muted select-none flex-shrink-0">
            <div className="flex items-center gap-1 overflow-hidden">
              <span className="hover:text-vsc-bright cursor-pointer">workspace</span>
              <span>&gt;</span>
              {pivotHistory.map((item, idx) => (
                <React.Fragment key={`pivot-${idx}`}>
                  <span
                    onClick={() => revertPivot()}
                    className="hover:text-sky-300 hover:underline cursor-pointer text-vsc-muted truncate max-w-[120px]"
                    title={`Click to revert to ${item.target}`}
                  >
                    {item.target}
                  </span>
                  <span>&gt;</span>
                </React.Fragment>
              ))}
              <span className="text-vsc-bright font-bold">{target}</span>
              <span>&gt;</span>
              <span className="text-vsc-keyword uppercase font-bold">{targetType}</span>
              <span>&gt;</span>
              <span className="text-sky-400 font-bold uppercase">
                {activeTab === 'graph' ? 'GRAPH CANVAS' : 'STRUCTURED TABLE'}
              </span>
              {selectedFinding && (
                <>
                  <span>&gt;</span>
                  <span className="text-vsc-critical font-bold truncate max-w-xs">{selectedFinding.title}</span>
                </>
              )}
            </div>

            {pivotHistory.length > 0 && (
              <button
                onClick={() => revertPivot()}
                className="text-[10px] text-vsc-accent-blue hover:text-sky-300 flex items-center gap-1 hover:underline ml-2 flex-shrink-0"
                title="Return to parent reconnaissance pivot"
              >
                <span>↶ Revert Pivot</span>
              </button>
            )}
          </div>

          {/* Main Workspace Display: Toggle between Graph Canvas and Structured Data View */}
          {activeTab === 'table' ? (
            <StructuredDataView
              nodes={nodes}
              edges={edges}
              findings={findings}
              target={target}
              targetType={targetType}
              riskScore={riskScore}
              riskLevel={riskLevel}
              isScanning={isScanning}
              selectedFindingId={selectedFinding?.id}
              onSelectFinding={selectFinding}
              onPivot={(pTarget, pType) => startScan(pTarget, pType, true)}
            />
          ) : (
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              findings={findings}
              target={target}
              targetType={targetType}
              isScanning={isScanning}
              selectedFindingId={selectedFinding?.id}
              onSelectFinding={selectFinding}
              onPivot={(pTarget, pType) => startScan(pTarget, pType, true)}
            />
          )}

          {/* Integrated Live Telemetry Terminal & Problems Drawer */}
          <TelemetryTerminal
            logs={logs}
            findings={findings}
            isScanning={isScanning}
            activeTab={bottomTab}
            onTabChange={setBottomTab}
            onClearLogs={clearLogs}
            onSelectFinding={selectFinding}
            selectedFindingId={selectedFinding?.id}
          />
        </main>

        {/* Right Drawer: Finding Inspector & Remediation Playbook (300px) */}
        <aside className="w-72 bg-vsc-sidebar border-l border-vsc-border p-4 flex flex-col justify-between text-xs flex-shrink-0">
          <div>
            <div className="flex items-center justify-between mb-3">
              <Badge
                variant={selectedFinding ? (selectedFinding.severity.toLowerCase() as any) : 'info'}
                size="sm"
                className="font-bold"
              >
                {selectedFinding ? `${selectedFinding.severity.toUpperCase()} SEVERITY` : 'AUDIT READY'}
              </Badge>
              {(selectedFinding?.cve_id || selectedFinding?.cveId) && (
                <span className="text-vsc-muted text-[11px] font-mono">
                  {selectedFinding.cve_id || selectedFinding.cveId}
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-vsc-bright mb-1">
              {selectedFinding ? selectedFinding.title : 'Incident Remediation Engine'}
            </h3>
            <p className="text-vsc-muted text-xs leading-relaxed mb-4">
              {selectedFinding
                ? selectedFinding.evidence
                : 'Select any vulnerability finding from the PROBLEMS drawer below to generate actionable terminal remediation commands and mitigation playbooks.'}
            </p>

            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase text-vsc-muted mb-1.5 font-mono">
                Remediation Playbook (Bash / Firewall):
              </div>
              <div className="bg-vsc-panel p-2.5 rounded border border-vsc-border font-mono text-[11px] text-vsc-string relative group break-all select-all">
                <code>{getRemediationCommand(selectedFinding)}</code>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="primary"
              onClick={() => handleCopyRemediation(getRemediationCommand(selectedFinding))}
              className="w-full py-1.5 font-semibold text-xs flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Remediation Command'}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              className="w-full py-1.5 text-xs flex items-center justify-center gap-2"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Export Incident Report</span>
            </Button>
          </div>
        </aside>
      </div>

      {/* 3. VS CODE STATUS BAR (Bottom 24px) */}
      <footer className="h-6 bg-vsc-blue text-white flex items-center justify-between px-3 text-[11px] font-mono select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-bold">
            <StatusIndicator status={isScanning ? 'running' : 'success'} />
            <span>{isScanning ? 'SCANNING ACTIVE...' : 'SYSTEM READY'}</span>
          </span>
          <span className="opacity-75">|</span>
          <span>Target: {target}</span>
          <span className="opacity-75">|</span>
          <span className="font-bold">Risk: {riskScore}/100</span>
          <span className="opacity-75">|</span>
          <span>Nodes: {nodes.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Active Modules: 4/4</span>
          <span className="opacity-75">|</span>
          <span>UTF-8</span>
          <span className="opacity-75">|</span>
          <span>TypeScript</span>
          <span className="opacity-75">|</span>
          <span>ISEEYOU v0.1.0</span>
        </div>
      </footer>
    </div>
  );
}
