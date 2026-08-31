# 06 — Data Model

## Storage locations

| Data         | Location                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------- |
| User DB      | `app.getPath('userData')/versescape.db`                                                           |
| Resources    | `userData/resources/<resourceId>/` (one SQLite file + assets per resource)                        |
| Search index | Per-resource FTS tables inside the resource DB; a shared `catalog.db` for cross-resource metadata |
| Settings     | `userData/settings.json` (human-editable, Zod-validated)                                          |
| Logs         | `userData/logs/`                                                                                  |
| Backups      | `userData/backups/`                                                                               |

Rationale for **one DB per resource**: install/uninstall is a file operation,
resources stay read-only and shareable, and the user DB stays small and easy to
back up.

## Reference model

```ts
interface Reference {
  book: BookId; // canonical 3-letter OSIS-style id, e.g. 'JHN'
  chapter: number;
  verse?: number;
  subverse?: string; // 'a' | 'b' for split verses
}

interface ReferenceRange {
  start: Reference;
  end: Reference;
}
```

- Canonical book list is OSIS ids, including deuterocanon so those resources are
  representable even if not shipped.
- A **verse key** integer `bookIndex * 10^6 + chapter * 10^3 + verse` gives cheap
  range queries and sorting.
- **Versification** differs between traditions (KJV, LXX, MT, Vulgate). Each
  resource declares its scheme; a mapping table translates between schemes when
  linking panels. v1 ships KJV + MT mappings; unmapped verses fall back to
  chapter-level alignment and are flagged in the UI.

## User database schema (draft)

```sql
-- migrations are numbered files; this is the v1 shape

CREATE TABLE notebook (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT REFERENCES notebook(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE note (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body_md TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE note_anchor (
  note_id TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  start_key INTEGER NOT NULL, end_key INTEGER NOT NULL,
  resource_id TEXT,                        -- null = translation-agnostic
  PRIMARY KEY (note_id, start_key, end_key)
);
CREATE INDEX idx_note_anchor_range ON note_anchor(start_key, end_key);

CREATE TABLE highlight (
  id TEXT PRIMARY KEY,
  start_key INTEGER NOT NULL, end_key INTEGER NOT NULL,
  start_offset INTEGER, end_offset INTEGER,   -- char offsets for partial-verse
  colour TEXT NOT NULL, style TEXT NOT NULL DEFAULT 'fill',
  resource_id TEXT, created_at TEXT NOT NULL
);
CREATE INDEX idx_highlight_range ON highlight(start_key, end_key);

CREATE TABLE bookmark (
  id TEXT PRIMARY KEY, label TEXT, verse_key INTEGER NOT NULL,
  resource_id TEXT, created_at TEXT NOT NULL
);

CREATE TABLE tag (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, colour TEXT);
CREATE TABLE tag_link (
  tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,   -- 'note' | 'highlight' | 'bookmark'
  target_id TEXT NOT NULL,
  PRIMARY KEY (tag_id, target_kind, target_id)
);

CREATE TABLE workspace (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  layout_json TEXT NOT NULL, layout_version INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);

CREATE TABLE reading_plan (
  id TEXT PRIMARY KEY, template_id TEXT, name TEXT NOT NULL,
  start_date TEXT NOT NULL, schedule_json TEXT NOT NULL
);
CREATE TABLE reading_plan_progress (
  plan_id TEXT NOT NULL REFERENCES reading_plan(id) ON DELETE CASCADE,
  day INTEGER NOT NULL, completed_at TEXT,
  PRIMARY KEY (plan_id, day)
);

CREATE TABLE reading_position (
  resource_id TEXT PRIMARY KEY, verse_key INTEGER NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); -- schema_version etc.
```

Notes are stored as Markdown text; the editor's custom nodes serialise to
`[[ref:JHN.3.16-JHN.3.18]]` and `![[note:<id>]]` so the corpus stays portable.

## Resource database schema (per resource, read-only)

```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- id, title, abbreviation, type, language, versification, licence,
-- publisher, year, checksum, schema_version

CREATE TABLE book (id TEXT PRIMARY KEY, ordinal INTEGER, name TEXT, short_name TEXT, chapters INTEGER);

CREATE TABLE verse (
  verse_key INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
  text TEXT NOT NULL,      -- lightly marked-up inline format
  para_start INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE heading (verse_key INTEGER, level INTEGER, text TEXT);
CREATE TABLE footnote (id TEXT PRIMARY KEY, verse_key INTEGER, marker TEXT, text TEXT);
CREATE TABLE cross_ref (from_key INTEGER, to_start INTEGER, to_end INTEGER);

CREATE VIRTUAL TABLE verse_fts USING fts5(
  text, content='verse', content_rowid='verse_key', tokenize='unicode61 remove_diacritics 2'
);
```

Non-Bible resources (commentaries, dictionaries) use an `entry` table keyed by
article id with an optional reference range, sharing the same FTS pattern.

## Resource manifest

Every resource directory contains `manifest.json`, Zod-validated on import:

```json
{
  "schemaVersion": 1,
  "id": "kjv",
  "title": "King James Version",
  "abbreviation": "KJV",
  "type": "bible",
  "language": "en",
  "versification": "kjv",
  "licence": { "spdx": "PublicDomain", "text": "…" },
  "files": [{ "path": "kjv.db", "sha256": "…" }]
}
```

## Backup and export

- `Settings → Data & Backup` produces `versescape-backup-<date>.zip` containing
  the user DB, settings, and a manifest — **not** resources.
- Automatic rolling local backup before every schema migration.
