'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  FolderOpen,
  Save,
  Download,
  Upload,
  Trash2,
  FileJson,
  Check,
} from 'lucide-react';
import { CaseFile } from '@iseeyou/shared-types';

interface CaseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCaseName: string;
  caseNotes: string;
  onCaseNotesChange: (notes: string) => void;
  savedCases: CaseFile[];
  onSaveCase: (name?: string) => void;
  onLoadCase: (caseFile: CaseFile) => void;
  onDeleteCase: (id: string) => void;
  onExportCaseJson: () => void;
}

export function CaseManagerModal({
  isOpen,
  onClose,
  activeCaseName,
  caseNotes,
  onCaseNotesChange,
  savedCases,
  onSaveCase,
  onLoadCase,
  onDeleteCase,
  onExportCaseJson,
}: CaseManagerModalProps) {
  const [nameInput, setNameInput] = useState(activeCaseName);
  const [savedToast, setSavedToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCase(nameInput.trim() || activeCaseName);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && parsed.seedInput && Array.isArray(parsed.nodes)) {
          onLoadCase(parsed as CaseFile);
          onClose();
        }
      } catch (err) {
        console.error('Failed to import .case.json:', err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      data-testid="case-manager-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg bg-[#0F1219] border border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden text-xs text-slate-200">
        {/* Header */}
        <div className="px-4 py-3 bg-[#131720] border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-sky-400" />
            <span className="font-mono font-semibold text-sm text-slate-100">
              OSINT Case Session Manager (.case.json)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Save Current Investigation */}
          <form
            onSubmit={handleSave}
            className="p-3.5 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2.5"
          >
            <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
              Current Active Investigation
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Case Name:
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={activeCaseName}
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Global Case Summary / Hypothesis Notes:
              </label>
              <textarea
                rows={2}
                value={caseNotes}
                onChange={(e) => onCaseNotesChange(e.target.value)}
                placeholder="Overall investigation objectives, target background, or timeline notes..."
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-200 outline-none focus:border-sky-400/60"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {savedToast ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved to Browser!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Snapshot</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onExportCaseJson}
                className="py-2 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] text-slate-200 font-mono text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Download portable .case.json file"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export .case.json</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] text-slate-200 font-mono text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Import a saved .case.json file"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Import</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          </form>

          {/* Saved Cases List */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold tabular-nums">
              Saved Browser Case Snapshots ({savedCases.length})
            </div>
            {savedCases.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#131720]/60 border border-white/[0.06] text-center text-slate-400">
                No saved cases yet. Click <strong className="text-slate-200">Save Snapshot</strong> above to store your active
                board.
              </div>
            ) : (
              <div className="space-y-1.5">
                {savedCases.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#131720] border border-white/[0.07] hover:border-white/[0.14] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <FileJson className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 tabular-nums">
                        Target: <strong className="text-slate-200">{c.seedInput}</strong> •{' '}
                        {(c.nodes || []).length} nodes • {new Date(c.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onLoadCase(c);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-mono text-[10px] font-medium transition-colors"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCase(c.id)}
                        className="p-1 rounded-md hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
