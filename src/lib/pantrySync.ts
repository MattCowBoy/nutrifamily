import {
  collection, doc, getDocs, setDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { firestoreDb } from './firebase';
import type { Meal, PantryItem, PantryUnit, ShoppingItem, MealIngredient } from '../types';

// ─── Normalizzazione ──────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // rimuove accenti
}

// Mappa unità del piano alimentare (testo libero) → PantryUnit
const UNIT_MAP: Record<string, PantryUnit> = {
  g: 'g', gr: 'g', grammo: 'g', grammi: 'g',
  kg: 'kg', chilo: 'kg', chilogrammo: 'kg', chilogrammi: 'kg',
  ml: 'ml', millilitro: 'ml', millilitri: 'ml',
  l: 'L', lt: 'L', litro: 'L', litri: 'L',
  pz: 'pz', pezzo: 'pz', pezzi: 'pz',
  conf: 'conf', confezione: 'conf', confezioni: 'conf',
};

function normalizeUnit(unit: string): PantryUnit | null {
  return UNIT_MAP[unit.toLowerCase().trim()] ?? null;
}

// ─── Matching ingrediente → PantryItem ───────────────────────────────────────

function matchIngredient(
  ingredientName: string,
  pantryItems: PantryItem[]
): PantryItem | undefined {
  const norm = normalizeName(ingredientName);
  // 1. Match esatto
  const exact = pantryItems.find(p => normalizeName(p.name) === norm);
  if (exact) return exact;
  // 2. Contains bidirezionale
  return pantryItems.find(p => {
    const pn = normalizeName(p.name);
    return pn.includes(norm) || norm.includes(pn);
  });
}

// ─── Risultato della sincronizzazione ────────────────────────────────────────

export interface SyncResult {
  updatedPantryItems: PantryItem[];
  addedShoppingItems: ShoppingItem[];
  removedShoppingItemIds: string[];
  updatedShoppingItems: ShoppingItem[];
}

// ─── Logica principale ────────────────────────────────────────────────────────

export async function applyMealToggle(params: {
  meal: Meal;
  nowCompleted: boolean;
  householdId: string;
  pantryItems: PantryItem[];
}): Promise<SyncResult> {
  const { meal, nowCompleted, householdId, pantryItems } = params;

  const updatedPantryItems: PantryItem[] = [];
  const addedShoppingItems: ShoppingItem[] = [];
  const removedShoppingItemIds: string[] = [];
  const updatedShoppingItems: ShoppingItem[] = [];

  // Ingredienti effettivi (considerando le sostituzioni)
  const effectiveIngredients: MealIngredient[] = meal.ingredients.map(ing => {
    const sub = meal.substitutions.find(
      s => s.originalIngredient.name === ing.name
    );
    return sub ? sub.replacementIngredient : ing;
  });

  for (const ing of effectiveIngredients) {
    const pantryItem = matchIngredient(ing.name, pantryItems);
    if (!pantryItem) continue;

    const normalizedUnit = normalizeUnit(ing.unit);
    const unitsMatch = normalizedUnit === pantryItem.unit;
    const now = new Date().toISOString();

    // Cerca shopping item auto per questo pantryItem (filtro origin in memoria per evitare indice composito)
    const shoppingSnap = await getDocs(
      query(
        collection(firestoreDb, 'households', householdId, 'shoppingItems'),
        where('pantryItemId', '==', pantryItem.id)
      )
    );
    const existing = shoppingSnap.docs
      .map(d => d.data() as ShoppingItem)
      .find(s => s.origin === 'auto');

    if (nowCompleted) {
      let newQty = pantryItem.quantity;
      if (unitsMatch) newQty = Math.max(0, pantryItem.quantity - ing.quantity);
      const updated: PantryItem = { ...pantryItem, quantity: newQty, updatedAt: now };
      updatedPantryItems.push(updated);

      const isLow = newQty <= pantryItem.initialQuantity / 3;
      if (isLow) {
        if (!existing) {
          const newItem: ShoppingItem = {
            id: crypto.randomUUID(),
            householdId,
            name: pantryItem.name,
            quantity: pantryItem.initialQuantity,
            unit: pantryItem.unit,
            checked: false,
            origin: 'auto',
            pantryItemId: pantryItem.id,
            mealIds: [meal.id],
            createdAt: now,
          };
          await setDoc(doc(firestoreDb, 'households', householdId, 'shoppingItems', newItem.id), newItem);
          addedShoppingItems.push(newItem);
        } else if (!existing.mealIds.includes(meal.id)) {
          const upd: ShoppingItem = { ...existing, mealIds: [...existing.mealIds, meal.id] };
          await setDoc(doc(firestoreDb, 'households', householdId, 'shoppingItems', upd.id), upd);
          updatedShoppingItems.push(upd);
        }
      }
    } else {
      let newQty = pantryItem.quantity;
      if (unitsMatch) newQty = pantryItem.quantity + ing.quantity;
      const updated: PantryItem = { ...pantryItem, quantity: newQty, updatedAt: now };
      updatedPantryItems.push(updated);

      const isOk = newQty > pantryItem.initialQuantity / 3;
      if (isOk && existing) {
        const newMealIds = existing.mealIds.filter(id => id !== meal.id);
        if (newMealIds.length === 0) {
          await deleteDoc(doc(firestoreDb, 'households', householdId, 'shoppingItems', existing.id));
          removedShoppingItemIds.push(existing.id);
        } else {
          const upd: ShoppingItem = { ...existing, mealIds: newMealIds };
          await setDoc(doc(firestoreDb, 'households', householdId, 'shoppingItems', upd.id), upd);
          updatedShoppingItems.push(upd);
        }
      }
    }
  }

  return { updatedPantryItems, addedShoppingItems, removedShoppingItemIds, updatedShoppingItems };
}
