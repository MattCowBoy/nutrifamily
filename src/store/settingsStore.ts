import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  claudeApiKey: string;
  setClaudeApiKey: (key: string) => void;
  clearClaudeApiKey: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      claudeApiKey: '',
      setClaudeApiKey: (key) => set({ claudeApiKey: key }),
      clearClaudeApiKey: () => set({ claudeApiKey: '' }),
    }),
    { name: 'nutrifamily-settings' }
  )
);
