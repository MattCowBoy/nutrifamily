import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import BottomNav from '../../components/BottomNav';

const AVATAR_COLORS = ['#FDE8E2', '#E4F0E8', '#EDE9F6', '#FEF3E8', '#E2F5EC', '#FDE8E2'];

export default function ProfilesAppPage() {
  const navigate = useNavigate();
  const { household, currentProfile, logout } = useAuthStore();
  const { claudeApiKey, setClaudeApiKey, clearClaudeApiKey } = useSettingsStore();

  const [apiKeyInput, setApiKeyInput] = useState(claudeApiKey);
  const [showKey, setShowKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setClaudeApiKey(apiKeyInput.trim());
    } else {
      clearClaudeApiKey();
    }
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  if (!household) return null;

  return (
    <div className="min-h-screen pb-24" style={{ background: '#FBFAF8' }}>
      <div className="max-w-lg mx-auto px-4">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="pt-5 mb-4">
          <h1 className="font-serif text-[22px] font-bold" style={{ color: '#1A1812' }}>La mia famiglia</h1>
          <p className="text-sm" style={{ color: '#9C9485' }}>{household.name}</p>
        </div>

        {/* ── Family overview card ─────────────────────────────── */}
        <div
          className="rounded-3xl p-5 mb-4 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #6B9E7A 0%, #4D7A5A 100%)' }}
        >
          <div className="absolute top-[-20px] right-[-20px] w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.7 }}>Famiglia</p>
          <p className="font-serif text-xl font-bold mb-3">{household.name}</p>
          <div className="flex gap-2">
            {household.members.map((m) => (
              <div key={m.id} className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>

        {/* ── Profile cards ────────────────────────────────────── */}
        <div className="space-y-3 mb-4">
          {household.members.map((profile, idx) => (
            <button
              key={profile.id}
              onClick={() => navigate(`/profile/${profile.id}`)}
              className="w-full bg-white rounded-3xl px-4 py-4 text-left flex items-center gap-3 shadow-warm-sm transition hover:scale-[1.01]"
              style={{ border: '1px solid #EFEBE5' }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                style={{
                  background: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                  color: '#3F3B30',
                }}
              >
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold" style={{ color: '#1A1812' }}>{profile.name}</span>
                  {profile.id === currentProfile?.id && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: '#FDE8E2', color: '#C0604A' }}>
                      Attivo
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {profile.diet && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#E4F0E8', color: '#3D6B4A' }}>
                      {profile.diet}
                    </span>
                  )}
                  {profile.intolleranze?.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#FDE8E2', color: '#C0604A' }}>
                      {profile.intolleranze.length} intolleranz{profile.intolleranze.length === 1 ? 'a' : 'e'}
                    </span>
                  )}
                  {profile.obiettivi?.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#EDE9F6', color: '#5D5090' }}>
                      {profile.obiettivi[0]}
                    </span>
                  )}
                </div>
              </div>
              <svg className="w-5 h-5 shrink-0" style={{ color: '#D7D1C5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}

          {/* Add profile */}
          <button
            onClick={() => navigate('/profile/new')}
            className="w-full py-3.5 rounded-3xl text-sm font-medium flex items-center justify-center gap-2 transition"
            style={{ border: '2px dashed #D7D1C5', color: '#9C9485', background: 'transparent' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Aggiungi profilo
          </button>
        </div>

        {/* ── Impostazioni ─────────────────────────────────────── */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: '#9C9485' }}>
          Impostazioni
        </p>

        <div className="bg-white rounded-3xl p-4 shadow-warm-sm mb-3" style={{ border: '1px solid #EFEBE5' }}>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
              style={{ background: '#FDE8E2' }}>🤖</div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#1A1812' }}>Claude AI (Anthropic)</p>
              <p className="text-xs mt-0.5" style={{ color: '#9C9485' }}>
                Per piano alimentare, ricette e sostituzione ingredienti.
              </p>
            </div>
            {claudeApiKey && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                style={{ background: '#E4F0E8', color: '#3D6B4A' }}>
                ✓ Attiva
              </span>
            )}
          </div>
          <div className="relative mb-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={e => { setApiKeyInput(e.target.value); setApiKeySaved(false); }}
              placeholder="sk-ant-api03-..."
              className="w-full pr-10 pl-3 py-2.5 rounded-xl text-sm font-mono outline-none transition"
              style={{ border: '1.5px solid #D7D1C5', background: '#FBFAF8', color: '#1A1812' }}
            />
            <button type="button" onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9C9485' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showKey
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                }
              </svg>
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveApiKey}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition text-white"
              style={{ background: apiKeySaved ? '#6B9E7A' : '#E07A5F' }}>
              {apiKeySaved ? '✓ Salvata' : 'Salva API key'}
            </button>
            {claudeApiKey && (
              <button onClick={() => { clearClaudeApiKey(); setApiKeyInput(''); }}
                className="px-4 py-2.5 text-sm font-medium rounded-xl transition"
                style={{ border: '1.5px solid #fecaca', color: '#ef4444', background: 'transparent' }}>
                Rimuovi
              </button>
            )}
          </div>
        </div>

        {/* ── Logout ───────────────────────────────────────────── */}
        <button onClick={() => logout()}
          className="w-full py-3 text-sm font-medium rounded-3xl flex items-center justify-center gap-2 transition mt-2 mb-4"
          style={{ border: '1.5px solid #EFEBE5', color: '#9C9485', background: 'transparent' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Esci dalla famiglia
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
