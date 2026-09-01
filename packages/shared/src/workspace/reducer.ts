import {
  DEFAULT_SYNC_SET_COLOURS,
  LAYOUT_VERSION,
  MAX_RECENTLY_CLOSED,
  MIN_SPLIT_FRACTION,
  SYNC_SET_IDS,
} from './types.js';
import type {
  Direction,
  Edge,
  GroupNode,
  JsonValue,
  LayoutNode,
  NodeId,
  SplitNode,
  SyncSetId,
  SyncSetState,
  Tab,
  TabId,
  Workspace,
  WorkspaceContext,
} from './types.js';
import {
  collectGroups,
  edgePlacesFirst,
  edgeToDirection,
  findGroup,
  findGroupContainingTab,
  findNode,
  isGroup,
  isSplit,
  normalise,
  removeNode,
  replaceNode,
} from './tree.js';

/**
 * Pure reducers over `Workspace` (doc 05). Every exported function returns a new
 * workspace and never mutates its input, which is what makes the layout engine
 * testable without a DOM and undoable by snapshot.
 */

function touch(workspace: Workspace, ctx: WorkspaceContext, root?: LayoutNode): Workspace {
  const next = root ? { ...workspace, root: normalise(root) } : { ...workspace };
  next.updatedAt = ctx.now();
  return next;
}

function emptySyncSets(): Record<SyncSetId, SyncSetState> {
  const sets = {} as Record<SyncSetId, SyncSetState>;
  for (const id of SYNC_SET_IDS) {
    sets[id] = { colour: DEFAULT_SYNC_SET_COLOURS[id], verseKey: null };
  }
  return sets;
}

export function createTab(ctx: WorkspaceContext, panelType: string, state: JsonValue = null): Tab {
  return { id: ctx.newId(), panelType, state, title: null, pinned: false, syncSet: null };
}

export function createWorkspace(
  ctx: WorkspaceContext,
  options: { name?: string; panelType?: string } = {},
): Workspace {
  const tab = createTab(ctx, options.panelType ?? 'placeholder');
  const group: GroupNode = { kind: 'group', id: ctx.newId(), tabs: [tab.id], activeTab: tab.id };

  return {
    id: ctx.newId(),
    name: options.name ?? 'Workspace',
    layoutVersion: LAYOUT_VERSION,
    root: group,
    tabs: { [tab.id]: tab },
    syncSets: emptySyncSets(),
    focusedGroup: group.id,
    maximizedGroup: null,
    recentlyClosed: [],
    updatedAt: ctx.now(),
  };
}

/** Resolves the group a new panel should land in, falling back to any group. */
function resolveTargetGroup(workspace: Workspace, groupId?: NodeId): GroupNode {
  const requested = groupId ? findGroup(workspace.root, groupId) : null;
  if (requested) return requested;

  const focused = findGroup(workspace.root, workspace.focusedGroup);
  if (focused) return focused;

  const first = collectGroups(workspace.root)[0];
  if (!first) throw new Error('Workspace has no groups');
  return first;
}

export function openPanel(
  workspace: Workspace,
  options: { panelType: string; state?: JsonValue; targetGroup?: NodeId; activate?: boolean },
  ctx: WorkspaceContext,
): Workspace {
  const target = resolveTargetGroup(workspace, options.targetGroup);
  const tab = createTab(ctx, options.panelType, options.state ?? null);
  const activate = options.activate ?? true;

  const nextGroup: GroupNode = {
    ...target,
    tabs: [...target.tabs, tab.id],
    activeTab: activate ? tab.id : target.activeTab,
  };

  const next = touch(workspace, ctx, replaceNode(workspace.root, target.id, nextGroup));
  next.tabs = { ...workspace.tabs, [tab.id]: tab };
  next.focusedGroup = target.id;
  return next;
}

export function activateTab(workspace: Workspace, tabId: TabId, ctx: WorkspaceContext): Workspace {
  const group = findGroupContainingTab(workspace.root, tabId);
  if (!group || group.activeTab === tabId) return workspace;

  const next = touch(
    workspace,
    ctx,
    replaceNode(workspace.root, group.id, { ...group, activeTab: tabId }),
  );
  next.focusedGroup = group.id;
  return next;
}

export function focusGroup(
  workspace: Workspace,
  groupId: NodeId,
  ctx: WorkspaceContext,
): Workspace {
  if (!findGroup(workspace.root, groupId) || workspace.focusedGroup === groupId) return workspace;
  const next = touch(workspace, ctx);
  next.focusedGroup = groupId;
  return next;
}

/** Picks the tab that should become active when `removed` leaves the group. */
function nextActiveTab(group: GroupNode, removed: TabId): TabId | null {
  const remaining = group.tabs.filter((id) => id !== removed);
  if (remaining.length === 0) return null;
  if (group.activeTab !== removed) return group.activeTab;

  const index = group.tabs.indexOf(removed);
  return remaining[Math.min(index, remaining.length - 1)] ?? remaining[0]!;
}

export function closeTab(workspace: Workspace, tabId: TabId, ctx: WorkspaceContext): Workspace {
  const group = findGroupContainingTab(workspace.root, tabId);
  const tab = workspace.tabs[tabId];
  if (!group || !tab) return workspace;

  const index = group.tabs.indexOf(tabId);
  const survivor = nextActiveTab(group, tabId);

  let root: LayoutNode | null;
  if (survivor === null) {
    root = removeNode(workspace.root, group.id);
    // Refuse to empty the workspace entirely; the last group stays.
    if (root === null) return workspace;
  } else {
    root = replaceNode(workspace.root, group.id, {
      ...group,
      tabs: group.tabs.filter((id) => id !== tabId),
      activeTab: survivor,
    });
  }

  const next = touch(workspace, ctx, root);
  const tabs = { ...workspace.tabs };
  delete tabs[tabId];
  next.tabs = tabs;
  next.recentlyClosed = [{ tab, groupId: group.id, index }, ...workspace.recentlyClosed].slice(
    0,
    MAX_RECENTLY_CLOSED,
  );

  if (!findGroup(next.root, next.focusedGroup)) {
    next.focusedGroup = collectGroups(next.root)[0]?.id ?? next.focusedGroup;
  }
  if (next.maximizedGroup && !findGroup(next.root, next.maximizedGroup)) {
    next.maximizedGroup = null;
  }

  return next;
}

/** VS Code style reopen: back to its old group if it still exists, else the focused one. */
export function reopenLastClosed(workspace: Workspace, ctx: WorkspaceContext): Workspace {
  const [entry, ...rest] = workspace.recentlyClosed;
  if (!entry) return workspace;

  const target = findGroup(workspace.root, entry.groupId) ?? resolveTargetGroup(workspace);
  const index = Math.min(entry.index, target.tabs.length);
  const tabs = [...target.tabs];
  tabs.splice(index, 0, entry.tab.id);

  const next = touch(
    workspace,
    ctx,
    replaceNode(workspace.root, target.id, {
      ...target,
      tabs,
      activeTab: entry.tab.id,
    }),
  );
  next.tabs = { ...workspace.tabs, [entry.tab.id]: entry.tab };
  next.recentlyClosed = rest;
  next.focusedGroup = target.id;
  return next;
}

export function moveTab(
  workspace: Workspace,
  options: { tabId: TabId; toGroup: NodeId; index?: number },
  ctx: WorkspaceContext,
): Workspace {
  const from = findGroupContainingTab(workspace.root, options.tabId);
  const to = findGroup(workspace.root, options.toGroup);
  if (!from || !to || !workspace.tabs[options.tabId]) return workspace;

  if (from.id === to.id) {
    const remaining = from.tabs.filter((id) => id !== options.tabId);
    const index = Math.min(options.index ?? remaining.length, remaining.length);
    remaining.splice(index, 0, options.tabId);
    const next = touch(
      workspace,
      ctx,
      replaceNode(workspace.root, from.id, { ...from, tabs: remaining }),
    );
    next.focusedGroup = from.id;
    return next;
  }

  const survivor = nextActiveTab(from, options.tabId);
  const targetTabs = [...to.tabs];
  targetTabs.splice(
    Math.min(options.index ?? targetTabs.length, targetTabs.length),
    0,
    options.tabId,
  );
  const nextTarget: GroupNode = { ...to, tabs: targetTabs, activeTab: options.tabId };

  let root = replaceNode(workspace.root, to.id, nextTarget);
  if (survivor === null) {
    const pruned = removeNode(root, from.id);
    if (pruned) root = pruned;
  } else {
    root = replaceNode(root, from.id, {
      ...from,
      tabs: from.tabs.filter((id) => id !== options.tabId),
      activeTab: survivor,
    });
  }

  const next = touch(workspace, ctx, root);
  next.focusedGroup = to.id;
  if (next.maximizedGroup && !findGroup(next.root, next.maximizedGroup)) {
    next.maximizedGroup = null;
  }
  return next;
}

/**
 * Shared core of `splitGroup` and `dropTabOnEdge`: put a group beside `targetId`
 * holding either an existing tab or a new panel.
 *
 * Both callers funnel through here because the subtle part — detaching the tab
 * from whichever group currently owns it, which may be neither the target nor
 * the focused group — is easy to get wrong twice.
 */
function insertGroupBeside(
  workspace: Workspace,
  options: {
    targetId: NodeId;
    direction: Direction;
    placeFirst: boolean;
    tabId?: TabId;
    panelType?: string;
  },
  ctx: WorkspaceContext,
): Workspace | null {
  const target = findGroup(workspace.root, options.targetId);
  if (!target) return null;

  let movingTab: Tab;
  let tabs = workspace.tabs;
  let owner: GroupNode | null = null;

  if (options.tabId) {
    const existing = workspace.tabs[options.tabId];
    if (!existing) return null;
    owner = findGroupContainingTab(workspace.root, options.tabId);
    if (!owner) return null;
    // Moving a group's only tab into a split beside itself would leave nothing behind.
    if (owner.id === target.id && owner.tabs.length === 1) return null;
    movingTab = existing;
  } else {
    movingTab = createTab(ctx, options.panelType ?? 'placeholder');
    tabs = { ...workspace.tabs, [movingTab.id]: movingTab };
  }

  const newGroup: GroupNode = {
    kind: 'group',
    id: ctx.newId(),
    tabs: [movingTab.id],
    activeTab: movingTab.id,
  };

  const survivor = owner ? nextActiveTab(owner, movingTab.id) : null;

  const targetAfterRemoval: LayoutNode =
    owner && owner.id === target.id
      ? {
          ...target,
          tabs: target.tabs.filter((id) => id !== movingTab.id),
          activeTab: survivor ?? target.activeTab,
        }
      : target;

  const split: SplitNode = {
    kind: 'split',
    id: ctx.newId(),
    direction: options.direction,
    children: options.placeFirst ? [newGroup, targetAfterRemoval] : [targetAfterRemoval, newGroup],
    sizes: [0.5, 0.5],
  };

  let root: LayoutNode = replaceNode(workspace.root, target.id, split);

  if (owner && owner.id !== target.id) {
    if (survivor === null) {
      const pruned = removeNode(root, owner.id);
      if (pruned) root = pruned;
    } else {
      root = replaceNode(root, owner.id, {
        ...owner,
        tabs: owner.tabs.filter((id) => id !== movingTab.id),
        activeTab: survivor,
      });
    }
  }

  const next = touch(workspace, ctx, root);
  next.tabs = tabs;
  next.focusedGroup = newGroup.id;
  if (next.maximizedGroup && !findGroup(next.root, next.maximizedGroup)) {
    next.maximizedGroup = null;
  }
  return next;
}

/**
 * Wraps `groupId` in a split and puts a sibling group beside it. The sibling
 * receives `tabId` when given, otherwise a freshly opened panel.
 */
export function splitGroup(
  workspace: Workspace,
  options: {
    groupId: NodeId;
    direction: Direction;
    tabId?: TabId;
    panelType?: string;
    placeFirst?: boolean;
  },
  ctx: WorkspaceContext,
): Workspace {
  const result = insertGroupBeside(
    workspace,
    {
      targetId: options.groupId,
      direction: options.direction,
      placeFirst: options.placeFirst ?? false,
      ...(options.tabId ? { tabId: options.tabId } : {}),
      ...(options.panelType ? { panelType: options.panelType } : {}),
    },
    ctx,
  );
  return result ?? workspace;
}

/** Drag-to-edge drop: split the target group at `edge` and place the tab there. */
export function dropTabOnEdge(
  workspace: Workspace,
  options: { tabId: TabId; groupId: NodeId; edge: Edge },
  ctx: WorkspaceContext,
): Workspace {
  const result = insertGroupBeside(
    workspace,
    {
      targetId: options.groupId,
      direction: edgeToDirection(options.edge),
      placeFirst: edgePlacesFirst(options.edge),
      tabId: options.tabId,
    },
    ctx,
  );
  return result ?? workspace;
}

/** Clamps to a minimum fraction so a pane can never be dragged to nothing. */
export function resizeSplit(
  workspace: Workspace,
  options: { splitId: NodeId; sizes: number[] },
  ctx: WorkspaceContext,
): Workspace {
  const node = findNode(workspace.root, options.splitId);
  if (!node || !isSplit(node) || options.sizes.length !== node.children.length) {
    return workspace;
  }

  const clamped = options.sizes.map((size) => Math.max(MIN_SPLIT_FRACTION, size));
  const total = clamped.reduce((sum, size) => sum + size, 0);
  const sizes = clamped.map((size) => size / total);

  return touch(workspace, ctx, replaceNode(workspace.root, node.id, { ...node, sizes }));
}

export function setSyncSet(
  workspace: Workspace,
  tabId: TabId,
  syncSet: SyncSetId | null,
  ctx: WorkspaceContext,
): Workspace {
  const tab = workspace.tabs[tabId];
  if (!tab || tab.syncSet === syncSet) return workspace;

  const next = touch(workspace, ctx);
  next.tabs = { ...workspace.tabs, [tabId]: { ...tab, syncSet } };
  return next;
}

export function setSyncSetVerse(
  workspace: Workspace,
  syncSet: SyncSetId,
  verseKey: number | null,
  ctx: WorkspaceContext,
): Workspace {
  const current = workspace.syncSets[syncSet];
  if (current.verseKey === verseKey) return workspace;

  const next = touch(workspace, ctx);
  next.syncSets = { ...workspace.syncSets, [syncSet]: { ...current, verseKey } };
  return next;
}

export function toggleMaximize(
  workspace: Workspace,
  groupId: NodeId,
  ctx: WorkspaceContext,
): Workspace {
  if (!findGroup(workspace.root, groupId)) return workspace;
  const next = touch(workspace, ctx);
  next.maximizedGroup = workspace.maximizedGroup === groupId ? null : groupId;
  return next;
}

export function setTabTitle(
  workspace: Workspace,
  tabId: TabId,
  title: string | null,
  ctx: WorkspaceContext,
): Workspace {
  const tab = workspace.tabs[tabId];
  if (!tab) return workspace;
  const next = touch(workspace, ctx);
  next.tabs = { ...workspace.tabs, [tabId]: { ...tab, title } };
  return next;
}

export function setTabState(
  workspace: Workspace,
  tabId: TabId,
  state: JsonValue,
  ctx: WorkspaceContext,
): Workspace {
  const tab = workspace.tabs[tabId];
  if (!tab) return workspace;
  const next = touch(workspace, ctx);
  next.tabs = { ...workspace.tabs, [tabId]: { ...tab, state } };
  return next;
}

/** Groups in left-to-right, top-to-bottom order, for `Ctrl+1..9` focus. */
export function groupsInVisualOrder(workspace: Workspace): GroupNode[] {
  const walk = (node: LayoutNode): GroupNode[] =>
    isGroup(node) ? [node] : node.children.flatMap(walk);
  return walk(workspace.root);
}
