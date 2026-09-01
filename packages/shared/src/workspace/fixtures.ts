import { createWorkspace } from './reducer.js';
import { testContext } from './test-helpers.js';
import type { Workspace } from './types.js';

/**
 * A deep-cloned workspace, so invariant tests can corrupt it freely without
 * leaking mutations between cases.
 */
export function workspaceSchemaFixture(): Workspace {
  return structuredClone(createWorkspace(testContext(), { panelType: 'bible' }));
}
