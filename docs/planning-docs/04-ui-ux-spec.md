# 04 — UI/UX Specification

## Shell anatomy

```
┌───────────────────────────────────────────────────────────────────────┐
│ ░░ drag region ░░                                                     │
│ [☰] VerseScape · John 3        [ 🔍 search… ]   [⧉][🔗][🕮] [─][□][✕] │  toolbar 40px
├──────────┬────────────────────────────────────────────────────────────┤
│ ⌂ Home   │                                                            │
│ 🕮 Bible │                 P A G E   A R E A                          │
│ 📓 Notes │        (Dashboard | Library | Notes | Workspace)           │
│ 📚 Libr. │                                                            │
│ 🗓 Plans │                                                            │
│ ────────  │                                                            │
│ ⚙ Settings                                                            │
│ 👤 Account                                                             │
├──────────┴────────────────────────────────────────────────────────────┤
│ John 3:16 · KJV        ▸ indexing 42%                    3 panels      │  status 24px
└───────────────────────────────────────────────────────────────────────┘
  rail 56 / 220px
```

## Frameless window

- `frame: false`, `titleBarStyle: 'hidden'`.
- Drag region declared with `-webkit-app-region: drag`; every interactive child
  must set `no-drag`. This is the #1 source of bugs — enforce via a shared
  `<DragRegion>` component rather than ad-hoc CSS.
- 4 px invisible resize border implemented in CSS around the window edge.
  Verified on X11 and Windows; native Wayland is out of scope for v1 (D-18).
- The top window edge carries a 4 px `no-drag` guard strip: without it the
  titlebar drag region swallows the platform resize border.
- Dragging must go through `-webkit-app-region` and never through manual
  `setPosition` calls — the latter has no future on Wayland and breaks
  compositor snap/tiling gestures.
- Window controls rendered by us. **Decision D-09:** Windows-style ordering
  (`─ □ ✕`, right-aligned) on **both** Windows and Linux. We intentionally do not
  read the GTK `button-layout` setting — one code path, one design.
- Snap layouts on Windows 11 require a hit-test region over the maximize
  button — implement via `setWindowButtonVisibility`-equivalent workaround
  (documented spike).

## Left rail

- Two states: **collapsed** (56 px, icon-only, tooltip on hover) and
  **expanded** (220 px, icon + label). Toggle via the hamburger in the toolbar
  or `Ctrl+B`. State persisted.
- Sections: primary navigation (top), utility navigation (bottom, pinned):
  Settings, Account.
- Active item has a 2 px accent bar and elevated background.
- Optional **secondary rail panel** (like VS Code's sidebar): a rail item may
  expand a 280 px contextual panel. Resizable (min 200, max 480 px) and
  collapsible; width and open state persisted. **Decision D-13: in v1, must-have.**

  | Rail section | Sidebar content                                    |
  | ------------ | -------------------------------------------------- |
  | Bible        | Book grid → chapter grid picker, recent references |
  | Notes        | Notebook tree, note list, quick filter             |
  | Library      | Installed resources, grouped by type, drag-to-open |
  | Plans        | Plan list and today's reading                      |
  | Search       | Query builder, scope pickers, search history       |

  Dashboard, Settings and Account have no sidebar; selecting them collapses it.

## Top toolbar

Left → right:

1. Rail toggle (hamburger)
2. App title + current context (`VerseScape · John 3 · KJV`), doubles as drag handle
3. Centre: global search input (`Ctrl+K` focuses), reference-aware
4. Special actions (contextual to active page):
   - Workspace: `New Panel ▾`, `Split ▾`, `Layouts ▾`, `Sync Sets ▾` (A–D)
   - Notes: `New Note`, `Export`
5. Global actions: notifications, theme toggle, profile
6. Window controls

Toolbar collapses overflow actions into a `⋯` menu below 900 px width.

## Page area

Exactly one active page. Pages:

| Page      | Content                                                           |
| --------- | ----------------------------------------------------------------- |
| Dashboard | Widget grid (Continue Reading, Plan, Recent Notes, VOTD, Layouts) |
| Workspace | The panel system (see doc 05) — the primary study surface         |
| Library   | Installed/available resources, import, downloads                  |
| Notes     | Full-page notebook browser and editor                             |
| Plans     | Reading plan list and progress                                    |
| Settings  | Sectioned settings                                                |
| Account   | Profile, licence, sync (placeholder v1)                           |

Page transitions are instant (no animation) except an optional 120 ms fade,
disabled under `prefers-reduced-motion`.

## Design tokens

**Decision D-11 — modern dark-first.** Dark is the default theme; light is a
first-class equal. Tone: compact, high-contrast, sharp (VS Code / Linear), with
dense information display in the chrome and generous, calm typography in the
reading surface. The chrome should recede; the text should dominate.

Themes are CSS custom properties on `:root[data-theme]`. Never hard-code colour.

```
--vs-bg-app        --vs-bg-surface     --vs-bg-elevated
--vs-fg-primary    --vs-fg-muted       --vs-fg-inverse
--vs-accent        --vs-accent-fg      --vs-border
--vs-danger        --vs-warning        --vs-success
--vs-highlight-{yellow|green|blue|pink|purple}
--vs-radius-{sm|md|lg}   --vs-space-{1..8}
--vs-font-ui       --vs-font-reading   --vs-font-original
```

Starting palette (to be refined against contrast targets):

| Token              | Dark      | Light     |
| ------------------ | --------- | --------- |
| `--vs-bg-app`      | `#0e1116` | `#f7f8fa` |
| `--vs-bg-surface`  | `#151a21` | `#ffffff` |
| `--vs-bg-elevated` | `#1c232c` | `#eef1f5` |
| `--vs-fg-primary`  | `#e6e9ef` | `#12161c` |
| `--vs-fg-muted`    | `#8b94a3` | `#5c6472` |
| `--vs-border`      | `#252d38` | `#dde1e8` |
| `--vs-accent`      | `#4f8cff` | `#2563d9` |

Radii 4–6 px. Chrome density: 40 px toolbar, 32 px tab strip, 24 px status bar.

Reading typography is separately configurable from UI typography:
font family, size, line height, measure (max line length), paragraph spacing.
UI font is the system UI stack; the reading font defaults to a serif.

**TBD:** shipping a Hebrew/Greek-capable font (SBL fonts have redistribution
terms to check — and must be GPL-compatible per D-08) vs relying on system fonts.
Deferred with original languages to v2.

## Interaction principles

- Every action reachable from the command palette.
- Right-click context menus everywhere (tabs, verses, notes, resources).
- Hover reveals affordances; nothing important is hover-only.
- Destructive actions confirm, and are undoable where feasible.

## Core keyboard map (draft)

| Keys               | Action                                  |
| ------------------ | --------------------------------------- |
| `Ctrl+K`           | Command palette / global search         |
| `Ctrl+B`           | Toggle rail                             |
| `Ctrl+T`           | New panel in active group               |
| `Ctrl+W`           | Close active tab                        |
| `Ctrl+\`           | Split right · `Ctrl+Shift+\` split down |
| `Ctrl+Tab`         | Next tab in group                       |
| `Ctrl+1..9`        | Focus panel group n                     |
| `Ctrl+G`           | Go to reference                         |
| `Ctrl+F`           | Find in panel                           |
| `Ctrl+Shift+F`     | Search all resources                    |
| `Ctrl+Shift+Enter` | Maximize/restore active panel           |
| `F11`              | Full screen                             |

## Accessibility

- Landmarks: `banner` (toolbar), `navigation` (rail), `main` (page), `contentinfo` (status).
- Tab groups implement the ARIA tabs pattern with arrow-key navigation.
- Drag/drop has a keyboard equivalent (move panel via command palette).
- Minimum 4.5:1 contrast; focus visible on every interactive element.
