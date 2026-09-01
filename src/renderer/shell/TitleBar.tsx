import { PanelLeft, Search, Bell } from 'lucide-react';
import { useSettings } from '../stores/settings.js';
import { navItemFor } from './navigation.js';
import { WindowControls } from './WindowControls.js';
import { WorkspaceActions } from './WorkspaceActions.js';

export function TitleBar(): React.JSX.Element {
  const activePage = useSettings((state) => state.settings.shell.activePage);
  const toggleRail = useSettings((state) => state.toggleRail);
  const current = navItemFor(activePage);

  return (
    <header className="titlebar" role="banner">
      <div className="titlebar__left no-drag">
        <button
          type="button"
          className="icon-button"
          aria-label="Toggle navigation"
          title="Toggle navigation (Ctrl+B)"
          onClick={() => void toggleRail()}
        >
          <PanelLeft size={16} aria-hidden />
        </button>
      </div>

      <div className="titlebar__title">
        <span className="titlebar__brand">VerseScape</span>
        <span className="titlebar__separator" aria-hidden>
          ·
        </span>
        <span className="titlebar__context">{current.label}</span>
      </div>

      <div className="titlebar__search no-drag">
        <Search size={14} aria-hidden className="titlebar__search-icon" />
        <input
          type="search"
          className="titlebar__search-input"
          placeholder="Search or go to reference…"
          aria-label="Search or go to reference"
        />
        <kbd className="titlebar__kbd">Ctrl K</kbd>
      </div>

      <div className="titlebar__actions no-drag">
        {activePage === 'workspace' && <WorkspaceActions />}
        <button type="button" className="icon-button" aria-label="Notifications">
          <Bell size={16} aria-hidden />
        </button>
      </div>

      <div className="no-drag">
        <WindowControls />
      </div>
    </header>
  );
}
