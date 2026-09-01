import type { LayoutNode, Workspace, WorkspaceContext } from './types.js';
import { createWorkspace } from './reducer.js';

/** Deterministic ids and clock so every assertion is reproducible. */
export function testContext(seed = 0): WorkspaceContext {
  let counter = seed;
  let tick = 0;
  return {
    newId: () => `id${++counter}`,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
  };
}

export function makeWorkspace(ctx: WorkspaceContext = testContext()): Workspace {
  return createWorkspace(ctx, { panelType: 'bible' });
}

/** Compact tree rendering, so failures read as structure rather than JSON. */
export function shape(node: LayoutNode): string {
  if (node.kind === 'group') return `[${node.tabs.join(',')}]`;
  const separator = node.direction === 'row' ? ' | ' : ' / ';
  return `(${node.children.map(shape).join(separator)})`;
}

/** Small xorshift PRNG: reproducible sequences without a dependency. */
export function makeRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return Math.abs(state) / 2 ** 31;
  };
}
