import { describe, expect, it } from 'vitest';
import * as schema from './schema.js';
import { openPanel, splitGroup, setSyncSet } from './reducer.js';
import { collectTabIds } from './tree.js';
import { LAYOUT_VERSION } from './types.js';
import { makeWorkspace, testContext } from './test-helpers.js';

describe('workspace schema', () => {
  it('accepts a non-trivial workspace and round-trips through JSON', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = openPanel(ws, { panelType: 'notes', state: { scroll: 12 } }, ctx);
    ws = splitGroup(
      ws,
      { groupId: ws.focusedGroup, direction: 'row', panelType: 'commentary' },
      ctx,
    );
    ws = setSyncSet(ws, collectTabIds(ws.root)[0]!, 'A', ctx);

    const revived: unknown = JSON.parse(JSON.stringify(ws));
    const parsed = schema.workspace.safeParse(revived);

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(ws);
  });

  it('rejects a split with a single child', () => {
    const ctx = testContext();
    const ws = makeWorkspace(ctx);
    const broken = {
      ...ws,
      root: { kind: 'split', id: 's', direction: 'row', children: [ws.root], sizes: [1] },
    };
    expect(schema.workspace.safeParse(broken).success).toBe(false);
  });

  it('rejects an empty group', () => {
    const ctx = testContext();
    const ws = makeWorkspace(ctx);
    const broken = { ...ws, root: { kind: 'group', id: 'g', tabs: [], activeTab: 't' } };
    expect(schema.workspace.safeParse(broken).success).toBe(false);
  });

  it('rejects a non-positive split size', () => {
    const ctx = testContext();
    let ws = makeWorkspace(ctx);
    ws = splitGroup(ws, { groupId: ws.focusedGroup, direction: 'row', panelType: 'x' }, ctx);
    const broken = { ...ws, root: { ...ws.root, sizes: [0, 1] } };
    expect(schema.workspace.safeParse(broken).success).toBe(false);
  });

  it('detects the current layout version', () => {
    expect(schema.isCurrentLayoutVersion(makeWorkspace())).toBe(true);
    expect(schema.isCurrentLayoutVersion({ layoutVersion: LAYOUT_VERSION + 1 })).toBe(false);
    expect(schema.isCurrentLayoutVersion(null)).toBe(false);
  });
});
