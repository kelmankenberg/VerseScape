import { z } from 'zod';
import { LAYOUT_VERSION, SYNC_SET_IDS } from './types.js';
import type { LayoutNode } from './types.js';

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

export const syncSetId = z.enum(SYNC_SET_IDS as unknown as [string, ...string[]]);

export const groupNode = z.object({
  kind: z.literal('group'),
  id: z.string().min(1),
  tabs: z.array(z.string().min(1)).min(1),
  activeTab: z.string().min(1),
});

export const layoutNode: z.ZodType<LayoutNode> = z.lazy(() =>
  z.union([
    groupNode,
    z.object({
      kind: z.literal('split'),
      id: z.string().min(1),
      direction: z.enum(['row', 'column']),
      children: z.array(layoutNode).min(2),
      sizes: z.array(z.number().positive()).min(2),
    }),
  ]),
) as z.ZodType<LayoutNode>;

export const tab = z.object({
  id: z.string().min(1),
  panelType: z.string().min(1),
  state: jsonValue,
  title: z.string().nullable(),
  pinned: z.boolean(),
  syncSet: syncSetId.nullable(),
});

export const syncSetState = z.object({
  colour: z.string().min(1),
  verseKey: z.number().int().nullable(),
});

export const workspace = z.object({
  id: z.string().min(1),
  name: z.string(),
  layoutVersion: z.number().int().positive(),
  root: layoutNode,
  tabs: z.record(z.string(), tab),
  syncSets: z.record(syncSetId, syncSetState),
  focusedGroup: z.string().min(1),
  maximizedGroup: z.string().nullable(),
  recentlyClosed: z.array(
    z.object({ tab, groupId: z.string().min(1), index: z.number().int().nonnegative() }),
  ),
  updatedAt: z.string(),
});

/**
 * Persisted layouts are versioned. Anything older than the current version is
 * routed through a migration rather than parsed directly.
 */
export function isCurrentLayoutVersion(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { layoutVersion?: unknown }).layoutVersion === LAYOUT_VERSION
  );
}
