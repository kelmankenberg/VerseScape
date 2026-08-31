# 01 — Requirements

Priority: **M** must-have v1 · **S** should-have v1 · **C** could-have · **V2** deferred.

## 1. Application shell

| ID       | Pri | Requirement                                                                                                                                                                                                             |
| -------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-SH-01 | M   | Frameless window: no OS titlebar or native control buttons on Windows or Linux.                                                                                                                                         |
| FR-SH-02 | M   | Custom draggable title region; double-click toggles maximize; standard snap behaviour preserved on Windows.                                                                                                             |
| FR-SH-03 | M   | Custom minimize / maximize-restore / close buttons that match platform ordering conventions (**TBD**: single ordering vs per-platform).                                                                                 |
| FR-SH-04 | M   | Window size and maximized state are persisted and restored. Position and display are **best-effort**: restored where the platform reports them, silently skipped where it does not (D-18).                                                                                                 |
| FR-SH-05 | M   | Collapsible left navigation rail: expanded (labels + icons) and collapsed (icons only) states, persisted.                                                                                                               |
| FR-SH-06 | M   | Top toolbar containing: app/window title, global search entry, context actions, and window controls.                                                                                                                    |
| FR-SH-07 | M   | Main "page area" hosts exactly one active page: Dashboard, Library, Notes, Settings, Account, or a Workspace.                                                                                                           |
| FR-SH-08 | V2  | Multiple app windows, each with its own workspace layout. Deferred by D-15.                                                                                                                                             |
| FR-SH-09 | S   | Command palette (`Ctrl+K` / `Ctrl+Shift+P`) for all commands.                                                                                                                                                           |
| FR-SH-10 | S   | Global status bar: current reference, sync state, background task progress.                                                                                                                                             |
| FR-SH-11 | C   | System tray icon with quick-open.                                                                                                                                                                                       |
| FR-SH-12 | M   | Secondary contextual sidebar: a rail item expands a resizable, collapsible ~280 px panel with a per-section provider (Bible book picker, notebook tree, resource list, search builder). Width and open state persisted. |

## 2. Workspace / panel system

See [05-workspace-panel-system.md](05-workspace-panel-system.md) for the model.

| ID       | Pri | Requirement                                                                                                                                        |
| -------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-WS-01 | M   | Workspace is a recursive split tree of rows and columns terminating in tab groups.                                                                 |
| FR-WS-02 | M   | User can split any tab group horizontally or vertically to arbitrary depth.                                                                        |
| FR-WS-03 | M   | Tabs can be reordered within a group and dragged between groups.                                                                                   |
| FR-WS-04 | M   | Dragging a tab to a group edge creates a new split at that edge.                                                                                   |
| FR-WS-05 | M   | Splitters are draggable; sizes stored as fractions and preserved on window resize.                                                                 |
| FR-WS-06 | M   | Closing the last tab in a group collapses the group and rebalances siblings.                                                                       |
| FR-WS-07 | M   | Layouts are named, savable, and reloadable; last layout auto-restores on launch.                                                                   |
| FR-WS-08 | S   | Panels can join a coloured "link set" and follow each other by reference.                                                                          |
| FR-WS-09 | S   | Maximize/zen a single panel temporarily (`Ctrl+Shift+Enter`).                                                                                      |
| FR-WS-10 | V2  | Float a tab into its own window; drop back to re-dock. Deferred by D-15.                                                                           |
| FR-WS-11 | C   | Layout presets shipped with the app (Sermon Prep, Compare Translations, Word Study).                                                               |
| FR-WS-12 | M   | Inactive tabs remain mounted up to an LRU cap of 8 live panels; beyond the cap panels unmount and restore from serialised state without data loss. |

### Panel types (v1)

`Bible` · `Notes` · `Search Results` · `Passage Compare` · `Reading Plan` ·
`Resource Reader` (commentaries and reference works) · `Web Article` (sandboxed) ·
`Timeline` (C)

## 3. Reading

| ID       | Pri | Requirement                                                                                                                                                                 |
| -------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-RD-01 | M   | Render a chapter or arbitrary passage range with verse numbers.                                                                                                             |
| FR-RD-02 | M   | Reference navigation bar with parser accepting `Jn 3:16`, `John 3:16-18`, `Ps 23`, etc.                                                                                     |
| FR-RD-03 | M   | Virtualised continuous scrolling across chapter boundaries within a book.                                                                                                   |
| FR-RD-04 | M   | Switch translation in-place, preserving current reference.                                                                                                                  |
| FR-RD-05 | M   | Per-panel display options: verse-per-line vs paragraph, red letter, footnotes, headings, cross-refs. Default is **verse-per-line** (D-10); the global default is a setting. |
| FR-RD-06 | S   | Text selection → context actions: highlight, note, copy with citation, search, compare.                                                                                     |
| FR-RD-07 | S   | Copy with configurable citation format.                                                                                                                                     |
| FR-RD-08 | C   | Text-to-speech read-aloud.                                                                                                                                                  |

## 4. Search

| ID       | Pri | Requirement                                                                      |
| -------- | --- | -------------------------------------------------------------------------------- |
| FR-SE-01 | M   | Full-text search across selected installed resources.                            |
| FR-SE-02 | M   | Query syntax: phrase `"..."`, boolean `AND/OR/NOT`, prefix `word*`.              |
| FR-SE-03 | M   | Scope filters: resource, testament, book range.                                  |
| FR-SE-04 | M   | Results panel with snippet + highlight; click opens reference in a target panel. |
| FR-SE-05 | S   | Search history and saved searches.                                               |
| FR-SE-06 | V2  | Original-language lemma / morphology search.                                     |

## 5. Notes, highlights, study data

| ID       | Pri | Requirement                                                                                                |
| -------- | --- | ---------------------------------------------------------------------------------------------------------- |
| FR-NT-01 | M   | Rich-text notes stored as Markdown with an extended `[[ref:BOOK.C.V]]` link syntax.                        |
| FR-NT-02 | M   | Notes organised into notebooks; a note may anchor to zero or more references.                              |
| FR-NT-03 | M   | Highlights with colour palette and optional style (underline, box), anchored to verse ranges.              |
| FR-NT-04 | M   | Bible panel shows highlight/note indicators inline in the margin.                                          |
| FR-NT-05 | S   | Bookmarks and a per-resource reading position memory.                                                      |
| FR-NT-06 | M   | Export note / notebook to Markdown, HTML, PDF — required for lesson/sermon handouts (**TBD**: PDF engine). |
| FR-NT-07 | C   | Tags across notes, highlights, and bookmarks.                                                              |
| FR-NT-08 | S   | Outline-style note mode with collapsible headings, for lesson and sermon prep.                             |

## 6. Library and resources

| ID       | Pri | Requirement                                                                                                                   |
| -------- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| FR-LB-01 | M   | Library page: installed resources, metadata, size, enable/disable, delete.                                                    |
| FR-LB-02 | M   | Import a resource from a local file in a supported open format.                                                               |
| FR-LB-03 | M   | Download resources from a configured catalogue endpoint with progress and resume.                                             |
| FR-LB-04 | M   | Only public-domain or explicitly licensed resources ship by default.                                                          |
| FR-LB-05 | M   | Import must verify checksum and record licence text; licence shown in resource info.                                          |
| FR-LB-06 | C   | User-defined catalogue sources.                                                                                               |
| FR-LB-07 | M   | Commentaries and reference works are supported resource types, openable in a Resource Reader panel and linkable by reference. |

## 7. Reading plans

| ID       | Pri | Requirement                                                    |
| -------- | --- | -------------------------------------------------------------- |
| FR-PL-01 | S   | Start a plan from bundled templates; track completion per day. |
| FR-PL-02 | S   | Dashboard widget with today's reading and streak.              |
| FR-PL-03 | C   | Custom plan builder.                                           |

## 8. Dashboard

| ID       | Pri | Requirement                                                                                         |
| -------- | --- | --------------------------------------------------------------------------------------------------- |
| FR-DB-01 | M   | Home page shown on first launch when no workspace is restored.                                      |
| FR-DB-02 | M   | Widgets: Continue Reading, Today's Reading Plan, Recent Notes, Verse of the Day, Quick Open Layout. |
| FR-DB-03 | S   | Widgets are reorderable and hideable.                                                               |

## 9. Settings and account

| ID       | Pri | Requirement                                                                                |
| -------- | --- | ------------------------------------------------------------------------------------------ |
| FR-ST-01 | M   | Dedicated Settings page: Appearance, Reading, Shortcuts, Library, Data & Backup, Advanced. |
| FR-ST-02 | M   | Theme: dark (default), light, follow system. Adjustable base font size and reading font.   |
| FR-ST-03 | M   | Full keyboard shortcut listing with rebinding and conflict detection.                      |
| FR-ST-04 | M   | Manual export/import of all user data as a single archive.                                 |
| FR-ST-05 | S   | Account page — placeholder in v1, real sync in v2.                                         |

## Non-functional

| ID     | Pri | Requirement                                                                                                      |
| ------ | --- | ---------------------------------------------------------------------------------------------------------------- |
| NFR-01 | M   | Cold start to interactive < 2 s; warm < 1 s.                                                                     |
| NFR-02 | M   | Chapter navigation renders < 100 ms; search over 5 Bibles < 300 ms p95.                                          |
| NFR-03 | M   | Idle memory < 400 MB with 6 panels open (measured at the 8-panel LRU cap, D-14).                                 |
| NFR-04 | M   | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in all renderers.                            |
| NFR-05 | M   | Fully functional with no network access.                                                                         |
| NFR-06 | M   | Keyboard operable end-to-end; visible focus ring; ARIA roles on shell landmarks.                                 |
| NFR-07 | S   | WCAG 2.1 AA contrast in both themes; respects `prefers-reduced-motion`.                                          |
| NFR-08 | M   | Deterministic reproducible builds from CI for both platforms.                                                    |
| NFR-09 | S   | Crash-safe: user data writes are transactional; no data loss on hard kill.                                       |
| NFR-10 | S   | i18n-ready string extraction from day one; English only at v1.                                                   |
| NFR-11 | M   | HiDPI and fractional scaling correct on Windows and on Linux/X11 (including XWayland). Native Wayland fidelity is a v2 goal (D-18).                                                         |
| NFR-12 | M   | All bundled dependencies, fonts and resources must be GPL-3.0-compatible (D-08); enforced by a CI licence check. |
