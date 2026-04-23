import { create } from 'zustand';
import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase';
import type { PantryItem } from '../types';

function pantryCol(householdId: string) {
  return collection(firestoreDb, 'households', householdId, 'pantryItems');
}
function pantryDoc(householdId: string, id: string) {
  return doc(firestoreDb, 'households', householdId, 'pantryItems', id);
}

interface PantryStore {
  items: PantryItem[];
  loading: boolean;
  loadItems: (householdId: string) => Promise<void>;
  addItem: (item: PantryItem) => Promise<void>;
  updateItem: (item: PantryItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  updateQuantity: (id: string, delta: number) => Promise<void>;
  batchUpdateItems: (updatedItems: PantryItem[]) => Promise<void>;
}

export const usePantryStore = create<PantryStore>((set, get) => ({
  items: [],
  loading: false,

  loadItems: async (householdId) => {
    set({ loading: true });
    const snap = await getDocs(pantryCol(householdId));
    const items = snap.docs.map(d => d.data() as PantryItem);
    set({ items, loading: false });
  },

  addItem: async (item) => {
    await setDoc(pantryDoc(item.householdId, item.id), item);
    set(s => ({ items: [...s.items, item] }));
  },

  updateItem: async (item) => {
    await setDoc(pantryDoc(item.householdId, item.id), item);
    set(s => ({ items: s.items.map(i => i.id === item.id ? item : i) }));
  },

  deleteItem: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;
    await deleteDoc(pantryDoc(item.householdId, id));
    set(s => ({ items: s.items.filter(i => i.id !== id) }));
  },

  updateQuantity: async (id, delta) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    const updated = { ...item, quantity: newQty, updatedAt: new Date().toISOString() };
    await setDoc(pantryDoc(item.householdId, id), updated);
    set(s => ({ items: s.items.map(i => i.id === id ? updated : i) }));
  },

  batchUpdateItems: async (updatedItems) => {
    if (updatedItems.length === 0) return;
    const batch = writeBatch(firestoreDb);
    for (const item of updatedItems) {
      batch.set(pantryDoc(item.householdId, item.id), item);
    }
    await batch.commit();
    set(s => ({
      items: s.items.map(i => {
        const upd = updatedItems.find(u => u.id === i.id);
        return upd ?? i;
      }),
    }));
  },
}));

export function stockStatus(item: PantryItem): 'ok' | 'low' | 'empty' {
  if (item.quantity === 0) return 'empty';
  if (item.quantity <= item.initialQuantity / 3) return 'low';
  return 'ok';
}
