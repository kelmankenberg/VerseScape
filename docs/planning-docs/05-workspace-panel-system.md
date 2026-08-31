# 05 — Workspace Panel System

The defining feature. A workspace is a **recursive split tree** whose leaves are
**tab groups**, each holding one or more **panels**.

## Model

```ts
type NodeId = string;

type LayoutNode = SplitNode | GroupNode;

interface SplitNode {
  kind: 'split';
  id: NodeId;
  direction: 'row' | 'column'; // row = children side by side
  children: LayoutNode[]; // length >= 2
  sizes: number[]; // fractions, sum === 1
}

interface GroupNode {
  kind: 'group';
  id: NodeId;
  tabs: TabId[];
  activeTab: TabId;
}

interface Tab {
  id: TabId;
  panelType: string; // key into the panel registry
  state: JsonValue; // serialized panel state
  title?: string; // user override
  pinned?: boolean;
  linkSet?: LinkSetId | null;
}

interface Workspace {
  id: string;
  name: string;
  root: LayoutNode;
  tabs: Record<TabId, Tab>;
  linkSets: Record<LinkSetId, { colour: string; reference: string | null }>;
  focusedGroup: NodeId;
  updatedAt: string;
}
```

### Invariants

1. A `SplitNode` always has ≥ 2 children; collapsing to 1 replaces it with the child.
2. Adjacent splits of the same direction are flattened.
3. `sizes.length === children.length` and sums to 1 (renormalise after mutation).
4. Exactly one `focusedGroup`; it always exists in the tree.
5. Every `TabId` in the tree exists in `tabs`, and every tab in `tabs` is in exactly one group.

An invariant-checking function runs in dev builds after every mutation.

## Operations

| Op                                       | Behaviour                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `openPanel(type, init, target?)`         | Add tab to focused group (or `target`), activate it                       |
| `splitGroup(groupId, direction, tabId?)` | Wrap group in a split; move `tabId` (or a new panel) into the new sibling |
| `moveTab(tabId, toGroup, index)`         | Reorder or transfer; collapse source if emptied                           |
| `dropTabOnEdge(tabId, groupId, edge)`    | Split `groupId` at `edge` and place tab there                             |
| `closeTab(tabId)`                        | Remove; collapse empty group; rebalance sizes                             |
| `resizeSplit(splitId, sizes)`            | Set fractions, clamped to per-child minimums                              |
| `maximizeGroup(groupId)`                 | Overlay-render one group full-page; restore on Esc                        |
| `floatTab(tabId)`                        | Detach to a child window — **v2**, deferred by D-15                       |

All operations are pure reducers over `Workspace` → easy to unit test and to
back with undo/redo (`Ctrl+Shift+Z` restores closed panels — VS Code style).

## Rendering

- Splits render as flex containers with `flex-basis: <fraction>%`.
- Splitters are 4 px wide with an 8 px hit area, `role="separator"`,
  arrow-key resizable.
- Minimum group size 240 × 160 px; splits that would violate it are refused.
- Tab strip: overflow scrolls horizontally with a dropdown listing all tabs.
- **Decision D-14:** inactive tabs stay mounted (hidden) for instant switching,
  up to an **LRU cap of 8 live panels per window**. Beyond the cap the
  least-recently-used panel unmounts, keeping its serialised state, and
  remounts on activation.

  This makes _"a panel must survive unmount and remount with no visible data
  loss"_ a hard contract on every panel type. Panels with volatile state
  (an in-progress note edit, scroll position, search results) must persist it
  through the descriptor's `serialize`/`deserialize`, and an actively-editing
  panel is pinned exempt from eviction.

## Drag and drop

Drop zones per group: centre (append to tabs), and four edges at 25% inset
(split). Highlight the target region with a translucent accent overlay while
dragging. Tab strip shows an insertion caret.

Dragging outside the window does nothing in v1 (single-window, D-15).

## Link sets

- Up to 6 colour-coded sets: A–F.
- A panel's tab shows a small colour dot when linked.
- On navigation, the panel publishes `{ setId, reference, originTabId }`;
  members other than the origin navigate. Versification differences resolved
  by the mapping layer (doc 06).
- Scroll-linking (S): within a set, proportional scroll sync for panels showing
  the same passage.

## Persistence

- Active workspace is autosaved (debounced 500 ms) to SQLite.
- Named layouts are saved snapshots the user can restore; restoring replaces the
  current tree after a confirm if unsaved.
- Layout JSON is versioned; a migration function upgrades old snapshots.
- Panel state serialisation is the panel's responsibility via its descriptor.

## Presets (C)

| Preset               | Layout                                                  |
| -------------------- | ------------------------------------------------------- |
| Sermon Prep          | Row: [Bible ‖ Notes], bottom row: [Commentary ‖ Search] |
| Compare Translations | Row of 3–4 linked Bible panels                          |
| Word Study           | Bible ‖ (Lexicon over Search)                           |
| Reading              | Single maximised Bible panel                            |
