import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePantryStore, stockStatus } from '../../store/pantryStore';
import { useMealPlanStore } from '../../store/mealPlanStore';
import BottomNav from '../../components/BottomNav';

const QUOTES = [
  'Ogni pasto è un\'opportunità per nutrire il corpo con amore 🌿',
  'Un piccolo passo oggi, un grande cambiamento domani ✨',
  'Mangiare bene è un atto di cura verso te stessa 🌸',
  'Il benessere parte dalla tavola, ogni giorno 🍃',
  'Scegli cibi che ti fanno sentire bene dentro e fuori 💫',
  'La cura di sé comincia dai dettagli del quotidiano 🌼',
  'Ogni pasto è un nuovo inizio 🌅',
];

const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];

const MEAL_SLOTS = [
  { type: 'colazione',  label: 'COLAZIONE', emoji: '☀️',  bg: '#FDE8E2', text: '#C0604A' },
  { type: 'pranzo',     label: 'PRANZO',    emoji: '🌤️', bg: '#E4F0E8', text: '#3D6B4A' },
  { type: 'cena',       label: 'CENA',      emoji: '🌙',  bg: '#EDE9F6', text: '#5D5090' },
];

const AVATAR_COLORS = ['#FDE8E2', '#E4F0E8', '#EDE9F6', '#FEF3E8', '#E2F5EC'];
const AVATAR_TEXT   = ['#C0604A', '#3D6B4A', '#5D5090', '#B06010', '#3D6B4A'];

export default function HomePage() {
  const navigate = useNavigate();
  const { household, currentProfile, setCurrentProfile } = useAuthStore();
  const { items: pantryItems, loadItems } = usePantryStore();
  const { allPlans, loadAllPlans } = useMealPlanStore();

  const dayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const quote  = QUOTES[dayIdx % QUOTES.length];
  const dayName = DAY_NAMES[dayIdx];

  useEffect(() => {
    if (!household?.id) return;
    loadItems(household.id);
    if (household.members.length > 0)
      loadAllPlans(household.id, household.members.map(m => m.id));
  }, [household?.id]);

  /* Piano del giorno del profilo attivo */
  const currentPlan  = allPlans.find(p => p.profileId === currentProfile?.id);
  const todayMeals   = currentPlan?.weeks?.[0]?.days?.find(d => d.dayIndex === dayIdx)?.meals ?? [];
  const lowCount     = pantryItems.filter(i => stockStatus(i) !== 'ok').length;

  if (!household) return null;

  return (
    <div className="min-h-screen pb-28" style={{ background: '#FBFAF8' }}>
      <div className="max-w-lg mx-auto px-4">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-5 mb-5">
          <div>
            <p className="text-xs font-medium" style={{ color: '#9C9485' }}>Bentornata,</p>
            <h1 className="font-serif text-[22px] font-bold leading-tight" style={{ color: '#1A1812' }}>
              {currentProfile?.name ?? household.name}
            </h1>
          </div>
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-warm-sm"
            style={{ background: 'white', border: '1.5px solid #EFEBE5' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
              style={{ color: '#9C9485' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
        </div>

        {/* ── Profile switcher ────────────────────────────────────── */}
        <div className="flex gap-4 mb-5 overflow-x-auto scrollbar-hide pb-1">
          {household.members.map((member, i) => {
            const isActive = member.id === currentProfile?.id;
            const bg   = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const txt  = AVATAR_TEXT[i % AVATAR_TEXT.length];
            return (
              <button
                key={member.id}
                onClick={() => setCurrentProfile(member)}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all"
                  style={{
                    background: bg,
                    color: txt,
                    border: isActive ? `2.5px solid ${txt}` : '2.5px solid transparent',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: isActive ? '#1A1812' : '#9C9485', fontWeight: isActive ? 600 : 400 }}
                >
                  {member.name}
                </span>
              </button>
            );
          })}
          {/* Add member */}
          <button
            onClick={() => navigate('/profile/new')}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ border: '2px dashed #D7D1C5' }}
            >
              <svg className="w-5 h-5" style={{ color: '#9C9485' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-[10px]" style={{ color: '#9C9485' }}>Aggiungi</span>
          </button>
        </div>

        {/* ── Motivational banner ─────────────────────────────────── */}
        <div
          className="rounded-3xl p-5 mb-4 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #D4724A 0%, #B85A35 100%)' }}
        >
          <div className="absolute top-[-24px] right-[-24px] w-28 h-28 rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="absolute bottom-[-32px] right-6 w-20 h-20 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }} />
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ opacity: 0.75 }}>
            Motivazione del giorno
          </p>
          <p className="font-serif text-[15px] leading-relaxed italic max-w-[85%]">{quote}</p>
        </div>

        {/* ── Oggi card ────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-3xl p-4 mb-4 shadow-warm-sm"
          style={{ border: '1px solid #EFEBE5' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-[15px]" style={{ color: '#1A1812' }}>
              Oggi · {dayName}
            </p>
            <button
              onClick={() => navigate('/piano')}
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: '#FDE8E2', color: '#C0604A' }}
            >
              {todayMeals.length > 0 ? `${todayMeals.filter(m => m.completed).length}/${todayMeals.length} pasti` : 'Vai al piano'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {MEAL_SLOTS.map(slot => {
              const meal = todayMeals.find(m => m.type === slot.type);
              return (
                <button
                  key={slot.type}
                  onClick={() => navigate('/piano')}
                  className="rounded-2xl p-3 text-left"
                  style={{ background: slot.bg }}
                >
                  <div className="text-[17px] mb-1">{slot.emoji}</div>
                  <div
                    className="text-[9px] font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: slot.text }}
                  >
                    {slot.label}
                  </div>
                  <div className="text-[11px] font-semibold leading-snug" style={{ color: '#1A1812' }}>
                    {meal
                      ? meal.name.split(' ').slice(0, 4).join(' ') + (meal.name.split(' ').length > 4 ? '…' : '')
                      : <span style={{ color: '#9C9485', fontStyle: 'italic' }}>—</span>
                    }
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Quick links ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Scansiona scontrino */}
          <button
            onClick={() => navigate('/dispensa')}
            className="bg-white rounded-3xl p-4 text-left shadow-warm-sm hover:scale-[1.02] transition-transform"
            style={{ border: '1px solid #EFEBE5' }}
          >
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: '#E4F0E8' }}>
              <svg className="w-5 h-5" style={{ color: '#3D6B4A' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14H5a2 2 0 01-2-2V6a2 2 0 012-2h4m6 0h4a2 2 0 012 2v6a2 2 0 01-2 2h-4m-6 6h6M9 14v6m6-6v6" />
              </svg>
            </div>
            <p className="font-semibold text-[13px] mb-0.5" style={{ color: '#1A1812' }}>
              Scansiona scontrino
            </p>
            <p className="text-[11px]" style={{ color: '#9C9485' }}>Aggiungi alla dispensa</p>
          </button>

          {/* Genera piano AI */}
          <button
            onClick={() => navigate('/piano')}
            className="bg-white rounded-3xl p-4 text-left shadow-warm-sm hover:scale-[1.02] transition-transform"
            style={{ border: '1px solid #EFEBE5' }}
          >
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: '#EDE9F6' }}>
              <svg className="w-5 h-5" style={{ color: '#5D5090' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <p className="font-semibold text-[13px] mb-0.5" style={{ color: '#1A1812' }}>
              Carica piano AI
            </p>
            <p className="text-[11px]" style={{ color: '#9C9485' }}>
              {currentPlan ? 'Piano attivo ✓' : 'Settimana su misura'}
            </p>
          </button>

          {/* Lista spesa */}
          <button
            onClick={() => navigate('/spesa')}
            className="bg-white rounded-3xl p-4 text-left shadow-warm-sm hover:scale-[1.02] transition-transform"
            style={{ border: '1px solid #EFEBE5' }}
          >
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: '#FEF3E8' }}>
              <svg className="w-5 h-5" style={{ color: '#B06010' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="font-semibold text-[13px] mb-0.5" style={{ color: '#1A1812' }}>
              Lista della spesa
            </p>
            <p className="text-[11px]" style={{ color: '#9C9485' }}>Cosa comprare oggi</p>
          </button>

          {/* Dispensa */}
          <button
            onClick={() => navigate('/dispensa')}
            className="rounded-3xl p-4 text-left hover:scale-[1.02] transition-transform"
            style={{ background: 'linear-gradient(135deg, #6B9E7A 0%, #4D7A5A 100%)' }}
          >
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              <span className="text-lg">📦</span>
            </div>
            <p className="font-semibold text-[13px] mb-0.5 text-white">La dispensa</p>
            <p className="text-[11px] text-white/70">
              {pantryItems.length} prodotti
              {lowCount > 0 && ` · ${lowCount} in esaurimento`}
            </p>
          </button>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}
