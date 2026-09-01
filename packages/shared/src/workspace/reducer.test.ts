import { describe, expect, it } from 'vitest';
import {
  activateTab,
  closeTab,
  dropTabOnEdge,
  focusGroup,
  moveTab,
  openPanel,
  reopenLastClosed,
  resizeSplit,
  setSyncSet,
  setSyncSetVerse,
  splitGroup,
  toggleMaximize,
} from './reducer.js';
import { findViolations, isValid } from './invariants.js';
import { collectGroups, collectTabIds, findGroupContainingTab } from './tree.js';
import { MIN_SPLIT_FRACTION } from './types.js';
import { makeWorkspace, shape, testContext } from './test-helpers.js';

describe('createWorkspace', () => {
  it('starts valid, with one group and one tab', () => {
    const ws = makeWorkspace();
    expect(findViolations(ws)).toEqual([]);
    expect(collectGroups(ws.root)).toHaveLength(1);
    expect(Object.keys(ws.tabs)).toHaveLength(1);
    expect(ws.focusedGroup).toBe(collectGroups(ws.root)[0]!.id);
  });

  it('creates all four sync sets, unset', () => {
    const ws = makeWorkspace();
    expect(Object.keys(ws.syncSets).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(ws.syncSets.A.verseKey).toBeNull();
  });
});

describe('openPanel', () => {
  it('adds a tab to the focused group and activates it', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'notes' }, ctx);

    const group = collectGroups(ws.root)[0]!;
    expect(group.tabs).toHaveLength(2);
    expect(ws.tabs[group.activeTab]!.panelType).toBe('notes');
    expect(isValid(ws)).toBe(true);
  });

  it('can add without activating', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    const before = collectGroups(ws.root)[0]!.activeTab;
    ws = openPanel(ws, { panelType: 'notes', activate: false }, ctx);
    expect(collectGroups(ws.root)[0]!.activeTab).toBe(before);
  });

  it('falls back to a real group when the target is unknown', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'notes', targetGroup: 'ghost' }, ctx);
    expect(isValid(ws)).toBe(true);
    expect(collectTabIds(ws.root)).toHaveLength(2);
  });
});

describe('closeTab', () => {
  it('removes the tab and its record', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'notes' }, ctx);
    const target = collectGroups(ws.root)[0]!.tabs[1]!;

    ws = closeTab(ws, target, ctx);
    expect(ws.tabs[target]).toBeUndefined();
    expect(collectTabIds(ws.root)).not.toContain(target);
    expect(isValid(ws)).toBe(true);
  });

  it('collapses the group and its split when the last tab closes', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes' }, ctx);
    expect(collectGroups(ws.root)).toHaveLength(2);

    const lonely = collectGroups(ws.root)[1]!;
    ws = closeTab(ws, lonely.tabs[0]!, ctx);

    expect(collectGroups(ws.root)).toHaveLength(1);
    expect(ws.root.kind).toBe('group');
    expect(isValid(ws)).toBe(true);
  });

  it('activates the neighbour to the right, then the left at the end', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'a' }, ctx);
    ws = openPanel(ws, { panelType: 'b' }, ctx);
    const [first, second, third] = collectGroups(ws.root)[0]!.tabs;

    ws = activateTab(ws, second!, ctx);
    ws = closeTab(ws, second!, ctx);
    expect(collectGroups(ws.root)[0]!.activeTab).toBe(third);

    ws = closeTab(ws, third!, ctx);
    expect(collectGroups(ws.root)[0]!.activeTab).toBe(first);
  });

  it('refuses to empty the workspace', () => {
    const ctx = testContext();
    const ws = makeWorkspace(ctx);
    const only = collectTabIds(ws.root)[0]!;
    expect(closeTab(ws, only, ctx)).toBe(ws);
  });

  it('keeps a bounded reopen history', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    for (let i = 0; i < 15; i += 1) ws = openPanel(ws, { panelType: `p${i}` }, ctx);
    for (let i = 0; i < 12; i += 1) {
      const tabs = collectGroups(ws.root)[0]!.tabs;
      ws = closeTab(ws, tabs[tabs.length - 1]!, ctx);
    }
    expect(ws.recentlyClosed).toHaveLength(10);
  });
});

describe('reopenLastClosed', () => {
  it('restores the tab to its original group and index', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'a' }, ctx);
    ws = openPanel(ws, { panelType: 'b' }, ctx);

    const middle = collectGroups(ws.root)[0]!.tabs[1]!;
    ws = closeTab(ws, middle, ctx);
    ws = reopenLastClosed(ws, ctx);

    expect(collectGroups(ws.root)[0]!.tabs[1]).toBe(middle);
    expect(ws.tabs[middle]!.panelType).toBe('a');
    expect(ws.recentlyClosed).toHaveLength(0);
    expect(isValid(ws)).toBe(true);
  });

  it('falls back to the focused group when the original is gone', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes' }, ctx);
    const lonely = collectGroups(ws.root)[1]!;

    ws = closeTab(ws, lonely.tabs[0]!, ctx);
    ws = reopenLastClosed(ws, ctx);

    expect(isValid(ws)).toBe(true);
    expect(collectTabIds(ws.root)).toHaveLength(2);
  });

  it('is a no-op with empty history', () => {
    const ctx = testContext();
    const ws = makeWorkspace(ctx);
    expect(reopenLastClosed(ws, ctx)).toBe(ws);
  });
});

describe('splitGroup', () => {
  it('wraps the group in a split and focuses the new sibling', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes' }, ctx);

    expect(ws.root.kind).toBe('split');
    expect(collectGroups(ws.root)).toHaveLength(2);
    expect(ws.focusedGroup).toBe(collectGroups(ws.root)[1]!.id);
    expect(isValid(ws)).toBe(true);
  });

  it('honours placeFirst', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(
      ws,
      { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes', placeFirst: true },
      ctx,
    );
    expect(collectGroups(ws.root)[0]!.id).toBe(ws.focusedGroup);
  });

  it('moves an existing tab into the new group', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'notes' }, ctx);
    const moving = collectGroups(ws.root)[0]!.tabs[1]!;

    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'column', tabId: moving }, ctx);

    expect(collectGroups(ws.root)).toHaveLength(2);
    expect(findGroupContainingTab(ws.root, moving)!.tabs).toEqual([moving]);
    expect(Object.keys(ws.tabs)).toHaveLength(2);
    expect(isValid(ws)).toBe(true);
  });

  it('refuses to split a group using its only tab', () => {
    const ctx = testContext();
    const ws = makeWorkspace(ctx);
    const only = collectTabIds(ws.root)[0]!;
    expect(splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', tabId: only }, ctx)).toBe(
      ws,
    );
  });

  it('flattens when splitting in the same direction as the parent', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'b' }, ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'c' }, ctx);

    expect(ws.root.kind).toBe('split');
    if (ws.root.kind !== 'split') return;
    expect(ws.root.children).toHaveLength(3);
    expect(isValid(ws)).toBe(true);
  });
});

describe('moveTab', () => {
  it('reorders within a group', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'a' }, ctx);
    ws = openPanel(ws, { panelType: 'b' }, ctx);
    const [first, , third] = collectGroups(ws.root)[0]!.tabs;

    ws = moveTab(ws, { tabId: third!, toGroup: ws.focusedGroup, index: 0 }, ctx);
    expect(collectGroups(ws.root)[0]!.tabs[0]).toBe(third);
    expect(collectGroups(ws.root)[0]!.tabs[1]).toBe(first);
    expect(isValid(ws)).toBe(true);
  });

  it('transfers between groups and collapses an emptied source', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes' }, ctx);

    const [left, right] = collectGroups(ws.root);
    const moving = right!.tabs[0]!;
    ws = moveTab(ws, { tabId: moving, toGroup: left!.id }, ctx);

    expect(collectGroups(ws.root)).toHaveLength(1);
    expect(collectGroups(ws.root)[0]!.tabs).toContain(moving);
    expect(isValid(ws)).toBe(true);
  });

  it('is a no-op for an unknown tab or group', () => {
    const ctx = testContext();
    const ws = makeWorkspace(ctx);
    expect(moveTab(ws, { tabId: 'ghost', toGroup: ws.focusedGroup }, ctx)).toBe(ws);
    expect(moveTab(ws, { tabId: collectTabIds(ws.root)[0]!, toGroup: 'ghost' }, ctx)).toBe(ws);
  });
});

describe('dropTabOnEdge', () => {
  it.each([
    ['left', 'row', 0],
    ['right', 'row', 1],
    ['top', 'column', 0],
    ['bottom', 'column', 1],
  ] as const)('drops on the %s edge', (edge, direction, index) => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'column', panelType: 'notes' }, ctx);

    const [target, source] = collectGroups(ws.root);
    const moving = source!.tabs[0]!;
    ws = dropTabOnEdge(ws, { tabId: moving, groupId: target!.id, edge }, ctx);

    expect(ws.root.kind).toBe('split');
    if (ws.root.kind !== 'split') return;
    expect(ws.root.direction).toBe(direction);
    expect(collectGroups(ws.root)[index]!.tabs).toEqual([moving]);
    expect(isValid(ws)).toBe(true);
  });

  it('splits a group using one of its own tabs', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'notes' }, ctx);
    const moving = collectGroups(ws.root)[0]!.tabs[1]!;

    ws = dropTabOnEdge(ws, { tabId: moving, groupId: ws.focusedGroup, edge: 'right' }, ctx);

    expect(collectGroups(ws.root)).toHaveLength(2);
    expect(isValid(ws)).toBe(true);
  });

  it('is a no-op when a group would drop its only tab onto itself', () => {
    const ctx = testContext();
    const ws = makeWorkspace(ctx);
    const only = collectTabIds(ws.root)[0]!;
    expect(dropTabOnEdge(ws, { tabId: only, groupId: ws.focusedGroup, edge: 'left' }, ctx)).toBe(
      ws,
    );
  });
});

describe('resizeSplit', () => {
  it('normalises the supplied sizes', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes' }, ctx);

    ws = resizeSplit(ws, { splitId: ws.root.id, sizes: [3, 1] }, ctx);
    if (ws.root.kind !== 'split') throw new Error('expected split');
    expect(ws.root.sizes[0]).toBeCloseTo(0.75);
    expect(isValid(ws)).toBe(true);
  });

  it('clamps a pane to the minimum fraction', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes' }, ctx);

    ws = resizeSplit(ws, { splitId: ws.root.id, sizes: [1, 0] }, ctx);
    if (ws.root.kind !== 'split') throw new Error('expected split');
    expect(ws.root.sizes[1]).toBeGreaterThanOrEqual(MIN_SPLIT_FRACTION * 0.9);
  });

  it('rejects a size array of the wrong length', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes' }, ctx);
    expect(resizeSplit(ws, { splitId: ws.root.id, sizes: [1] }, ctx)).toBe(ws);
  });
});

describe('sync sets', () => {
  it('assigns and clears a tab’s set', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    const tabId = collectTabIds(ws.root)[0]!;

    ws = setSyncSet(ws, tabId, 'A', ctx);
    expect(ws.tabs[tabId]!.syncSet).toBe('A');

    ws = setSyncSet(ws, tabId, null, ctx);
    expect(ws.tabs[tabId]!.syncSet).toBeNull();
  });

  it('records the current verse for a set', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = setSyncSetVerse(ws, 'B', 15001007, ctx);
    expect(ws.syncSets.B.verseKey).toBe(15001007);
    expect(ws.syncSets.A.verseKey).toBeNull();
  });
});

describe('maximize', () => {
  it('toggles and clears when the group disappears', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes' }, ctx);

    const lonely = collectGroups(ws.root)[1]!;
    ws = toggleMaximize(ws, lonely.id, ctx);
    expect(ws.maximizedGroup).toBe(lonely.id);

    ws = toggleMaximize(ws, lonely.id, ctx);
    expect(ws.maximizedGroup).toBeNull();

    ws = toggleMaximize(ws, lonely.id, ctx);
    ws = closeTab(ws, lonely.tabs[0]!, ctx);
    expect(ws.maximizedGroup).toBeNull();
    expect(isValid(ws)).toBe(true);
  });
});

describe('focus', () => {
  it('moves focus and survives closing the focused group', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'notes' }, ctx);

    const [first, second] = collectGroups(ws.root);
    ws = focusGroup(ws, first!.id, ctx);
    expect(ws.focusedGroup).toBe(first!.id);

    ws = closeTab(ws, first!.tabs[0]!, ctx);
    expect(ws.focusedGroup).toBe(collectGroups(ws.root)[0]!.id);
    expect(collectGroups(ws.root)[0]!.tabs).toEqual(second!.tabs);
    expect(isValid(ws)).toBe(true);
  });
});

describe('purity', () => {
  it('never mutates the input workspace', () => {
    const ctx = testContext();
    const ws = makeWorkspace(ctx);
    const snapshot = JSON.stringify(ws);

    openPanel(ws, { panelType: 'notes' }, ctx);
    splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'x' }, ctx);
    closeTab(ws, collectTabIds(ws.root)[0]!, ctx);
    setSyncSet(ws, collectTabIds(ws.root)[0]!, 'A', ctx);

    expect(JSON.stringify(ws)).toBe(snapshot);
  });

  it('produces a stable shape for a known sequence', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'b' }, ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'column', panelType: 'c' }, ctx);

    expect(shape(ws.root)).toMatch(/^\(\[\w+\] \| \(\[\w+\] \/ \[\w+\]\)\)$/);
    expect(collectGroups(ws.root)).toHaveLength(3);
  });

  it('does not duplicate a tab when splitting with a tab from another group', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'a' }, ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'b' }, ctx);

    const [left, right] = collectGroups(ws.root);
    const strayTab = left!.tabs[0]!;

    // Split the right-hand group using a tab that lives in the left-hand one.
    ws = splitGroup(ws, { groupId: right!.id, direction: 'column', tabId: strayTab }, ctx);

    const occurrences = collectTabIds(ws.root).filter((id) => id === strayTab);
    expect(occurrences).toHaveLength(1);
    expect(isValid(ws)).toBe(true);
  });
});
