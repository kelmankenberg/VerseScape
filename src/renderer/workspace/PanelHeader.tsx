import { Link2, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from './store.js';
import { ReferenceInput } from './ReferenceInput.js';
import { getPanel } from '../panels/registry.js';
import { DEFAULT_SYNC_SET_COLOURS, SYNC_SET_IDS } from '@shared/workspace/index.js';
import type { GroupNode, SyncSetId, Tab } from '@shared/workspace/index.js';

function SyncSetPicker({ tab }: { tab: Tab }): React.JSX.Element {
  const setSyncSet = useWorkspace((state) => state.setSyncSet);
  const [open, setOpen] = useState(false);

  const choose = (id: SyncSetId | null): void => {
    setSyncSet(tab.id, id);
    setOpen(false);
  };

  return (
    <div className="syncpicker">
      <button
        type="button"
        className="syncpicker__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title={tab.syncSet ? `Sync set ${tab.syncSet}` : 'Not synced'}
        onClick={() => setOpen((value) => !value)}
        style={tab.syncSet ? { background: DEFAULT_SYNC_SET_COLOURS[tab.syncSet] } : undefined}
      >
        {tab.syncSet ?? <Link2 size={13} aria-hidden />}
      </button>

      {open && (
        <div className="syncpicker__menu" role="menu">
          {SYNC_SET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className="syncpicker__option"
              onClick={() => choose(id)}
            >
              <span
                className="syncpicker__swatch"
                style={{ background: DEFAULT_SYNC_SET_COLOURS[id] }}
                aria-hidden
              />
              Set {id}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="syncpicker__option"
            onClick={() => choose(null)}
          >
            <span className="syncpicker__swatch syncpicker__swatch--none" aria-hidden />
            None
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Per-panel header (D-25): reference input, sync-set badge and panel actions.
 * The reference input is inert until the parser lands in M2 step 6.
 */
export function PanelHeader({ group, tab }: { group: GroupNode; tab: Tab }): React.JSX.Element {
  const toggleMaximize = useWorkspace((state) => state.toggleMaximize);
  const maximized = useWorkspace((state) => state.workspace.maximizedGroup === group.id);
  const descriptor = getPanel(tab.panelType);

  return (
    <div className="panelheader">
      {descriptor?.hasReferenceInput ? (
        <ReferenceInput tabId={tab.id} />
      ) : (
        <span className="panelheader__title">{descriptor?.title ?? tab.panelType}</span>
      )}

      <div className="panelheader__actions">
        {descriptor?.linkable && <SyncSetPicker tab={tab} />}
        <button
          type="button"
          className="icon-button icon-button--small"
          aria-label={maximized ? 'Restore panel' : 'Maximize panel'}
          onClick={() => toggleMaximize(group.id)}
        >
          {maximized ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
