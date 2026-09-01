import { useState } from 'react';
import { ChevronDown, Columns2, Plus, Rows2 } from 'lucide-react';
import { useWorkspace } from '../workspace/store.js';
import { creatablePanels } from '../panels/registry.js';

/** Workspace-level actions in the global toolbar (doc 04). */
export function WorkspaceActions(): React.JSX.Element {
  const openPanel = useWorkspace((state) => state.openPanel);
  const splitGroup = useWorkspace((state) => state.splitGroup);
  const focusedGroup = useWorkspace((state) => state.workspace.focusedGroup);
  const [open, setOpen] = useState(false);

  return (
    <div className="toolbar-actions">
      <div className="menu">
        <button
          type="button"
          className="toolbar-button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Plus size={14} aria-hidden />
          New Panel
          <ChevronDown size={13} aria-hidden />
        </button>

        {open && (
          <div className="menu__list" role="menu">
            {creatablePanels().map((panel) => {
              const Icon = panel.icon;
              return (
                <button
                  key={panel.type}
                  type="button"
                  role="menuitem"
                  className="menu__item"
                  onClick={() => {
                    openPanel(panel.type, focusedGroup);
                    setOpen(false);
                  }}
                >
                  <Icon size={14} aria-hidden />
                  {panel.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        className="toolbar-button"
        title="Split right (Ctrl+\)"
        onClick={() => splitGroup(focusedGroup, 'row')}
      >
        <Columns2 size={14} aria-hidden />
      </button>

      <button
        type="button"
        className="toolbar-button"
        title="Split down (Ctrl+Shift+\)"
        onClick={() => splitGroup(focusedGroup, 'column')}
      >
        <Rows2 size={14} aria-hidden />
      </button>
    </div>
  );
}
