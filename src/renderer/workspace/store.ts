import { create } from 'zustand';
import {
  activateTab,
  assertValid,
  closeTab,
  createWorkspace,
  dropTabOnEdge,
  focusGroup,
  moveTab,
  openPanel,
  reopenLastClosed,
  resizeSplit,
  setSyncSet,
  setTabState,
  splitGroup,
  toggleMaximize,
} from '@shared/workspace/index.js';
import type {
  Direction,
  Edge,
  JsonValue,
  NodeId,
  SyncSetId,
  TabId,
  Workspace,
  WorkspaceContext,
} from '@shared/workspace/index.js';

const ctx: WorkspaceContext = {
  newId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

interface WorkspaceStore {
  workspace: Workspace;
  openPanel: (panelType: string, targetGroup?: NodeId) => void;
  closeTab: (tabId: TabId) => void;
  reopenLastClosed: () => void;
  activateTab: (tabId: TabId) => void;
  focusGroup: (groupId: NodeId) => void;
  moveTab: (tabId: TabId, toGroup: NodeId, index?: number) => void;
  splitGroup: (groupId: NodeId, direction: Direction, panelType?: string) => void;
  dropTabOnEdge: (tabId: TabId, groupId: NodeId, edge: Edge) => void;
  resizeSplit: (splitId: NodeId, sizes: number[]) => void;
  setSyncSet: (tabId: TabId, syncSet: SyncSetId | null) => void;
  setTabState: (tabId: TabId, state: JsonValue) => void;
  toggleMaximize: (groupId: NodeId) => void;
}

export const useWorkspace = create<WorkspaceStore>((set) => {
  // Every mutation is checked in dev builds: a violation here is a reducer bug.
  const apply = (name: string, fn: (workspace: Workspace) => Workspace): void =>
    set((state) => {
      const next = fn(state.workspace);
      if (import.meta.env.DEV && next !== state.workspace) assertValid(next, name);
      return next === state.workspace ? state : { workspace: next };
    });

  return {
    workspace: createWorkspace(ctx, { name: 'Study', panelType: 'placeholder' }),

    openPanel: (panelType, targetGroup) =>
      apply('openPanel', (w) =>
        openPanel(w, { panelType, ...(targetGroup ? { targetGroup } : {}) }, ctx),
      ),
    closeTab: (tabId) => apply('closeTab', (w) => closeTab(w, tabId, ctx)),
    reopenLastClosed: () => apply('reopenLastClosed', (w) => reopenLastClosed(w, ctx)),
    activateTab: (tabId) => apply('activateTab', (w) => activateTab(w, tabId, ctx)),
    focusGroup: (groupId) => apply('focusGroup', (w) => focusGroup(w, groupId, ctx)),
    moveTab: (tabId, toGroup, index) =>
      apply('moveTab', (w) =>
        moveTab(w, { tabId, toGroup, ...(index === undefined ? {} : { index }) }, ctx),
      ),
    splitGroup: (groupId, direction, panelType) =>
      apply('splitGroup', (w) =>
        splitGroup(w, { groupId, direction, panelType: panelType ?? 'placeholder' }, ctx),
      ),
    dropTabOnEdge: (tabId, groupId, edge) =>
      apply('dropTabOnEdge', (w) => dropTabOnEdge(w, { tabId, groupId, edge }, ctx)),
    resizeSplit: (splitId, sizes) =>
      apply('resizeSplit', (w) => resizeSplit(w, { splitId, sizes }, ctx)),
    setSyncSet: (tabId, syncSet) => apply('setSyncSet', (w) => setSyncSet(w, tabId, syncSet, ctx)),
    setTabState: (tabId, state) => apply('setTabState', (w) => setTabState(w, tabId, state, ctx)),
    toggleMaximize: (groupId) => apply('toggleMaximize', (w) => toggleMaximize(w, groupId, ctx)),
  };
});
