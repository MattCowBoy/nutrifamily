import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import BottomNav from '../../components/BottomNav';

const sections = [
  {
    to: '/dispensa',
    title: 'Dispensa',
    description: 'Gestisci i tuoi alimenti',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    color: 'bg-orange-50 border-orange-100 text-orange-600',
  },
  {
    to: '/piano',
    title: 'Piano alimentare',
    description: 'Segui il tuo piano',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    color: 'bg-blue-50 border-blue-100 text-blue-600',
  },
  {
    to: '/spesa',
    title: 'Lista della spesa',
    description: 'Cosa comprare oggi',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: 'bg-green-50 border-green-100 text-green-600',
  },
  {
    to: '/profili-app',
    title: 'Profili famiglia',
    description: 'Gestisci i profili',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: 'bg-violet-50 border-violet-100 text-violet-600',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { household, currentProfile, lockProfile } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Benvenuto/a</p>
            <h1 className="text-xl font-bold text-gray-900">{currentProfile?.name ?? household?.name}</h1>
          </div>
          <button
            onClick={lockProfile}
            className={`w-10 h-10 ${currentProfile?.avatar ?? 'bg-primary-600'} rounded-full flex items-center justify-center text-white font-bold text-base`}
            title="Cambia profilo"
          >
            {(currentProfile?.name ?? household?.name ?? '?').charAt(0).toUpperCase()}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Banner piano */}
        <div className="bg-primary-600 rounded-2xl p-5 mb-6 text-white">
          <p className="text-primary-100 text-sm mb-1">Oggi</p>
          <p className="text-xl font-bold mb-3">Nessun piano caricato</p>
          <button
            onClick={() => navigate('/piano')}
            className="bg-white/20 hover:bg-white/30 transition px-4 py-2 rounded-xl text-sm font-semibold"
          >
            Carica piano alimentare
          </button>
        </div>

        {/* Grid sezioni */}
        <div className="grid grid-cols-2 gap-3">
          {sections.map(({ to, title, description, icon, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className={`${color} border rounded-2xl p-4 text-left hover:scale-[1.02] transition-transform`}
            >
              <div className="mb-2">{icon}</div>
              <p className="font-semibold text-gray-900 text-sm">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </button>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
