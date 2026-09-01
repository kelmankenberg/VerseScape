import { useWorkspace, MOUNT_LIMIT } from './store.js';
import { TabStrip } from './TabStrip.js';
import { PanelHeader } from './PanelHeader.js';
import { DropZones } from './DropZones.js';
import { getPanel } from '../panels/registry.js';
import type { GroupNode, TabId } from '@shared/workspace/index.js';

function MountedPanel({ tabId, visible }: { tabId: TabId; visible: boolean }): React.JSX.Element {
  const tab = useWorkspace((state) => state.workspace.tabs[tabId]);
  const setTabState = useWorkspace((state) => state.setTabState);

  if (!tab) return <div className="panelbody panelbody--error">Missing tab record.</div>;

  const descriptor = getPanel(tab.panelType);
  if (!descriptor) {
    return (
      <div className="panelbody panelbody--error">
        Unknown panel type <code>{tab.panelType}</code>.
      </div>
    );
  }

  const Component = descriptor.component;
  return (
    <div className="panelbody" hidden={!visible} aria-hidden={!visible}>
      <Component
        tabId={tab.id}
        state={tab.state}
        setState={(state) => setTabState(tab.id, state)}
      />
    </div>
  );
}

/**
 * Renders the active tab plus any other tab still inside the LRU window, hidden
 * (D-14). Panels beyond the cap unmount; their state lives in the workspace, so
 * remounting restores them.
 */
function PanelArea({ group }: { group: GroupNode }): React.JSX.Element {
  const mounted = useWorkspace((state) => state.mounted);

  const live = group.tabs.filter(
    (tabId) => tabId === group.activeTab || mounted.slice(0, MOUNT_LIMIT).includes(tabId),
  );

  return (
    <>
      {live.map((tabId) => (
        <MountedPanel key={tabId} tabId={tabId} visible={tabId === group.activeTab} />
      ))}
    </>
  );
}

export function TabGroupView({
  group,
  dragging,
}: {
  group: GroupNode;
  dragging: boolean;
}): React.JSX.Element {
  const focusGroup = useWorkspace((state) => state.focusGroup);
  const focused = useWorkspace((state) => state.workspace.focusedGroup === group.id);
  const tab = useWorkspace((state) => state.workspace.tabs[group.activeTab]);

  return (
    <section
      className={`tabgroup${focused ? ' tabgroup--focused' : ''}`}
      data-group-id={group.id}
      onPointerDownCapture={() => focusGroup(group.id)}
    >
      <TabStrip group={group} />
      {tab && <PanelHeader group={group} tab={tab} />}
      <PanelArea group={group} />
      <DropZones groupId={group.id} active={dragging} />
    </section>
  );
}
