import { app } from 'electron';
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { appSettings, defaultSettings, settingsPatch } from '@shared/settings.js';
import type { AppSettings, SettingsPatch } from '@shared/settings.js';

let cached: AppSettings | null = null;
let flushTimer: NodeJS.Timeout | null = null;

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

/**
 * Merges stored values over the defaults one section at a time, so a settings
 * file written by an older version keeps working when new keys are added.
 */
function coerce(raw: unknown): AppSettings {
  if (typeof raw !== 'object' || raw === null) return structuredClone(defaultSettings);
  const candidate = raw as Record<string, unknown>;

  const merged = {
    ...defaultSettings,
    ...candidate,
    version: 1,
    appearance: { ...defaultSettings.appearance, ...(candidate['appearance'] as object) },
    shell: { ...defaultSettings.shell, ...(candidate['shell'] as object) },
    window: { ...defaultSettings.window, ...(candidate['window'] as object) },
  };

  const parsed = appSettings.safeParse(merged);
  if (parsed.success) return parsed.data;

  console.warn('[settings] stored settings were invalid; falling back to defaults');
  return structuredClone(defaultSettings);
}

export function loadSettings(): AppSettings {
  if (cached) return cached;

  const file = settingsPath();
  if (!existsSync(file)) {
    cached = structuredClone(defaultSettings);
    return cached;
  }

  try {
    cached = coerce(JSON.parse(readFileSync(file, 'utf8')));
  } catch (cause) {
    console.warn('[settings] could not read settings.json; using defaults', cause);
    cached = structuredClone(defaultSettings);
  }
  return cached;
}

/** Write via a temp file and rename so a crash cannot leave a truncated file. */
function writeNow(value: AppSettings): void {
  const file = settingsPath();
  const temp = `${file}.tmp`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(temp, file);
  } catch (cause) {
    console.error('[settings] failed to persist settings', cause);
    if (existsSync(temp)) {
      try {
        unlinkSync(temp);
      } catch {
        /* best effort */
      }
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (cached) writeNow(cached);
  }, 400);
}

export function patchSettings(patch: SettingsPatch): AppSettings {
  const validated = settingsPatch.parse(patch);
  const current = loadSettings();

  cached = appSettings.parse({
    ...current,
    appearance: { ...current.appearance, ...validated.appearance },
    shell: { ...current.shell, ...validated.shell },
    window: { ...current.window, ...validated.window },
  });

  scheduleFlush();
  return cached;
}

/** Called on quit so a pending debounced write is not lost. */
export function flushSettings(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (cached) writeNow(cached);
}
