/**
 * Workspace layout model (doc 05).
 *
 * A workspace is a recursive split tree whose leaves are tab groups. Everything
 * here is pure data: no React, no DOM, no Electron. It lives in `shared` rather
 * than the renderer because the main process validates persisted layouts
 * against the same schema.
 */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type NodeId = string;
export type TabId = string;

/** Four sync sets, Logos-style (D-23). */
export type SyncSetId = 'A' | 'B' | 'C' | 'D';
export const SYNC_SET_IDS: readonly SyncSetId[] = ['A', 'B', 'C', 'D'];

export type Direction = 'row' | 'column';
export type Edge = 'left' | 'right' | 'top' | 'bottom';

export interface SplitNode {
  kind: 'split';
  id: NodeId;
  /** `row` lays children out side by side; `column` stacks them. */
  direction: Direction;
  children: LayoutNode[];
  /** Fractions, one per child, summing to 1. */
  sizes: number[];
}

export interface GroupNode {
  kind: 'group';
  id: NodeId;
  /** Never empty: a group that loses its last tab is removed from the tree. */
  tabs: TabId[];
  activeTab: TabId;
}

export type LayoutNode = SplitNode | GroupNode;

export interface Tab {
  id: TabId;
  /** Key into the renderer's panel registry. */
  panelType: string;
  state: JsonValue;
  /** User override; null means the panel supplies its own title. */
  title: string | null;
  pinned: boolean;
  syncSet: SyncSetId | null;
}

export interface SyncSetState {
  colour: string;
  /** Current verse key for the set, or null before anything has published. */
  verseKey: number | null;
}

/** Enough context to put a closed tab back where it came from. */
export interface ClosedTab {
  tab: Tab;
  groupId: NodeId;
  index: number;
}

export interface Workspace {
  id: string;
  name: string;
  layoutVersion: number;
  root: LayoutNode;
  tabs: Record<TabId, Tab>;
  syncSets: Record<SyncSetId, SyncSetState>;
  focusedGroup: NodeId;
  /** Group rendered full-page over the others, or null. */
  maximizedGroup: NodeId | null;
  recentlyClosed: ClosedTab[];
  updatedAt: string;
}

/**
 * Injected so reducers stay pure and tests stay deterministic.
 */
export interface WorkspaceContext {
  newId: () => string;
  now: () => string;
}

export const LAYOUT_VERSION = 1;
export const MAX_RECENTLY_CLOSED = 10;

/** Matches the 240x160 minimum group size in doc 05 at a typical window size. */
export const MIN_SPLIT_FRACTION = 0.05;

export const DEFAULT_SYNC_SET_COLOURS: Record<SyncSetId, string> = {
  A: '#4f8cff',
  B: '#3fb950',
  C: '#e0a336',
  D: '#c678dd',
};
