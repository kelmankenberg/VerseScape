import { useCallback, useEffect, useRef } from 'react';
import { useWorkspace } from './store.js';
import type { TabId } from '@shared/workspace/index.js';

/** Window after a programmatic scroll during which we ignore scroll events. */
const ECHO_GUARD_MS = 160;

function verseAtViewportTop(container: HTMLElement): number | null {
  const top = container.getBoundingClientRect().top;
  const lines = container.querySelectorAll<HTMLElement>('[data-verse]');

  let candidate: number | null = null;
  for (const line of lines) {
    const rect = line.getBoundingClientRect();
    // First line whose bottom is still below the container's top edge.
    if (rect.bottom > top + 1) {
      const value = Number(line.dataset['verse']);
      candidate = Number.isFinite(value) ? value : null;
      break;
    }
  }
  return candidate;
}

/**
 * Two-way verse sync for a scrollable panel (FR-WS-13..16).
 *
 * The panel publishes the verse at its viewport top as the user scrolls, and
 * follows the set when another panel publishes. `onNavigate` is called when the
 * target verse is not currently rendered, so the panel can load the right
 * chapter; the hook retries once it appears.
 */
export function useVerseSync({
  tabId,
  containerRef,
  onNavigate,
}: {
  tabId: TabId;
  containerRef: React.RefObject<HTMLElement | null>;
  onNavigate?: (verseKey: number) => void;
}): void {
  const syncSet = useWorkspace((state) => state.workspace.tabs[tabId]?.syncSet ?? null);
  const setVerse = useWorkspace((state) =>
    syncSet ? state.workspace.syncSets[syncSet].verseKey : null,
  );
  const origin = useWorkspace((state) => state.syncOrigin);
  const publishVerse = useWorkspace((state) => state.publishVerse);

  const suppressUntil = useRef(0);
  const pending = useRef<number | null>(null);
  const frame = useRef<number | null>(null);

  const scrollToVerse = useCallback(
    (verseKey: number): boolean => {
      const container = containerRef.current;
      if (!container) return false;

      const target = container.querySelector<HTMLElement>(`[data-verse="${verseKey}"]`);
      if (!target) return false;

      // Followers align the target to the top, always, and without animation (D-25).
      suppressUntil.current = Date.now() + ECHO_GUARD_MS;
      container.scrollTop +=
        target.getBoundingClientRect().top - container.getBoundingClientRect().top;
      return true;
    },
    [containerRef],
  );

  // Follow the set.
  useEffect(() => {
    if (!syncSet || setVerse === null) return;
    if (origin?.tabId === tabId) return;

    if (!scrollToVerse(setVerse)) {
      pending.current = setVerse;
      onNavigate?.(setVerse);
    } else {
      pending.current = null;
    }
  }, [syncSet, setVerse, origin, tabId, scrollToVerse, onNavigate]);

  // Retry once the panel has rendered the chapter containing the target.
  useEffect(() => {
    if (pending.current !== null && scrollToVerse(pending.current)) {
      pending.current = null;
    }
  });

  // Publish while scrolling.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !syncSet) return;

    const onScroll = (): void => {
      if (Date.now() < suppressUntil.current) return;
      if (frame.current !== null) return;

      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const verse = verseAtViewportTop(container);
        if (verse !== null) publishVerse(tabId, verse);
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [containerRef, syncSet, tabId, publishVerse]);
}
