import { screen } from 'electron';
import type { BrowserWindow } from 'electron';
import type { AppSettings } from '@shared/settings.js';
import { patchSettings } from '../services/settings.js';

export interface InitialBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

/** True when the saved position still lands on a currently connected display. */
function isOnSomeDisplay(x: number, y: number, width: number, height: number): boolean {
  return screen.getAllDisplays().some(({ workArea }) => {
    const overlapsHorizontally = x < workArea.x + workArea.width && x + width > workArea.x;
    const overlapsVertically = y < workArea.y + workArea.height && y + height > workArea.y;
    return overlapsHorizontally && overlapsVertically;
  });
}

/**
 * Position is restored only when it was recorded and still lands on a
 * connected display; otherwise Electron centres the window. Wayland never
 * reports a position, so this legitimately degrades to size-only (D-18).
 */
export function resolveInitialBounds(settings: AppSettings): InitialBounds {
  const { width, height, x, y } = settings.window;
  const bounds: InitialBounds = { width, height };

  if (x !== null && y !== null && isOnSomeDisplay(x, y, width, height)) {
    bounds.x = x;
    bounds.y = y;
  }

  return bounds;
}

/**
 * Persists geometry as the user moves and resizes. Only the un-maximized size
 * is recorded, so restoring from a maximized session gives a sane window.
 */
export function trackWindowState(window: BrowserWindow): void {
  const capture = (): void => {
    if (window.isDestroyed() || window.isFullScreen()) return;

    const maximized = window.isMaximized();
    if (maximized) {
      patchSettings({ window: { maximized: true } });
      return;
    }

    const { width, height, x, y } = window.getNormalBounds();
    patchSettings({
      window: {
        maximized: false,
        width,
        height,
        // A zero origin on Wayland means "unknown", not "top-left".
        x: x === 0 && y === 0 ? null : x,
        y: x === 0 && y === 0 ? null : y,
      },
    });
  };

  window.on('resized', capture);
  window.on('moved', capture);
  window.on('maximize', capture);
  window.on('unmaximize', capture);
  window.on('close', capture);
}
