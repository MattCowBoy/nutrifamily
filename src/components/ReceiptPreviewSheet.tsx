import { useState } from 'react';
import type { ReceiptParsedItem, PantryItem, PantryCategory, PantryUnit } from '../types';
import { PANTRY_CATEGORIES, PANTRY_UNITS } from '../types';

interface Props {
  items: ReceiptParsedItem[];
  existingPantryItems: PantryItem[];
  onConfirm: (items: ReceiptParsedItem[]) => void;
  onClose: () => void;
}

function ReceiptItemRow({
  item,
  onChange,
}: {
  item: ReceiptParsedItem;
  onChange: (updated: ReceiptParsedItem) => void;
}) {
  const isNew = !item.existingPantryItemId;

  return (
    <div className={`bg-white rounded-2xl border p-3 transition-all ${
      item.include ? 'border-gray-200' : 'border-gray-100 opacity-50'
    }`}>
      <div className="flex items-start gap-2.5">
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => onChange({ ...item, include: !item.include })}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
            item.include
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-gray-300'
          }`}
        >
          {item.include && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Nome + badge */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={item.name}
              onChange={e => onChange({ ...item, name: e.target.value })}
              className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-primary-400 outline-none py-0.5 min-w-0"
            />
            <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              isNew
                ? 'bg-blue-100 text-blue-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {isNew ? 'Nuovo' : 'Aggiorna'}
            </span>
          </div>

          {/* Categoria */}
          <select
            value={item.category}
            onChange={e => onChange({ ...item, category: e.target.value as PantryCategory })}
            className="w-full text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-primary-400"
          >
            {PANTRY_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Quantità + Unità + Prezzo */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200 px-2 py-1 flex-1">
              <input
                type="number"
                value={item.quantity}
                onChange={e => onChange({ ...item, quantity: parseFloat(e.target.value) || 1 })}
                min={0.1}
                step={0.1}
                className="w-12 text-xs text-gray-700 bg-transparent outline-none text-center font-medium"
              />
              <select
                value={item.unit}
                onChange={e => onChange({ ...item, unit: e.target.value as PantryUnit })}
                className="text-xs text-gray-500 bg-transparent outline-none"
              >
                {PANTRY_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200 px-2 py-1 w-24">
              <span className="text-xs text-gray-400">€</span>
              <input
                type="number"
                value={item.price ?? ''}
                onChange={e => onChange({ ...item, price: e.target.value ? parseFloat(e.target.value) : undefined })}
                min={0}
                step={0.01}
                placeholder="—"
                className="w-full text-xs text-gray-700 bg-transparent outline-none text-center font-medium"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ReceiptPreviewSheet({ items: initialItems, existingPantryItems: _existingPantryItems, onConfirm, onClose }: Props) {
  const [editedItems, setEditedItems] = useState<ReceiptParsedItem[]>(initialItems);

  const included = editedItems.filter(i => i.include);
  const newCount = included.filter(i => !i.existingPantryItemId).length;
  const updateCount = included.filter(i => !!i.existingPantryItemId).length;

  const updateItem = (id: string, updated: ReceiptParsedItem) => {
    setEditedItems(prev => prev.map(i => i.id === id ? updated : i));
  };

  const toggleAll = () => {
    const allIncluded = editedItems.every(i => i.include);
    setEditedItems(prev => prev.map(i => ({ ...i, include: !allIncluded })));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-16 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl max-h-[calc(92vh-4rem)] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Articoli trovati ({editedItems.length})
              </h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-blue-600">+{newCount} nuovi</span>
                {updateCount > 0 && (
                  <span className="text-xs text-green-600">↑ {updateCount} aggiornati</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAll}
                className="text-xs text-primary-600 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 transition"
              >
                {editedItems.every(i => i.include) ? 'Deseleziona tutti' : 'Seleziona tutti'}
              </button>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Lista scrollabile */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {editedItems.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">🧾</p>
              <p className="text-sm text-gray-400">Nessun articolo alimentare trovato nello scontrino.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {editedItems.map(item => (
                <ReceiptItemRow
                  key={item.id}
                  item={item}
                  onChange={updated => updateItem(item.id, updated)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pt-3 pb-8 border-t border-gray-100 shrink-0 bg-white">
          <button
            onClick={() => onConfirm(editedItems)}
            disabled={included.length === 0}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition shadow-sm"
          >
            {included.length > 0
              ? `Aggiungi ${included.length} articol${included.length === 1 ? 'o' : 'i'} alla dispensa`
              : 'Seleziona almeno un articolo'}
          </button>
        </div>
      </div>
    </>
  );
}
