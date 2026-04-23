import { create } from 'zustand';
import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase';
import type { ShoppingItem, MealPlan, PantryItem } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normName(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchPantry(name: string, pantryItems: PantryItem[]): PantryItem | undefined {
  const n = normName(name);
  return pantryItems.find(p => {
    const pn = normName(p.name);
    return pn === n || pn.includes(n) || n.includes(pn);
  });
}

function shoppingCol(householdId: string) {
  return collection(firestoreDb, 'households', householdId, 'shoppingItems');
}
function shoppingDoc(householdId: string, id: string) {
  return doc(firestoreDb, 'households', householdId, 'shoppingItems', id);
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ShoppingStore {
  items: ShoppingItem[];
  loading: boolean;
  loadItems: (householdId: string) => Promise<void>;
  addManualItem: (householdId: string, name: string, quantity?: number, unit?: string) => Promise<void>;
  applyAutoChanges: (
    toAdd: ShoppingItem[],
    toRemoveIds: string[],
    toUpdate: ShoppingItem[]
  ) => Promise<void>;
  generateFromPlan: (plan: MealPlan, pantryItems: PantryItem[], householdId: string) => Promise<number>;
  toggleChecked: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearChecked: (householdId: string) => Promise<void>;
  clearAll: (householdId: string) => Promise<void>;
}

export const useShoppingStore = create<ShoppingStore>((set, get) => ({
  items: [],
  loading: false,

  loadItems: async (householdId) => {
    set({ loading: true });
    const snap = await getDocs(shoppingCol(householdId));
    const items = snap.docs
      .map(d => d.data() as ShoppingItem)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    set({ items, loading: false });
  },

  addManualItem: async (householdId, name, quantity, unit) => {
    const item: ShoppingItem = {
      id: crypto.randomUUID(),
      householdId,
      name: name.trim(),
      quantity,
      unit,
      checked: false,
      origin: 'manual',
      mealIds: [],
      createdAt: new Date().toISOString(),
    };
    await setDoc(shoppingDoc(householdId, item.id), item);
    set(s => ({ items: [...s.items, item] }));
  },

  applyAutoChanges: async (toAdd, toRemoveIds, toUpdate) => {
    // Le scritture Firestore sono già avvenute in pantrySync — qui aggiorniamo solo Zustand
    set(s => {
      let items = s.items.filter(i => !toRemoveIds.includes(i.id));
      items = items.map(i => {
        const upd = toUpdate.find(u => u.id === i.id);
        return upd ?? i;
      });
      items = [...items, ...toAdd];
      return { items };
    });
  },

  generateFromPlan: async (plan, pantryItems, householdId) => {
    const aggregated = new Map<string, {
      name: string;
      qty: number;
      unit: string;
      mealIds: string[];
    }>();

    for (const week of plan.weeks) {
      for (const day of week.days) {
        for (const meal of day.meals) {
          const effective = meal.ingredients.map(ing => {
            const sub = meal.substitutions.find(s => s.originalIngredient.name === ing.name);
            return sub ? sub.replacementIngredient : ing;
          });
          for (const ing of effective) {
            const key = normName(ing.name);
            const prev = aggregated.get(key);
            if (prev) {
              prev.qty += ing.quantity;
              if (!prev.mealIds.includes(meal.id)) prev.mealIds.push(meal.id);
            } else {
              aggregated.set(key, { name: ing.name, qty: ing.quantity, unit: ing.unit, mealIds: [meal.id] });
            }
          }
        }
      }
    }

    const existingItems = get().items;
    const existingNames = new Set(existingItems.map(i => normName(i.name)));
    const toAdd: ShoppingItem[] = [];
    const now = new Date().toISOString();

    for (const [key, ing] of aggregated) {
      if (existingNames.has(key)) continue;
      const pantryMatch = matchPantry(ing.name, pantryItems);
      if (pantryMatch) {
        const isLow = pantryMatch.quantity <= pantryMatch.initialQuantity / 3;
        if (!isLow) continue;
      }
      const newItem: ShoppingItem = {
        id: crypto.randomUUID(),
        householdId,
        name: ing.name,
        quantity: pantryMatch?.initialQuantity ?? ing.qty,
        checked: false,
        origin: 'auto',
        mealIds: ing.mealIds,
        createdAt: now,
      };
      // Aggiungi campi opzionali solo se definiti (Firestore rifiuta undefined)
      const resolvedUnit = pantryMatch?.unit ?? ing.unit;
      if (resolvedUnit) newItem.unit = resolvedUnit;
      if (pantryMatch?.id) newItem.pantryItemId = pantryMatch.id;
      toAdd.push(newItem);
    }

    if (toAdd.length > 0) {
      const batch = writeBatch(firestoreDb);
      for (const item of toAdd) {
        batch.set(shoppingDoc(householdId, item.id), item);
      }
      await batch.commit();
      set(s => ({ items: [...s.items, ...toAdd] }));
    }

    return toAdd.length;
  },

  toggleChecked: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;
    const updated: ShoppingItem = { ...item, checked: !item.checked };
    await setDoc(shoppingDoc(item.householdId, id), updated);
    set(s => ({ items: s.items.map(i => i.id === id ? updated : i) }));
  },

  deleteItem: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;
    await deleteDoc(shoppingDoc(item.householdId, id));
    set(s => ({ items: s.items.filter(i => i.id !== id) }));
  },

  clearChecked: async (householdId) => {
    const toDelete = get().items.filter(i => i.checked && i.householdId === householdId);
    if (toDelete.length === 0) return;
    const batch = writeBatch(firestoreDb);
    for (const item of toDelete) {
      batch.delete(shoppingDoc(householdId, item.id));
    }
    await batch.commit();
    set(s => ({ items: s.items.filter(i => !(i.checked && i.householdId === householdId)) }));
  },

  clearAll: async (householdId) => {
    const snap = await getDocs(shoppingCol(householdId));
    if (snap.empty) return;
    const batch = writeBatch(firestoreDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    set(s => ({ items: s.items.filter(i => i.householdId !== householdId) }));
  },
}));
