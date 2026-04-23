import { useState, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { parseMealPlanPDF, type ParseProgress } from '../lib/claudeParser';
import type { MealPlan } from '../types';

interface Props {
  householdId: string;
  profileId: string;
  onDone: (plan: MealPlan) => void;
  onClose: () => void;
}

export default function UploadPlanSheet({ householdId, profileId, onDone, onClose }: Props) {
  const { claudeApiKey, setClaudeApiKey } = useSettingsStore();
  const [apiKeyInput, setApiKeyInput] = useState(claudeApiKey);
  const [showKey, setShowKey] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isParsing = progress !== null && progress.status !== 'done' && progress.status !== 'error';

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.type !== 'application/pdf') {
        setError('Seleziona un file PDF');
        return;
      }
      setFile(f);
      setError('');
    }
  };

  const handleParse = async () => {
    if (!apiKeyInput.trim()) { setError('Inserisci la tua API key Claude'); return; }
    if (!file) { setError('Seleziona un file PDF'); return; }
    setError('');
    setClaudeApiKey(apiKeyInput.trim());
    try {
      const plan = await parseMealPlanPDF(
        apiKeyInput.trim(),
        file,
        householdId,
        profileId,
        (p) => setProgress(p),
      );
      onDone(plan);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(msg);
      setProgress({ status: 'error', message: msg });
    }
  };

  const statusIcon = () => {
    if (!progress) return null;
    switch (progress.status) {
      case 'reading': return '📄';
      case 'uploading': return '⬆️';
      case 'parsing': return '🤖';
      case 'done': return '✅';
      case 'error': return '❌';
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={!isParsing ? onClose : undefined} />
      <div className="fixed bottom-16 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl max-h-[calc(90vh-4rem)] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Carica piano alimentare</h2>
              <p className="text-xs text-gray-400">Analisi automatica con Claude AI</p>
            </div>
            {!isParsing && (
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl mb-3">{error}</p>
          )}

          {/* API Key */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
              API Key Claude (Anthropic)
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              La chiave è salvata localmente e non inviata a nessun server esterno.{' '}
              <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-primary-600 underline">Ottienila qui</a>
            </p>
          </div>

          {/* Upload PDF */}
          <div className="mb-5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
              Piano alimentare (PDF)
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                file ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              {file ? (
                <div>
                  <p className="text-2xl mb-1">📄</p>
                  <p className="font-medium text-gray-800 text-sm">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB — clicca per cambiare</p>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">⬆️</p>
                  <p className="text-sm font-medium text-gray-600">Tocca per selezionare il PDF</p>
                  <p className="text-xs text-gray-400">Il piano del tuo nutrizionista</p>
                </div>
              )}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
          </div>

          {/* Progress */}
          {progress && (
            <div className={`mb-4 rounded-xl p-3 flex items-center gap-3 ${
              progress.status === 'error' ? 'bg-red-50 border border-red-100' :
              progress.status === 'done' ? 'bg-green-50 border border-green-100' :
              'bg-blue-50 border border-blue-100'
            }`}>
              <span className="text-xl">{statusIcon()}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">{progress.message}</p>
                  {isParsing && progress.chars !== undefined && progress.chars > 0 && (
                    <span className="text-xs text-blue-500 font-mono">{progress.chars} car.</span>
                  )}
                </div>
                {isParsing && (
                  <div className="h-1.5 bg-blue-100 rounded-full mt-1.5 overflow-hidden">
                    {progress.chars && progress.chars > 0 ? (
                      // Barra animata che avanza con i token ricevuti (stima su ~3000 car. tipici)
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(95, (progress.chars / 3000) * 100)}%` }}
                      />
                    ) : (
                      <div className="h-full bg-blue-500 rounded-full animate-pulse w-1/4" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="bg-gray-50 rounded-xl p-3 mb-5 text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-600 mb-1">Come funziona:</p>
            <p>1. Carica il PDF del piano del tuo nutrizionista</p>
            <p>2. Claude AI legge e struttura automaticamente i pasti</p>
            <p>3. Puoi spuntare i pasti, sostituire ingredienti e chiedere ricette</p>
          </div>

          <button
            onClick={handleParse}
            disabled={isParsing || !file || !apiKeyInput.trim()}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition shadow-sm flex items-center justify-center gap-2"
          >
            {isParsing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analisi in corso...
              </>
            ) : (
              <>
                <span>🤖</span>
                Analizza con Claude AI
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
