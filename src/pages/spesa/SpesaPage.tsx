import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useShoppingStore } from '../../store/shoppingStore';
import { useMealPlanStore } from '../../store/mealPlanStore';
import { usePantryStore } from '../../store/pantryStore';
import BottomNav from '../../components/BottomNav';
import type { ShoppingItem } from '../../types';
import { PANTRY_UNITS } from '../../types';

// ─── ShoppingRow ──────────────────────────────────────────────────────────────

function ShoppingRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl border shadow-sm px-3 py-3 transition-all ${
      item.checked ? 'border-gray-100 opacity-55' : 'border-gray-100'
    }`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item.id)}
        className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
          item.checked
            ? 'bg-primary-500 border-primary-500 text-white'
            : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        {item.checked && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-medium ${item.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {item.name}
          </span>
          {item.origin === 'auto' && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
              Auto
            </span>
          )}
        </div>
        {item.quantity != null && item.unit && (
          <p className="text-xs text-gray-400 mt-0.5">{item.quantity} {item.unit}</p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(item.id)}
        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-200 hover:text-red-400 transition shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── SpesaPage ────────────────────────────────────────────────────────────────

export default function SpesaPage() {
  const { household } = useAuthStore();
  const {
    items, loading,
    loadItems, addManualItem, generateFromPlan,
    toggleChecked, deleteItem, clearChecked, clearAll,
  } = useShoppingStore();
  const { plan, loadPlan } = useMealPlanStore();
  const { items: pantryItems, loadItems: loadPantry } = usePantryStore();
  const { currentProfile } = useAuthStore();

  // Add item form
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newUnit, setNewUnit] = useState<string>('pz');
  const [showQty, setShowQty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [showMenu, setShowMenu] = useState(false);
  const [showChecked, setShowChecked] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (household?.id && currentProfile?.id) {
      loadItems(household.id);
      loadPlan(household.id, currentProfile.id);
      loadPantry(household.id);
    }
  }, [household?.id, currentProfile?.id, loadItems, loadPlan, loadPantry]);

  const handleAdd = async () => {
    if (!newName.trim() || !household) return;
    const qty = newQty ? parseFloat(newQty) : undefined;
    const unit = (showQty && newQty && newUnit) ? newUnit : undefined;
    await addManualItem(household.id, newName.trim(), qty, unit);
    setNewName('');
    setNewQty('');
    setShowQty(false);
    inputRef.current?.focus();
  };

  const handleGenerateFromPlan = async () => {
    if (!plan || !household) return;
    setGenerating(true);
    setLastAdded(null);
    setGenerateError(null);
    try {
      const count = await generateFromPlan(plan, pantryItems, household.id);
      setLastAdded(count);
    } catch (e) {
      console.error('generateFromPlan error:', e);
      setGenerateError(e instanceof Error ? e.message : 'Errore durante la generazione della lista.');
    } finally {
      setGenerating(false);
    }
  };

  const pending = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);
  const autoCount = pending.filter(i => i.origin === 'auto').length;

  // Stima costo
  const estimatedCost = (() => {
    let total = 0;
    let count = 0;
    for (const item of pending) {
      if (!item.pantryItemId) continue;
      const pantryItem = pantryItems.find(p => p.id === item.pantryItemId);
      if (pantryItem?.avgPrice && item.quantity) {
        total += pantryItem.avgPrice * (item.quantity / (pantryItem.initialQuantity || 1));
        count++;
      }
    }
    return count > 0 ? total : null;
  })();

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Lista della spesa</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-400">
                  {pending.length} da comprare
                  {autoCount > 0 && ` · ${autoCount} auto`}
                </p>
                {estimatedCost !== null && (
                  <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                    ~€{estimatedCost.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Menu azioni */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-10 bg-white rounded-2xl shadow-xl border border-gray-100 z-30 w-52 py-1 overflow-hidden">
                    <button
                      onClick={() => { clearChecked(household?.id ?? ''); setShowMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                    >
                      <span>✅</span> Rimuovi acquistati
                    </button>
                    <button
                      onClick={() => { clearAll(household?.id ?? ''); setLastAdded(null); setShowMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition flex items-center gap-2"
                    >
                      <span>🗑️</span> Svuota lista
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Add item */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 mb-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              onFocus={() => setShowQty(true)}
              placeholder="Aggiungi alimento..."
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm bg-white"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="w-11 h-11 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition font-bold text-xl shadow-sm shrink-0"
            >
              +
            </button>
          </div>

          {/* Quantità opzionale */}
          {showQty && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400 shrink-0">Quantità (opzionale):</span>
              <input
                type="number"
                value={newQty}
                onChange={e => setNewQty(e.target.value)}
                min={0}
                step={0.1}
                placeholder="—"
                className="w-16 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-primary-400 text-center"
              />
              <select
                value={newUnit}
                onChange={e => setNewUnit(e.target.value)}
                className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-primary-400"
              >
                {PANTRY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Genera da piano */}
        {plan && (
          <button
            onClick={handleGenerateFromPlan}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-3 mb-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white font-semibold rounded-2xl transition shadow-sm text-sm"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analisi piano in corso…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Genera da piano alimentare
              </>
            )}
          </button>
        )}

        {/* Errore Genera da piano */}
        {generateError && (
          <div className="rounded-2xl px-3 py-2.5 mb-4 flex items-start gap-2 bg-red-50 border border-red-100">
            <span className="text-lg shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-red-700">Errore generazione lista</p>
              <p className="text-xs text-red-600 mt-0.5">{generateError}</p>
            </div>
            <button onClick={() => setGenerateError(null)} className="text-red-300 hover:text-red-500 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Feedback Genera da piano */}
        {lastAdded !== null && (
          <div className={`rounded-2xl px-3 py-2.5 mb-4 flex items-center gap-2 ${
            lastAdded > 0
              ? 'bg-green-50 border border-green-100'
              : 'bg-gray-50 border border-gray-100'
          }`}>
            <span className="text-lg">{lastAdded > 0 ? '✅' : '👍'}</span>
            <p className="text-xs font-medium text-gray-700">
              {lastAdded > 0
                ? `${lastAdded} aliment${lastAdded === 1 ? 'o aggiunto' : 'i aggiunti'} dalla lista dei pasti`
                : 'La lista è già aggiornata con tutti gli ingredienti necessari'}
            </p>
            <button
              onClick={() => setLastAdded(null)}
              className="ml-auto text-gray-300 hover:text-gray-500 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🛒</div>
            <h3 className="font-semibold text-gray-700 mb-1">Lista vuota</h3>
            <p className="text-sm text-gray-400 max-w-[240px] mx-auto">
              {plan
                ? 'Premi "Genera da piano alimentare" per aggiungere gli ingredienti mancanti'
                : 'Gli ingredienti in esaurimento nella dispensa appariranno qui automaticamente'}
            </p>
          </div>
        )}

        {/* Auto-info banner */}
        {autoCount > 0 && !generating && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2.5 mb-4 flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <p className="text-xs text-amber-700">
              <span className="font-semibold">{autoCount} aliment{autoCount === 1 ? 'o' : 'i'}</span>{' '}
              in esaurimento nella dispensa
            </p>
          </div>
        )}

        {/* Da comprare */}
        {pending.length > 0 && (
          <div className="mb-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Da comprare ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.map(item => (
                <ShoppingRow
                  key={item.id}
                  item={item}
                  onToggle={toggleChecked}
                  onDelete={deleteItem}
                />
              ))}
            </div>
          </div>
        )}

        {/* Acquistati */}
        {checked.length > 0 && (
          <div>
            <button
              onClick={() => setShowChecked(!showChecked)}
              className="flex items-center gap-2 w-full mb-2"
            >
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Acquistati ({checked.length})
              </span>
              <svg
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showChecked ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showChecked && (
              <div className="space-y-2">
                {checked.map(item => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    onToggle={toggleChecked}
                    onDelete={deleteItem}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
