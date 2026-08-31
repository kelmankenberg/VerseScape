import { create } from 'zustand';
import type { AppSettings, PageId, SettingsPatch, ThemePreference } from '@shared/settings.js';
import { defaultSettings } from '@shared/settings.js';

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  patch: (patch: SettingsPatch) => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setActivePage: (page: PageId) => Promise<void>;
  toggleRail: () => Promise<void>;
  setSidebarOpen: (open: boolean) => Promise<void>;
  setSidebarWidth: (width: number) => Promise<void>;
}

/** Spreading a partial would reintroduce explicit `undefined` values, which
 * `exactOptionalPropertyTypes` rejects. */
type Loose<T> = { [K in keyof T]?: T[K] | undefined };

function mergeDefined<T extends object>(base: T, patch: Loose<T> | undefined): T {
  if (!patch) return base;
  const result = { ...base } as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) result[key] = value;
  }
  return result as unknown as T;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  load: async () => {
    const result = await window.versescape.settings.get();
    if (result.ok) {
      set({ settings: result.data, loaded: true });
    } else {
      console.error('[settings] load failed:', result.message);
      set({ loaded: true });
    }
  },

  // Applied optimistically so the UI never waits on disk, then reconciled with
  // whatever main actually persisted.
  patch: async (patch) => {
    const previous = get().settings;
    set({
      settings: {
        ...previous,
        appearance: mergeDefined(previous.appearance, patch.appearance),
        shell: mergeDefined(previous.shell, patch.shell),
        window: mergeDefined(previous.window, patch.window),
      },
    });

    const result = await window.versescape.settings.patch(patch);
    if (result.ok) {
      set({ settings: result.data });
    } else {
      console.error('[settings] patch failed:', result.message);
      set({ settings: previous });
    }
  },

  setTheme: (theme) => get().patch({ appearance: { theme } }),
  setActivePage: (activePage) => get().patch({ shell: { activePage } }),
  toggleRail: () => get().patch({ shell: { railExpanded: !get().settings.shell.railExpanded } }),
  setSidebarOpen: (sidebarOpen) => get().patch({ shell: { sidebarOpen } }),
  setSidebarWidth: (sidebarWidth) => get().patch({ shell: { sidebarWidth } }),
}));
