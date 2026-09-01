import { BookOpen, Columns2, NotebookPen, Rows2 } from 'lucide-react';
import { useWorkspace } from '../workspace/store.js';
import { findGroupContainingTab } from '@shared/workspace/index.js';
import type { PanelProps } from './registry.js';

/**
 * Shown when a group has nothing meaningful in it, so the workspace is never a
 * blank rectangle with no way forward.
 */
export function PlaceholderPanel({ tabId }: PanelProps): React.JSX.Element {
  const workspace = useWorkspace((state) => state.workspace);
  const openPanel = useWorkspace((state) => state.openPanel);
  const splitGroup = useWorkspace((state) => state.splitGroup);
  const closeTab = useWorkspace((state) => state.closeTab);

  const groupId = findGroupContainingTab(workspace.root, tabId)?.id ?? workspace.focusedGroup;

  const open = (panelType: string): void => {
    openPanel(panelType, groupId);
    closeTab(tabId);
  };

  return (
    <div className="empty-panel">
      <p className="empty-panel__lead">This panel is empty.</p>

      <div className="empty-panel__actions">
        <button type="button" className="empty-panel__action" onClick={() => open('sample')}>
          <BookOpen size={16} aria-hidden />
          Open a reader
        </button>
        <button type="button" className="empty-panel__action" onClick={() => open('scratch')}>
          <NotebookPen size={16} aria-hidden />
          New scratch note
        </button>
      </div>

      <div className="empty-panel__actions">
        <button
          type="button"
          className="empty-panel__action empty-panel__action--quiet"
          onClick={() => splitGroup(groupId, 'row')}
        >
          <Columns2 size={16} aria-hidden />
          Split right
        </button>
        <button
          type="button"
          className="empty-panel__action empty-panel__action--quiet"
          onClick={() => splitGroup(groupId, 'column')}
        >
          <Rows2 size={16} aria-hidden />
          Split down
        </button>
      </div>
    </div>
  );
}
