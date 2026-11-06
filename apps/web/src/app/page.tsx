'use client';

import React, { useState } from 'react';
import {
  FolderTree,
  Search,
  ShieldAlert,
  BookOpen,
  Settings,
  ChevronRight,
  ChevronDown,
  Terminal,
  AlertCircle,
  Copy,
  ExternalLink,
  Globe,
  Radio,
  FileCode,
  Check,
} from 'lucide-react';
import { OmniSearchBar } from '@/components/OmniSearchBar';
import { EntityType } from '@iseeyou/shared-types';

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<'graph' | 'table'>('graph');
  const [bottomTab, setBottomTab] = useState<'terminal' | 'problems'>('terminal');
  const [targetInput, setTargetInput] = useState('example.com');
  const [isScanning, setIsScanning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleScan = (target: string, type: EntityType) => {
    setTargetInput(target);
    setIsScanning(true);
    // Temporary simulation state; Task 2.3 will wire live SSE streams
    setTimeout(() => setIsScanning(false), 1500);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
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
            Case: <strong className="text-vsc-bright">Audit-Demo</strong>
          </span>
        </div>

        {/* Center Omni-Search (VS Code Quick-Open with Auto-Classifier) */}
        <OmniSearchBar
          onScan={handleScan}
          isScanning={isScanning}
          initialValue={targetInput}
        />

        {/* Right Status Badge */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-950/60 border border-vsc-critical text-vsc-critical">
            <span className="w-2 h-2 rounded-full bg-vsc-critical animate-pulse" />
            RISK: 78/100 (CRITICAL)
          </span>
        </div>
      </header>

      {/* 2. MAIN 3-PANE WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar (Left 48px rail) */}
        <aside className="w-12 bg-vsc-activityBar flex flex-col items-center py-2 border-r border-vsc-border z-10">
          <button
            title="Target Explorer"
            className="w-10 h-10 flex items-center justify-center text-vsc-bright border-l-2 border-vsc-accent-blue bg-vsc-canvas mb-1"
          >
            <FolderTree className="w-5 h-5" />
          </button>
          <button
            title="Threat Intelligence"
            className="w-10 h-10 flex items-center justify-center text-vsc-muted hover:text-vsc-bright mb-1"
          >
            <ShieldAlert className="w-5 h-5" />
          </button>
          <button
            title="Remediation Playbooks"
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
        <aside className="w-60 bg-vsc-sidebar border-r border-vsc-border flex flex-col text-xs">
          <div className="h-8 px-3 flex items-center justify-between text-[11px] font-bold tracking-wider text-vsc-muted uppercase border-b border-vsc-border">
            <span>Target Explorer</span>
          </div>

          {/* Tree Structure */}
          <div className="flex-1 p-2 overflow-y-auto font-mono text-[12px] space-y-1">
            <div className="flex items-center gap-1.5 text-vsc-bright font-semibold py-1 px-1 rounded hover:bg-vsc-card cursor-pointer">
              <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
              <Globe className="w-3.5 h-3.5 text-vsc-keyword" />
              <span>example-target.com</span>
            </div>

            <div className="pl-4 space-y-1">
              <div className="flex items-center gap-1.5 text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                <ChevronDown className="w-3.5 h-3.5 text-vsc-muted" />
                <span>📁 subdomains (32)</span>
              </div>
              <div className="pl-5 space-y-0.5 text-vsc-muted">
                <div className="hover:text-vsc-bright cursor-pointer">├─ api.target...</div>
                <div className="text-vsc-critical font-bold flex items-center gap-1 hover:text-red-400 cursor-pointer">
                  <span>└─ 🚨 staging-db.target...</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                <ChevronRight className="w-3.5 h-3.5 text-vsc-muted" />
                <span>📧 exposed emails (4)</span>
              </div>

              <div className="flex items-center gap-1.5 text-vsc-text py-0.5 px-1 rounded hover:bg-vsc-card cursor-pointer">
                <ChevronRight className="w-3.5 h-3.5 text-vsc-muted" />
                <span>📜 leaked secrets (1)</span>
              </div>
            </div>
          </div>

          {/* Quick External Pivots */}
          <div className="p-2 border-t border-vsc-border bg-vsc-panel text-[11px]">
            <div className="text-vsc-muted uppercase font-bold text-[10px] mb-1.5">
              1-Click External Pivots
            </div>
            <div className="space-y-1 font-mono">
              <a
                href={`https://web.archive.org/web/*/${targetInput}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between text-vsc-text hover:text-vsc-bright hover:underline"
              >
                <span>Wayback Machine</span>
                <ExternalLink className="w-3 h-3 text-vsc-muted" />
              </a>
              <a
                href={`https://www.shodan.io/search?query=${targetInput}`}
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

        {/* Center Workspace (Tabs, Breadcrumbs, Canvas) */}
        <main className="flex-1 flex flex-col bg-vsc-canvas overflow-hidden">
          {/* Tabs Bar */}
          <div className="h-9 bg-vsc-sidebar flex items-center border-b border-vsc-border overflow-x-auto">
            <div className="h-full bg-vsc-canvas px-4 flex items-center gap-2 border-t-2 border-vsc-accent-blue text-xs font-medium text-vsc-bright border-r border-vsc-border">
              <Globe className="w-3.5 h-3.5 text-vsc-keyword" />
              <span>{targetInput} [Recon Graph]</span>
              <span className="text-vsc-muted hover:text-white cursor-pointer ml-2">×</span>
            </div>
            <div className="h-full bg-vsc-sidebar px-4 flex items-center gap-2 text-xs text-vsc-muted border-r border-vsc-border hover:bg-vsc-canvas/50 cursor-pointer">
              <Terminal className="w-3.5 h-3.5" />
              <span>telemetry_stream.log</span>
            </div>
          </div>

          {/* Breadcrumb Bar */}
          <div className="h-6 bg-vsc-canvas border-b border-vsc-border flex items-center px-3 text-[11px] font-mono text-vsc-muted gap-1 select-none">
            <span className="hover:text-vsc-bright cursor-pointer">workspace</span>
            <span>&gt;</span>
            <span className="text-vsc-bright">{targetInput}</span>
            <span>&gt;</span>
            <span className="hover:text-vsc-bright cursor-pointer">subdomains</span>
            <span>&gt;</span>
            <span className="text-vsc-critical font-bold">staging-db.target (Port 5432)</span>
          </div>

          {/* Interactive Canvas Area */}
          <div className="flex-1 relative flex items-center justify-center p-8 bg-[#1e1e1e] bg-[radial-gradient(#2b2b2b_1px,transparent_1px)] [background-size:16px_16px]">
            {/* Mock Graph Layout Nodes */}
            <div className="flex flex-col items-center gap-12 z-10">
              {/* Root Node */}
              <div className="bg-vsc-card border-2 border-vsc-accent-blue rounded p-3 w-64 shadow-lg shadow-blue-950/20">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-vsc-accent-blue mb-1">
                  <span>ROOT SEED DOMAIN</span>
                  <Radio className="w-3 h-3 text-vsc-accent-blue animate-pulse" />
                </div>
                <div className="font-mono text-sm font-bold text-vsc-bright">{targetInput}</div>
                <div className="text-[11px] text-vsc-muted mt-1 font-mono">Status: Analyzed (100%)</div>
              </div>

              {/* Connected Branch Nodes */}
              <div className="flex items-center gap-16">
                {/* Cluster Node (Folded) */}
                <div className="bg-vsc-card border border-vsc-borderSubtle hover:border-vsc-accent-blue rounded p-3 w-56 cursor-pointer transition-all">
                  <div className="text-[10px] font-mono text-vsc-muted uppercase">SUBDOMAINS (FOLDED)</div>
                  <div className="font-bold text-xs text-vsc-bright mt-1">📁 32 Subdomains Found</div>
                  <div className="text-[10px] text-vsc-info mt-1 font-mono">[ Click to Expand Cluster ▾ ]</div>
                </div>

                {/* Critical Finding Node */}
                <div className="bg-red-950/40 border-2 border-vsc-critical rounded p-3 w-64 shadow-lg shadow-red-950/30">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-vsc-critical mb-1">
                    <span>CRITICAL EXPOSURE</span>
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-mono text-xs font-bold text-vsc-bright">staging-db.{targetInput}</div>
                  <div className="text-[11px] text-red-300 mt-1 font-mono">Port 5432 (Postgres) OPEN</div>
                </div>
              </div>
            </div>

            {/* Bottom Right Minimap Mock */}
            <div className="absolute bottom-4 right-4 bg-vsc-sidebar/80 backdrop-blur border border-vsc-border rounded p-2 w-32 h-24 pointer-events-none flex flex-col justify-between">
              <span className="text-[9px] font-mono text-vsc-muted">MINIMAP</span>
              <div className="w-full h-12 bg-vsc-canvas/50 border border-vsc-borderSubtle rounded relative">
                <div className="w-3 h-3 rounded-full bg-vsc-blue absolute top-2 left-6" />
                <div className="w-3 h-3 rounded-full bg-vsc-critical absolute top-6 right-6" />
              </div>
            </div>
          </div>

          {/* Integrated Bottom Terminal & Problems Drawer */}
          <div className="h-44 bg-vsc-panel border-t border-vsc-border flex flex-col">
            {/* Panel Tabs */}
            <div className="h-7 bg-vsc-sidebar flex items-center px-2 gap-4 text-xs border-b border-vsc-border">
              <button
                onClick={() => setBottomTab('terminal')}
                className={`flex items-center gap-1.5 h-full px-2 border-b-2 font-medium ${
                  bottomTab === 'terminal'
                    ? 'border-vsc-accent-blue text-vsc-bright'
                    : 'border-transparent text-vsc-muted hover:text-vsc-text'
                }`}
              >
                <Terminal className="w-3 h-3" />
                <span>TERMINAL</span>
              </button>
              <button
                onClick={() => setBottomTab('problems')}
                className={`flex items-center gap-1.5 h-full px-2 border-b-2 font-medium ${
                  bottomTab === 'problems'
                    ? 'border-vsc-accent-blue text-vsc-bright'
                    : 'border-transparent text-vsc-muted hover:text-vsc-text'
                }`}
              >
                <AlertCircle className="w-3 h-3 text-vsc-critical" />
                <span>PROBLEMS (1)</span>
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-1">
              {bottomTab === 'terminal' ? (
                <>
                  <div className="text-vsc-info">[00:01] Omni-Classifier identified target: DOMAIN</div>
                  <div className="text-vsc-success">[00:02] crt.sh query returned 32 subdomains</div>
                  <div className="text-vsc-success">[00:03] DoH resolved origin IP: 103.28.12.44</div>
                  <div className="text-vsc-critical font-bold">
                    [00:05] [ALERT] Port 5432 (PostgreSQL) is OPEN on host staging-db.{targetInput}!
                  </div>
                  <div className="text-vsc-muted">[00:06] Synthesizing remediation blueprint...</div>
                </>
              ) : (
                <div className="flex items-center justify-between text-vsc-critical py-1 px-2 bg-red-950/20 border border-vsc-critical/30 rounded">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="font-bold">PostgreSQL Port 5432 Open to Public</span>
                  </div>
                  <span className="text-vsc-muted text-[11px]">host: staging-db.{targetInput}</span>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right Drawer: Finding Inspector & Remediation Playbook (300px) */}
        <aside className="w-72 bg-vsc-sidebar border-l border-vsc-border p-4 flex flex-col justify-between text-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-950 text-vsc-critical border border-vsc-critical">
                CRITICAL SEVERITY
              </span>
              <span className="text-vsc-muted text-[11px] font-mono">CVE-2024-PASSIVE</span>
            </div>

            <h3 className="text-sm font-bold text-vsc-bright mb-1">
              Exposed Database (Port 5432)
            </h3>
            <p className="text-vsc-muted text-xs leading-relaxed mb-4">
              PostgreSQL database server port is publicly reachable on staging infrastructure. Unauthenticated brute-force attacks possible.
            </p>

            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase text-vsc-muted mb-1.5 font-mono">
                Remediation Playbook (UFW Rule):
              </div>
              <div className="bg-vsc-panel p-2.5 rounded border border-vsc-border font-mono text-[11px] text-vsc-string relative group">
                <code>sudo ufw deny 5432/tcp</code>
                <br />
                <code>sudo ufw allow from 10.0.0.0/8</code>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => handleCopy('sudo ufw deny 5432/tcp\nsudo ufw allow from 10.0.0.0/8')}
              className="w-full bg-vsc-blue hover:bg-vsc-blueHover text-white py-1.5 px-3 rounded font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Remediation Command'}</span>
            </button>
            <button className="w-full bg-vsc-dropdown hover:bg-vsc-card border border-vsc-border text-vsc-text py-1.5 px-3 rounded text-xs flex items-center justify-center gap-2 transition-colors">
              <FileCode className="w-3.5 h-3.5" />
              <span>Export Incident PDF</span>
            </button>
          </div>
        </aside>
      </div>

      {/* 3. VS CODE STATUS BAR (Bottom 22px) */}
      <footer className="h-6 bg-vsc-blue text-white flex items-center justify-between px-3 text-[11px] font-mono select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-bold">
            <span>🛡️</span>
            <span>AUDIT_MODE: ACTIVE</span>
          </span>
          <span className="opacity-75">|</span>
          <span>Target: {targetInput}</span>
          <span className="opacity-75">|</span>
          <span className="font-bold">Risk: 78/100 (CRITICAL)</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Workers: 4/4</span>
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
