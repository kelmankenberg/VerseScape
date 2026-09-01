# 09 — Open Questions

Blocking decisions, grouped. Answer these and the docs above become concrete.
Settled items are struck through and recorded in [13-decision-log.md](13-decision-log.md).

## A. Product

| #      | Question                                                 | Options / default                                                                        |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ~~A1~~ | ~~Who is the primary v1 user?~~                          | **Resolved D-01:** lay reader + group leader + pastor. Academic → v2.                    |
| ~~A2~~ | ~~Personal, open-source, or commercial?~~                | **Resolved D-02:** open source, free forever.                                            |
| A3     | Which Bible translations must ship in v1?                | Default: KJV, ASV, WEB, YLT (all public domain). Which are _bundled_ vs downloaded?      |
| ~~A4~~ | ~~Commentaries in v1 or v2?~~                            | **Resolved D-01:** v1, via Resource Reader. Which commentaries? (see E7)                 |
| A5     | Is cloud sync ever planned?                              | Default: design the schema for it, ship nothing in v1.                                   |
| A6     | Is macOS a future target?                                | Default: keep the code portable, do not build/test it.                                   |
| A7     | **New** — Which open-source licence?                     | **Resolved D-08:** GPL-3.0-or-later.                                                     |
| A8     | **New** — Do you want public contributions from day one? | Drives CONTRIBUTING.md, issue templates, code of conduct, and how strict the PR gate is. |

## B. Shell and window chrome

| #      | Question                                                                           | Options / default                                          |
| ------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| ~~B1~~ | ~~Window control button order on Linux?~~                                          | **Resolved D-09:** Windows-style on both platforms.        |
| ~~B2~~ | ~~Support Wayland client-side decorations properly, or force `--ozone-platform=x11`?~~ | **Resolved D-18:** native Wayland deferred to v2; v1 runs on X11/XWayland. |
| ~~B3~~ | ~~Multiple top-level windows in v1?~~                                              | **Resolved D-15:** single window in v1; multi-window → v2. |
| ~~B4~~ | ~~Secondary contextual sidebar in v1?~~                                            | **Resolved D-13:** yes, must-have (FR-SH-12).              |
| B5     | Status bar in v1?                                                                  | Default: yes, minimal.                                     |

## C. Workspace / panels

| #      | Question                                                                        | Options / default                                                            |
| ------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ~~C1~~ | ~~Custom layout engine or `dockview`?~~                                         | **Resolved D-03:** custom engine, committed.                                 |
| ~~C2~~ | ~~Do background tabs stay mounted?~~                                            | **Resolved D-14:** mounted, LRU cap of 8.                                    |
| ~~C3~~ | ~~Floating/detached panels in v1 or v2?~~                                       | **Resolved D-15:** v2.                                                       |
| C4     | Max split depth?                                                                | Default: unlimited by model, minimum-size constraint limits it in practice.  |
| C5     | Are link sets user-visible colours (A–F) or implicit?                           | Default: explicit colours, Logos-style.                                      |
| C6     | Should each panel have its own toolbar, or use the global toolbar contextually? | Default: slim per-panel header + global toolbar for workspace-level actions. |

## D. Reading experience

| #      | Question                                                              | Options / default                                             |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| ~~D1~~ | ~~Default reading layout?~~                                           | **Resolved D-10:** one verse per line; paragraph is a toggle. |
| D2     | Continuous scroll across whole book, or per-chapter paging?           | Default: continuous within a book.                            |
| D3     | Original-language fonts — bundle SBL fonts (check licence) or system? | Deferred with originals to v2.                                |
| D4     | Audio Bible / TTS in scope at all?                                    | Default: no.                                                  |

## E. Data and resources

| #      | Question                                                        | Options / default                                                                    |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| E1     | Confirm one-DB-per-resource over one monolithic DB.             | Default: per-resource.                                                               |
| E2     | Is SWORD module support worth the licence review?               | Default: no for v1; USFM/OSIS only.                                                  |
| E3     | Where is the resource catalogue hosted?                         | Default: GitHub Releases + signed `catalog.json`.                                    |
| E4     | Which versification mapping dataset, and under what licence?    | Needs research.                                                                      |
| ~~E5~~ | ~~Bundle resources vs fetch on first run?~~                     | **Resolved D-04:** bundle a small PD set, download the rest from a signed catalogue. |
| E6     | Notes stored as Markdown text vs ProseMirror JSON?              | Default: Markdown for portability; accept minor fidelity loss.                       |
| E7     | **New** — Which public-domain commentaries for v1?              | **Resolved D-16:** Matthew Henry + JFB. Source data still to be located.             |
| E8     | **New** — Who signs and hosts the catalogue for an OSS project? | GitHub Releases + a project key committed to the repo; key custody matters.          |

## F. Engineering

| #   | Question                                                                   | Options / default                                                                           |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| F1  | React vs Svelte?                                                           | Default: React, for dnd/virtualisation ecosystem.                                           |
| F2  | electron-vite vs Electron Forge?                                           | Default: electron-vite + electron-builder.                                                  |
| F3  | Windows code signing — unsigned v1, self-funded cert, or a free OSS route? | **Resolved D-12:** pursue free OSS routes (SignPath, winget/Chocolatey); unsigned fallback. |
| F4  | Auto-update in v1?                                                         | Default: yes, opt-in prompt.                                                                |
| F5  | Test depth for v1 — where is the line?                                     | Default: unit-test reducers/parsers hard, 6–8 Playwright happy paths.                       |
| F6  | Repo: single package or pnpm workspace (app + resource-compiler + shared)? | Default: pnpm workspace.                                                                    |

## G. Naming and branding

| #      | Question                                                                                      |
| ------ | --------------------------------------------------------------------------------------------- |
| ~~G1~~ | ~~App icon / logo?~~ **Resolved D-17:** placeholder mark for now.                             |
| G2     | Linux app id and desktop entry name (`app.versescape.VerseScape`?).                           |
| ~~G3~~ | ~~Accent colour and visual tone?~~ **Resolved D-11:** modern dark-first, VS Code/Linear feel. |

## H. Accounts and sync (v2, D-21)

None of these block v1, but they shape whether v2 is feasible for a free
GPL project with no revenue (D-02).

| #   | Question                                                                            | Notes                                                                                                                        |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| H1  | Who pays for and operates the sync server?                                          | The unsolved problem. Options: self-hostable server, a BYO-storage model (user's own Dropbox/WebDAV/S3), or a funded service. |
| H2  | Self-hosted / BYO-storage instead of a first-party service?                         | Fits the GPL and privacy stance far better and removes hosting cost; worse onboarding for non-technical users.                |
| H3  | End-to-end encryption of note content — and if so, how is key recovery handled?     | E2EE plus "I forgot my password" is a genuine tension; losing a decade of sermon notes is unacceptable.                       |
| H4  | Auth mechanism: email + password, magic link, or OAuth via an existing provider?    | Device-code flow keeps credentials out of the app.                                                                           |
| H5  | Conflict resolution beyond last-writer-wins for long-form note bodies?              | Two devices editing the same note offline is the realistic bad case; consider CRDT or per-field merge.                        |
| H6  | Does an account ever gate any non-sync feature?                                     | Strong default: **no**, per FR-AC-02.                                                                                        |
