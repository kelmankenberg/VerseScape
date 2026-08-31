import { useEffect, useState } from 'react';
import type { WindowState } from '@shared/ipc/contracts.js';

const initial: WindowState = { isMaximized: false, isFullScreen: false, isFocused: true };

/** Mirrors the main-process window state so the custom chrome can react to it. */
export function useWindowState(): WindowState {
  const [state, setState] = useState<WindowState>(initial);

  useEffect(() => {
    let cancelled = false;

    void window.versescape.window.getState().then((result) => {
      if (!cancelled && result.ok) setState(result.data);
    });

    const unsubscribe = window.versescape.window.onStateChanged(setState);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
