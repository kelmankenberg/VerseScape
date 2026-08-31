import { useEffect, useState } from 'react';
import type { AppInfo } from '@shared/ipc/contracts.js';
import { useSettings } from '../stores/settings.js';
import { navItemFor } from './navigation.js';

export function StatusBar(): React.JSX.Element | null {
  const visible = useSettings((state) => state.settings.shell.statusBarVisible);
  const activePage = useSettings((state) => state.settings.shell.activePage);
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.versescape.app.getInfo().then((result) => {
      if (!cancelled && result.ok) setInfo(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <footer className="statusbar" role="contentinfo">
      <span className="statusbar__item">{navItemFor(activePage).label}</span>
      <span className="statusbar__spacer" />
      <span className="statusbar__item statusbar__item--muted">Offline</span>
      {info && <span className="statusbar__item statusbar__item--muted">v{info.version}</span>}
    </footer>
  );
}
