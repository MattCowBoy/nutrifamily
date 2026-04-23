import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMealPlanStore } from '../../store/mealPlanStore';
import type { MealToggleEntry } from '../../store/mealPlanStore';
import { useSettingsStore } from '../../store/settingsStore';
import { usePantryStore } from '../../store/pantryStore';
import BottomNav from '../../components/BottomNav';
import UploadPlanSheet from '../../components/UploadPlanSheet';
import SubstituteSheet from '../../components/SubstituteSheet';
import type { Meal, MealPlan, MealSubstitution, MealType, UserProfile } from '../../types';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER, DAY_SHORT } from '../../types';

// ─── Types per la vista combinata ─────────────────────────────────────────────

interface MealEntry {
  meal: Meal;
  planId: string;
  weekNum: number;
  dayId: string;
  profileId: string;
  profileName: string;
  profileAvatar?: string; // Tailwind bg class es. "bg-green-400"
}

/** Un "slot" rappresenta un tipo di pasto per il giorno selezionato. */
type CombinedSlot =
  | { shared: true;  type: MealType; entries: MealEntry[] }
  | { shared: false; type: MealType; entry: MealEntry; showBadge: boolean };

// ─── Helper: costruisce la vista combinata ────────────────────────────────────

const normMealName = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

function buildCombinedSlots(
  allPlans: MealPlan[],
  profiles: UserProfile[],
  weekNum: number,
  dayIndex: number,
): CombinedSlot[] {
  const multiProfile = allPlans.length > 1;
  const result: CombinedSlot[] = [];

  for (const mealType of MEAL_TYPE_ORDER) {
    const entries: MealEntry[] = [];

    for (const plan of allPlans) {
      const week = plan.weeks.find(w => w.weekNumber === weekNum);
      if (!week) continue;
      const day = week.days.find(d => d.dayIndex === dayIndex);
      if (!day) continue;
      const meal = day.meals.find(m => m.type === mealType);
      if (!meal) continue;
      const profile = profiles.find(p => p.id === plan.profileId);
      if (!profile) continue;
      entries.push({
        meal, planId: plan.id, weekNum,
        dayId: day.id,
        profileId: plan.profileId,
        profileName: profile.name,
        profileAvatar: profile.avatar,
      });
    }

    if (entries.length === 0) continue;

    if (multiProfile && entries.length > 1) {
      const names = new Set(entries.map(e => normMealName(e.meal.name)));
      if (names.size === 1) {
        // Stesso pasto → card condivisa
        result.push({ shared: true, type: mealType, entries });
      } else {
        // Pasti diversi → una card per profilo
        for (const entry of entries) {
          result.push({ shared: false, type: mealType, entry, showBadge: true });
        }
      }
    } else {
      // Singolo profilo o un solo piano disponibile per questo slot
      result.push({ shared: false, type: mealType, entry: entries[0], showBadge: false });
    }
  }

  return result;
}

// ─── ProfileBadge ─────────────────────────────────────────────────────────────

function ProfileBadge({ name, avatar }: { name: string; avatar?: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-4 h-4 rounded-full ${avatar ?? 'bg-gray-400'} flex items-center justify-center shrink-0`}>
        <span className="text-[8px] text-white font-bold leading-none">{name[0].toUpperCase()}</span>
      </div>
      <span className="text-[10px] text-gray-500 font-medium">{name}</span>
    </div>
  );
}

// ─── MealCard ─────────────────────────────────────────────────────────────────

const MEAL_ICONS: Record<string, string> = {
  colazione: '☀️', spuntino_mattina: '🍎',
  pranzo: '🍽️', spuntino_pomeriggio: '🧃', cena: '🌙',
};

function MealCard({
  meal,
  completed,
  sharedProfiles,   // se definito → card condivisa, mostra tutti i profili
  personalBadge,    // se definito → card personale in vista multi-profilo
  onToggle, onSubstitute, onRecipe,
}: {
  meal: Meal;
  completed: boolean;
  sharedProfiles?: Array<{ name: string; avatar?: string }>;
  personalBadge?: { name: string; avatar?: string };
  onToggle: () => void;
  onSubstitute: () => void;
  onRecipe: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${
      completed ? 'border-green-200 bg-green-50/30' : 'border-gray-100'
    }`}>
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* Checkbox */}
          <button
            onClick={onToggle}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
              completed
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 hover:border-green-400'
            }`}
          >
            {completed && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{MEAL_ICONS[meal.type]}</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                {MEAL_TYPE_LABELS[meal.type]}
              </span>
            </div>
            <p className={`text-sm font-semibold mt-0.5 ${completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {meal.name}
            </p>

            {/* Profili condivisi — mostrati sotto il nome */}
            {sharedProfiles && sharedProfiles.length > 1 && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {sharedProfiles.map(p => (
                  <ProfileBadge key={p.name} name={p.name} avatar={p.avatar} />
                ))}
              </div>
            )}

            {/* Sostituzioni badge */}
            {meal.substitutions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {meal.substitutions.map((sub, i) => (
                  <span key={i} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {sub.originalIngredient.name} → {sub.replacementIngredient.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Azioni + badge profilo personale */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {/* Badge profilo (solo per card non-condivise in vista multi-profilo) */}
            {personalBadge && (
              <ProfileBadge name={personalBadge.name} avatar={personalBadge.avatar} />
            )}

            <div className="flex items-center gap-1">
              {/* Ricetta */}
              <button
                onClick={onRecipe}
                title="Genera ricetta con Claude AI"
                className="p-1.5 rounded-lg hover:bg-green-50 text-gray-300 hover:text-primary-500 transition"
              >
                <span className="text-base leading-none">🍳</span>
              </button>
              {/* Sostituisci */}
              <button
                onClick={onSubstitute}
                title="Sostituisci ingrediente"
                className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-300 hover:text-amber-500 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
              {/* Espandi */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition"
              >
                <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Ingredienti (espandibili) */}
        {expanded && (
          <div className="mt-2 ml-7 border-t border-gray-100 pt-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Ingredienti</p>
            <div className="space-y-1.5">
              {meal.ingredients.map((ing, i) => {
                const sub = meal.substitutions.find(s => s.originalIngredient.name === ing.name);
                const effective = sub ? sub.replacementIngredient : ing;
                return (
                  <div key={i} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${sub ? 'text-amber-700' : 'text-gray-700'}`}>
                        {effective.name}
                      </span>
                      <span className={`font-medium ${sub ? 'text-amber-600' : 'text-gray-400'}`}>
                        {effective.quantity} {effective.unit}
                      </span>
                    </div>
                    {sub && (
                      <div className="mt-0.5">
                        <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">
                          ↔ prima: {ing.name} {ing.quantity} {ing.unit}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PianoPage ────────────────────────────────────────────────────────────────

export default function PianoPage() {
  const { household, currentProfile } = useAuthStore();
  const {
    plan, allPlans, loading,
    loadPlan, loadAllPlans, savePlan, deletePlan,
    toggleMeal, toggleSharedMeal, addSubstitution,
  } = useMealPlanStore();
  const { claudeApiKey } = useSettingsStore();
  const pantryItems = usePantryStore(s => s.items);

  const [showUpload, setShowUpload] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState(0);

  // substituteTarget porta con sé tutte le info per sapere quale piano aggiornare
  const navigate = useNavigate();
  const [substituteTarget, setSubstituteTarget] = useState<MealEntry | null>(null);

  // Profili di tutti i membri della famiglia
  const members: UserProfile[] = household?.members ?? [];

  useEffect(() => {
    if (!household?.id || !currentProfile?.id) return;
    const profileIds = members.map(m => m.id);
    loadPlan(household.id, currentProfile.id);
    loadAllPlans(household.id, profileIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id, currentProfile?.id]);

  // Piano primario = quello del profilo corrente (per la navigazione settimane/giorni)
  const primaryPlan = plan ?? allPlans[0] ?? null;
  const currentWeek = primaryPlan?.weeks.find(w => w.weekNumber === selectedWeek);

  // Vista combinata del giorno selezionato
  const combinedSlots: CombinedSlot[] = currentWeek
    ? buildCombinedSlots(allPlans, members, selectedWeek, selectedDay)
    : [];

  // Conteggi per la progress bar (ogni "card" conta come 1)
  const totalCount = combinedSlots.length;
  const completedCount = combinedSlots.filter(slot =>
    slot.shared
      ? slot.entries.every(e => e.meal.completed)
      : slot.entry.meal.completed
  ).length;

  // Label del giorno
  const currentDayLabel = (() => {
    for (const p of allPlans) {
      const week = p.weeks.find(w => w.weekNumber === selectedWeek);
      const day = week?.days.find(d => d.dayIndex === selectedDay);
      if (day) return day.dayLabel;
    }
    return '';
  })();

  const handlePlanDone = async (newPlan: MealPlan) => {
    await savePlan(newPlan);
    setShowUpload(false);
    setSelectedWeek(newPlan.weeks[0]?.weekNumber ?? 1);
    setSelectedDay(newPlan.weeks[0]?.days[0]?.dayIndex ?? 0);
    // Ricarica tutti i piani per aggiornare la vista combinata
    if (household?.id) {
      await loadAllPlans(household.id, members.map(m => m.id));
    }
  };

  const handleSubstitution = async (sub: MealSubstitution) => {
    if (!substituteTarget) return;
    const { planId, weekNum, dayId, meal } = substituteTarget;
    await addSubstitution(planId, weekNum, dayId, meal.id, sub);
    setSubstituteTarget(null);
  };

  if (loading && allPlans.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <BottomNav />
      </div>
    );
  }

  // Empty state: nessun piano disponibile per nessun membro
  if (!primaryPlan) {
    return (
      <div className="min-h-screen bg-gray-50 pb-28">
        <div className="max-w-lg mx-auto px-4 pt-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Piano alimentare</h1>
          <p className="text-xs text-gray-400 mb-8">Carica il piano del tuo nutrizionista</p>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="font-bold text-gray-800 text-lg mb-2">Nessun piano caricato</h2>
            <p className="text-sm text-gray-400 mb-6">
              Carica il PDF del piano alimentare del tuo nutrizionista. Claude AI estrarrà
              automaticamente i pasti, gli ingredienti e le grammature.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="w-full py-3.5 bg-primary-600 text-white font-semibold rounded-2xl hover:bg-primary-700 transition flex items-center justify-center gap-2"
            >
              <span>🤖</span>
              Carica con Claude AI
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { icon: '📄', label: 'Carica PDF' },
              { icon: '✅', label: 'Spunta pasti' },
              { icon: '🔄', label: 'Sostituisci' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
                <p className="text-2xl mb-1">{item.icon}</p>
                <p className="text-xs text-gray-500 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {showUpload && household && currentProfile && (
          <UploadPlanSheet
            householdId={household.id}
            profileId={currentProfile.id}
            onDone={handlePlanDone}
            onClose={() => setShowUpload(false)}
          />
        )}

        <BottomNav />
      </div>
    );
  }

  // ─── Vista principale ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header sticky */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Piano alimentare</h1>
              {/* Mostra quanti piani sono caricati */}
              {allPlans.length > 1 ? (
                <p className="text-[11px] text-primary-600 font-medium">
                  Vista famiglia · {allPlans.length} piani
                </p>
              ) : primaryPlan.pdfName ? (
                <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{primaryPlan.pdfName}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUpload(true)}
                className="text-xs text-primary-600 font-medium px-3 py-1.5 rounded-xl border border-primary-200 hover:bg-primary-50 transition"
              >
                {plan ? 'Aggiorna' : 'Carica'}
              </button>
              {plan && (
                <button
                  onClick={() => deletePlan(plan.id, household!.id)}
                  className="text-xs text-red-400 font-medium px-2 py-1.5 rounded-xl hover:bg-red-50 transition"
                  title="Elimina il mio piano"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Week selector (basato sul piano primario) */}
          {primaryPlan.weeks.length > 1 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              {primaryPlan.weeks.map(w => (
                <button
                  key={w.weekNumber}
                  onClick={() => {
                    setSelectedWeek(w.weekNumber);
                    setSelectedDay(w.days[0]?.dayIndex ?? 0);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    selectedWeek === w.weekNumber
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  Settimana {w.weekNumber}
                </button>
              ))}
            </div>
          )}

          {/* Day selector */}
          {currentWeek && (
            <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
              {currentWeek.days.map(day => {
                // Calcola completamento sommando dai combined slots di quel giorno
                const daySlots = buildCombinedSlots(allPlans, members, selectedWeek, day.dayIndex);
                const done = daySlots.filter(s =>
                  s.shared ? s.entries.every(e => e.meal.completed) : s.entry.meal.completed
                ).length;
                const tot = daySlots.length;
                const allDone = done === tot && tot > 0;
                return (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day.dayIndex)}
                    className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-all ${
                      selectedDay === day.dayIndex
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{DAY_SHORT[day.dayIndex]}</span>
                    <span className={`text-[9px] mt-0.5 ${selectedDay === day.dayIndex ? 'text-primary-100' : 'text-gray-400'}`}>
                      {allDone ? '✓' : `${done}/${tot}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        {combinedSlots.length > 0 ? (
          <>
            {/* Day header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">{currentDayLabel}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{completedCount}/{totalCount} pasti</span>
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: totalCount ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {combinedSlots.map((slot, idx) => {
                if (slot.shared) {
                  const completedAll = slot.entries.every(e => e.meal.completed);
                  // Per substitute/recipe usa il proprio entry se disponibile
                  const myEntry = slot.entries.find(e => e.profileId === currentProfile?.id) ?? slot.entries[0];
                  const toggleEntries: MealToggleEntry[] = slot.entries.map(e => ({
                    planId: e.planId, weekNum: e.weekNum, dayId: e.dayId, mealId: e.meal.id,
                  }));
                  return (
                    <MealCard
                      key={`shared-${slot.type}-${idx}`}
                      meal={myEntry.meal}
                      completed={completedAll}
                      sharedProfiles={slot.entries.map(e => ({ name: e.profileName, avatar: e.profileAvatar }))}
                      onToggle={() => toggleSharedMeal(toggleEntries, household?.id ?? '')}
                      onSubstitute={() => setSubstituteTarget(myEntry)}
                      onRecipe={() => navigate('/piano/ricetta', { state: { meal: myEntry.meal, profile: currentProfile, apiKey: claudeApiKey } })}
                    />
                  );
                } else {
                  const { entry, showBadge } = slot;
                  return (
                    <MealCard
                      key={`${entry.planId}-${entry.meal.id}`}
                      meal={entry.meal}
                      completed={entry.meal.completed}
                      personalBadge={showBadge ? { name: entry.profileName, avatar: entry.profileAvatar } : undefined}
                      onToggle={() => toggleMeal(entry.planId, entry.weekNum, entry.dayId, entry.meal.id)}
                      onSubstitute={() => setSubstituteTarget(entry)}
                      onRecipe={() => navigate('/piano/ricetta', { state: { meal: entry.meal, profile: currentProfile, apiKey: claudeApiKey } })}
                    />
                  );
                }
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            Nessun pasto previsto per questo giorno.
          </p>
        )}
      </div>

      {/* Modali */}
      {showUpload && household && currentProfile && (
        <UploadPlanSheet
          householdId={household.id}
          profileId={currentProfile.id}
          onDone={handlePlanDone}
          onClose={() => setShowUpload(false)}
        />
      )}

      {substituteTarget && currentProfile && (
        <SubstituteSheet
          meal={substituteTarget.meal}
          profile={currentProfile as UserProfile}
          pantryItems={pantryItems}
          apiKey={claudeApiKey}
          onSave={handleSubstitution}
          onClose={() => setSubstituteTarget(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
