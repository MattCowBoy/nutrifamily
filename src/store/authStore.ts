import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firebaseAuth, firestoreDb } from '../lib/firebase';
import type { Household, UserProfile } from '../types';

interface AuthStore {
  household: Household | null;
  currentProfile: UserProfile | null;
  isAuthenticated: boolean;
  setHousehold: (household: Household) => void;
  saveHousehold: (household: Household) => Promise<void>;
  setCurrentProfile: (profile: UserProfile) => void;
  logout: () => Promise<void>;
  lockProfile: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      household: null,
      currentProfile: null,
      isAuthenticated: false,

      setHousehold: (household) => set({ household, isAuthenticated: true }),

      saveHousehold: async (household) => {
        set({ household, isAuthenticated: true });
        // Serializza le date prima di scrivere su Firestore
        const toFirestore = {
          id: household.id,
          name: household.name,
          createdAt: household.createdAt instanceof Date
            ? household.createdAt.toISOString()
            : household.createdAt,
          members: household.members.map(m => ({
            ...m,
            createdAt: m.createdAt instanceof Date
              ? m.createdAt.toISOString()
              : m.createdAt,
          })),
        };
        await setDoc(doc(firestoreDb, 'households', household.id), toFirestore);
      },

      setCurrentProfile: (profile) => set({ currentProfile: profile }),

      logout: async () => {
        await signOut(firebaseAuth);
        set({ household: null, currentProfile: null, isAuthenticated: false });
      },

      lockProfile: () => set({ currentProfile: null }),
    }),
    {
      name: 'nutrifamily-auth',
      partialize: (state) => ({
        household: state.household,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
