import { collectGroups, collectNodeIds, collectTabIds, findGroup, isGroup } from './tree.js';
import type { LayoutNode, Workspace } from './types.js';

export interface Violation {
  rule: string;
  detail: string;
}

const SIZE_EPSILON = 1e-6;

function checkNode(node: LayoutNode, violations: Violation[]): void {
  if (isGroup(node)) {
    if (node.tabs.length === 0) {
      violations.push({ rule: 'group-not-empty', detail: `group ${node.id} has no tabs` });
    }
    if (!node.tabs.includes(node.activeTab)) {
      violations.push({
        rule: 'active-tab-present',
        detail: `group ${node.id} active tab ${node.activeTab} is not in its tabs`,
      });
    }
    if (new Set(node.tabs).size !== node.tabs.length) {
      violations.push({ rule: 'tabs-unique', detail: `group ${node.id} has duplicate tabs` });
    }
    return;
  }

  if (node.children.length < 2) {
    violations.push({
      rule: 'split-arity',
      detail: `split ${node.id} has ${node.children.length} children, expected at least 2`,
    });
  }

  if (node.sizes.length !== node.children.length) {
    violations.push({
      rule: 'sizes-match-children',
      detail: `split ${node.id} has ${node.sizes.length} sizes for ${node.children.length} children`,
    });
  }

  const total = node.sizes.reduce((sum, size) => sum + size, 0);
  if (Math.abs(total - 1) > SIZE_EPSILON) {
    violations.push({
      rule: 'sizes-sum-to-one',
      detail: `split ${node.id} sizes sum to ${total}`,
    });
  }

  if (node.sizes.some((size) => size <= 0)) {
    violations.push({
      rule: 'sizes-positive',
      detail: `split ${node.id} has a non-positive size`,
    });
  }

  for (const child of node.children) {
    if (!isGroup(child) && child.direction === node.direction) {
      violations.push({
        rule: 'splits-flattened',
        detail: `split ${node.id} contains split ${child.id} of the same direction`,
      });
    }
    checkNode(child, violations);
  }
}

/**
 * Returns every invariant violation in a workspace. Empty means valid.
 *
 * Called after each mutation in development builds; a violation is a bug in a
 * reducer, never something the user can cause.
 */
export function findViolations(workspace: Workspace): Violation[] {
  const violations: Violation[] = [];

  checkNode(workspace.root, violations);

  const nodeIds = collectNodeIds(workspace.root);
  if (new Set(nodeIds).size !== nodeIds.length) {
    violations.push({ rule: 'node-ids-unique', detail: 'duplicate node ids in tree' });
  }

  const tabIdsInTree = collectTabIds(workspace.root);
  if (new Set(tabIdsInTree).size !== tabIdsInTree.length) {
    violations.push({
      rule: 'tab-in-one-group',
      detail: 'a tab appears in more than one group',
    });
  }

  for (const tabId of tabIdsInTree) {
    if (!workspace.tabs[tabId]) {
      violations.push({
        rule: 'tab-record-exists',
        detail: `tab ${tabId} is in the tree but not in the tabs record`,
      });
    }
  }

  for (const tabId of Object.keys(workspace.tabs)) {
    if (!tabIdsInTree.includes(tabId)) {
      violations.push({
        rule: 'no-orphan-tabs',
        detail: `tab ${tabId} is in the tabs record but not in the tree`,
      });
    }
  }

  if (!findGroup(workspace.root, workspace.focusedGroup)) {
    violations.push({
      rule: 'focused-group-exists',
      detail: `focused group ${workspace.focusedGroup} is not in the tree`,
    });
  }

  if (workspace.maximizedGroup && !findGroup(workspace.root, workspace.maximizedGroup)) {
    violations.push({
      rule: 'maximized-group-exists',
      detail: `maximized group ${workspace.maximizedGroup} is not in the tree`,
    });
  }

  if (collectGroups(workspace.root).length === 0) {
    violations.push({ rule: 'at-least-one-group', detail: 'workspace has no groups' });
  }

  return violations;
}

export function isValid(workspace: Workspace): boolean {
  return findViolations(workspace).length === 0;
}

/**
 * Development-time guard. Throws with every violation listed so a broken
 * reducer fails loudly at its call site rather than corrupting a saved layout.
 */
export function assertValid(workspace: Workspace, operation: string): void {
  const violations = findViolations(workspace);
  if (violations.length > 0) {
    const detail = violations.map((v) => `  ${v.rule}: ${v.detail}`).join('\n');
    throw new Error(`Workspace invariants violated after ${operation}:\n${detail}`);
  }
}
