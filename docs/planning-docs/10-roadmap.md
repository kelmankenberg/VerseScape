# 10 — Roadmap

Sequenced by dependency, not by date. Each milestone ends with something runnable.

## M0 — Foundations

- pnpm workspace, TypeScript strict, ESLint/Prettier, Vitest
- electron-vite scaffold: main / preload / renderer with HMR
- Hardened `BrowserWindow` per doc 08; CSP in place from day one
- Typed IPC contract module + Zod validation + one round-trip smoke test
- CI: lint, typecheck, unit tests on Linux and Windows
- **Exit:** blank hardened window builds and runs on both OSes

## M1 — App shell

- Frameless window, custom drag region, window controls, resize edges
- Window state persistence
- Collapsible rail with placeholder pages, top toolbar, status bar
- Secondary contextual sidebar with a provider interface (FR-SH-12)
- Theme tokens, dark/light/system, settings persisted to `settings.json`
- Page router (Dashboard / Library / Notes / Settings / Account / Workspace stubs)
- **Exit:** FR-SH-01..07, FR-SH-12 demonstrable; Playwright test drives window controls
- **Risk spike:** Windows 11 snap layouts over the custom maximize button

## M2 — Workspace engine

- Layout tree model, reducers, invariant checker, full unit-test suite
- Split/resize rendering with splitters
- Tab strip, activation, close, reorder
- Drag/drop between groups and edge-split drop zones
- Panel registry + two trivial panel types for testing
- Panel header shell: reference input, resource selector slot, sync badge
- Reference model, parser, formatter and book-name autocomplete (shared
  infrastructure, needed by every panel header — D-25)
- Sync set plumbing A–D: membership, badges, publish/subscribe, loop guard
- LRU mount manager (cap 8) and the unmount/remount panel contract
- Layout persistence and restore
- **Exit:** FR-WS-01..07, FR-WS-12, FR-WS-17..19; a user can build a 2×3 layout and it survives restart

## M3 — Bible reading

- Resource compiler tool; compile KJV + **Berean Standard Bible** (D-26)
- Compile the STEPBible TVTMS versification map and openbible.info cross-references
- `LICENSES.md` provenance record started (NFR-14)
- Resource DB access layer, `versescape://` protocol
- Verse-key indexed virtualisation: the renderer must name the verse at the
  viewport top cheaply, every frame, or sync cannot work (D-23)
- Bible panel: chapter render, translation switch, and a sliding virtualised
  chapter window that automatically prepends/appends adjacent chapters without
  jumping the viewport (FR-RD-03, D-30)
- Display options; Passage Compare panel
- Verse sync made real across Bible panels: scroll, click, selection, keyboard
- **Exit:** FR-RD-01..05, FR-WS-08, FR-WS-13..16; three synced panels track together

## M4 — Search

- FTS query parser → MATCH expression
- Cross-resource fan-out search in the utility process
- Search Results panel, scope filters, click-to-open into a target panel
- Find-in-panel
- **Exit:** FR-SE-01..04 and NFR-02 search budget met

## M5 — Notes and highlights

- Notes schema, notebook tree, TipTap editor with `ref` nodes
- Notes panel + full-page Notes view
- Notes panel joins sync sets and follows the current verse
- Personal commentary: notebook `kind`, verse-keyed entry view, commentary
  panel, create/edit from a Bible selection (FR-NT-09..12)
- Outline mode with collapsible headings (lesson/sermon prep)
- Highlights: selection → colour, margin indicators, persistence
- Selection context menu (copy with citation, note, highlight, search)
- Export note/notebook to Markdown, HTML and PDF
- **Exit:** FR-NT-01..12

## M6 — Library and resources

- Library page: list, enable/disable, delete, resource info with licence
- `.vsres` import with full validation and sandboxed extraction
- Signed catalogue fetch, resumable download, atomic install
- Resource Reader panel; compile Matthew Henry and JFB commentaries from CCEL
  (D-29 — text only, never their formatting)
- Commentary continuous reading: automatically traverse previous/next chapter
  coverage with stable prepend anchoring, matching Bible-panel behavior (D-30)
- Commentary follows its sync set alongside Bible panels
- Personal commentaries listed in the Library and exportable as `.vsres`
  (FR-NT-13)
- Configurable library location with move-and-rollback migration, plus the
  unavailable-path degraded state (FR-LB-08/09)
- **Exit:** FR-LB-01..09

## M7 — Dashboard, plans, polish

- Dashboard widgets; Continue Reading; Verse of the Day
- Reading plans from templates with progress tracking
- Command palette, full keyboard map, shortcut rebinding
- Accessibility pass; empty states; error states; first-run onboarding
- **Exit:** FR-DB-*, FR-PL-01..02, FR-SH-09, NFR-06

## M8 — Release

- electron-builder config: AppImage, deb, NSIS
- Auto-update channel, signing (F3 permitting)
- Backup/export/import of user data, with a user-chosen backup directory,
  cloud-folder guard rails and optional scheduled backups (FR-ST-06..08)
- Performance pass against NFR-01..03
- Docs: user guide, keyboard reference, resource authoring guide
- **Exit:** installable v1.0 on Linux and Windows

## Deferred to v2

Original languages and lexicons · multi-window and floating panels (D-15) ·
native Wayland (D-18) · timeline/atlas panels · plugin API · macOS ·
collaborative features

**Deferred indefinitely:** accounts, sign-in and cloud database sync (D-22).

## Cross-cutting risks

| Risk                                                             | Mitigation                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Frameless window quirks on Wayland                               | Deferred, not mitigated: v1 targets X11/XWayland (D-18). Revisit in v2.                                 |
| Custom docking engine is the largest unknown (D-03, no fallback) | Build the reducer layer first with exhaustive unit tests before any UI; invariant checker in dev builds |
| Public-domain commentary source data quality varies wildly       | Pick 1–2 well-structured sources; the compiler fails loudly on malformed input                          |
| Unsigned Windows installer deters users (F3)                     | Decide early; document SmartScreen bypass in release notes if unsigned                                  |
| Resource licensing ambiguity                                     | Public domain only for v1; licence read at source, recorded per resource with retrieval date (NFR-14) |
| better-sqlite3 native rebuilds across platforms                  | Pin versions, build in CI matrix, cache prebuilds                                                       |
| Scroll sync feels laggy or fights the user (D-19)                | Verse-key anchoring, rAF throttling, origin suppression; measure against NFR-02 with 6 linked panels    |
| User puts the live database in a cloud-synced folder (D-24)      | Refuse for the user DB, warn for the library; document why in Settings and the user guide              |
| Library on a removable or network drive disappears               | Degraded startup with a banner (FR-LB-09); resources open read-only so nothing corrupts                |
| Scope creep from Logos feature parity                            | Requirements table is the contract; new asks go to v2                                                   |
