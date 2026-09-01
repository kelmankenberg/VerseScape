# 00 — Vision and Scope

## One-liner

VerseScape is an offline-first desktop Bible study workspace that lets a reader
open many resources side by side, keep them in sync by scripture reference, and
capture their own notes and study output.

## Problem

Existing serious Bible study software is either expensive and heavyweight
(Logos, Accordance), or lightweight but weak on multi-resource workflows
(most web readers). Linux support in the serious tier is poor.

## Target users

| Persona            | v1?     | Need                                                         |
| ------------------ | ------- | ------------------------------------------------------------ |
| Lay student        | **Yes** | Read a translation, follow cross-references, keep notes      |
| Small-group leader | **Yes** | Prepare a lesson, assemble passages and notes into a handout |
| Pastor / teacher   | **Yes** | Compare translations, consult commentaries, sermon prep      |
| Academic           | v2      | Original-language morphology, lexicons, citation export      |

Decision D-01: the first three personas define v1. Original-language study is
deliberately deferred so that reading, notes, commentaries and the workspace can
be excellent rather than broad.

## Product pillars

1. **Offline-first.** Everything works with no network. Network is for
   downloading resources and optional sync only.
2. **Workspace, not a reader.** Arbitrary rows/columns of tabbed panels that the
   user arranges and saves as named layouts.
3. **Linked reading.** Panels can join a "link set" and follow one another by
   scripture reference, staying aligned as the reader scrolls.
4. **Own your data.** Notes are plain, exportable, and stored locally in an open
   format.
5. **Cross-platform parity.** Linux is a first-class target, not an afterthought.

## In scope (v1)

- Bible reading with multiple translations
- Custom panel workspace (tabs, splits, saved layouts)
- Linked reading: panels follow one another by reference **and scroll together**
- Dashboard / home page
- Notes and highlights linked to references
- Personal commentary: user-authored, verse-keyed, usable as a resource
- Commentaries and reference works via a generic Resource Reader panel
- Sermon/lesson prep: outline notes and export to Markdown/HTML/PDF
- Full-text and reference search across installed resources
- Local resource library management + import + catalogue download
- Reading plans (basic)
- Light/dark theming, keyboard shortcuts, command palette

## Out of scope (v1)

- Mobile / web clients
- Accounts, sign-in and multi-device sync — specified for v2 (D-21), and v1
  keeps the schema ready for it
- Original-language morphology and lexicon integration (v2)
- Commercial resource store / DRM — the app is free and open source
- Collaborative real-time editing
- macOS packaging (build should not preclude it)

## Non-goals

- Not a church presentation tool.
- Not a general-purpose ebook reader.
- Not a Logos resource-format compatibility layer. **Legal constraint:** we do
  not read or convert third-party proprietary or encrypted resource formats.

## Success criteria for v1

- Cold start to interactive under 2 s on a mid-range machine.
- Open 6 panels across 2 rows, sync-scroll a chapter, no perceptible jank.
- Full-text search across 5 installed Bibles returns in under 300 ms.
- Ships as `.deb`/AppImage and Windows NSIS installer from one CI pipeline.
