import { create } from 'zustand';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase';
import type { MealPlan, Meal, MealSubstitution } from '../types';
import { applyMealToggle } from '../lib/pantrySync';
import { usePantryStore } from './pantryStore';
import { useShoppingStore } from './shoppingStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MealToggleEntry {
  planId: string;
  weekNum: number;
  dayId: string;
  mealId: string;
}

interface MealPlanStore {
  plan: MealPlan | null;
  allPlans: MealPlan[];
  loading: boolean;
  loadPlan: (householdId: string, profileId: string) => Promise<void>;
  loadAllPlans: (householdId: string, profileIds: string[]) => Promise<void>;
  savePlan: (plan: MealPlan) => Promise<void>;
  deletePlan: (id: string, householdId: string) => Promise<void>;
  toggleMeal: (planId: string, weekNum: number, dayId: string, mealId: string) => Promise<void>;
  toggleSharedMeal: (entries: MealToggleEntry[], householdId: string) => Promise<void>;
  addSubstitution: (planId: string, weekNum: number, dayId: string, mealId: string, sub: MealSubstitution) => Promise<void>;
  updateMealNotes: (planId: string, weekNum: number, dayId: string, mealId: string, notes: string) => Promise<void>;
}

// ─── Helpers Firestore ────────────────────────────────────────────────────────

function mealPlansCol(householdId: string) {
  return collection(firestoreDb, 'households', householdId, 'mealPlans');
}
function mealPlanDoc(householdId: string, id: string) {
  return doc(firestoreDb, 'households', householdId, 'mealPlans', id);
}

async function fetchLatestPlan(householdId: string, profileId: string): Promise<MealPlan | undefined> {
  const q = query(mealPlansCol(householdId), where('profileId', '==', profileId));
  const snap = await getDocs(q);
  const plans = snap.docs.map(d => d.data() as MealPlan);
  return plans.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function applyMealUpdate(
  plan: MealPlan,
  weekNum: number,
  dayId: string,
  mealId: string,
  updater: (meal: Meal) => Meal,
): MealPlan {
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    weeks: plan.weeks.map(w =>
      w.weekNumber !== weekNum ? w : {
        ...w,
        days: w.days.map(d =>
          d.id !== dayId ? d : {
            ...d,
            meals: d.meals.map((m: Meal) => m.id !== mealId ? m : updater(m)),
          }
        ),
      }
    ),
  };
}

function findPlan(
  state: Pick<MealPlanStore, 'plan' | 'allPlans'>,
  planId: string,
): MealPlan | null {
  return state.allPlans.find(p => p.id === planId)
    ?? (state.plan?.id === planId ? state.plan : null);
}

function upsertPlanInState(
  state: Pick<MealPlanStore, 'plan' | 'allPlans'>,
  updated: MealPlan,
): Partial<MealPlanStore> {
  return {
    allPlans: state.allPlans.map(p => p.id === updated.id ? updated : p),
    plan: state.plan?.id === updated.id ? updated : state.plan,
  };
}

// ─── Pantry sync ──────────────────────────────────────────────────────────────

async function syncPantry(meal: Meal, nowCompleted: boolean, householdId: string) {
  const pantryItems = usePantryStore.getState().items;
  if (pantryItems.length === 0) return;
  try {
    const result = await applyMealToggle({ meal, nowCompleted, householdId, pantryItems });
    if (result.updatedPantryItems.length > 0) {
      await usePantryStore.getState().batchUpdateItems(result.updatedPantryItems);
    }
    useShoppingStore.getState().applyAutoChanges(
      result.addedShoppingItems,
      result.removedShoppingItemIds,
      result.updatedShoppingItems,
    );
  } catch (err) {
    console.warn('pantrySync error:', err);
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMealPlanStore = create<MealPlanStore>((set, get) => ({
  plan: null,
  allPlans: [],
  loading: false,

  loadPlan: async (householdId, profileId) => {
    set({ loading: true });
    const latest = (await fetchLatestPlan(householdId, profileId)) ?? null;
    set(s => ({
      plan: latest,
      allPlans: latest
        ? [...s.allPlans.filter(p => p.profileId !== profileId), latest]
        : s.allPlans.filter(p => p.profileId !== profileId),
      loading: false,
    }));
  },

  loadAllPlans: async (householdId, profileIds) => {
    const plans: MealPlan[] = [];
    for (const profileId of profileIds) {
      const latest = await fetchLatestPlan(householdId, profileId);
      if (latest) plans.push(latest);
    }
    set(s => ({
      allPlans: plans,
      plan: s.plan
        ? (plans.find(p => p.id === s.plan!.id) ?? s.plan)
        : s.plan,
    }));
  },

  savePlan: async (plan) => {
    await setDoc(mealPlanDoc(plan.householdId, plan.id), plan);
    set(s => ({
      plan,
      allPlans: s.allPlans.some(p => p.id === plan.id)
        ? s.allPlans.map(p => p.id === plan.id ? plan : p)
        : [...s.allPlans, plan],
    }));
  },

  deletePlan: async (id, householdId) => {
    await deleteDoc(mealPlanDoc(householdId, id));
    set(s => ({
      plan: s.plan?.id === id ? null : s.plan,
      allPlans: s.allPlans.filter(p => p.id !== id),
    }));
  },

  toggleMeal: async (planId, weekNum, dayId, mealId) => {
    const state = get();
    const targetPlan = findPlan(state, planId);
    if (!targetPlan) return;

    const meal = targetPlan.weeks
      .find(w => w.weekNumber === weekNum)
      ?.days.find(d => d.id === dayId)
      ?.meals.find(m => m.id === mealId);
    if (!meal) return;

    const nowCompleted = !meal.completed;
    const updated = applyMealUpdate(targetPlan, weekNum, dayId, mealId,
      m => ({ ...m, completed: nowCompleted }));

    await setDoc(mealPlanDoc(targetPlan.householdId, updated.id), updated);
    set(s => upsertPlanInState(s, updated));

    await syncPantry(meal, nowCompleted, targetPlan.householdId);
  },

  toggleSharedMeal: async (entries, householdId) => {
    if (entries.length === 0) return;

    const firstEntry = entries[0];
    const firstPlan = findPlan(get(), firstEntry.planId);
    if (!firstPlan) return;

    const primaryMeal = firstPlan.weeks
      .find(w => w.weekNumber === firstEntry.weekNum)
      ?.days.find(d => d.id === firstEntry.dayId)
      ?.meals.find(m => m.id === firstEntry.mealId);
    if (!primaryMeal) return;

    const nowCompleted = !primaryMeal.completed;

    for (const entry of entries) {
      const plan = findPlan(get(), entry.planId);
      if (!plan) continue;
      const updated = applyMealUpdate(plan, entry.weekNum, entry.dayId, entry.mealId,
        m => ({ ...m, completed: nowCompleted }));
      await setDoc(mealPlanDoc(householdId, updated.id), updated);
      set(s => upsertPlanInState(s, updated));
    }

    await syncPantry(primaryMeal, nowCompleted, householdId);
  },

  addSubstitution: async (planId, weekNum, dayId, mealId, sub) => {
    const targetPlan = findPlan(get(), planId);
    if (!targetPlan) return;
    const updated = applyMealUpdate(targetPlan, weekNum, dayId, mealId,
      m => ({ ...m, substitutions: [...m.substitutions, sub] }));
    await setDoc(mealPlanDoc(targetPlan.householdId, updated.id), updated);
    set(s => upsertPlanInState(s, updated));
  },

  updateMealNotes: async (planId, weekNum, dayId, mealId, notes) => {
    const targetPlan = findPlan(get(), planId);
    if (!targetPlan) return;
    const updated = applyMealUpdate(targetPlan, weekNum, dayId, mealId,
      m => ({ ...m, notes }));
    await setDoc(mealPlanDoc(targetPlan.householdId, updated.id), updated);
    set(s => upsertPlanInState(s, updated));
  },
}));
