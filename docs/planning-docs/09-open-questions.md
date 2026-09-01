# 09 — Open Questions

Blocking decisions, grouped. Answer these and the docs above become concrete.
Settled items are struck through and recorded in [13-decision-log.md](13-decision-log.md).

## A. Product

| #      | Question                                                 | Options / default                                                                        |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ~~A1~~ | ~~Who is the primary v1 user?~~                          | **Resolved D-01:** lay reader + group leader + pastor. Academic → v2.                    |
| ~~A2~~ | ~~Personal, open-source, or commercial?~~                | **Resolved D-02:** open source, free forever.                                            |
| A3     | Which Bible translations must ship in v1?                | **Resolved D-26:** bundled KJV + Berean Standard Bible; WEB/ASV/YLT/Darby/Geneva via catalogue. |
| ~~A4~~ | ~~Commentaries in v1 or v2?~~                            | **Resolved D-01:** v1, via Resource Reader. Which commentaries? (see E7)                 |
| ~~A5~~ | ~~Is cloud sync ever planned?~~                          | **Resolved D-22:** no. Local-first; backups go to a user-chosen folder.                  |
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
| ~~C5~~ | ~~Are link sets user-visible colours (A–F) or implicit?~~                       | **Resolved D-23:** four explicit sets A–D, Logos-style, chosen per tab.      |
| ~~C6~~ | ~~Should each panel have its own toolbar, or use the global toolbar contextually?~~ | **Resolved D-25:** slim per-panel header carrying the reference input and sync badge; the global toolbar keeps workspace-level actions. |

## D. Reading experience

| #      | Question                                                              | Options / default                                             |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| ~~D1~~ | ~~Default reading layout?~~                                           | **Resolved D-10:** one verse per line; paragraph is a toggle. |
| ~~D2~~ | ~~Continuous scroll across whole book, or per-chapter paging?~~       | **Closed 2026-09-01 by D-30:** seamless bidirectional continuous scroll within the current book for Bible and commentary panels. |
| D3     | Original-language fonts — bundle SBL fonts (check licence) or system? | Deferred with originals to v2.                                |
| D4     | Audio Bible / TTS in scope at all?                                    | Default: no.                                                  |

## E. Data and resources

| #      | Question                                                        | Options / default                                                                    |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| E1     | Confirm one-DB-per-resource over one monolithic DB.             | Default: per-resource.                                                               |
| ~~E2~~ | ~~Is SWORD module support worth the licence review?~~           | **Resolved D-26:** no. Distribution permission is granted to CrossWire and is not transferable. |
| E3     | Where is the resource catalogue hosted?                         | Default: GitHub Releases + signed `catalog.json`.                                    |
| ~~E4~~ | ~~Which versification mapping dataset, and under what licence?~~ | **Resolved D-26:** STEPBible **TVTMS** (CC BY 4.0 — verify).                        |
| ~~E5~~ | ~~Bundle resources vs fetch on first run?~~                     | **Resolved D-04:** bundle a small PD set, download the rest from a signed catalogue. |
| E6     | Notes stored as Markdown text vs ProseMirror JSON?              | Default: Markdown for portability; accept minor fidelity loss.                       |
| ~~E7~~ | ~~Which public-domain commentaries for v1?~~                    | **Resolved D-26:** Matthew Henry (Concise) + JFB, from CCEL / htmlbible.com.         |
| E8     | **New** — Who signs and hosts the catalogue for an OSS project? | GitHub Releases + a project key committed to the repo; key custody matters.          |
| E9     | **New** — Does UK Crown copyright on the KJV affect distributing a bundled KJV? | **Accepted risk.** Public domain outside the UK; perpetual letters patent within it. Distribution is non-commercial (D-02). Recorded in `LICENSES.md`, not formally resolved. |
| E10    | **New** — Confirm licences at source for BSB, STEPBible TVTMS, openbible.info cross-references, and each CCEL commentary. | **Closed 2026-09-01.** All verified with quoted statements in `packages/resource-compiler/LICENSES.md`: BSB (CC0), WEB/eBible (PD, per-translation check required), STEPBible TVTMS (CC BY 4.0), openbible.info (CC BY 4.0), CCEL (non-commercial — **excluded**). |
| ~~E11~~ | ~~Which transcription of Matthew Henry and JFB do we compile?~~ | **Closed 2026-09-01.** CCEL confirmed the texts are public domain and that their claim covers their files and formatting only. We take text and discard formatting. See `LICENSES.md`. |

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

## H. Accounts and sync (deferred — D-22)

D-22 settled the shape of this: **no web sync, local-first, backups to a
user-chosen folder.** Most of these questions are therefore closed. They stay
recorded because they become live again if a first-party service is ever
considered.

| #      | Question                                                                         | Notes                                                                                                                       |
| ------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ~~H1~~ | ~~Who pays for and operates the sync server?~~                                    | **Closed by D-22:** there is no sync server.                                                                                |
| ~~H2~~ | ~~Self-hosted / BYO-storage instead of a first-party service?~~                   | **Closed by D-22:** effectively BYO-storage — backups go to the user's own cloud-synced folder.                             |
| H3     | End-to-end encryption of note content — and if so, how is key recovery handled?  | **Deliberately postponed.** Only becomes relevant if a service is ever built. Note: backups sitting in a cloud folder are readable by that provider today — see H7. |
| ~~H4~~ | ~~Auth mechanism?~~                                                              | **Moot** while accounts are deferred.                                                                                       |
| ~~H5~~ | ~~Conflict resolution beyond last-writer-wins?~~                                  | **Moot** while there is no sync. Relevant again if two machines ever share one backup folder — see H8.                       |
| ~~H6~~ | ~~Does an account ever gate any non-sync feature?~~                               | **Closed:** no. There is no account.                                                                                        |
| H7     | Should the backup archive be optionally encrypted with a user passphrase?         | Backups in a Dropbox/Drive folder are plainly readable by that provider. Sermon notes may be personal. Cheap to add.         |
| H8     | What happens if two machines back up to, and restore from, the same folder?        | Not sync, but users will try it. At minimum, name archives per-device and never auto-restore.                               |
