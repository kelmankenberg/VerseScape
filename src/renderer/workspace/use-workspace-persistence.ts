import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from './store.js';
import type { Workspace } from '@shared/workspace/index.js';

const SAVE_DEBOUNCE_MS = 500;

/**
 * Restores the saved layout on mount and autosaves changes (FR-WS-07).
 *
 * Returns false until the load has settled, so the workspace does not flash a
 * default layout before the real one arrives.
 */
export function useWorkspacePersistence(): boolean {
  const workspace = useWorkspace((state) => state.workspace);
  const replaceWorkspace = useWorkspace((state) => state.replaceWorkspace);

  const [ready, setReady] = useState(false);
  const timer = useRef<number | null>(null);
  const lastSaved = useRef<Workspace | null>(null);

  useEffect(() => {
    let cancelled = false;

    void window.versescape.workspace.get().then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        lastSaved.current = result.data;
        replaceWorkspace(result.data);
      } else if (!result.ok) {
        console.error('[workspace] load failed:', result.message);
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [replaceWorkspace]);

  useEffect(() => {
    if (!ready || workspace === lastSaved.current) return;

    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      lastSaved.current = workspace;
      void window.versescape.workspace.save(workspace).then((result) => {
        if (!result.ok) console.error('[workspace] save failed:', result.message);
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [workspace, ready]);

  return ready;
}
