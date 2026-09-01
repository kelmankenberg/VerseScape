import type { Direction, GroupNode, LayoutNode, NodeId, SplitNode, TabId } from './types.js';

export function isSplit(node: LayoutNode): node is SplitNode {
  return node.kind === 'split';
}

export function isGroup(node: LayoutNode): node is GroupNode {
  return node.kind === 'group';
}

export function collectGroups(node: LayoutNode): GroupNode[] {
  return isGroup(node) ? [node] : node.children.flatMap(collectGroups);
}

export function collectNodeIds(node: LayoutNode): NodeId[] {
  return isGroup(node) ? [node.id] : [node.id, ...node.children.flatMap(collectNodeIds)];
}

export function collectTabIds(node: LayoutNode): TabId[] {
  return isGroup(node) ? [...node.tabs] : node.children.flatMap(collectTabIds);
}

export function findGroup(node: LayoutNode, id: NodeId): GroupNode | null {
  if (isGroup(node)) return node.id === id ? node : null;
  for (const child of node.children) {
    const found = findGroup(child, id);
    if (found) return found;
  }
  return null;
}

export function findNode(node: LayoutNode, id: NodeId): LayoutNode | null {
  if (node.id === id) return node;
  if (isGroup(node)) return null;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findGroupContainingTab(node: LayoutNode, tabId: TabId): GroupNode | null {
  if (isGroup(node)) return node.tabs.includes(tabId) ? node : null;
  for (const child of node.children) {
    const found = findGroupContainingTab(child, tabId);
    if (found) return found;
  }
  return null;
}

export function findParent(root: LayoutNode, id: NodeId): SplitNode | null {
  if (isGroup(root)) return null;
  if (root.children.some((child) => child.id === id)) return root;
  for (const child of root.children) {
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

/** Replaces a node by id, returning a new tree. Unmatched trees are returned as-is. */
export function replaceNode(root: LayoutNode, id: NodeId, replacement: LayoutNode): LayoutNode {
  if (root.id === id) return replacement;
  if (isGroup(root)) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const next = replaceNode(child, id, replacement);
    if (next !== child) changed = true;
    return next;
  });

  return changed ? { ...root, children } : root;
}

/** Removes a node by id. Returns null when the whole tree would disappear. */
export function removeNode(root: LayoutNode, id: NodeId): LayoutNode | null {
  if (root.id === id) return null;
  if (isGroup(root)) return root;

  const kept: Array<{ node: LayoutNode; size: number }> = [];
  root.children.forEach((child, index) => {
    const next = removeNode(child, id);
    if (next !== null) kept.push({ node: next, size: root.sizes[index] ?? 0 });
  });

  if (kept.length === 0) return null;
  if (kept.length === 1) return kept[0]!.node;

  const total = kept.reduce((sum, entry) => sum + entry.size, 0);
  return {
    ...root,
    children: kept.map((entry) => entry.node),
    sizes: kept.map((entry) => (total > 0 ? entry.size / total : 1 / kept.length)),
  };
}

/**
 * Enforces the structural invariants that make the tree canonical:
 * splits of the same direction are flattened, single-child splits collapse into
 * their child, and sizes are renormalised to sum to 1.
 *
 * Every mutation runs through this, so reducers can build sloppy intermediate
 * trees and let normalisation clean up.
 */
export function normalise(node: LayoutNode): LayoutNode {
  if (isGroup(node)) return node;

  const entries: Array<{ node: LayoutNode; size: number }> = [];

  node.children.forEach((child, index) => {
    const normalised = normalise(child);
    const size = node.sizes[index] ?? 1 / node.children.length;

    if (isSplit(normalised) && normalised.direction === node.direction) {
      const inner = normalised.sizes.reduce((sum, value) => sum + value, 0) || 1;
      normalised.children.forEach((grandchild, innerIndex) => {
        const innerSize = normalised.sizes[innerIndex] ?? 0;
        entries.push({ node: grandchild, size: size * (innerSize / inner) });
      });
    } else {
      entries.push({ node: normalised, size });
    }
  });

  if (entries.length === 0) return node;
  if (entries.length === 1) return entries[0]!.node;

  const total = entries.reduce((sum, entry) => sum + entry.size, 0);
  return {
    kind: 'split',
    id: node.id,
    direction: node.direction,
    children: entries.map((entry) => entry.node),
    sizes: entries.map((entry) => (total > 0 ? entry.size / total : 1 / entries.length)),
  };
}

export function edgeToDirection(edge: 'left' | 'right' | 'top' | 'bottom'): Direction {
  return edge === 'left' || edge === 'right' ? 'row' : 'column';
}

export function edgePlacesFirst(edge: 'left' | 'right' | 'top' | 'bottom'): boolean {
  return edge === 'left' || edge === 'top';
}
