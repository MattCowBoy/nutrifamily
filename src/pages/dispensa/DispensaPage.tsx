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



export default function DispensaPage() {
  const { household } = useAuthStore();
  const { items, loading, loadItems, addItem, updateItem, batchUpdateItems } = usePantryStore();
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

  const lowCount = items.filter(i => stockStatus(i) !== 'ok').length;

  const handleSave = async (item: PantryItem) => {
    if (editingItem) await updateItem(item);
    else await addItem(item);
    setShowSheet(false);
    setEditingItem(null);
  };

  return (
    <div className="min-h-screen pb-28" style={{ background: '#FBFAF8' }}>
      {/* Header */}
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #EFEBE5' }}>
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-serif text-[22px] font-bold" style={{ color: '#1A1812' }}>La dispensa</h1>
              <p className="text-xs" style={{ color: '#9C9485' }}>{items.length} aliment{items.length === 1 ? 'o' : 'i'}</p>
            </div>
            <button
              onClick={handleReceiptClick}
              disabled={isParsingReceipt}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-semibold transition"
              style={{ background: '#1A1812' }}
            >
              {isParsingReceipt ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {parseProgress.total > 1 ? `${parseProgress.done}/${parseProgress.total}` : 'Analisi...'}
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Scontrino
                </>
              )}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleReceiptFiles} />

          {/* Low stock alert */}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5 mb-3" style={{ background: '#FEF3E8', border: '1px solid #F5C09A' }}>
              <span className="text-sm">⚠️</span>
              <span className="text-xs font-medium" style={{ color: '#8C4B20' }}>{lowCount} ingredient{lowCount === 1 ? 'e' : 'i'} in esaurimento</span>
              <button onClick={() => setFilterLow(!filterLow)} className="ml-auto text-xs font-semibold" style={{ color: '#E07A5F' }}>
                {filterLow ? 'Mostra tutti' : 'Filtra'}
              </button>
            </div>
          )}

          {receiptError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl mb-3">{receiptError}</p>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9C9485' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cerca ingrediente..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition"
              style={{ background: '#EFEBE5', border: 'none', color: '#1A1812' }}
            />
          </div>

          {/* Category filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(['Tutto', 'Cereali & pasta', 'Legumi', 'Verdure & ortaggi', 'Frutta', 'Carne & pesce', 'Latticini & uova', 'Condimenti & oli', 'Bevande', 'Altro'] as const).map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-warm-sm"
                style={{
                  background: filterCategory === cat ? '#1A1812' : 'white',
                  color: filterCategory === cat ? 'white' : '#9C9485',
                  whiteSpace: 'nowrap',
                }}>
                {cat !== 'Tutto' ? `${CATEGORY_ICONS[cat]} ` : ''}{cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content — 2-column emoji grid */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#E07A5F', borderTopColor: 'transparent' }} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">📦</div>
            <h3 className="font-serif font-semibold text-lg mb-1" style={{ color: '#3F3B30' }}>Dispensa vuota</h3>
            <p className="text-sm mb-4" style={{ color: '#9C9485' }}>Fotografa uno scontrino o aggiungi manualmente</p>
            <button onClick={() => { setEditingItem(null); setShowSheet(true); }}
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: '#E07A5F' }}>
              + Aggiungi manualmente
            </button>
          </div>
        )}

        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: '#9C9485' }}>Nessun risultato per i filtri selezionati</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(item => {
              const status = stockStatus(item);
              return (
                <button
                  key={item.id}
                  onClick={() => { setEditingItem(item); setShowSheet(true); }}
                  className="bg-white rounded-3xl p-4 text-left shadow-warm-sm relative hover:scale-[1.02] transition-transform"
                  style={{
                    border: `1px solid ${status === 'empty' ? '#fecaca' : status === 'low' ? '#F5C09A' : '#EFEBE5'}`,
                  }}
                >
                  {/* Low stock dot */}
                  {status !== 'ok' && (
                    <div
                      className="absolute top-3 right-3 w-2 h-2 rounded-full"
                      style={{ background: status === 'empty' ? '#ef4444' : '#F5C09A' }}
                    />
                  )}
                  <div className="text-3xl mb-2">{CATEGORY_ICONS[item.category] ?? '🛒'}</div>
                  <p className="font-semibold text-sm leading-tight" style={{ color: '#1A1812' }}>{item.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9C9485' }}>
                    {item.quantity} {item.unit}
                  </p>
                  {/* Mini stock bar */}
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: '#EFEBE5' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (item.quantity / item.initialQuantity) * 100)}%`,
                        background: status === 'empty' ? '#EFEBE5' : status === 'low' ? '#F5C09A' : '#6B9E7A',
                      }}
                    />
                  </div>
                </button>
              );
            })}

            {/* Add item card */}
            <button
              onClick={() => { setEditingItem(null); setShowSheet(true); }}
              className="rounded-3xl p-4 flex flex-col items-center justify-center gap-2 min-h-[110px] hover:scale-[1.02] transition-transform"
              style={{ border: '2px dashed #D7D1C5', background: 'transparent' }}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: '#EFEBE5' }}>
                <svg className="w-5 h-5" style={{ color: '#9C9485' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-xs font-medium text-center" style={{ color: '#9C9485' }}>
                Aggiungi ingrediente
              </span>
            </button>
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
