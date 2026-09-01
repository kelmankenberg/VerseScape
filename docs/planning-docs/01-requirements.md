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
| FR-WS-08 | M   | Panels can join one of four sync sets (**A, B, C, D**) and follow each other by reference. Bible, commentary, Resource Reader and Notes panels are all linkable. Each tab shows its set, and the set is chosen from the tab's context menu and the toolbar. |
| FR-WS-09 | S   | Maximize/zen a single panel temporarily (`Ctrl+Shift+Enter`).                                                                                      |
| FR-WS-10 | V2  | Float a tab into its own window; drop back to re-dock. Deferred by D-15.                                                                           |
| FR-WS-11 | C   | Layout presets shipped with the app (Sermon Prep, Compare Translations, Word Study).                                                               |
| FR-WS-12 | M   | Inactive tabs remain mounted up to an LRU cap of 8 live panels; beyond the cap panels unmount and restore from serialised state without data loss. |
| FR-WS-13 | M   | **Verse sync.** When a panel in a sync set moves to a verse, every other member moves to the same verse. Triggered by scrolling, explicit navigation, clicking or selecting a verse, and keyboard movement — anything that brings a verse into focus. |
| FR-WS-14 | M   | Sync anchors on **verse keys, not scroll percentage**, so a Bible, a commentary and a notes panel stay aligned despite content of wildly different lengths. Panels not covering the target verse move to the nearest covered verse and indicate the near miss. |
| FR-WS-15 | M   | Sync is loop-guarded and throttled; the panel the user is actively driving is never moved by its own echo.                                          |
| FR-WS-16 | S   | A panel may follow a set for reference but opt out of scroll-following, to hold still while the user reads elsewhere.                              |

### Panel types (v1)

`Bible` · `Notes` · `Search Results` · `Passage Compare` · `Reading Plan` ·
`Resource Reader` (published commentaries and reference works) ·
`Personal Commentary` · `Web Article` (sandboxed) · `Timeline` (C)

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
| FR-NT-09 | M   | **Personal commentary.** A notebook can be designated a personal commentary: a user-authored resource whose entries are keyed to a verse or verse range. |
| FR-NT-10 | M   | A personal commentary opens in a commentary panel alongside published commentaries, appears in the Library, and participates in sync sets and verse sync exactly as a published resource does. |
| FR-NT-11 | M   | Entries may anchor to a single verse or an arbitrary verse range, and more than one entry may cover the same verse. The panel shows every entry covering the current reference, in canonical order. |
| FR-NT-12 | M   | Creating or editing an entry is possible directly from the commentary panel and from a Bible panel's selection context menu.                       |
| FR-NT-13 | S   | A personal commentary can be exported as a whole to Markdown/HTML/PDF, and shared as a `.vsres` resource file others can import.                    |

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
| FR-LB-08 | M   | The library location is user-configurable — another drive, an external disk or a network share. Changing it moves the existing library with progress and rollback on failure. |
| FR-LB-09 | M   | If the configured library path is unavailable at startup, the app launches in a degraded state with a clear banner rather than failing or re-downloading. |

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
| FR-ST-06 | M   | The backup destination is a user-chosen directory. Pointing it at a Dropbox, MEGA, Google Drive, iCloud or OneDrive folder is supported and requires no account or API integration — the vendor's own client syncs the folder. |
| FR-ST-07 | S   | Scheduled automatic backups (on quit and/or daily) with a configurable retention count.     |
| FR-ST-08 | M   | The app refuses to place the live user database in a directory it detects as cloud-synced, and warns for the library. Sync clients corrupt open SQLite files. |

## 10. Account and sync (deferred, not planned for v1 or v2 scope yet)

**VerseScape is a local-first desktop application. It does not sync its
database to a web service.** Off-device continuity is achieved by pointing the
backup destination at a folder the user's existing cloud client already syncs
(FR-ST-06) — no server, no account, no data custody on our part.

These requirements are retained only so the schema does not foreclose the
option later. See decision D-22, which supersedes D-21.

| ID       | Pri      | Requirement                                                                                                                                 |
| -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-AC-01 | Deferred | A user can create an account and sign in from the Account page.                                                                             |
| FR-AC-02 | Deferred | Signing in is **optional**. Every feature except sync works fully without an account, offline, forever. The app never prompts on first run. |
| FR-AC-03 | Deferred | Signed-in users can sync notes, personal commentaries, highlights, bookmarks, reading positions, plans and layouts across devices.          |
| FR-AC-04 | Deferred | Resources are **never** synced; the library is re-downloaded per device from the catalogue.                                                 |
| FR-AC-05 | Deferred | Sync is last-writer-wins per record with a conflict log the user can inspect; no silent data loss.                                          |
| FR-AC-06 | Deferred | Sign out wipes credentials and offers to keep or remove local data; local data is retained by default.                                      |
| FR-AC-07 | Deferred | Tokens are stored in the OS keychain via `safeStorage`, never in `settings.json`.                                                           |
| FR-AC-08 | Deferred | Account deletion removes all server-side data on request, and the client can export everything first.                                       |
| FR-AC-09 | Deferred | Sync payloads are encrypted in transit; end-to-end encryption of note content is unresolved and deliberately postponed (see **H3**).        |

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
