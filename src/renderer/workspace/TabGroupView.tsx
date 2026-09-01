import { useWorkspace } from './store.js';
import { TabStrip } from './TabStrip.js';
import { PanelHeader } from './PanelHeader.js';
import { DropZones } from './DropZones.js';
import { getPanel } from '../panels/registry.js';
import type { GroupNode } from '@shared/workspace/index.js';

function PanelBody({ group }: { group: GroupNode }): React.JSX.Element {
  const tab = useWorkspace((state) => state.workspace.tabs[group.activeTab]);
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
    <div className="panelbody">
      <Component
        tabId={tab.id}
        state={tab.state}
        setState={(state) => setTabState(tab.id, state)}
      />
    </div>
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
      <PanelBody group={group} />
      <DropZones groupId={group.id} active={dragging} />
    </section>
  );
}
