import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { usePantryStore, stockStatus } from '../../store/pantryStore';
import { useSettingsStore } from '../../store/settingsStore';
import BottomNav from '../../components/BottomNav';
import AddItemSheet from '../../components/AddItemSheet';
import ReceiptPreviewSheet from '../../components/ReceiptPreviewSheet';
import { parseReceiptImages } from '../../lib/claudeReceiptParser';
import type { PantryItem, PantryCategory, ReceiptParsedItem } from '../../types';

const CATEGORY_ICONS: Record<string, string> = {
  'Cereali & pasta': '🌾',
  'Legumi': '🫘',
  'Verdure & ortaggi': '🥦',
  'Frutta': '🍎',
  'Carne & pesce': '🥩',
  'Latticini & uova': '🥛',
  'Condimenti & oli': '🫙',
  'Bevande': '🧃',
  'Altro': '📦',
};

function StockBar({ item }: { item: PantryItem }) {
  const status = stockStatus(item);
  const pct = Math.min(100, (item.quantity / item.initialQuantity) * 100);
  const barColor = status === 'empty' ? 'bg-gray-200' : status === 'low' ? 'bg-amber-400' : 'bg-primary-500';
  return (
    <div className="mt-1.5">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-gray-400">
          {item.quantity} / {item.initialQuantity} {item.unit}
        </span>
        {status === 'low' && <span className="text-[10px] text-amber-600 font-medium">Scorta bassa</span>}
        {status === 'empty' && <span className="text-[10px] text-red-500 font-medium">Esaurito</span>}
      </div>
    </div>
  );
}

function ItemCard({ item, onEdit, onDelete, onAdjustQty }: {
  item: PantryItem;
  onEdit: (item: PantryItem) => void;
  onDelete: (id: string) => void;
  onAdjustQty: (id: string, delta: number) => void;
}) {
  const status = stockStatus(item);
  const isExpiringSoon = item.expiryDate
    ? new Date(item.expiryDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    : false;
  const step = item.unit === 'g' || item.unit === 'ml' ? 50 : 1;

  return (
    <div className={`bg-white rounded-2xl border transition-all shadow-sm ${
      status === 'empty' ? 'border-red-100' : status === 'low' ? 'border-amber-100' : 'border-gray-100'
    }`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{item.name}</span>
              {isExpiringSoon && (
                <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full">
                  Scade presto
                </span>
              )}
            </div>
            {/* Prezzo medio */}
            {item.avgPrice != null && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                € {item.avgPrice.toFixed(2)} / {item.unit}
                {item.priceHistory.length > 1 && (
                  <span className="text-gray-300 ml-1">· media {item.priceHistory.length} acq.</span>
                )}
              </p>
            )}
            {item.expiryDate && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                Scade: {new Date(item.expiryDate).toLocaleDateString('it-IT')}
              </p>
            )}
            <StockBar item={item} />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          <button onClick={() => onAdjustQty(item.id, -step)} disabled={item.quantity === 0}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center transition font-bold text-gray-600">−</button>
          <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{item.quantity} {item.unit}</span>
          <button onClick={() => onAdjustQty(item.id, step)}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition font-bold text-gray-600">+</button>
          <span className="text-[10px] text-gray-400 ml-auto">±{step}{item.unit}</span>
        </div>
      </div>
    </div>
  );
}

export default function DispensaPage() {
  const { household } = useAuthStore();
  const { items, loading, loadItems, addItem, updateItem, deleteItem, updateQuantity, batchUpdateItems } = usePantryStore();
  const { claudeApiKey } = useSettingsStore();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<PantryCategory | 'Tutto'>('Tutto');
  const [showSheet, setShowSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [filterLow, setFilterLow] = useState(false);

  // Receipt scanning
  const [isParsingReceipt, setIsParsingReceipt] = useState(false);
  const [parseProgress, setParseProgress] = useState({ done: 0, total: 0 });
  const [receiptItems, setReceiptItems] = useState<ReceiptParsedItem[]>([]);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (household?.id) loadItems(household.id);
  }, [household?.id, loadItems]);

  // ─── Receipt handlers ─────────────────────────────────────────────────────

  const handleReceiptClick = () => {
    if (!claudeApiKey) {
      setReceiptError('Inserisci la tua API key Claude nelle impostazioni del Piano alimentare per usare questa funzione.');
      return;
    }
    setReceiptError('');
    fileInputRef.current?.click();
  };

  const handleReceiptFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !claudeApiKey) return;
    e.target.value = '';
    setIsParsingReceipt(true);
    setParseProgress({ done: 0, total: files.length });
    setReceiptError('');
    try {
      const parsed = await parseReceiptImages(
        claudeApiKey,
        files,
        items,
        (done, total) => setParseProgress({ done, total }),
      );
      setReceiptItems(parsed);
      setShowReceiptPreview(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore durante il riconoscimento';
      setReceiptError(msg);
    } finally {
      setIsParsingReceipt(false);
    }
  };

  const handleReceiptConfirm = async (parsedItems: ReceiptParsedItem[]) => {
    const now = new Date().toISOString();
    const toUpdate: PantryItem[] = [];

    for (const parsed of parsedItems.filter(i => i.include)) {
      const existing = items.find(i => i.id === parsed.existingPantryItemId);

      if (existing) {
        const newHistory = parsed.price != null
          ? [...(existing.priceHistory ?? []), parsed.price].slice(-10)
          : (existing.priceHistory ?? []);
        const avgPrice = newHistory.length > 0
          ? newHistory.reduce((a, b) => a + b, 0) / newHistory.length
          : existing.avgPrice;
        toUpdate.push({
          ...existing,
          quantity: existing.quantity + parsed.quantity,
          priceHistory: newHistory,
          avgPrice,
          updatedAt: now,
        });
      } else {
        const priceHistory = parsed.price != null ? [parsed.price] : [];
        await addItem({
          id: crypto.randomUUID(),
          householdId: household!.id,
          name: parsed.name,
          category: parsed.category,
          quantity: parsed.quantity,
          unit: parsed.unit,
          initialQuantity: parsed.quantity,
          priceHistory,
          avgPrice: parsed.price ?? undefined,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (toUpdate.length > 0) await batchUpdateItems(toUpdate);
    setShowReceiptPreview(false);
    setReceiptItems([]);
  };

  // ─── Filtri ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => items
    .filter(item => {
      if (filterCategory !== 'Tutto' && item.category !== filterCategory) return false;
      if (filterLow && stockStatus(item) === 'ok') return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name)),
    [items, filterCategory, filterLow, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PantryItem[]>();
    filtered.forEach(item => {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    });
    return map;
  }, [filtered]);

  const lowCount = items.filter(i => stockStatus(i) !== 'ok').length;

  const handleSave = async (item: PantryItem) => {
    if (editingItem) await updateItem(item);
    else await addItem(item);
    setShowSheet(false);
    setEditingItem(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dispensa</h1>
              <p className="text-xs text-gray-400">{items.length} aliment{items.length === 1 ? 'o' : 'i'}</p>
            </div>
          </div>

          {/* CTAs */}
          <div className="mb-3">
            <button
              onClick={handleReceiptClick}
              disabled={isParsingReceipt}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-2xl transition shadow-sm mb-2"
            >
              {isParsingReceipt ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analisi scontrino... {parseProgress.total > 1 ? `(${parseProgress.done}/${parseProgress.total})` : ''}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Aggiungi scontrino
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handleReceiptFiles}
            />
            <div className="text-center">
              <button
                onClick={() => { setEditingItem(null); setShowSheet(true); }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium underline-offset-2 hover:underline transition"
              >
                Aggiungi manualmente
              </button>
            </div>
            {receiptError && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl mt-2">{receiptError}</p>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cerca alimento..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-100 border-transparent focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-100 outline-none transition text-sm"
            />
          </div>

          {/* Filter bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setFilterLow(!filterLow)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterLow ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-gray-200 text-gray-600'
              }`}>
              ⚠️ Scorte basse {lowCount > 0 && <span className="bg-white/30 px-1 rounded-full">{lowCount}</span>}
            </button>
            {(['Tutto', 'Cereali & pasta', 'Legumi', 'Verdure & ortaggi', 'Frutta', 'Carne & pesce', 'Latticini & uova', 'Condimenti & oli', 'Bevande', 'Altro'] as const).map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filterCategory === cat ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                }`}>
                {cat !== 'Tutto' ? `${CATEGORY_ICONS[cat]} ` : ''}{cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🛒</div>
            <h3 className="font-semibold text-gray-700 mb-1">Dispensa vuota</h3>
            <p className="text-sm text-gray-400 mb-1">Fotografa uno scontrino o aggiungi manualmente</p>
          </div>
        )}

        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm">Nessun risultato per i filtri selezionati</p>
          </div>
        )}

        {!loading && grouped.size > 0 && (
          <div className="space-y-5">
            {Array.from(grouped.entries()).map(([category, catItems]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{CATEGORY_ICONS[category]}</span>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</h2>
                  <span className="text-xs text-gray-300">({catItems.length})</span>
                </div>
                <div className="space-y-2">
                  {catItems.map(item => (
                    <ItemCard key={item.id} item={item}
                      onEdit={i => { setEditingItem(i); setShowSheet(true); }}
                      onDelete={deleteItem}
                      onAdjustQty={updateQuantity}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Sheet */}
      {showSheet && household && (
        <AddItemSheet
          householdId={household.id}
          item={editingItem}
          onSave={handleSave}
          onClose={() => { setShowSheet(false); setEditingItem(null); }}
        />
      )}

      {/* Receipt Preview Sheet */}
      {showReceiptPreview && (
        <ReceiptPreviewSheet
          items={receiptItems}
          existingPantryItems={items}
          onConfirm={handleReceiptConfirm}
          onClose={() => { setShowReceiptPreview(false); setReceiptItems([]); }}
        />
      )}

      <BottomNav />
    </div>
  );
}
