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
      <div className="w-full max-w-lg bg-[#111318] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-xs text-slate-200">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            <span className="font-mono font-bold text-sm text-white">
              💾 OSINT Case Session Manager (.case.json)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Save Current Investigation */}
          <form onSubmit={handleSave} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-300 font-bold">
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
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white outline-none focus:border-indigo-400"
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
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 px-3 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/60 text-indigo-200 font-mono text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {savedToast ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Saved to Browser!</span>
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
                className="py-2 px-3 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 font-mono text-xs font-bold flex items-center gap-1.5"
                title="Download portable .case.json file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .case.json</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs font-semibold flex items-center gap-1.5"
                title="Import a saved .case.json file"
              >
                <Upload className="w-3.5 h-3.5" />
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
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Saved Browser Case Snapshots ({savedCases.length})
            </div>
            {savedCases.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-slate-400">
                No saved cases yet. Click <strong>Save Snapshot</strong> above to store your active
                board.
              </div>
            ) : (
              <div className="space-y-1.5">
                {savedCases.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <FileJson className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
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
                        className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 font-mono text-[10px] font-bold"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCase(c.id)}
                        className="p-1 rounded hover:bg-rose-950/60 text-slate-500 hover:text-rose-400"
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

