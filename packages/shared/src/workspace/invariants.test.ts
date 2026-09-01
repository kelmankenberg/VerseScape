import { describe, expect, it } from 'vitest';
import { findViolations } from './invariants.js';
import {
  closeTab,
  dropTabOnEdge,
  moveTab,
  openPanel,
  reopenLastClosed,
  resizeSplit,
  setSyncSet,
  splitGroup,
  toggleMaximize,
} from './reducer.js';
import { collectGroups, collectTabIds } from './tree.js';
import { workspaceSchemaFixture } from './fixtures.js';
import { makeRandom, makeWorkspace, testContext } from './test-helpers.js';
import type { Edge, SyncSetId, Workspace, WorkspaceContext } from './types.js';

const rules = (ws: Workspace): string[] => findViolations(ws).map((v) => v.rule);

describe('findViolations', () => {
  it('accepts a freshly created workspace', () => {
    expect(findViolations(makeWorkspace())).toEqual([]);
  });

  it('rejects a split with fewer than two children', () => {
    const ws = workspaceSchemaFixture();
    ws.root = { kind: 'split', id: 's', direction: 'row', children: [ws.root], sizes: [1] };
    expect(rules(ws)).toContain('split-arity');
  });

  it('rejects sizes that do not sum to one', () => {
    const ws = workspaceSchemaFixture();
    const group = collectGroups(ws.root)[0]!;
    ws.root = {
      kind: 'split',
      id: 's',
      direction: 'row',
      children: [group, { ...group, id: 'g2' }],
      sizes: [0.5, 0.9],
    };
    expect(rules(ws)).toContain('sizes-sum-to-one');
  });

  it('rejects nested splits of the same direction', () => {
    const ws = workspaceSchemaFixture();
    const group = collectGroups(ws.root)[0]!;
    const inner = {
      kind: 'split' as const,
      id: 's2',
      direction: 'row' as const,
      children: [
        { ...group, id: 'g2' },
        { ...group, id: 'g3' },
      ],
      sizes: [0.5, 0.5],
    };
    ws.root = {
      kind: 'split',
      id: 's1',
      direction: 'row',
      children: [group, inner],
      sizes: [0.5, 0.5],
    };
    expect(rules(ws)).toContain('splits-flattened');
  });

  it('rejects an active tab that is not in the group', () => {
    const ws = workspaceSchemaFixture();
    const group = collectGroups(ws.root)[0]!;
    ws.root = { ...group, activeTab: 'nope' };
    expect(rules(ws)).toContain('active-tab-present');
  });

  it('rejects a tab in the tree with no record', () => {
    const ws = workspaceSchemaFixture();
    const group = collectGroups(ws.root)[0]!;
    ws.root = { ...group, tabs: [...group.tabs, 'ghost'] };
    expect(rules(ws)).toContain('tab-record-exists');
  });

  it('rejects an orphan tab record', () => {
    const ws = workspaceSchemaFixture();
    ws.tabs['orphan'] = {
      id: 'orphan',
      panelType: 'x',
      state: null,
      title: null,
      pinned: false,
      syncSet: null,
    };
    expect(rules(ws)).toContain('no-orphan-tabs');
  });

  it('rejects the same tab appearing in two groups', () => {
    const ws = workspaceSchemaFixture();
    const group = collectGroups(ws.root)[0]!;
    ws.root = {
      kind: 'split',
      id: 's1',
      direction: 'row',
      children: [group, { ...group, id: 'g2' }],
      sizes: [0.5, 0.5],
    };
    expect(rules(ws)).toContain('tab-in-one-group');
  });

  it('rejects a dangling focused group', () => {
    const ws = workspaceSchemaFixture();
    ws.focusedGroup = 'ghost';
    expect(rules(ws)).toContain('focused-group-exists');
  });

  it('rejects a dangling maximized group', () => {
    const ws = workspaceSchemaFixture();
    ws.maximizedGroup = 'ghost';
    expect(rules(ws)).toContain('maximized-group-exists');
  });

  it('rejects duplicate node ids', () => {
    const ws = workspaceSchemaFixture();
    const group = collectGroups(ws.root)[0]!;
    ws.root = {
      kind: 'split',
      id: group.id,
      direction: 'row',
      children: [group, { ...group, id: 'g2', tabs: ['other'], activeTab: 'other' }],
      sizes: [0.5, 0.5],
    };
    expect(rules(ws)).toContain('node-ids-unique');
  });
});

/**
 * Random operation sequences are the only realistic way to catch tree bugs that
 * appear three splits deep. Seeds are fixed so a failure is reproducible.
 */
describe('invariants hold under random operation sequences', () => {
  const edges: Edge[] = ['left', 'right', 'top', 'bottom'];
  const syncSets: (SyncSetId | null)[] = ['A', 'B', 'C', 'D', null];

  const step = (ws: Workspace, random: () => number, ctx: WorkspaceContext): Workspace => {
    const groups = collectGroups(ws.root);
    const tabIds = collectTabIds(ws.root);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;

    switch (Math.floor(random() * 9)) {
      case 0:
        return openPanel(ws, { panelType: 'p', targetGroup: pick(groups).id }, ctx);
      case 1:
        return closeTab(ws, pick(tabIds), ctx);
      case 2:
        return splitGroup(
          ws,
          {
            groupId: pick(groups).id,
            direction: random() > 0.5 ? 'row' : 'column',
            panelType: 'p',
          },
          ctx,
        );
      case 3:
        return splitGroup(
          ws,
          {
            groupId: pick(groups).id,
            direction: random() > 0.5 ? 'row' : 'column',
            tabId: pick(tabIds),
          },
          ctx,
        );
      case 4:
        return moveTab(
          ws,
          {
            tabId: pick(tabIds),
            toGroup: pick(groups).id,
            index: Math.floor(random() * 3),
          },
          ctx,
        );
      case 5:
        return dropTabOnEdge(
          ws,
          { tabId: pick(tabIds), groupId: pick(groups).id, edge: pick(edges) },
          ctx,
        );
      case 6: {
        const split = ws.root.kind === 'split' ? ws.root : null;
        return split
          ? resizeSplit(
              ws,
              { splitId: split.id, sizes: split.children.map(() => random() + 0.1) },
              ctx,
            )
          : ws;
      }
      case 7:
        return setSyncSet(ws, pick(tabIds), pick(syncSets), ctx);
      default:
        return random() > 0.5
          ? toggleMaximize(ws, pick(groups).id, ctx)
          : reopenLastClosed(ws, ctx);
    }
  };

  it.each([1, 7, 42, 1337, 90210])('stays valid for seed %i', (seed) => {
    const ctx = testContext();
    const random = makeRandom(seed);
    let ws = makeWorkspace(ctx);

    for (let i = 0; i < 400; i += 1) {
      ws = step(ws, random, ctx);
      const violations = findViolations(ws);
      if (violations.length > 0) {
        throw new Error(
          `seed ${seed} step ${i}: ${violations.map((v) => `${v.rule} (${v.detail})`).join(', ')}`,
        );
      }
    }

    // The workspace should still be doing something, not collapsed to nothing.
    expect(collectGroups(ws.root).length).toBeGreaterThan(0);
    expect(collectTabIds(ws.root).length).toBeGreaterThan(0);
  });
});
