import { useDraggable } from '@dnd-kit/core';
import { X } from 'lucide-react';
import { useWorkspace } from './store.js';
import { getPanel } from '../panels/registry.js';
import { DEFAULT_SYNC_SET_COLOURS } from '@shared/workspace/index.js';
import type { GroupNode, Tab } from '@shared/workspace/index.js';

function tabLabel(tab: Tab): string {
  return tab.title ?? getPanel(tab.panelType)?.title ?? tab.panelType;
}

function TabButton({ tab, group }: { tab: Tab; group: GroupNode }): React.JSX.Element {
  const activateTab = useWorkspace((state) => state.activateTab);
  const closeTab = useWorkspace((state) => state.closeTab);
  const active = group.activeTab === tab.id;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tab:${tab.id}`,
    data: { tabId: tab.id, fromGroup: group.id },
  });

  const Icon = getPanel(tab.panelType)?.icon;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`tab${active ? ' tab--active' : ''}${isDragging ? ' tab--dragging' : ''}`}
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      // Activation is on click, not pointerdown: dnd-kit owns pointerdown, and
      // overriding it silently disables tab dragging.
      onClick={() => activateTab(tab.id)}
    >
      {Icon && <Icon size={13} aria-hidden className="tab__icon" />}
      <span className="tab__label">{tabLabel(tab)}</span>

      {tab.syncSet && (
        <span
          className="tab__sync"
          style={{ background: DEFAULT_SYNC_SET_COLOURS[tab.syncSet] }}
          title={`Sync set ${tab.syncSet}`}
        >
          {tab.syncSet}
        </span>
      )}

      <button
        type="button"
        className="tab__close"
        aria-label={`Close ${tabLabel(tab)}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          closeTab(tab.id);
        }}
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}

export function TabStrip({ group }: { group: GroupNode }): React.JSX.Element {
  const tabs = useWorkspace((state) => state.workspace.tabs);

  return (
    <div className="tabstrip" role="tablist" aria-label="Panels">
      {group.tabs.map((tabId) => {
        const tab = tabs[tabId];
        return tab ? <TabButton key={tabId} tab={tab} group={group} /> : null;
      })}
    </div>
  );
}
