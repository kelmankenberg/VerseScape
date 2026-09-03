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
  setSyncSetVerse,
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
  /** Who last published to a sync set; used to suppress the origin's own echo. */
  syncOrigin: { tabId: TabId; at: number } | null;
  /** Most-recently-active tabs, capped at MOUNT_LIMIT (D-14). */
  mounted: TabId[];
  openPanel: (panelType: string, targetGroup?: NodeId, state?: JsonValue) => void;
  openOrNavigateBible: (state: JsonValue) => void;
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
  publishVerse: (tabId: TabId, verseKey: number) => void;
  navigateTab: (tabId: TabId, verseKey: number, reference: string, patch?: JsonValue) => void;
  followTab: (tabId: TabId, verseKey: number, reference: string) => void;
  replaceWorkspace: (workspace: Workspace) => void;
}

/** Live panels per window before the least-recently-used one unmounts (D-14). */
export const MOUNT_LIMIT = 8;

function promote(mounted: TabId[], tabId: TabId): TabId[] {
  return [tabId, ...mounted.filter((id) => id !== tabId)].slice(0, MOUNT_LIMIT);
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
    syncOrigin: null,
    mounted: [],

    openPanel: (panelType, targetGroup, state) =>
      apply('openPanel', (w) => {
        if (panelType === 'strongs' || panelType === 'search-results' || panelType === 'notes') {
          const existing = Object.values(w.tabs).find((tab) => tab.panelType === panelType);
          if (existing) {
            let next = activateTab(w, existing.id, ctx);
            if (state !== undefined) next = setTabState(next, existing.id, state, ctx);
            return next;
          }
        }

        return openPanel(
          w,
          {
            panelType,
            ...(state === undefined ? {} : { state }),
            ...(targetGroup ? { targetGroup } : {}),
          },
          ctx,
        );
      }),
    openOrNavigateBible: (state) =>
      apply('openOrNavigateBible', (w) => {
        const requestedState =
          typeof state === 'object' && state !== null && !Array.isArray(state) ? state : {};
        const requestedResourceId =
          typeof requestedState['resourceId'] === 'string'
            ? requestedState['resourceId']
            : 'bsb';
        const existing = Object.values(w.tabs).find((tab) => {
          if (tab.panelType !== 'sample') return false;
          if (!requestedResourceId) return true;
          if (typeof tab.state !== 'object' || tab.state === null || Array.isArray(tab.state)) {
            return requestedResourceId === 'bsb';
          }
          const existingResourceId =
            typeof tab.state['resourceId'] === 'string' ? tab.state['resourceId'] : 'bsb';
          return existingResourceId === requestedResourceId;
        });
        if (existing) {
          let next = activateTab(w, existing.id, ctx);
          const existingState =
            typeof existing.state === 'object' &&
            existing.state !== null &&
            !Array.isArray(existing.state)
              ? existing.state
              : {};
          next = setTabState(next, existing.id, { ...existingState, ...requestedState }, ctx);
          return next;
        }
        return openPanel(w, { panelType: 'sample', state }, ctx);
      }),
    closeTab: (tabId) => apply('closeTab', (w) => closeTab(w, tabId, ctx)),
    reopenLastClosed: () => apply('reopenLastClosed', (w) => reopenLastClosed(w, ctx)),
    activateTab: (tabId) => {
      set((state) => ({ mounted: promote(state.mounted, tabId) }));
      apply('activateTab', (w) => activateTab(w, tabId, ctx));
    },
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

    publishVerse: (tabId, verseKey) =>
      set((state) => {
        const syncSet = state.workspace.tabs[tabId]?.syncSet;
        if (!syncSet) return state;
        if (state.workspace.syncSets[syncSet].verseKey === verseKey) return state;

        const next = setSyncSetVerse(state.workspace, syncSet, verseKey, ctx);
        return { workspace: next, syncOrigin: { tabId, at: Date.now() } };
      }),

    navigateTab: (tabId, verseKey, reference, patch) =>
      set((state) => {
        const tab = state.workspace.tabs[tabId];
        if (!tab) return state;

        const base = typeof tab.state === 'object' && tab.state !== null ? tab.state : {};
        let next = setTabState(
          state.workspace,
          tabId,
          {
            ...(base as Record<string, JsonValue>),
            reference,
            verseKey,
            ...(typeof patch === 'object' && patch !== null && !Array.isArray(patch)
              ? patch
              : {}),
          },
          ctx,
        );

        if (tab.syncSet) {
          next = setSyncSetVerse(next, tab.syncSet, verseKey, ctx);
          for (const partner of Object.values(next.tabs)) {
            if (partner.id === tabId || partner.syncSet !== tab.syncSet) continue;
            const partnerState =
              typeof partner.state === 'object' && partner.state !== null ? partner.state : {};
            next = setTabState(
              next,
              partner.id,
              { ...(partnerState as Record<string, JsonValue>), reference, verseKey },
              ctx,
            );
          }
        }
        if (import.meta.env.DEV) assertValid(next, 'navigateTab');

        return { workspace: next, syncOrigin: { tabId, at: Date.now() } };
      }),

    followTab: (tabId, verseKey, reference) =>
      apply('followTab', (workspace) => {
        const tab = workspace.tabs[tabId];
        if (!tab) return workspace;
        const base = typeof tab.state === 'object' && tab.state !== null ? tab.state : {};
        return setTabState(
          workspace,
          tabId,
          { ...(base as Record<string, JsonValue>), reference, verseKey },
          ctx,
        );
      }),

    replaceWorkspace: (workspace) => set({ workspace, syncOrigin: null, mounted: [] }),
  };
});
