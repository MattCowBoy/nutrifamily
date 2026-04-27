import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePantryStore, stockStatus } from '../../store/pantryStore';
import { useMealPlanStore } from '../../store/mealPlanStore';
import BottomNav from '../../components/BottomNav';
import { useEffect } from 'react';

const QUOTES = [
  'Ogni pasto è un\'opportunità per nutrire il corpo con amore 🌿',
  'Un piccolo passo oggi, un grande cambiamento domani ✨',
  'Mangiare bene è un atto di cura verso te stessa 🌸',
  'Il benessere parte dalla tavola, ogni giorno 🍃',
  'Scegli cibi che ti fanno sentire bene dentro e fuori 💫',
  'La cura di sé comincia dai dettagli del quotidiano 🌼',
  'Ogni pasto è un nuovo inizio 🌅',
];

const MEAL_LABELS: Record<string, { label: string; emoji: string; color: string; textColor: string }> = {
  colazione: { label: 'Colazione', emoji: '☀️', color: '#FDE8E2', textColor: '#C0604A' },
  pranzo:    { label: 'Pranzo',    emoji: '🌤️', color: '#E4F0E8', textColor: '#3D6B4A' },
  cena:      { label: 'Cena',      emoji: '🌙', color: '#EDE9F6', textColor: '#5D5090' },
};

export default function HomePage() {
  const navigate = useNavigate();
  const { household, currentProfile, lockProfile } = useAuthStore();
  const { items: pantryItems, loadItems } = usePantryStore();
  const { allPlans, loadAllPlans } = useMealPlanStore();

  useEffect(() => {
    if (household?.id) {
      loadItems(household.id);
      if (household.members.length > 0) {
        loadAllPlans(household.id, household.members.map(m => m.id));
      }
    }
  }, [household?.id]);

  const dayIdx = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();
  const quote = QUOTES[dayIdx % QUOTES.length];

  const currentPlan = allPlans.find(p => p.profileId === currentProfile?.id);
  const todayMeals = (() => {
    if (!currentPlan) return [];
    const week = currentPlan.weeks[0];
    if (!week) return [];
    const day = week.days.find(d => d.dayIndex === dayIdx);
    return day?.meals ?? [];
  })();

  const lowCount = pantryItems.filter(i => stockStatus(i) !== 'ok').length;

  const avatarColor = currentProfile?.avatar ?? 'bg-primary-500';

  return (
    <div className="min-h-screen pb-24" style={{ background: '#FBFAF8' }}>
      <div className="max-w-lg mx-auto px-4">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-5 mb-5">
          <div>
            <p className="text-xs font-medium" style={{ color: '#9C9485' }}>Bentornata,</p>
            <h1 className="font-serif text-[22px] font-bold" style={{ color: '#1A1812' }}>
              {currentProfile?.name ?? household?.name} 👋
            </h1>
          </div>
          <button
            onClick={lockProfile}
            className={`w-11 h-11 ${avatarColor} rounded-full flex items-center justify-center text-white font-bold text-base shadow-warm-sm`}
            title="Cambia profilo"
          >
            {(currentProfile?.name ?? household?.name ?? '?').charAt(0).toUpperCase()}
          </button>
        </div>

        {/* ── Motivational banner ─────────────────────────────────── */}
        <div
          className="rounded-3xl p-5 mb-4 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #E07A5F 0%, #C05A3A 100%)' }}
        >
          <div className="absolute top-[-20px] right-[-20px] w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="absolute bottom-[-30px] right-5 w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ opacity: 0.75 }}>
            Motivazione del giorno
          </p>
          <p className="font-serif text-[15px] leading-relaxed italic max-w-[85%]">{quote}</p>
        </div>

        {/* ── Oggi card ────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl border p-4 mb-4 shadow-warm-sm" style={{ borderColor: '#EFEBE5' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm" style={{ color: '#1A1812' }}>
              I tuoi pasti di oggi
            </p>
            <button
              onClick={() => navigate('/piano')}
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: '#FDE8E2', color: '#C0604A' }}
            >
              Vedi piano →
            </button>
          </div>

          {todayMeals.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">🍽️</p>
              <p className="text-xs font-medium" style={{ color: '#9C9485' }}>
                {currentPlan ? 'Nessun pasto per oggi' : 'Nessun piano caricato'}
              </p>
              <button
                onClick={() => navigate('/piano')}
                className="mt-2 text-xs font-semibold underline"
                style={{ color: '#E07A5F' }}
              >
                {currentPlan ? 'Vai al piano' : 'Carica piano alimentare'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {['colazione', 'pranzo', 'cena'].map(slot => {
                const meal = todayMeals.find((m: { type: string }) => m.type === slot);
                const meta = MEAL_LABELS[slot];
                return (
                  <div
                    key={slot}
                    className="rounded-2xl p-3 cursor-pointer"
                    style={{ background: meta.color }}
                    onClick={() => navigate('/piano')}
                  >
                    <div className="text-base mb-1">{meta.emoji}</div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: meta.textColor }}>
                      {meta.label}
                    </div>
                    <div className="text-[11px] font-semibold leading-tight" style={{ color: '#1A1812' }}>
                      {meal ? (meal.name.split(' ').slice(0, 3).join(' ') + (meal.name.split(' ').length > 3 ? '…' : '')) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Quick links grid ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Dispensa */}
          <button
            onClick={() => navigate('/dispensa')}
            className="bg-white rounded-3xl border p-4 text-left shadow-warm-sm hover:scale-[1.02] transition-transform"
            style={{ borderColor: '#EFEBE5' }}
          >
            <div className="text-2xl mb-2">📦</div>
            <p className="font-semibold text-sm" style={{ color: '#1A1812' }}>Dispensa</p>
            <p className="text-xs mt-0.5" style={{ color: '#9C9485' }}>
              {pantryItems.length} prodott{pantryItems.length === 1 ? 'o' : 'i'}
              {lowCount > 0 && (
                <span className="ml-1 font-semibold" style={{ color: '#E07A5F' }}>· {lowCount} in esaurimento</span>
              )}
            </p>
          </button>

          {/* Lista spesa */}
          <button
            onClick={() => navigate('/spesa')}
            className="bg-white rounded-3xl border p-4 text-left shadow-warm-sm hover:scale-[1.02] transition-transform"
            style={{ borderColor: '#EFEBE5' }}
          >
            <div className="text-2xl mb-2">🛒</div>
            <p className="font-semibold text-sm" style={{ color: '#1A1812' }}>Lista spesa</p>
            <p className="text-xs mt-0.5" style={{ color: '#9C9485' }}>Cosa comprare oggi</p>
          </button>

          {/* Profili */}
          <button
            onClick={() => navigate('/profili-app')}
            className="bg-white rounded-3xl border p-4 text-left shadow-warm-sm hover:scale-[1.02] transition-transform"
            style={{ borderColor: '#EFEBE5' }}
          >
            <div className="text-2xl mb-2">👨‍👩‍👧</div>
            <p className="font-semibold text-sm" style={{ color: '#1A1812' }}>Famiglia</p>
            <p className="text-xs mt-0.5" style={{ color: '#9C9485' }}>
              {household?.members.length ?? 0} profil{(household?.members.length ?? 0) === 1 ? 'o' : 'i'}
            </p>
          </button>

          {/* Piano */}
          <button
            onClick={() => navigate('/piano')}
            className="rounded-3xl p-4 text-left hover:scale-[1.02] transition-transform"
            style={{ background: 'linear-gradient(135deg, #6B9E7A 0%, #4D7A5A 100%)' }}
          >
            <div className="text-2xl mb-2">✨</div>
            <p className="font-semibold text-sm text-white">Piano AI</p>
            <p className="text-xs mt-0.5 text-white/70">Settimana su misura</p>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
