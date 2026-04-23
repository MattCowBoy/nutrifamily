export type DietType = 'onnivoro' | 'vegetariano' | 'vegano' | 'pescetariano' | 'flexitariano';
export type Gender = 'M' | 'F' | 'altro';

export const INTOLLERANZE_LIST = [
  'Lattosio', 'Glutine', 'Uova', 'Pesce', 'Crostacei',
  'Soia', 'Arachidi', 'Frutta a guscio', 'Sedano', 'Senape',
  'Sesamo', 'Anidride solforosa',
] as const;

export const OBIETTIVI_LIST = [
  'Perdita peso', 'Aumento massa muscolare', 'Mantenimento',
  'Salute generale', 'Controllo glicemia', 'Riduzione colesterolo',
] as const;

export const DIETE: { value: DietType; label: string }[] = [
  { value: 'onnivoro', label: 'Onnivoro' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'pescetariano', label: 'Pescetariano' },
  { value: 'flexitariano', label: 'Flexitariano' },
];

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string; // Tailwind bg color class
  role: 'admin' | 'member';
  pin?: string;
  createdAt: Date;
  // Dati personali
  age?: number;
  weight?: number;   // kg
  height?: number;   // cm
  gender?: Gender;
  // Alimentazione
  diet?: DietType;
  intolleranze: string[];
  obiettivi: string[];
  // Note libere per il nutrizionista
  note?: string;
}

export interface Household {
  id: string;
  name: string;
  passwordHash: string;
  members: UserProfile[];
  createdAt: Date;
}

export interface AuthState {
  household: Household | null;
  currentProfile: UserProfile | null;
  isAuthenticated: boolean;
}

// ─── Dispensa ───────────────────────────────────────────────────────────────

export type PantryUnit = 'g' | 'kg' | 'ml' | 'L' | 'pz' | 'conf';

export type PantryCategory =
  | 'Cereali & pasta'
  | 'Legumi'
  | 'Verdure & ortaggi'
  | 'Frutta'
  | 'Carne & pesce'
  | 'Latticini & uova'
  | 'Condimenti & oli'
  | 'Bevande'
  | 'Altro';

export const PANTRY_CATEGORIES: PantryCategory[] = [
  'Cereali & pasta', 'Legumi', 'Verdure & ortaggi', 'Frutta',
  'Carne & pesce', 'Latticini & uova', 'Condimenti & oli', 'Bevande', 'Altro',
];

export const PANTRY_UNITS: PantryUnit[] = ['g', 'kg', 'ml', 'L', 'pz', 'conf'];

export interface PantryItem {
  id: string;
  householdId: string;
  name: string;
  category: PantryCategory;
  quantity: number;        // quantità attuale
  unit: PantryUnit;
  initialQuantity: number; // quantità di riferimento (quando "pieno")
  expiryDate?: string;     // ISO date string, opzionale
  avgPrice?: number;       // prezzo medio (€)
  priceHistory: number[];  // ultimi 10 prezzi registrati
  createdAt: string;
  updatedAt: string;
}

// ─── Scontrino ────────────────────────────────────────────────────────────────

export interface ReceiptParsedItem {
  id: string;                    // UUID per key React
  name: string;
  category: PantryCategory;
  quantity: number;
  unit: PantryUnit;
  price?: number;                // prezzo unitario €
  include: boolean;              // checkbox include/escludi
  existingPantryItemId?: string; // se trovato match in dispensa → merge
}

// ─── Piano Alimentare ─────────────────────────────────────────────────────────

export type MealType = 'colazione' | 'spuntino_mattina' | 'pranzo' | 'spuntino_pomeriggio' | 'cena';

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  colazione: 'Colazione',
  spuntino_mattina: 'Spuntino mattina',
  pranzo: 'Pranzo',
  spuntino_pomeriggio: 'Spuntino pomeriggio',
  cena: 'Cena',
};

export const MEAL_TYPE_ORDER: MealType[] = [
  'colazione', 'spuntino_mattina', 'pranzo', 'spuntino_pomeriggio', 'cena',
];

export interface MealIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface MealSubstitution {
  originalIngredient: MealIngredient;
  replacementIngredient: MealIngredient;
}

export interface Meal {
  id: string;
  type: MealType;
  name: string;
  ingredients: MealIngredient[];
  completed: boolean;
  substitutions: MealSubstitution[];
  notes?: string;
}

export interface DayPlan {
  id: string;
  dayLabel: string;   // "Lunedì", "Martedì", ...
  dayIndex: number;   // 0 = Lunedì, 6 = Domenica
  meals: Meal[];
}

export interface WeekPlan {
  weekNumber: number;
  days: DayPlan[];
}

export interface MealPlan {
  id: string;
  householdId: string;
  profileId: string;
  pdfName?: string;
  weeks: WeekPlan[];
  createdAt: string;
  updatedAt: string;
}

export const DAY_LABELS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
export const DAY_SHORT  = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// ─── Lista della Spesa ────────────────────────────────────────────────────────

export type ShoppingItemOrigin = 'auto' | 'manual';

export interface ShoppingItem {
  id: string;
  householdId: string;
  name: string;
  quantity?: number;
  unit?: string;
  checked: boolean;            // spuntato al supermercato
  origin: ShoppingItemOrigin;  // 'auto' = da dispensa bassa, 'manual' = aggiunto a mano
  pantryItemId?: string;       // riferimento al PantryItem che ha generato l'auto-item
  mealIds: string[];           // mealId che contribuiscono a tenere basso questo item
  createdAt: string;
}
