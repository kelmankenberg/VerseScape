import { app } from 'electron';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { workspace as workspaceSchema } from '@shared/workspace/schema.js';
import type { Workspace } from '@shared/workspace/types.js';

/**
 * Layout persistence.
 *
 * A JSON file for now; this moves into SQLite with the rest of the data layer
 * in M3. The schema and the atomic write are the parts that matter, and both
 * carry over unchanged.
 */
function workspacePath(): string {
  return join(app.getPath('userData'), 'workspace.json');
}

export function loadWorkspace(): Workspace | null {
  const file = workspacePath();
  if (!existsSync(file)) return null;

  try {
    const parsed = workspaceSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    if (parsed.success) return parsed.data as Workspace;
    console.warn('[workspace] stored layout failed validation; starting fresh');
  } catch (cause) {
    console.warn('[workspace] could not read workspace.json', cause);
  }
  return null;
}

export function saveWorkspace(value: Workspace): void {
  const file = workspacePath();
  const temp = `${file}.tmp`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(temp, file);
  } catch (cause) {
    console.error('[workspace] failed to persist layout', cause);
    if (existsSync(temp)) {
      try {
        unlinkSync(temp);
      } catch {
        /* best effort */
      }
    }
  }
}
