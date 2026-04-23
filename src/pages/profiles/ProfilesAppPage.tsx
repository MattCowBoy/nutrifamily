import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import BottomNav from '../../components/BottomNav';

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
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Profili famiglia</h1>
          <p className="text-sm text-gray-500">{household.name}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-3">
        {household.members.map(profile => (
          <button
            key={profile.id}
            onClick={() => navigate(`/profile/${profile.id}`)}
            className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 hover:border-primary-200 transition flex items-center gap-3"
          >
            <div className={`w-12 h-12 ${profile.avatar ?? 'bg-gray-300'} rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0`}>
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{profile.name}</span>
                {profile.id === currentProfile?.id && (
                  <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Attivo</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.diet && (
                  <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{profile.diet}</span>
                )}
                {profile.intolleranze?.length > 0 && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {profile.intolleranze.length} intolleranz{profile.intolleranze.length === 1 ? 'a' : 'e'}
                  </span>
                )}
                {profile.obiettivi?.length > 0 && (
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    {profile.obiettivi[0]}
                  </span>
                )}
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}

        <button
          onClick={() => navigate('/profile/new')}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-primary-300 hover:text-primary-500 transition flex items-center justify-center gap-2 text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi profilo
        </button>

        {/* ─── Impostazioni ─────────────────────────────────────────────────── */}
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">Impostazioni</h2>

          {/* Claude API Key */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center shrink-0 text-base">🤖</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Claude AI (Anthropic)</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Necessaria per piano alimentare, ricette e sostituzione ingredienti.
                </p>
              </div>
              {claudeApiKey && (
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5">
                  ✓ Attiva
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => { setApiKeyInput(e.target.value); setApiKeySaved(false); }}
                placeholder="sk-ant-api03-..."
                className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm bg-gray-50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveApiKey}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition ${
                  apiKeySaved
                    ? 'bg-green-500 text-white'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
              >
                {apiKeySaved ? '✓ Salvata' : 'Salva API key'}
              </button>
              {claudeApiKey && (
                <button
                  onClick={() => { clearClaudeApiKey(); setApiKeyInput(''); }}
                  className="px-4 py-2.5 text-sm text-red-400 font-medium rounded-xl border border-red-100 hover:bg-red-50 transition"
                >
                  Rimuovi
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Logout ───────────────────────────────────────────────────────── */}
        <div className="mt-4">
          <button
            onClick={() => logout()}
            className="w-full py-3 text-sm font-medium text-gray-400 rounded-2xl border border-gray-200 hover:bg-gray-50 hover:text-gray-600 transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Esci dalla famiglia
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
