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

type SyncSetId = 'A' | 'B' | 'C' | 'D';

interface Tab {
  id: TabId;
  panelType: string; // key into the panel registry
  state: JsonValue; // serialized panel state
  title?: string; // user override
  pinned?: boolean;
  syncSet?: SyncSetId | null;
}

interface Workspace {
  id: string;
  name: string;
  root: LayoutNode;
  tabs: Record<TabId, Tab>;
  syncSets: Record<SyncSetId, { colour: string; verseKey: number | null }>;
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

## Sync sets

Four sets, **A, B, C and D**, each with a colour — the Logos model.

- A panel belongs to at most one set, or to none.
- The tab shows the set letter and colour; the set is chosen from the tab
  context menu and from the toolbar's set picker.
- Sets are workspace state, saved with the layout.
- Linkable panel types: Bible, Passage Compare, Resource Reader (published and
  personal commentaries), and Notes.

## Panel header

Every syncable panel carries a slim header (28 px), independent of the global
toolbar:

```
┌────────────────────────────────────────────────────────────┐
│ [ Ezra 1:1-11        ▾ ] [KJV ▾]              (ᴀ) [⋯]      │  panel header
├────────────────────────────────────────────────────────────┤
│  1 In the first year of Cyrus king of Persia…              │
```

- **Reference input** (FR-WS-17) — present on Bible, commentary, personal
  commentary and Notes panels alike. Typing a reference navigates that panel
  *and* publishes to its sync set, so any panel can drive the others. A
  commentary panel is not a passive follower.
- **Resource selector** where the panel type has one (translation, commentary).
- **Sync set badge** (FR-WS-19) — coloured letter A–D, or blank when unlinked.
  Click to change set.
- **Overflow menu** for panel-specific options.

## Verse sync (FR-WS-13..19)

Members of a set stay on the same verse. Sync fires whenever a verse **comes
into focus**, not only on explicit navigation:

| Trigger                                  | Publishes                                                |
| ---------------------------------------- | -------------------------------------------------------- |
| Scrolling                                | verse at the viewport top, throttled to animation frames |
| Reference typed into **any** panel header | the parsed reference; a range publishes its start        |
| Clicking a verse or selecting text       | the verse containing the selection anchor                |
| Keyboard verse movement                  | the focused verse                                        |
| Opening or remounting a linked panel     | nothing; the panel adopts the set's current verse        |

Worked example — three panels in set A, a KJV Bible, Matthew Henry, and a
personal notes panel:

1. The user scrolls the Bible to Ezra 1:7.
2. The Bible publishes `{ set: 'A', verseKey: EZR.1.7, origin: bibleTab }`.
3. Matthew Henry scrolls its entry covering Ezra 1:5–11 into view.
4. The notes panel scrolls to the user's note anchored at Ezra 1:7, or to the
   nearest anchored note if none exists for that verse.
5. Typing `Ezra 3:2` into the *commentary* panel's own header reverses the
   direction: the Bible and notes panels follow it.

**Anchor by verse key, never by pixel ratio.** Proportional scrolling breaks
immediately across heterogeneous resources: a commentary entry on Romans 9 may
run for pages while the verse itself is two lines, and a notes panel may hold
one paragraph for a whole chapter. Percentage-based sync would drift apart
within a single screen.

The panel contract:

```ts
interface SyncablePanel {
  /** Verse currently at the top of this panel's viewport. */
  getAnchorVerse(): VerseKey | null;
  /** Move to a verse. `origin` lets the panel suppress its own echo. */
  scrollToVerse(key: VerseKey, options: { origin: TabId; smooth: boolean }): void;
  /** False when this panel holds no content for that verse. */
  covers(key: VerseKey): boolean;
}
```

Correctness rules:

1. The publisher is whichever panel the user last interacted with; hover alone
   does not transfer origin.
2. Publishing is throttled to animation frames and loop-guarded by originator
   id. Programmatic scrolls are tagged so they never re-publish.
3. Sync is suppressed on the origin for the gesture plus a short tail, so an
   echo cannot fight the user's own scrolling (FR-WS-15).
4. A panel that does not cover the target verse moves to the nearest covered
   verse and shows a subtle "nearest match" affordance, rather than jumping
   somewhere misleading.
5. Versification differences are resolved by the mapping layer (doc 06) before
   `scrollToVerse`.
6. Sync must survive LRU unmount and remount (D-14): on mount a panel re-joins
   its set and adopts the set's current verse.
7. "Into view" for a follower means the target verse is scrolled to the top of
   its viewport, not merely made visible somewhere on screen. Consistency
   matters more than minimal movement: a follower that only scrolls when the
   verse would otherwise be off-screen looks broken next to one that always
   aligns.
8. Followers move without animation by default. Smooth scrolling across four
   panels at once reads as lag, and `prefers-reduced-motion` must disable it
   regardless.

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
