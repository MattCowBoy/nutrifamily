import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generateRecipe } from '../../lib/claudeRecipeGenerator';
import type { Meal, UserProfile } from '../../types';

// ─── Meal visuals ─────────────────────────────────────────────────────────────

const MEAL_VISUALS: Record<string, {
  emoji: string;
  bgFrom: string; bgVia: string; bgTo: string;
  label: string;
}> = {
  colazione:           { emoji: '🥐', bgFrom: '#92400e', bgVia: '#d97706', bgTo: '#fbbf24', label: 'Colazione' },
  spuntino_mattina:    { emoji: '🍎', bgFrom: '#991b1b', bgVia: '#dc2626', bgTo: '#f87171', label: 'Spuntino mattina' },
  pranzo:              { emoji: '🍝', bgFrom: '#14532d', bgVia: '#16a34a', bgTo: '#4ade80', label: 'Pranzo' },
  spuntino_pomeriggio: { emoji: '🧃', bgFrom: '#713f12', bgVia: '#ca8a04', bgTo: '#a3e635', label: 'Spuntino pomeriggio' },
  cena:                { emoji: '🥩', bgFrom: '#1e1b4b', bgVia: '#7c3aed', bgTo: '#c026d3', label: 'Cena' },
};

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  // Strip any remaining ** and render bold
  const parts = text.split(/(\*\*[^*]*\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      return <strong key={i} className="font-semibold text-gray-900">{inner}</strong>;
    }
    return part;
  });
}

function RecipeContent({ text, loading }: { text: string; loading: boolean }) {
  // Pre-process: normalise any line that contains ## as a heading
  // and strip stray ** markers
  const lines = text
    .split('\n')
    .map(l => {
      // If line has ## anywhere, normalise it to start with ##
      if (l.includes('##')) {
        const afterHash = l.replace(/^[^#]*##\s*/, '').trim();
        return afterHash ? `## ${afterHash}` : l;
      }
      return l;
    });

  let stepCounter = 0;

  return (
    <div className="space-y-1">
      {lines.map((raw, i) => {
        const line = raw.trim();

        if (!line) return <div key={i} className="h-3" />;

        // Table row → convert to bullet
        if (/^\|/.test(line)) {
          const cells = line.split('|').map(c => c.trim()).filter(c => c && !/^[-:]+$/.test(c));
          if (cells.length === 0) return null;
          return (
            <div key={i} className="flex gap-2.5 py-1 pl-1 items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0 mt-2.5" />
              <span className="flex-1 text-sm text-gray-700 leading-relaxed">{cells.join(' · ')}</span>
            </div>
          );
        }

        // Section heading: starts with # (after normalisation above)
        if (/^#/.test(line)) {
          // Strip all leading # and spaces, then strip remaining **
          const content = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
          stepCounter = 0;
          return (
            <div key={i} className="flex items-center gap-3 mt-7 mb-3 first:mt-0">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 px-1 whitespace-nowrap">
                {content}
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          );
        }

        // Standalone **bold** line → treat as sub-heading
        if (/^\*\*[^*]+\*\*:?\s*$/.test(line)) {
          const content = line.replace(/\*\*/g, '').replace(/:$/, '').trim();
          return (
            <p key={i} className="text-sm font-bold text-gray-800 mt-3 mb-1">{content}</p>
          );
        }

        // Numbered step
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          stepCounter++;
          const n = stepCounter;
          return (
            <div key={i} className="flex gap-3 py-2 items-start">
              <div className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {n}
              </div>
              <p className="flex-1 text-sm text-gray-700 leading-relaxed pt-1">
                {renderInline(numMatch[2])}
              </p>
            </div>
          );
        }

        // Bullet
        if (/^[-•*]\s/.test(line)) {
          const content = line.replace(/^[-•*]\s/, '');
          return (
            <div key={i} className="flex gap-2.5 py-1 pl-1 items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0 mt-2.5" />
              <span className="flex-1 text-sm text-gray-700 leading-relaxed">
                {renderInline(content)}
              </span>
            </div>
          );
        }

        // Plain text — strip any residual ** before rendering
        const clean = line.replace(/\*\*/g, '');
        if (!clean) return null;
        return (
          <p key={i} className="text-sm text-gray-700 leading-relaxed">
            {renderInline(clean)}
          </p>
        );
      })}

      {/* Streaming cursor */}
      {loading && text && (
        <span className="inline-block w-1.5 h-4 bg-primary-500 rounded-sm animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface RecipeState {
  meal: Meal;
  profile: UserProfile;
  apiKey: string;
}

export default function RecipePage() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: RecipeState | null };

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [servings, setServings] = useState(2);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  // Redirect back if no state
  useEffect(() => {
    if (!state?.meal) navigate('/piano', { replace: true });
  }, [state, navigate]);

  if (!state?.meal) return null;

  const { meal, profile, apiKey } = state;
  const visual = MEAL_VISUALS[meal.type] ?? {
    emoji: '🍽️', bgFrom: '#374151', bgVia: '#6b7280', bgTo: '#9ca3af', label: 'Pasto',
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
      }
    } catch (e) {
      if (!abortRef.current) {
        setError(e instanceof Error ? e.message : 'Errore nella generazione della ricetta.');
      }
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    runGeneration(servings);
    return () => { abortRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeServings = (delta: number) => {
    const next = Math.max(1, Math.min(12, servings + delta));
    if (next === servings) return;
    setServings(next);
    abortRef.current = true;
    setTimeout(() => runGeneration(next), 50);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── HERO FOTOGRAFICO ─────────────────────────────────────────────────── */}
      <div
        className="relative w-full shrink-0"
        style={{
          height: '45vh',
          maxHeight: 320,
          background: `linear-gradient(145deg, ${visual.bgFrom} 0%, ${visual.bgVia} 55%, ${visual.bgTo} 100%)`,
        }}
      >
        {/* Luce radiale */}
        <div className="absolute inset-0" style={{
          backgroundImage: [
            'radial-gradient(ellipse 65% 55% at 40% 38%, rgba(255,255,255,0.22) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 65% at 75% 68%, rgba(0,0,0,0.28) 0%, transparent 55%)',
          ].join(', '),
        }} />

        {/* Grana fotografica */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          backgroundSize: '150px',
        }} />

        {/* Emoji principale */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="select-none leading-none"
            style={{
              fontSize: 'clamp(80px, 18vw, 120px)',
              filter: 'drop-shadow(0 14px 36px rgba(0,0,0,0.50)) drop-shadow(0 4px 10px rgba(0,0,0,0.30))',
            }}
          >
            {visual.emoji}
          </span>
        </div>

        {/* Gradiente in basso */}
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white via-transparent to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-safe top-4 left-4 flex items-center gap-1.5 text-white font-semibold text-sm px-3 py-2 rounded-full bg-black/25 backdrop-blur-sm hover:bg-black/40 transition active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Piano
        </button>

        {/* Rigenera */}
        {!loading && (
          <button
            onClick={() => runGeneration(servings)}
            className="absolute top-4 right-4 flex items-center gap-1.5 text-white font-semibold text-[12px] px-3 py-2 rounded-full bg-black/25 backdrop-blur-sm hover:bg-black/40 transition active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rigenera
          </button>
        )}

        {/* Tipo pasto */}
        <div className="absolute bottom-8 left-5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            {visual.label}
          </span>
        </div>
      </div>

      {/* ── TITOLO ───────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-2 pb-4 shrink-0">
        <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">{meal.name}</h1>

        {/* Pills */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {profile.diet && (
            <span className="text-[11px] bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-semibold capitalize">
              {profile.diet}
            </span>
          )}
          {profile.intolleranze.map(i => (
            <span key={i} className="text-[11px] bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full font-medium">
              senza {i}
            </span>
          ))}
        </div>
      </div>

      {/* ── PORZIONI ─────────────────────────────────────────────────────────── */}
      <div className="mx-5 mb-4 shrink-0">
        <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5">
          <div>
            <p className="text-sm font-bold text-gray-800">Porzioni</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Le quantità si adattano</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => changeServings(-1)}
              disabled={servings <= 1}
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary-400 hover:text-primary-600 disabled:opacity-25 disabled:cursor-not-allowed transition shadow-sm active:scale-90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-2xl font-extrabold text-primary-600 w-6 text-center tabular-nums">{servings}</span>
            <button
              onClick={() => changeServings(1)}
              disabled={servings >= 12}
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary-400 hover:text-primary-600 disabled:opacity-25 disabled:cursor-not-allowed transition shadow-sm active:scale-90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-5 border-t border-gray-100 shrink-0" />

      {/* ── RICETTA ──────────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-4 pb-28">

        {/* Loading */}
        {loading && text === '' && (
          <div className="flex flex-col items-center justify-center py-16 gap-5">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
                style={{ background: `linear-gradient(135deg, ${visual.bgFrom}, ${visual.bgVia})` }}
              >
                🍳
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-[3px] border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-800">Sto preparando la ricetta…</p>
              <p className="text-sm text-gray-400 mt-1">
                Per {servings} person{servings === 1 ? 'a' : 'e'} · Claude AI sta elaborando
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        {text && <RecipeContent text={text} loading={loading} />}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mt-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-red-700">Errore generazione</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
                <button
                  onClick={() => runGeneration(servings)}
                  className="mt-3 text-sm text-white font-semibold bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl transition"
                >
                  Riprova
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer disclaimer */}
        {!loading && !error && text && (
          <p className="text-center text-[11px] text-gray-400 mt-8 pb-2">
            ✨ Ricetta generata da Claude AI · verifica sempre con il tuo nutrizionista
          </p>
        )}
      </div>
    </div>
  );
}
