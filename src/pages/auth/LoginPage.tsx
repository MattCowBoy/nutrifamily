import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, nameToEmail } from '../../lib/firebase';
import type { Household } from '../../types';

type View = 'login' | 'register';

function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Nome famiglia o password errati.';
    case 'auth/email-already-in-use':
      return 'Una famiglia con questo nome esiste già.';
    case 'auth/weak-password':
      return 'La password deve essere di almeno 6 caratteri.';
    case 'auth/network-request-failed':
      return 'Errore di rete. Controlla la connessione.';
    default:
      return 'Errore durante l\'operazione. Riprova.';
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setHousehold } = useAuthStore();
  const [view, setView] = useState<View>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const email = nameToEmail(loginName.trim());
      const userCred = await signInWithEmailAndPassword(firebaseAuth, email, loginPassword);
      const uid = userCred.user.uid;

      const snap = await getDoc(doc(firestoreDb, 'households', uid));
      if (!snap.exists()) {
        setError('Dati famiglia non trovati. Contatta il supporto.');
        return;
      }
      const data = snap.data();
      const household: Household = {
        id: uid,
        name: data.name,
        passwordHash: '',
        members: data.members ?? [],
        createdAt: new Date(data.createdAt),
      };
      setHousehold(household);
      navigate('/profiles');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(authErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPassword !== regConfirm) {
      setError('Le password non coincidono.');
      return;
    }
    if (regPassword.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.');
      return;
    }
    if (!regName.trim()) {
      setError('Inserisci il nome della famiglia.');
      return;
    }
    setLoading(true);
    try {
      const email = nameToEmail(regName.trim());
      const userCred = await createUserWithEmailAndPassword(firebaseAuth, email, regPassword);
      const uid = userCred.user.uid;
      const createdAt = new Date().toISOString();

      await setDoc(doc(firestoreDb, 'households', uid), {
        id: uid,
        name: regName.trim(),
        members: [],
        createdAt,
      });

      const household: Household = {
        id: uid,
        name: regName.trim(),
        passwordHash: '',
        members: [],
        createdAt: new Date(createdAt),
      };
      setHousehold(household);
      navigate('/profiles');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(authErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-3xl mb-4 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">NutriFamily</h1>
        <p className="text-gray-500 mt-1">Il tuo piano alimentare di famiglia</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              view === 'login'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => { setView('login'); setError(''); }}
          >
            Accedi
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              view === 'register'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => { setView('register'); setError(''); }}
          >
            Registrati
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nome famiglia
              </label>
              <input
                type="text"
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
                placeholder="Es. Famiglia Rossi"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900 placeholder-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nome famiglia
              </label>
              <input
                type="text"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                placeholder="Es. Famiglia Rossi"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900 placeholder-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">Questo sarà il nome condiviso da tutta la famiglia</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                placeholder="Min. 6 caratteri"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Conferma password
              </label>
              <input
                type="password"
                value={regConfirm}
                onChange={e => setRegConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition text-gray-900 placeholder-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              {loading ? 'Registrazione...' : 'Crea famiglia'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        I tuoi dati sono sincronizzati nel cloud
      </p>
    </div>
  );
}
