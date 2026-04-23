import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { UserProfile } from '../../types';

export default function ProfilesPage() {
  const navigate = useNavigate();
  const { household, setCurrentProfile } = useAuthStore();
  const [members, setMembers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!household) {
      navigate('/login');
      return;
    }
    setMembers(household.members || []);
  }, [household, navigate]);

  const handleSelectProfile = (profile: UserProfile) => {
    setCurrentProfile(profile);
    navigate('/');
  };

  if (!household) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-3 shadow-md">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{household.name}</h2>
          <p className="text-gray-500 text-sm mt-1">Chi sta usando l'app?</p>
        </div>

        {/* Profiles Grid */}
        {members.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {members.map((profile) => (
              <div key={profile.id} className="relative group">
                <button
                  onClick={() => handleSelectProfile(profile)}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all flex flex-col items-center gap-2"
                >
                  <div className={`w-14 h-14 ${profile.avatar || 'bg-gray-300'} rounded-full flex items-center justify-center text-white text-xl font-bold`}>
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-800 text-center leading-tight">{profile.name}</span>
                  {profile.role === 'admin' && (
                    <span className="text-xs text-primary-600 font-medium">Admin</span>
                  )}
                  {profile.intolleranze?.length > 0 && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      {profile.intolleranze.length} intolleranz{profile.intolleranze.length === 1 ? 'a' : 'e'}
                    </span>
                  )}
                </button>
                {/* Edit button */}
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/profile/${profile.id}`); }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 border border-gray-100 text-gray-400 hover:text-primary-600 hover:border-primary-200 transition opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Profile */}
        <button
          onClick={() => navigate('/profile/new')}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-primary-300 hover:text-primary-500 transition flex items-center justify-center gap-2 text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {members.length === 0 ? 'Aggiungi il primo profilo' : 'Aggiungi profilo'}
        </button>

        {/* Logout */}
        <button
          onClick={() => useAuthStore.getState().logout()}
          className="w-full mt-4 py-2 text-gray-400 text-sm hover:text-gray-600 transition"
        >
          Cambia famiglia
        </button>
      </div>
    </div>
  );
}
