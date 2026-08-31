import { useEffect, useState } from 'react';
import type { AppInfo } from '@shared/ipc/contracts.js';
import './App.css';

type Status =
  { kind: 'loading' } | { kind: 'ready'; info: AppInfo } | { kind: 'error'; message: string };

/**
 * M0 verification surface: proves the sandboxed renderer can reach the main
 * process through the validated preload bridge and nothing else. Replaced by
 * the real app shell in M1.
 */
export function App(): React.JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void window.versescape.app.getInfo().then((result) => {
      if (cancelled) return;
      setStatus(
        result.ok
          ? { kind: 'ready', info: result.data }
          : { kind: 'error', message: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="boot">
      <h1 className="boot__title">VerseScape</h1>
      <p className="boot__tagline">Offline-first Bible study workspace</p>

      {status.kind === 'loading' && <p className="boot__muted">Connecting to the main process…</p>}

      {status.kind === 'error' && <p className="boot__error">IPC failed: {status.message}</p>}

      {status.kind === 'ready' && (
        <dl className="boot__facts">
          <dt>Version</dt>
          <dd>{status.info.version}</dd>
          <dt>Platform</dt>
          <dd>{status.info.platform}</dd>
          <dt>Electron</dt>
          <dd>{status.info.electron}</dd>
          <dt>Chromium</dt>
          <dd>{status.info.chrome}</dd>
          <dt>Node</dt>
          <dd>{status.info.node}</dd>
          <dt>Mode</dt>
          <dd>{status.info.isDev ? 'development' : 'production'}</dd>
        </dl>
      )}

      <p className="boot__milestone">Milestone M0 — foundations</p>
    </main>
  );
}
