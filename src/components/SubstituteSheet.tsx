import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import type { Meal, MealIngredient, MealSubstitution, PantryItem, UserProfile, PantryUnit } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { usePantryStore } from '../store/pantryStore';

interface Props {
  meal: Meal;
  profile: UserProfile;
  pantryItems: PantryItem[];
  apiKey: string;
  onSave: (sub: MealSubstitution) => void;
  onClose: () => void;
}

interface Suggestion {
  name: string;
  quantity: number;
  unit: string;
  reason: string;
  pantryStatus: 'ok' | 'low' | 'empty' | 'missing';
}

function norm(s: string) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findInPantry(name: string, items: PantryItem[]): PantryItem | undefined {
  const n = norm(name);
  return items.find(p => {
    const pn = norm(p.name);
    return pn === n || pn.includes(n) || n.includes(pn);
  });
}

function getPantryStatus(item: PantryItem | undefined): 'ok' | 'low' | 'empty' | 'missing' {
  if (!item) return 'missing';
  if (item.quantity === 0) return 'empty';
  if (item.quantity <= item.initialQuantity / 3) return 'low';
  return 'ok';
}

// ─── Diet compatibility check ─────────────────────────────────────────────────

function checkDietCompatibility(name: string, profile: UserProfile): string | null {
  const n = norm(name);

  // Check intolleranze first
  for (const int of profile.intolleranze) {
    const ni = norm(int);
    if (n.includes(ni) || ni.includes(n)) {
      return `"${name}" potrebbe contenere ${int}, presente nella tua lista di intolleranze.`;
    }
  }

  const meatWords = ['carne', 'pollo', 'manzo', 'maiale', 'vitello', 'agnello', 'tacchino',
    'prosciutto', 'salame', 'pancetta', 'salsiccia', 'bistecca', 'hamburger', 'cotoletta'];
  const fishWords = ['pesce', 'tonno', 'salmone', 'merluzzo', 'orata', 'branzino',
    'gamberetti', 'cozze', 'vongole', 'sardine', 'acciughe', 'sgombro'];
  const dairyWords = ['latte', 'formaggio', 'mozzarella', 'ricotta', 'burro', 'panna',
    'yogurt', 'grana', 'parmigiano', 'pecorino'];
  const eggWords = ['uova', 'uovo'];

  if (profile.diet === 'vegano') {
    const allAnimal = [...meatWords, ...fishWords, ...dairyWords, ...eggWords];
    if (allAnimal.some(w => n.includes(w))) {
      return `"${name}" non sembra adatto a una dieta vegana.`;
    }
  }
  if (profile.diet === 'vegetariano') {
    if ([...meatWords, ...fishWords].some(w => n.includes(w))) {
      return `"${name}" non sembra adatto a una dieta vegetariana.`;
    }
  }
  if (profile.diet === 'pescetariano') {
    if (meatWords.some(w => n.includes(w))) {
      return `"${name}" è carne. Non si abbina a una dieta pescetariana.`;
    }
  }

  return null;
}

// ─── Claude suggestions ───────────────────────────────────────────────────────

async function fetchSuggestions(
  apiKey: string,
  ing: MealIngredient,
  meal: Meal,
  pantryItems: PantryItem[],
): Promise<Array<{ name: string; quantity: number; unit: string; reason: string }>> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const pantryList = pantryItems.length > 0
    ? pantryItems.map(p => `- ${p.name} (${p.quantity}${p.unit})`).join('\n')
    : 'Dispensa vuota';

  const prompt = `Sei un nutrizionista. Sostituisci "${ing.name}" (${ing.quantity} ${ing.unit}) nel pasto "${meal.name}" (${meal.type}).

Dispensa disponibile:
${pantryList}

Suggerisci 4-5 sostituti che:
1. Si abbinino al pasto (${meal.type}: ${meal.name}) — non proporre cose fuori contesto
2. Siano salutari e nutrienti — niente junk food
3. Abbiano grammatura equivalente ~${ing.quantity} ${ing.unit}
4. Preferisci ingredienti presenti in dispensa; puoi suggerire altri se si abbinano meglio

Rispondi SOLO con JSON valido:
{"suggestions":[{"name":"nome","quantity":${ing.quantity},"unit":"${ing.unit}","reason":"max 4 parole"}]}`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content.find(b => b.type === 'text')?.text ?? '';
  const jsonText = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(jsonText);
  return parsed.suggestions ?? [];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubstituteSheet({ meal, profile, pantryItems, apiKey, onSave, onClose }: Props) {
  const navigate = useNavigate();
  const { setClaudeApiKey } = useSettingsStore();
  const { household } = useAuthStore();
  const { addItem } = usePantryStore();

  const [selectedIngredient, setSelectedIngredient] = useState<MealIngredient | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [replaceName, setReplaceName] = useState('');
  const [replaceQty, setReplaceQty] = useState('');
  const [replaceUnit, setReplaceUnit] = useState('g');
  const [error, setError] = useState('');

  // Inline API key input (shown when apiKey is missing)
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiInput, setShowApiInput] = useState(false);

  // Pantry autocomplete
  const [pantryHints, setPantryHints] = useState<PantryItem[]>([]);

  // Diet warning overlay
  const [dietWarning, setDietWarning] = useState<string | null>(null);
  const [pendingSub, setPendingSub] = useState<MealSubstitution | null>(null);

  // Add to pantry prompt
  const [addToPantryPrompt, setAddToPantryPrompt] = useState<{ name: string; quantity: number; unit: string } | null>(null);
  const [addToPantryQty, setAddToPantryQty] = useState('');
  const [addingToPantry, setAddingToPantry] = useState(false);

  const alreadyReplaced = new Set(meal.substitutions.map(s => s.originalIngredient.name));
  const availableIngredients = meal.ingredients.filter(i => !alreadyReplaced.has(i.name));

  // ─── Ingredient selection ───────────────────────────────────────────────────

  const selectIngredient = async (ing: MealIngredient) => {
    setSelectedIngredient(ing);
    setReplaceQty(ing.quantity.toString());
    setReplaceUnit(ing.unit);
    setReplaceName('');
    setError('');
    setSuggestions([]);
    setPantryHints([]);
    if (!apiKey) return;
    setLoadingSuggestions(true);
    try {
      const raw = await fetchSuggestions(apiKey, ing, meal, pantryItems);
      const enriched: Suggestion[] = raw.map(s => {
        const pantryItem = findInPantry(s.name, pantryItems);
        return { ...s, pantryStatus: getPantryStatus(pantryItem) };
      });
      const order = { ok: 0, low: 1, empty: 2, missing: 3 };
      enriched.sort((a, b) => order[a.pantryStatus] - order[b.pantryStatus]);
      setSuggestions(enriched);
    } catch { /* fallback silenzioso */ }
    finally { setLoadingSuggestions(false); }
  };

  const applySuggestion = (s: Suggestion) => {
    setReplaceName(s.name);
    setReplaceQty(s.quantity.toString());
    setReplaceUnit(s.unit);
    setError('');
    setPantryHints([]);
  };

  // ─── Pantry autocomplete ────────────────────────────────────────────────────

  const handleNameChange = (value: string) => {
    setReplaceName(value);
    setError('');
    if (!value.trim()) {
      setPantryHints([]);
      return;
    }
    const nv = norm(value);
    const matches = pantryItems.filter(p => norm(p.name).includes(nv) && p.quantity > 0);
    setPantryHints(matches.slice(0, 5));
  };

  const applyPantryHint = (item: PantryItem) => {
    setReplaceName(item.name);
    setReplaceQty(item.quantity.toString());
    setReplaceUnit(item.unit);
    setPantryHints([]);
    setError('');
  };

  // ─── Save flow ──────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!selectedIngredient) { setError("Seleziona l'ingrediente da sostituire"); return; }
    if (!replaceName.trim()) { setError('Inserisci il nome del sostituto'); return; }
    const qty = parseFloat(replaceQty);
    if (isNaN(qty) || qty <= 0) { setError('Quantità non valida'); return; }

    const sub: MealSubstitution = {
      originalIngredient: selectedIngredient,
      replacementIngredient: { name: replaceName.trim(), quantity: qty, unit: replaceUnit },
    };

    // Diet compatibility check
    const warning = checkDietCompatibility(replaceName.trim(), profile);
    if (warning) {
      setDietWarning(warning);
      setPendingSub(sub);
      return;
    }

    confirmSub(sub);
  };

  const confirmSub = (sub: MealSubstitution) => {
    setDietWarning(null);
    setPendingSub(null);

    // Check if replacement is in pantry
    const inPantry = findInPantry(sub.replacementIngredient.name, pantryItems);
    if (!inPantry) {
      setAddToPantryPrompt({
        name: sub.replacementIngredient.name,
        quantity: sub.replacementIngredient.quantity,
        unit: sub.replacementIngredient.unit,
      });
      setAddToPantryQty(sub.replacementIngredient.quantity.toString());
      // Store sub to call onSave after pantry decision
      setPendingSub(sub);
      return;
    }

    onSave(sub);
  };

  const handleAddToPantry = async () => {
    if (!addToPantryPrompt || !household?.id || !pendingSub) return;
    const qty = parseFloat(addToPantryQty);
    if (isNaN(qty) || qty <= 0) return;

    setAddingToPantry(true);
    try {
      const unit = (addToPantryPrompt.unit as PantryUnit) || 'g';
      const newItem: PantryItem = {
        id: crypto.randomUUID(),
        householdId: household.id,
        name: addToPantryPrompt.name,
        category: 'Altro',
        quantity: qty,
        unit,
        initialQuantity: qty,
        priceHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addItem(newItem);
    } finally {
      setAddingToPantry(false);
    }

    const sub = pendingSub;
    setAddToPantryPrompt(null);
    setPendingSub(null);
    onSave(sub);
  };

  const handleSkipAddToPantry = () => {
    const sub = pendingSub!;
    setAddToPantryPrompt(null);
    setPendingSub(null);
    onSave(sub);
  };

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    setClaudeApiKey(apiKeyInput.trim());
    setShowApiInput(false);
    // Re-trigger suggestions if ingredient is already selected
    if (selectedIngredient) selectIngredient(selectedIngredient);
  };

  // ─── Status badge ───────────────────────────────────────────────────────────

  const statusBadge = (status: Suggestion['pantryStatus']) => {
    switch (status) {
      case 'ok':      return <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">✓ In dispensa</span>;
      case 'low':     return <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">⚠ In esaurimento</span>;
      case 'empty':   return <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">✗ Esaurito</span>;
      case 'missing': return <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium shrink-0">Non in dispensa</span>;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[55]" onClick={onClose} />
      <div className="fixed bottom-16 left-0 right-0 bg-white rounded-t-3xl z-[60] shadow-2xl max-h-[calc(92vh-4rem)] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        {/* Header */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Sostituisci ingrediente</h2>
              <p className="text-xs text-gray-400 truncate max-w-[240px]">{meal.name}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl mb-3">{error}</p>}

          {/* Sostituzioni già applicate */}
          {meal.substitutions.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">Sostituzioni attive:</p>
              {meal.substitutions.map((sub, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-800">
                  <span className="line-through text-gray-400">{sub.originalIngredient.name} ({sub.originalIngredient.quantity}{sub.originalIngredient.unit})</span>
                  <span>→</span>
                  <span className="font-medium">{sub.replacementIngredient.name} ({sub.replacementIngredient.quantity}{sub.replacementIngredient.unit})</span>
                </div>
              ))}
            </div>
          )}

          {availableIngredients.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Tutti gli ingredienti sono già stati sostituiti.</p>
          ) : (
            <>
              {/* Step 1 */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
                  1. Ingrediente da sostituire
                </label>
                <div className="space-y-2">
                  {availableIngredients.map((ing, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectIngredient(ing)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                        selectedIngredient?.name === ing.name
                          ? 'bg-primary-50 border-primary-400 text-primary-800'
                          : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{ing.name}</span>
                        <span className="text-xs text-gray-400">{ing.quantity} {ing.unit}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2 */}
              {selectedIngredient && (
                <div className="mb-5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
                    2. Scegli sostituto
                  </label>

                  {/* API key missing */}
                  {!apiKey && !showApiInput && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3 flex items-start gap-3">
                      <span className="text-lg shrink-0">🔑</span>
                      <div className="flex-1">
                        <p className="text-xs text-gray-600 font-medium">Claude AI non configurato</p>
                        <p className="text-xs text-gray-400 mt-0.5">Aggiungi la API key per ricevere suggerimenti automatici dalla dispensa.</p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => setShowApiInput(true)}
                            className="text-xs text-primary-600 font-semibold underline"
                          >
                            Imposta API key
                          </button>
                          <span className="text-gray-300">·</span>
                          <button
                            onClick={() => navigate('/profili-app')}
                            className="text-xs text-gray-400"
                          >
                            Vai a Profili
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!apiKey && showApiInput && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">API key Claude (Anthropic)</p>
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={e => setApiKeyInput(e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm bg-white mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveApiKey}
                          disabled={!apiKeyInput.trim()}
                          className="flex-1 py-2 bg-primary-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition"
                        >
                          Salva
                        </button>
                        <button
                          onClick={() => setShowApiInput(false)}
                          className="px-4 py-2 text-sm text-gray-500 rounded-xl border border-gray-200"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Suggerimenti AI */}
                  {loadingSuggestions ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3 px-1">
                      <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin shrink-0" />
                      Cerco alternative dalla tua dispensa...
                    </div>
                  ) : suggestions.length > 0 ? (
                    <div className="mb-3 space-y-2">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => applySuggestion(s)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                            replaceName === s.name
                              ? 'border-primary-400 bg-primary-50'
                              : s.pantryStatus === 'ok'
                                ? 'border-green-200 bg-green-50 hover:border-green-400'
                                : s.pantryStatus === 'low'
                                  ? 'border-amber-200 bg-amber-50 hover:border-amber-400'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm text-gray-900">{s.name}</span>
                                {statusBadge(s.pantryStatus)}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 italic">{s.reason}</p>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0 mt-0.5">{s.quantity} {s.unit}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* Form manuale */}
                  <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                    <p className="text-xs text-gray-500 font-medium">
                      {suggestions.length > 0 ? 'Oppure inserisci manualmente:' : 'Inserisci il sostituto:'}
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        value={replaceName}
                        onChange={e => handleNameChange(e.target.value)}
                        placeholder={`Al posto di "${selectedIngredient.name}"...`}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm bg-white"
                      />
                      {/* Pantry autocomplete hints */}
                      {pantryHints.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                          {pantryHints.map((item, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => applyPantryHint(item)}
                              className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition flex items-center justify-between border-b border-gray-50 last:border-0"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base leading-none">🗄️</span>
                                <span className="text-sm font-medium text-gray-800">{item.name}</span>
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">In dispensa</span>
                              </div>
                              <span className="text-xs text-gray-400 shrink-0">{item.quantity} {item.unit}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Quantità</label>
                        <input
                          type="number"
                          value={replaceQty}
                          onChange={e => setReplaceQty(e.target.value)}
                          min={0.1}
                          step={0.1}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-400 outline-none text-sm bg-white text-center"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Unità</label>
                        <input
                          type="text"
                          value={replaceUnit}
                          onChange={e => setReplaceUnit(e.target.value)}
                          placeholder="g, ml, pz..."
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-400 outline-none text-sm bg-white text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Fixed footer */}
        <div className="px-4 pt-3 pb-8 border-t border-gray-100 shrink-0 bg-white">
          <button
            onClick={handleSave}
            disabled={!selectedIngredient || !replaceName.trim()}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition"
          >
            Applica sostituzione
          </button>
        </div>
      </div>

      {/* ─── Diet warning overlay ──────────────────────────────────────────────── */}
      {dietWarning && pendingSub && (
        <>
          <div className="fixed inset-0 bg-black/50 z-60" />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-60 shadow-2xl px-4 pb-8 pt-4">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-2xl">⚠️</div>
              <div>
                <h3 className="font-bold text-gray-900 text-base mb-1">Possibile incompatibilità</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{dietWarning}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={() => confirmSub(pendingSub)}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-2xl transition"
              >
                Aggiungi comunque
              </button>
              <button
                onClick={() => { setDietWarning(null); setPendingSub(null); }}
                className="w-full py-3 text-gray-500 font-medium rounded-2xl border border-gray-200 hover:bg-gray-50 transition"
              >
                Annulla
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Add to pantry prompt ──────────────────────────────────────────────── */}
      {addToPantryPrompt && pendingSub && (
        <>
          <div className="fixed inset-0 bg-black/50 z-60" />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-60 shadow-2xl px-4 pb-8 pt-4">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center text-2xl">🛒</div>
              <div>
                <h3 className="font-bold text-gray-900 text-base mb-1">Aggiungere in dispensa?</h3>
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-800">{addToPantryPrompt.name}</span> non è presente nella tua dispensa. Vuoi aggiungerlo?
                </p>
              </div>
            </div>
            <div className="mt-4 bg-gray-50 rounded-xl p-3">
              <label className="text-xs text-gray-500 block mb-1">Quantità acquistata</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={addToPantryQty}
                  onChange={e => setAddToPantryQty(e.target.value)}
                  min={0.1}
                  step={0.1}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-400 outline-none text-sm bg-white text-center"
                />
                <span className="flex items-center px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-500 font-medium">
                  {addToPantryPrompt.unit}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={handleAddToPantry}
                disabled={addingToPantry || !addToPantryQty}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2"
              >
                {addingToPantry ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : '🗄️'}
                Aggiungi in dispensa
              </button>
              <button
                onClick={handleSkipAddToPantry}
                disabled={addingToPantry}
                className="w-full py-3 text-gray-500 font-medium rounded-2xl border border-gray-200 hover:bg-gray-50 transition"
              >
                No grazie, solo sostituzione
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
