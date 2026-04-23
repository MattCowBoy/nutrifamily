import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  INTOLLERANZE_LIST, OBIETTIVI_LIST, DIETE,
  type UserProfile, type DietType, type Gender,
} from '../../types';

const AVATAR_COLORS = [
  'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-green-400',
  'bg-teal-400', 'bg-blue-400', 'bg-violet-400', 'bg-pink-400',
];

function TagButton({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
        active
          ? 'bg-primary-600 border-primary-600 text-white'
          : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide text-primary-700">{title}</h3>
      {children}
    </div>
  );
}

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const { profileId } = useParams<{ profileId: string }>();
  const { household, saveHousehold, setCurrentProfile, currentProfile } = useAuthStore();

  const isNew = profileId === 'new';
  const existing = household?.members.find(m => m.id === profileId);

  const [name, setName] = useState(existing?.name ?? '');
  const [avatarColor, setAvatarColor] = useState(existing?.avatar ?? AVATAR_COLORS[0]);
  const [age, setAge] = useState(existing?.age?.toString() ?? '');
  const [weight, setWeight] = useState(existing?.weight?.toString() ?? '');
  const [height, setHeight] = useState(existing?.height?.toString() ?? '');
  const [gender, setGender] = useState<Gender | ''>(existing?.gender ?? '');
  const [diet, setDiet] = useState<DietType | ''>(existing?.diet ?? '');
  const [intolleranze, setIntolleranze] = useState<string[]>(existing?.intolleranze ?? []);
  const [obiettivi, setObiettivi] = useState<string[]>(existing?.obiettivi ?? []);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!household) {
    navigate('/login');
    return null;
  }

  if (!isNew && !existing) {
    navigate('/profiles');
    return null;
  }

  const toggleTag = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Il nome è obbligatorio.');
      return;
    }
    if (isSaving) return;
    setIsSaving(true);

    try {
      const profile: UserProfile = {
        id: isNew ? crypto.randomUUID() : existing!.id,
        name: name.trim(),
        avatar: avatarColor,
        role: isNew ? (household.members.length === 0 ? 'admin' : 'member') : existing!.role,
        createdAt: isNew ? new Date() : existing!.createdAt,
        age: age ? parseInt(age) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        height: height ? parseFloat(height) : undefined,
        gender: gender || undefined,
        diet: diet || undefined,
        intolleranze,
        obiettivi,
        note: note.trim() || undefined,
      };

      const updatedMembers = isNew
        ? [...household.members, profile]
        : household.members.map(m => m.id === profile.id ? profile : m);

      const updatedHousehold = { ...household, members: updatedMembers };
      await saveHousehold(updatedHousehold);

      if (isNew) {
        // Nuovo profilo → entra direttamente nell'app
        setCurrentProfile(profile);
        navigate('/');
      } else {
        // Modifica → aggiorna il currentProfile se è quello attivo
        if (currentProfile?.id === profile.id) {
          setCurrentProfile(profile);
        }
        navigate('/profili-app');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing || household.members.length === 1) return;
    const updatedMembers = household.members.filter(m => m.id !== existing.id);
    await saveHousehold({ ...household, members: updatedMembers });
    navigate('/profili-app');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate('/profiles')}
            className="p-2 rounded-xl hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-bold text-gray-900 text-lg flex-1">
            {isNew ? 'Nuovo profilo' : 'Modifica profilo'}
          </h1>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Salvo...
              </>
            ) : 'Salva'}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Avatar + Nome */}
        <Section title="Identità">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 ${avatarColor} rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0`}>
              {name ? name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                placeholder="Nome del membro"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900"
              />
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
          </div>
          {/* Color picker */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Colore avatar</p>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={`w-8 h-8 ${color} rounded-full transition-transform ${avatarColor === color ? 'scale-125 ring-2 ring-offset-2 ring-primary-500' : ''}`}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* Dati personali */}
        <Section title="Dati personali">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Età</label>
              <input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="—"
                min={1} max={120}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm text-center"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Peso (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="—"
                min={1} max={300} step={0.5}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm text-center"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Altezza (cm)</label>
              <input
                type="number"
                value={height}
                onChange={e => setHeight(e.target.value)}
                placeholder="—"
                min={50} max={250}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm text-center"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-2">Sesso</label>
            <div className="flex gap-2">
              {([{ v: 'M', l: 'Maschio' }, { v: 'F', l: 'Femmina' }, { v: 'altro', l: 'Altro' }] as { v: Gender; l: string }[]).map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setGender(gender === v ? '' : v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    gender === v
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Tipo di dieta */}
        <Section title="Tipo di dieta">
          <div className="flex flex-wrap gap-2">
            {DIETE.map(({ value, label }) => (
              <TagButton
                key={value}
                label={label}
                active={diet === value}
                onClick={() => setDiet(diet === value ? '' : value)}
              />
            ))}
          </div>
        </Section>

        {/* Intolleranze */}
        <Section title="Intolleranze & allergie">
          <div className="flex flex-wrap gap-2">
            {INTOLLERANZE_LIST.map(item => (
              <TagButton
                key={item}
                label={item}
                active={intolleranze.includes(item)}
                onClick={() => toggleTag(intolleranze, setIntolleranze, item)}
              />
            ))}
          </div>
        </Section>

        {/* Obiettivi */}
        <Section title="Obiettivi">
          <div className="flex flex-wrap gap-2">
            {OBIETTIVI_LIST.map(item => (
              <TagButton
                key={item}
                label={item}
                active={obiettivi.includes(item)}
                onClick={() => toggleTag(obiettivi, setObiettivi, item)}
              />
            ))}
          </div>
        </Section>

        {/* Note */}
        <Section title="Note per le ricette">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Es. preferisco piatti veloci, non mangio piccante, ho il diabete..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm resize-none"
          />
        </Section>

        {/* Elimina profilo */}
        {!isNew && household.members.length > 1 && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-3 border border-red-200 text-red-500 rounded-2xl text-sm font-medium hover:bg-red-50 transition"
          >
            Elimina profilo
          </button>
        )}
      </div>
    </div>
  );
}
