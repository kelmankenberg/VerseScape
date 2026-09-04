import { z } from 'zod';

/** Pages that can occupy the main page area (FR-SH-07). */
export const pageIds = [
  'dashboard',
  'workspace',
  'library',
  'notes',
  'plans',
  'settings',
  'account',
] as const;

export const pageId = z.enum(pageIds);
export type PageId = z.infer<typeof pageId>;

export const themePreference = z.enum(['dark', 'light', 'system']);
export type ThemePreference = z.infer<typeof themePreference>;

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 280;

/**
 * Window geometry. `x`/`y` are nullable because Wayland withholds absolute
 * position (decision D-18); restoring position is best-effort.
 */
export const windowStateSettings = z.object({
  width: z.number().int().min(940),
  height: z.number().int().min(600),
  x: z.number().int().nullable(),
  y: z.number().int().nullable(),
  maximized: z.boolean(),
});
export type WindowStateSettings = z.infer<typeof windowStateSettings>;

/** Per-panel overridable Bible/commentary display options (FR-RD-05). */
export const bibleDisplayOptions = z.object({
  /** Verse-per-line is the D-10 default; false groups same-paragraph verses. */
  versePerLine: z.boolean(),
  redLetter: z.boolean(),
  showFootnotes: z.boolean(),
  showHeadings: z.boolean(),
  showCrossReferences: z.boolean(),
});
export type BibleDisplayOptions = z.infer<typeof bibleDisplayOptions>;

export const defaultBibleDisplayOptions: BibleDisplayOptions = {
  versePerLine: true,
  redLetter: true,
  showFootnotes: true,
  showHeadings: true,
  showCrossReferences: true,
};

export const appSettings = z.object({
  version: z.literal(1),
  appearance: z.object({
    theme: themePreference,
  }),
  shell: z.object({
    railExpanded: z.boolean(),
    sidebarOpen: z.boolean(),
    sidebarWidth: z.number().int().min(SIDEBAR_MIN_WIDTH).max(SIDEBAR_MAX_WIDTH),
    statusBarVisible: z.boolean(),
    activePage: pageId,
  }),
  window: windowStateSettings,
  reading: bibleDisplayOptions,
  library: z.object({
    disabledResourceIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)),
    location: z.string().min(1).nullable(),
  }),
});
export type AppSettings = z.infer<typeof appSettings>;

export const defaultSettings: AppSettings = {
  version: 1,
  appearance: { theme: 'system' },
  shell: {
    railExpanded: true,
    sidebarOpen: false,
    sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
    statusBarVisible: true,
    activePage: 'dashboard',
  },
  window: { width: 1360, height: 900, x: null, y: null, maximized: false },
  reading: defaultBibleDisplayOptions,
  library: { disabledResourceIds: [], location: null },
};

/** Patches are section-wise partials so a caller can update one field safely. */
export const settingsPatch = z
  .object({
    appearance: appSettings.shape.appearance.partial(),
    shell: appSettings.shape.shell.partial(),
    window: windowStateSettings.partial(),
    reading: bibleDisplayOptions.partial(),
    library: appSettings.shape.library.partial(),
  })
  .partial()
  .strict();
export type SettingsPatch = z.infer<typeof settingsPatch>;
