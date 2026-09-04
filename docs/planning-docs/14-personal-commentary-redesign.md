# 14 - Personal Commentary Redesign

## Status

**Accepted design; implementation pending.** This document supersedes the
implementation interpretation of Personal Commentary (PC) used during M5. It
does not supersede decision D-20's single-store constraint: PC entries remain
notes with canonical Scripture anchors. The presentation, authoring workflow,
and sync behavior change.

## Product Intent

A Personal Commentary is an optional, user-authored commentary resource. It
appears alongside installed commentaries such as Matthew Henry and JFB and is
read as a complete, canonically ordered work rather than as a collection of
individual notes.

Notes and PCs serve different jobs:

| Notes | Personal Commentary |
| --- | --- |
| Private working material, organised by notebooks and arbitrary anchors. | A named authored commentary, organised by canonical Scripture coverage. |
| The Notes page and Notes panel are the primary editing surfaces. | A Commentary Reader panel is the primary reading surface. |
| A note may have no anchor or many anchors. | Each published PC entry has one canonical verse or verse-range anchor. |
| Notes follow a synced Bible reference to show relevant notes. | A synced PC reader follows the Bible reference and selects/scrolls to the matching commentary entry. |
| Notes are not automatically public resources. | A PC becomes a Library resource only when the user elects to create one. |

## Creation and Lifecycle

1. The user opens **Library** and chooses **Create Personal Commentary**.
2. They provide a title, abbreviation, and optional description.
3. VerseScape creates a `notebook.kind = 'commentary'` record and registers it
   in the Library as a user-authored resource. No default PC is created.
4. The resource can be opened in a Commentary Reader panel, just like an
   installed commentary.
5. Deleting a PC opens a confirmation that requires the user to choose either
  **Convert entries to ordinary notes** in a recovery notebook or **Export XML
  and delete**. The latter writes the portable XML file before deletion.

## Library and Workspace UI

### Library

- Personal commentaries appear under a **Personal Commentaries** group, visually
  distinct from installed resources but using the same resource-row interaction.
- Each row exposes title, abbreviation, entry count, last updated time, and an
  overflow menu for edit metadata, export, and delete/archive.
- A PC can be opened into the workspace by double-clicking or using the row
  action, exactly as an installed commentary would be.

### Commentary Reader Panel

- The panel header has the normal reference input, PC selector, sync-set badge,
  and overflow menu.
- The reading surface shows all PC entries in canonical order. It is continuous
  within the current book, loading adjacent chapters at either scroll edge.
- Sparse coverage is explicit: a quiet no-entry state appears for verses or
  chapters without an entry. The reader never creates blank entries while
  reading.
- When linked to a sync set, the PC reader follows the set's active verse. It
  scrolls to the entry covering that verse and marks it active. If several
  entries cover a verse, they remain in canonical order and all are visible.
- Selecting a verse/reference in the PC reader publishes that anchor to the sync
  set, allowing the PC to drive linked Bible panels.

### Authoring

- The PC reader has an explicit **Edit** mode, not an always-visible note
  editor. Reading remains clean and resource-like by default.
- In Edit mode, an author can add an entry for the current reference, a chapter
  introduction, or a book introduction; edit its title/body; change its
  canonical anchor; and remove it.
- Entry bodies use the same rich-text and `[[ref:BOOK.C.V]]` support as Notes.
- Creating a PC entry requires a canonical Scripture anchor: book, chapter, or
  verse range. An ordinary note may still have zero or multiple anchors.

## Add Note to Personal Commentary

The Notes panel's note context menu gains **Add to Personal Commentary** directly
above **Delete note**.

1. If no PC exists, the action opens the PC creation flow and preserves the
   selected note as the pending source.
2. If exactly one PC exists, the action adds the note to that PC.
3. If several PCs exist, the action opens a compact chooser; it must not guess.
4. The user selects one of the note's anchors as the PC entry's canonical anchor.
   For a note with one anchor, that anchor is selected by default.
5. The note is inserted at its anchor's canonical position in the PC reader.
   Display order is computed from `start_key`, then `end_key`, then creation
   time; no manual reordering is needed for Scripture coverage.

The operation creates an independent **copy into PC**. The source ordinary note
is unchanged, and the copied entry may be edited independently. A source note
may be copied into more than one PC.

## Export and Import

- **XML** is the canonical portable PC interchange format and the default for
  export/import. It contains PC metadata, entry text, canonical anchor type and
  value, tags, and timestamps.
- Markdown, HTML, and PDF are additional export formats intended for reading,
  sharing, and handouts; they are not import formats.
- XML import creates a new PC after validating its metadata and canonical
  anchors. It does not overwrite an existing PC.

## Data and Migration Model

The shared `notebook`, `note`, and `note_anchor` tables remain the source of
truth. No duplicate commentary body store is introduced.

Required constraints and metadata:

- `notebook.kind = 'commentary'` identifies a PC.
- `notebook.abbreviation` and `notebook.description` become required at PC
  creation time, while remaining optional for ordinary notebooks.
- A PC entry is a note whose `notebook_id` identifies a commentary notebook.
- A new `commentary_entry` table should identify the canonical anchor chosen for
  each PC entry: `note_id PRIMARY KEY`, `anchor_kind` (`book`, `chapter`, or
  `verse_range`), `book_id`, nullable `chapter`, nullable `start_key`/
  `end_key`, and nullable `resource_id`. This removes ambiguity when a source
  note has multiple anchors while supporting introductions.
- Existing `note_anchor` rows are retained so ordinary-note behavior is not
  destroyed. The PC reader queries `commentary_entry` for its reading order.
- Copying a note into a PC is transactional: create an independent destination
  note, copy its body and tags, and write its canonical anchor.

## Implementation Plan

1. Replace the current Commentary panel with a generic Commentary Reader data
   contract that can read installed resources and PC entries.
2. Add PC metadata and `commentary_entry` migration, validated IPC contracts,
   and Library registration/listing for user-authored PCs.
3. Implement canonical entry queries, coverage lookup, bidirectional continuous
   reading, and sync-set behavior for the PC reader.
4. Implement reader Edit mode and canonical-anchor entry creation/editing.
5. Add the Notes context-menu action and PC chooser/anchor picker with copy
  semantics, plus XML export/import and the deletion recovery choice.
6. Add focused unit tests for canonical ordering and migrations, plus Electron
   end-to-end coverage for creation, sync in both directions, and adding a note.
7. Update M5/M6 scope and decision D-20 after implementation is complete.

## Settled Decisions

| ID | Question | Options / proposed default | Why it matters |
| --- | --- | --- | --- |
| PC-01 | Add note behavior | Copy into PC; no default move action. |
| PC-02 | Multiple source anchors | Compact anchor picker; a single anchor is preselected. |
| PC-03 | Multiple PCs | A source note may be copied into multiple PCs. |
| PC-04 | Entry editing | Copied PC entries are independently editable. |
| PC-05 | PC deletion | Prompt for conversion to a recovery notebook or XML export before deletion. |
| PC-06 | Portability | XML is the default export/import format; Markdown, HTML, and PDF remain export options. |
| PC-07 | Introduction entries | Support book- and chapter-level introductions without a verse. |
| PC-08 | Overlapping coverage order | Start key, end key, creation time. |
| PC-09 | Bible-selection content | Pre-fill title only, matching ordinary note creation. |
| PC-10 | Tags and anchors | Tags supported; one canonical PC anchor plus optional source-note anchors. |

## Acceptance Criteria

- A user with no PC sees no required setup or empty default resource.
- A user can create a named PC from Library and open it as a commentary reader.
- The PC reader is visually and behaviorally resource-like: canonical, continuous,
  sparse-aware, and syncable in both directions with Bible panels.
- A note can be added to a chosen PC from its context menu, with explicit anchor
  selection when necessary and deterministic placement.
- Notes and PC entries remain distinguishable and independently understandable
  throughout creation, editing, export, deletion, and recovery.