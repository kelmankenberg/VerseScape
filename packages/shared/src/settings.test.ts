import { describe, expect, it } from 'vitest';
import {
  appSettings,
  defaultSettings,
  settingsPatch,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from './settings.js';

describe('app settings schema', () => {
  it('accepts the shipped defaults', () => {
    expect(appSettings.safeParse(defaultSettings).success).toBe(true);
  });

  it('rejects a window smaller than the minimum size', () => {
    const tooSmall = { ...defaultSettings, window: { ...defaultSettings.window, width: 100 } };
    expect(appSettings.safeParse(tooSmall).success).toBe(false);
  });

  it('allows a null window position, because Wayland withholds it', () => {
    const noPosition = {
      ...defaultSettings,
      window: { ...defaultSettings.window, x: null, y: null },
    };
    expect(appSettings.safeParse(noPosition).success).toBe(true);
  });

  it('clamps the sidebar width to the documented bounds', () => {
    const within = { ...defaultSettings.shell, sidebarWidth: SIDEBAR_MIN_WIDTH };
    const beyond = { ...defaultSettings.shell, sidebarWidth: SIDEBAR_MAX_WIDTH + 1 };
    expect(appSettings.shape.shell.safeParse(within).success).toBe(true);
    expect(appSettings.shape.shell.safeParse(beyond).success).toBe(false);
  });

  it('defaults to verse-per-line, per D-10', () => {
    expect(defaultSettings.reading.versePerLine).toBe(true);
  });
});

describe('settings patch schema', () => {
  it('accepts a single field from one section', () => {
    const parsed = settingsPatch.safeParse({ appearance: { theme: 'light' } });
    expect(parsed.success).toBe(true);
  });

  it('accepts an empty patch', () => {
    expect(settingsPatch.safeParse({}).success).toBe(true);
  });

  it('rejects unknown sections so typos cannot silently do nothing', () => {
    expect(settingsPatch.safeParse({ nope: { theme: 'light' } }).success).toBe(false);
  });

  it('rejects an invalid value inside a known section', () => {
    expect(settingsPatch.safeParse({ appearance: { theme: 'sepia' } }).success).toBe(false);
  });

  it('accepts a partial reading patch', () => {
    expect(settingsPatch.safeParse({ reading: { redLetter: false } }).success).toBe(true);
  });
});
