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

function ProfileBadge({ name }: { name: string; avatar?: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={{ background: '#FDE8E2' }}>
        <span className="text-[8px] font-bold leading-none" style={{ color: '#C0604A' }}>{name[0].toUpperCase()}</span>
      </div>
      <span className="text-[10px] font-medium" style={{ color: '#9C9485' }}>{name}</span>
    </div>
  );
}

// ─── MealCard ─────────────────────────────────────────────────────────────────

const MEAL_ICONS: Record<string, string> = {
  colazione: '☀️', spuntino_mattina: '🍎',
  pranzo: '🌤️', spuntino_pomeriggio: '🧃', cena: '🌙',
};

const MEAL_SLOT_STYLE: Record<string, { bg: string; text: string }> = {
  colazione:           { bg: '#FDE8E2', text: '#C0604A' },
  spuntino_mattina:    { bg: '#FEF3E8', text: '#B06010' },
  pranzo:              { bg: '#E4F0E8', text: '#3D6B4A' },
  spuntino_pomeriggio: { bg: '#FEF3E8', text: '#B06010' },
  cena:                { bg: '#EDE9F6', text: '#5D5090' },
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

  const slotStyle = MEAL_SLOT_STYLE[meal.type] ?? { bg: '#EFEBE5', text: '#3F3B30' };

  return (
    <div>
      {/* ── Slot header row ── */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{ background: slotStyle.bg }}
        >
          {MEAL_ICONS[meal.type]}
        </div>
        <span className="text-[13px] font-semibold" style={{ color: '#3F3B30' }}>
          {MEAL_TYPE_LABELS[meal.type]}
        </span>
        {sharedProfiles && sharedProfiles.length > 1 && (
          <div className="flex items-center gap-1 ml-1">
            {sharedProfiles.map(p => (
              <ProfileBadge key={p.name} name={p.name} />
            ))}
          </div>
        )}
        {personalBadge && <ProfileBadge name={personalBadge.name} />}
      </div>

      {/* ── Meal card ── */}
      <div
        className="bg-white rounded-2xl shadow-warm-sm transition-all"
        style={{
          border: `1px solid ${completed ? '#c3dfc9' : '#EFEBE5'}`,
          background: completed ? '#f8fdf9' : 'white',
        }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Meal name with checkbox */}
              <div className="flex items-start gap-2">
                <button
                  onClick={onToggle}
                  className="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: completed ? '#6B9E7A' : 'transparent',
                    borderColor: completed ? '#6B9E7A' : '#D7D1C5',
                    color: 'white',
                  }}
                >
                  {completed && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <p
                  className={`text-[14px] font-semibold leading-snug ${completed ? 'line-through' : ''}`}
                  style={{ color: completed ? '#9C9485' : '#1A1812' }}
                >
                  {MEAL_ICONS[meal.type]} {meal.name}
                </p>
              </div>

              {/* Macro dots row */}
              {meal.ingredients.length > 0 && (
                <div className="flex items-center gap-3 mt-2 ml-7">
                  {[
                    { label: 'P', color: '#E07A5F' },
                    { label: 'C', color: '#6B9E7A' },
                    { label: 'G', color: '#A89BC8' },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      <span className="text-[11px] font-medium" style={{ color: '#9C9485' }}>
                        {label}: {label === 'P'
                          ? meal.ingredients.filter(i => ['carne','pesce','uova','legumi','tofu','yogurt'].some(k => i.name.toLowerCase().includes(k))).length > 0 ? '✓' : '—'
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Substitutions */}
              {meal.substitutions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 ml-7">
                  {meal.substitutions.map((sub, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: '#FEF3E8', color: '#B06010' }}>
                      {sub.originalIngredient.name} → {sub.replacementIngredient.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <button onClick={onRecipe} className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition"
                style={{ color: '#9C9485' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2zm-9 4v6m4-6v6M3 9h18" />
                </svg>
                <span className="text-[9px] font-medium">Ricetta</span>
              </button>
              <button onClick={onSubstitute} className="p-1.5 rounded-lg transition"
                style={{ color: '#D7D1C5' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
              <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg transition"
                style={{ color: '#D7D1C5' }}>
                <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded ingredients */}
          {expanded && (
            <div className="mt-3 pt-3 ml-7" style={{ borderTop: '1px solid #EFEBE5' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#9C9485' }}>
                Ingredienti
              </p>
              <div className="space-y-1.5">
                {meal.ingredients.map((ing, i) => {
                  const sub = meal.substitutions.find(s => s.originalIngredient.name === ing.name);
                  const effective = sub ? sub.replacementIngredient : ing;
                  return (
                    <div key={i} className="text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: sub ? '#B06010' : '#6B9E7A' }} />
                        <span style={{ color: sub ? '#B06010' : '#3F3B30' }}>{effective.name}</span>
                        {sub && <span className="text-[9px] px-1 rounded" style={{ background: '#FEF3E8', color: '#B06010' }}>↔</span>}
                      </div>
                      <span style={{ color: '#9C9485' }}>{effective.quantity} {effective.unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
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
      <div className="min-h-screen flex items-center justify-center pb-20" style={{ background: '#FBFAF8' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#E07A5F', borderTopColor: 'transparent' }} />
        <BottomNav />
      </div>
    );
  }

  if (!primaryPlan) {
    return (
      <div className="min-h-screen pb-28" style={{ background: '#FBFAF8' }}>
        <div className="max-w-lg mx-auto px-4 pt-6">
          <h1 className="font-serif text-[22px] font-bold mb-1" style={{ color: '#1A1812' }}>Piano alimentare</h1>
          <p className="text-xs mb-6" style={{ color: '#9C9485' }}>Carica il piano del tuo nutrizionista</p>

          <div className="bg-white rounded-3xl p-8 text-center shadow-warm-sm" style={{ border: '1px solid #EFEBE5' }}>
            <div className="text-5xl mb-4">📋</div>
            <h2 className="font-serif font-bold text-lg mb-2" style={{ color: '#1A1812' }}>Nessun piano caricato</h2>
            <p className="text-sm mb-6" style={{ color: '#9C9485' }}>
              Carica il PDF del piano del tuo nutrizionista. Claude AI estrarrà automaticamente pasti, ingredienti e grammature.
            </p>
            <button onClick={() => setShowUpload(true)}
              className="w-full py-3.5 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2"
              style={{ background: '#E07A5F' }}>
              <span>✨</span> Carica con Claude AI
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[{ icon: '📄', label: 'Carica PDF' }, { icon: '✅', label: 'Spunta pasti' }, { icon: '🔄', label: 'Sostituisci' }].map(item => (
              <div key={item.label} className="bg-white rounded-2xl p-3 text-center shadow-warm-sm" style={{ border: '1px solid #EFEBE5' }}>
                <p className="text-2xl mb-1">{item.icon}</p>
                <p className="text-xs font-medium" style={{ color: '#9C9485' }}>{item.label}</p>
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

  // Calcola la data di inizio settimana (lunedì di questa settimana)
  const weekStartDate = (() => {
    const today = new Date();
    const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0=lun
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (selectedWeek - 1) * 7);
    return monday;
  })();

  return (
    <div className="min-h-screen pb-28" style={{ background: '#FBFAF8' }}>
      {/* ── Header sticky ──────────────────────────────────────── */}
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #EFEBE5' }}>
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">

          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-serif text-[22px] font-bold" style={{ color: '#1A1812' }}>
              Piano settimanale
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ background: '#1A1812' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                AI
              </button>
              {plan && (
                <button onClick={() => deletePlan(plan.id, household!.id)}
                  className="p-1.5 rounded-xl text-red-300 hover:text-red-400 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Profile card */}
          {currentProfile && (
            <div
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 mb-3"
              style={{ background: 'white', border: '1px solid #EFEBE5' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: '#FDE8E2', color: '#C0604A' }}
              >
                {currentProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#1A1812' }}>{currentProfile.name}</p>
                <p className="text-xs truncate" style={{ color: '#9C9485' }}>
                  {currentProfile.diet
                    ? currentProfile.diet
                    : currentProfile.intolleranze?.length
                    ? currentProfile.intolleranze.join(', ')
                    : 'Nessuna preferenza'}
                </p>
              </div>
              {allPlans.length > 1 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: '#FDE8E2', color: '#C0604A' }}>
                  +{allPlans.length - 1} familiari
                </span>
              )}
            </div>
          )}

          {/* Week selector */}
          {primaryPlan.weeks.length > 1 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              {primaryPlan.weeks.map(w => (
                <button key={w.weekNumber}
                  onClick={() => { setSelectedWeek(w.weekNumber); setSelectedDay(w.days[0]?.dayIndex ?? 0); }}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow-warm-sm"
                  style={{
                    background: selectedWeek === w.weekNumber ? '#1A1812' : 'white',
                    color: selectedWeek === w.weekNumber ? 'white' : '#9C9485',
                  }}>
                  Settimana {w.weekNumber}
                </button>
              ))}
            </div>
          )}

          {/* Day selector — abbrev + date number + progress */}
          {currentWeek && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              {currentWeek.days.map(day => {
                const daySlots = buildCombinedSlots(allPlans, members, selectedWeek, day.dayIndex);
                const done = daySlots.filter(s =>
                  s.shared ? s.entries.every(e => e.meal.completed) : s.entry.meal.completed
                ).length;
                const tot = daySlots.length;
                const allDone = done === tot && tot > 0;
                const isSelected = selectedDay === day.dayIndex;
                const dateNum = new Date(weekStartDate.getTime() + day.dayIndex * 86400000).getDate();
                return (
                  <button key={day.id} onClick={() => setSelectedDay(day.dayIndex)}
                    className="shrink-0 flex flex-col items-center px-2.5 py-2 rounded-2xl transition-all"
                    style={{
                      minWidth: 44,
                      background: isSelected ? '#E07A5F' : 'white',
                      color: isSelected ? 'white' : '#9C9485',
                      boxShadow: isSelected ? '0 4px 12px rgba(224,122,95,0.3)' : '0 1px 3px rgba(42,39,32,0.06)',
                    }}>
                    <span className="text-[10px] font-medium">{DAY_SHORT[day.dayIndex]}</span>
                    <span className="text-[15px] font-bold leading-tight">{dateNum}</span>
                    <span className="text-[9px] mt-0.5" style={{ opacity: 0.75 }}>
                      {allDone ? '✓' : `${done}/${tot}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#EFEBE5' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(completedCount / totalCount) * 100}%`, background: '#6B9E7A' }} />
            </div>
            <span className="text-xs shrink-0" style={{ color: '#9C9485' }}>{completedCount}/{totalCount} pasti</span>
          </div>
        )}

        {combinedSlots.length > 0 ? (
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
        ) : (
          <p className="text-sm text-center py-8" style={{ color: '#9C9485' }}>
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
