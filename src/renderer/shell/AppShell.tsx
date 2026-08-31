import { useEffect } from 'react';
import { useSettings } from '../stores/settings.js';
import { useAppliedTheme } from '../theme/use-applied-theme.js';
import { TitleBar } from './TitleBar.js';
import { Rail } from './Rail.js';
import { Sidebar } from './Sidebar.js';
import { StatusBar } from './StatusBar.js';
import { PageRouter } from './PageRouter.js';
import './shell.css';

export function AppShell(): React.JSX.Element {
  const loaded = useSettings((state) => state.loaded);
  const load = useSettings((state) => state.load);
  const toggleRail = useSettings((state) => state.toggleRail);

  useAppliedTheme();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        void toggleRail();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleRail]);

  // Render nothing until settings arrive, so the shell does not flash the
  // default theme and rail state before the real ones load.
  if (!loaded) return <div className="shell shell--loading" />;

  return (
    <div className="shell">
      {/* Keeps the top window edge out of the drag region, or the platform
          resize border becomes unreachable. */}
      <div className="resize-guard" aria-hidden />
      <TitleBar />
      <div className="shell__body">
        <Rail />
        <Sidebar />
        <PageRouter />
      </div>
      <StatusBar />
    </div>
  );
}
