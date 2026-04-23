import { useState, useEffect } from 'react';
import { PANTRY_CATEGORIES, PANTRY_UNITS, type PantryItem, type PantryCategory, type PantryUnit } from '../types';

interface Props {
  householdId: string;
  item?: PantryItem | null; // null = new
  onSave: (item: PantryItem) => void;
  onClose: () => void;
}

export default function AddItemSheet({ householdId, item, onSave, onClose }: Props) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<PantryCategory>(item?.category ?? 'Altro');
  const [quantity, setQuantity] = useState(item?.quantity?.toString() ?? '1');
  const [unit, setUnit] = useState<PantryUnit>(item?.unit ?? 'pz');
  const [initialQuantity, setInitialQuantity] = useState(item?.initialQuantity?.toString() ?? '1');
  const [expiryDate, setExpiryDate] = useState(item?.expiryDate ?? '');
  const [error, setError] = useState('');

  // Sync initialQuantity to quantity when adding new item
  useEffect(() => {
    if (!isEdit) setInitialQuantity(quantity);
  }, [quantity, isEdit]);

  const handleSave = () => {
    if (!name.trim()) { setError('Nome obbligatorio'); return; }
    const qty = parseFloat(quantity);
    const initQty = parseFloat(initialQuantity);
    if (isNaN(qty) || qty < 0) { setError('Quantità non valida'); return; }
    if (isNaN(initQty) || initQty <= 0) { setError('Quantità iniziale non valida'); return; }

    const now = new Date().toISOString();
    const saved: PantryItem = {
      id: item?.id ?? crypto.randomUUID(),
      householdId,
      name: name.trim(),
      category,
      quantity: qty,
      unit,
      initialQuantity: initQty,
      expiryDate: expiryDate || undefined,
      avgPrice: item?.avgPrice,
      priceHistory: item?.priceHistory ?? [],
      createdAt: item?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(saved);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-16 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl max-h-[calc(90vh-4rem)] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-4 pb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Modifica alimento' : 'Aggiungi alimento'}
            </h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl mb-3">{error}</p>
          )}

          {/* Nome */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="Es. Pasta, Latte, Pomodori..."
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900"
            />
          </div>

          {/* Categoria */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {PANTRY_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    category === cat
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quantità + Unità */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                Quantità attuale
              </label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min={0}
                step={0.1}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900 text-center"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Unità</label>
              <div className="grid grid-cols-3 gap-1">
                {PANTRY_UNITS.map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                      unit === u
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quantità iniziale (soglia spesa) */}
          <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <label className="text-xs font-medium text-amber-700 block mb-1">
              Quantità di riferimento (per soglia lista spesa)
            </label>
            <p className="text-[11px] text-amber-600 mb-2">
              Quando scende a 1/3 di questo valore, l'alimento viene aggiunto alla lista della spesa.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={initialQuantity}
                onChange={e => setInitialQuantity(e.target.value)}
                min={0.1}
                step={0.1}
                className="w-28 px-3 py-2 rounded-xl border border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition text-gray-900 text-center bg-white text-sm"
              />
              <span className="text-sm text-amber-700 font-medium">{unit}</span>
              <span className="text-xs text-amber-600 ml-auto">
                Soglia: {(parseFloat(initialQuantity || '0') / 3).toFixed(1)} {unit}
              </span>
            </div>
          </div>

          {/* Scadenza (opzionale) */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
              Scadenza <span className="normal-case font-normal text-gray-400">(opzionale)</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition shadow-sm"
          >
            {isEdit ? 'Salva modifiche' : 'Aggiungi alla dispensa'}
          </button>
        </div>
      </div>
    </>
  );
}
