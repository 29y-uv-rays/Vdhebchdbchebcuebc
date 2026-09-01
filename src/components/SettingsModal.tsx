import React, { useState } from 'react';
import { AISettings } from '../types';
import { Settings, Cpu, Bot, Sliders, CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSaveSettings: (settings: AISettings) => void;
  boardTheme: 'emerald' | 'wood' | 'modern' | 'slate';
  onChangeBoardTheme: (theme: 'emerald' | 'wood' | 'modern' | 'slate') => void;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
}

const POPULAR_NVIDIA_MODELS = [
  { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'NVIDIA Nemotron 3.5 Lightning 30B (Recommended)' },
  { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct' },
  { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B Instruct' },
  { id: 'nvidia/nemotron-4-340b-instruct', name: 'NVIDIA Nemotron-4 340B' },
  { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1' },
  { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct (Fast)' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  boardTheme,
  onChangeBoardTheme,
  soundEnabled,
  onToggleSound,
}) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; message?: string; success?: boolean } | null>(null);

  if (!isOpen) return null;

  const formatTestConnectionError = (data: unknown): string => {
    if (typeof data !== 'object' || data === null) return 'Connection failed';

    const payload = data as {
      error?: unknown;
      code?: unknown;
      details?: unknown;
    };

    const error = typeof payload.error === 'string' ? payload.error : 'Connection failed';
    const code = typeof payload.code === 'string' ? payload.code : undefined;

    const details = Array.isArray(payload.details)
      ? payload.details
          .map((item) => {
            if (typeof item !== 'object' || item === null) return null;
            const detail = item as { field?: unknown; issue?: unknown };
            if (typeof detail.field !== 'string' || typeof detail.issue !== 'string') return null;
            return `${detail.field}: ${detail.issue}`;
          })
          .filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];

    return [error, code ? `Code: ${code}` : null, details.length > 0 ? `Details: ${details.join(' | ')}` : null]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' | ');
  };

  const handleTestNvidiaKey = async () => {
    setTestStatus({ loading: true });
    try {
      const res = await fetch('/api/ai/test-nim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localSettings.nvidiaModel,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus({
          loading: false,
          success: true,
          message: `Connected successfully! (${data.reply})`,
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: formatTestConnectionError(data),
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      setTestStatus({ loading: false, success: false, message });
    }
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-white animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Game & Coach Settings</h2>
              <p className="text-xs text-slate-400">Configure AI Providers (NVIDIA NIM / Offline) & Analysis Sensitivity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* AI Provider Section */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              AI Coach Engine Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'nvidia', title: 'NVIDIA NIM API', desc: 'Custom NVIDIA NIM endpoint & models' },
                { id: 'heuristic', title: 'Instant Offline Engine', desc: 'Fast rule-based tactical coaching' },
              ].map((prov) => (
                <button
                  key={prov.id}
                  onClick={() =>
                    setLocalSettings(s => ({ ...s, provider: prov.id as AISettings['provider'] }))
                  }
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    localSettings.provider === prov.id
                      ? 'bg-indigo-950/50 border-indigo-500 text-white ring-1 ring-indigo-500 shadow-md'
                      : 'bg-slate-800/40 border-slate-700/70 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="font-semibold text-xs text-white">{prov.title}</div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug">{prov.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* NVIDIA NIM Key Configuration (Shown if NVIDIA provider or configured) */}
          {localSettings.provider === 'nvidia' && (
            <div className="p-4 bg-slate-800/40 rounded-2xl border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider font-mono">
                  NVIDIA NIM Integration
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Calls integrate.api.nvidia.com</span>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  NVIDIA Model
                </label>
                <select
                  value={localSettings.nvidiaModel}
                  onChange={(e) =>
                    setLocalSettings(s => ({ ...s, nvidiaModel: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {POPULAR_NVIDIA_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Test Button & Status */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestNvidiaKey}
                  disabled={testStatus?.loading}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {testStatus?.loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  Test Connection
                </button>

                {testStatus?.message && (
                  <div
                    className={`text-xs flex items-center gap-1.5 ${
                      testStatus.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testStatus.success ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span className="whitespace-pre-wrap break-words">{testStatus.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coach Persona */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              Coach Personality
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'encouraging', label: 'Encouraging', desc: 'Supportive & pedagogical' },
                { id: 'strict', label: 'Grandmaster', desc: 'Direct & disciplined' },
                { id: 'tactical', label: 'Tactical Trainer', desc: 'Focuses on tactics' },
                { id: 'friendly', label: 'Friendly Club', desc: 'Simple & intuitive' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setLocalSettings(s => ({ ...s, coachPersona: p.id as AISettings['coachPersona'] }))
                  }
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    localSettings.coachPersona === p.id
                      ? 'bg-indigo-950/50 border-indigo-500 text-white ring-1 ring-indigo-500 shadow-md'
                      : 'bg-slate-800/40 border-slate-700/70 text-slate-400 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{p.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Configurable Mistake Thresholds */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Mistake Classification Sensitivity
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <div>
                <span className="text-xs text-yellow-400 font-semibold block mb-1">
                  Inaccuracy: ≥{localSettings.mistakeThresholds.inaccuracy.toFixed(2)} pawns
                </span>
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.05"
                  value={localSettings.mistakeThresholds.inaccuracy}
                  onChange={(e) =>
                    setLocalSettings(s => ({
                      ...s,
                      mistakeThresholds: { ...s.mistakeThresholds, inaccuracy: parseFloat(e.target.value) },
                    }))
                  }
                  className="w-full accent-yellow-400 cursor-pointer"
                />
              </div>

              <div>
                <span className="text-xs text-orange-400 font-semibold block mb-1">
                  Mistake: ≥{localSettings.mistakeThresholds.mistake.toFixed(2)} pawns
                </span>
                <input
                  type="range"
                  min="0.6"
                  max="1.8"
                  step="0.1"
                  value={localSettings.mistakeThresholds.mistake}
                  onChange={(e) =>
                    setLocalSettings(s => ({
                      ...s,
                      mistakeThresholds: { ...s.mistakeThresholds, mistake: parseFloat(e.target.value) },
                    }))
                  }
                  className="w-full accent-orange-400 cursor-pointer"
                />
              </div>

              <div>
                <span className="text-xs text-rose-400 font-semibold block mb-1">
                  Blunder: ≥{localSettings.mistakeThresholds.blunder.toFixed(2)} pawns
                </span>
                <input
                  type="range"
                  min="1.5"
                  max="3.5"
                  step="0.1"
                  value={localSettings.mistakeThresholds.blunder}
                  onChange={(e) =>
                    setLocalSettings(s => ({
                      ...s,
                      mistakeThresholds: { ...s.mistakeThresholds, blunder: parseFloat(e.target.value) },
                    }))
                  }
                  className="w-full accent-rose-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Board Theme & Sound */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Board Theme
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['emerald', 'wood', 'modern', 'slate'] as const).map((th) => (
                  <button
                    key={th}
                    onClick={() => onChangeBoardTheme(th)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold capitalize border transition-all cursor-pointer ${
                      boardTheme === th
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-950/40'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {th}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">Sound Effects</span>
                <span className="text-[11px] text-slate-400">Synthesized move & coach audio</span>
              </div>
              <button
                onClick={() => onToggleSound(!soundEnabled)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  soundEnabled ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {soundEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800 bg-slate-900 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-950/50 transition-all cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
