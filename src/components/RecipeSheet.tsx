import { useEffect, useRef, useState } from 'react';
import { generateRecipe } from '../lib/claudeRecipeGenerator';
import type { Meal, UserProfile } from '../types';

interface Props {
  meal: Meal;
  profile: UserProfile;
  apiKey: string;
  onClose: () => void;
}

// ─── Meal type visuals ────────────────────────────────────────────────────────

const MEAL_VISUALS: Record<string, {
  emoji: string;
  bgFrom: string;
  bgVia: string;
  bgTo: string;
  label: string;
}> = {
  colazione: {
    emoji: '🥐',
    bgFrom: '#92400e', bgVia: '#d97706', bgTo: '#f59e0b',
    label: 'Colazione',
  },
  spuntino_mattina: {
    emoji: '🍎',
    bgFrom: '#991b1b', bgVia: '#dc2626', bgTo: '#f87171',
    label: 'Spuntino mattina',
  },
  pranzo: {
    emoji: '🍝',
    bgFrom: '#14532d', bgVia: '#16a34a', bgTo: '#4ade80',
    label: 'Pranzo',
  },
  spuntino_pomeriggio: {
    emoji: '🧃',
    bgFrom: '#713f12', bgVia: '#ca8a04', bgTo: '#a3e635',
    label: 'Spuntino pomeriggio',
  },
  cena: {
    emoji: '🥩',
    bgFrom: '#1e1b4b', bgVia: '#7c3aed', bgTo: '#c026d3',
    label: 'Cena',
  },
};

// ─── Inline markdown renderer ─────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;

        if (/^#{1,3}\s/.test(line)) {
          const content = line.replace(/^#+\s/, '');
          return (
            <h3 key={i} className="text-sm font-bold text-gray-900 mt-5 mb-2 first:mt-0 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-primary-500 shrink-0 inline-block" />
              {renderInline(content)}
            </h3>
          );
        }

        if (/^\*\*[^*]+\*\*:?\s*$/.test(line)) {
          return (
            <h3 key={i} className="text-sm font-bold text-gray-900 mt-5 mb-2 first:mt-0 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-primary-500 shrink-0 inline-block" />
              {line.replace(/\*\*/g, '').replace(/:$/, '')}
            </h3>
          );
        }

        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed py-1">
              <span className="w-6 h-6 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {numMatch[1]}
              </span>
              <span className="flex-1 pt-0.5">{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        if (/^[-•*]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2.5 text-sm text-gray-700 leading-relaxed py-0.5 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0 mt-2" />
              <span className="flex-1">{renderInline(line.replace(/^[-•*]\s/, ''))}</span>
            </div>
          );
        }

        return (
          <p key={i} className="text-sm text-gray-700 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export default function RecipeSheet({ meal, profile, apiKey, onClose }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [servings, setServings] = useState(2);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  const visual = MEAL_VISUALS[meal.type] ?? {
    emoji: '🍽️',
    bgFrom: '#374151', bgVia: '#6b7280', bgTo: '#9ca3af',
    label: 'Pasto',
  };

  const runGeneration = async (sv: number) => {
    setText('');
    setLoading(true);
    setError(null);
    abortRef.current = false;
    try {
      for await (const chunk of generateRecipe(apiKey, meal, profile, sv)) {
        if (abortRef.current) break;
        setText(prev => prev + chunk);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
    } catch (e) {
      if (!abortRef.current) {
        setError(e instanceof Error ? e.message : 'Errore durante la generazione della ricetta.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runGeneration(servings);
    return () => { abortRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleServingsChange = (delta: number) => {
    const next = Math.max(1, Math.min(12, servings + delta));
    if (next === servings) return;
    setServings(next);
    abortRef.current = true;
    setTimeout(() => runGeneration(next), 50);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Sheet — piena altezza meno la BottomNav */}
      <div className="fixed bottom-16 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl max-h-[calc(92vh-4rem)] flex flex-col overflow-hidden">

        {/* ── HERO FOTOGRAFICO ──────────────────────────────────── */}
        <div
          className="relative shrink-0 h-56 rounded-t-3xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${visual.bgFrom} 0%, ${visual.bgVia} 55%, ${visual.bgTo} 100%)`,
          }}
        >
          {/* Texture radiale che simula la luce del piatto */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: [
                'radial-gradient(ellipse 60% 50% at 35% 40%, rgba(255,255,255,0.18) 0%, transparent 70%)',
                'radial-gradient(ellipse 40% 60% at 75% 65%, rgba(0,0,0,0.25) 0%, transparent 60%)',
              ].join(', '),
            }}
          />

          {/* Grana fotografica */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
              backgroundSize: '150px 150px',
            }}
          />

          {/* Emoji — centrata, grande, con ombra profonda */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-[100px] select-none leading-none"
              style={{
                filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.45)) drop-shadow(0 4px 8px rgba(0,0,0,0.30))',
              }}
            >
              {visual.emoji}
            </span>
          </div>

          {/* Gradiente nero in basso — divide hero dal contenuto */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Tipo pasto in basso a sinistra */}
          <div className="absolute bottom-4 left-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
              {visual.label}
            </span>
          </div>

          {/* Drag handle */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/30 rounded-full" />

          {/* Close button flottante */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center hover:bg-black/40 transition"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Rigenera — flottante in alto a sinistra, appare solo dopo il loading */}
          {!loading && (
            <button
              onClick={() => runGeneration(servings)}
              className="absolute top-3 left-3 flex items-center gap-1.5 text-[11px] text-white font-semibold px-2.5 py-1.5 rounded-full bg-black/25 backdrop-blur-sm hover:bg-black/40 transition"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Rigenera
            </button>
          )}
        </div>

        {/* ── TITOLO + META ─────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-3 shrink-0">
          <h2 className="text-[22px] font-extrabold text-gray-900 leading-tight mb-2">
            {meal.name}
          </h2>

          {/* Pills dieta / intolleranze */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {profile.diet && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold capitalize">
                {profile.diet}
              </span>
            )}
            {profile.intolleranze.slice(0, 3).map(i => (
              <span key={i} className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                senza {i}
              </span>
            ))}
            {profile.intolleranze.length > 3 && (
              <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                +{profile.intolleranze.length - 3}
              </span>
            )}
          </div>

          {/* Porzioni stepper */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
            <div>
              <p className="text-sm font-bold text-gray-800">Porzioni</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Quantità scalate automaticamente</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleServingsChange(-1)}
                disabled={servings <= 1}
                className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary-400 hover:text-primary-600 disabled:opacity-25 disabled:cursor-not-allowed transition shadow-sm active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
              </button>
              <div className="text-center w-8">
                <span className="text-2xl font-extrabold text-primary-600 tabular-nums">{servings}</span>
              </div>
              <button
                onClick={() => handleServingsChange(1)}
                disabled={servings >= 12}
                className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary-400 hover:text-primary-600 disabled:opacity-25 disabled:cursor-not-allowed transition shadow-sm active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mx-4 border-t border-gray-100 shrink-0" />

        {/* ── CONTENUTO RICETTA ─────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-6 pt-3">

          {/* Loading */}
          {loading && text === '' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: `linear-gradient(135deg, ${visual.bgFrom}, ${visual.bgVia})` }}
                >
                  🍳
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">Sto preparando la ricetta…</p>
                <p className="text-xs text-gray-400 mt-1">
                  Per {servings} person{servings === 1 ? 'a' : 'e'} · Claude AI sta elaborando
                </p>
              </div>
            </div>
          )}

          {/* Streaming text */}
          {text && (
            <div className="pb-2">
              <MarkdownBlock text={text} />
              {loading && (
                <span className="inline-block w-1.5 h-4 bg-primary-500 rounded-sm animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mt-2">
              <div className="flex items-start gap-2.5">
                <span className="text-xl mt-0.5">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-red-700">Errore generazione</p>
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                  <button
                    onClick={() => runGeneration(servings)}
                    className="mt-2.5 text-xs text-white font-semibold bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition"
                  >
                    Riprova
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && text && (
          <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-white">
            <p className="text-center text-[10px] text-gray-400">
              ✨ Ricetta generata da Claude AI · verifica sempre con il tuo nutrizionista
            </p>
          </div>
        )}
      </div>
    </>
  );
}
