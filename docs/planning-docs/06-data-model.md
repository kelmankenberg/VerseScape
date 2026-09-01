# 06 — Data Model

## Storage locations

| Data         | Default location                                                                                  | User-configurable       |
| ------------ | ------------------------------------------------------------------------------------------------- | ----------------------- |
| User DB      | `app.getPath('userData')/versescape.db`                                                           | No — see the warning    |
| Resources    | `userData/resources/<resourceId>/` (one SQLite file + assets per resource)                        | **Yes** (FR-LB-08)      |
| Search index | Per-resource FTS tables inside the resource DB; a shared `catalog.db` for cross-resource metadata | Follows the library     |
| Settings     | `userData/settings.json` (human-editable, Zod-validated)                                          | No                      |
| Logs         | `userData/logs/`                                                                                  | No                      |
| Backups      | `userData/backups/`                                                                               | **Yes** (FR-ST-06)      |

Rationale for **one DB per resource**: install/uninstall is a file operation,
resources stay read-only and shareable, and the user DB stays small and easy to
back up.

### Configurable library location (FR-LB-08)

The library may live on another drive — a NAS mount, an external disk, or a
second SSD — because a full commentary set is large. Requirements that follow:

- The path is validated on selection: it must exist, be writable, and have
  enough free space for the current library.
- Changing the location **moves** the existing library with progress and a
  rollback on failure; it never silently orphans resources.
- If the path is missing at startup (drive unplugged, network share down), the
  app starts in a degraded state with a clear banner and the library disabled,
  rather than failing to launch or re-downloading.
- Resource files are opened read-only, so a slow or removable volume degrades
  performance but cannot corrupt anything.

### Configurable backup location (FR-ST-06)

The backup destination is an ordinary directory path. Pointing it at a
Dropbox, MEGA, Google Drive, iCloud or OneDrive folder is explicitly supported
and needs **no API integration or account** — the vendor's desktop client syncs
the folder. This is how off-device backup works while the app stays local-first.

> **Do not put the live database or the library in a cloud-synced folder.**
> Sync clients copy files mid-write and reconcile them behind our back. For
> SQLite that means a WAL desynchronised from its database and a corrupted
> store. Backups are safe because they are written once, atomically, and never
> reopened for writing.
>
> The app therefore refuses to place the **user DB** in a directory it detects
> as cloud-synced, warns loudly for the **library**, and permits it freely for
> **backups**. Detection is best-effort by well-known folder names, so the
> warning is advisory rather than a hard guarantee.

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
  -- 'notebook' = ordinary notes; 'commentary' = a personal commentary that
  -- surfaces in the Library and opens in a commentary panel (FR-NT-09).
  kind TEXT NOT NULL DEFAULT 'notebook',
  abbreviation TEXT,                       -- shown on the panel tab
  description TEXT,
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
  "id": "bsb",
  "title": "Berean Standard Bible",
  "abbreviation": "BSB",
  "type": "bible",
  "language": "en",
  "versification": "kjv",
  "deliveryMode": "local",
  "licence": {
    "spdx": "PublicDomain",
    "text": "…",
    "attribution": null,
    "source": "https://berean.bible/",
    "retrieved": "2026-08-31"
  },
  "files": [{ "path": "bsb.db", "sha256": "…" }]
}
```

`deliveryMode` is `local` for every v1 resource. `online` is reserved for
API-delivered texts, which are deferred (D-27) and would be excluded from
full-text search.

## Personal commentary

A personal commentary (FR-NT-09) is **not** a second storage format. It is a
notebook with `kind = 'commentary'`, read through a view that presents its notes
as verse-keyed entries:

```sql
-- every entry covering a reference, in canonical order
SELECT n.id, n.title, n.body_md, a.start_key, a.end_key
FROM note n
JOIN note_anchor a ON a.note_id = n.id
WHERE n.notebook_id = :notebookId
  AND a.start_key <= :key AND a.end_key >= :key
ORDER BY a.start_key, a.end_key DESC, n.created_at;
```

Consequences of reusing notes rather than duplicating:

- Editing an entry is editing a note; there is one copy and no sync problem.
- A note may carry several anchors, so one entry can cover several passages.
- Overlapping entries are allowed and all are shown; ordering is widest-range
  first so a chapter-level comment precedes a verse-level one.
- The Library lists personal commentaries beside published ones, marked as
  user-authored and always editable.
- Export to `.vsres` (FR-NT-13) compiles the notebook through the same emitter
  the resource compiler uses for published commentaries, so a shared personal
  commentary is indistinguishable from any other resource on import.

## Sync readiness (v2)

Accounts and sync are v2 (D-21), but v1 schema choices must not block them:

- Every user-data row uses a **client-generated UUID** primary key, never an
  autoincrement integer, so records created offline on two devices never collide.
- Every user-data table carries `created_at` and `updated_at` in UTC ISO-8601.
- Deletions intended to sync need tombstones; v1 hard-deletes, and a migration
  will add a `deleted_at` column rather than reworking the tables.
- Nothing in the schema assumes a single device or a single user profile.

## Backup and export

- `Settings → Data & Backup` produces `versescape-backup-<date>.zip` containing
  the user DB, settings, and a manifest — **not** resources.
- Automatic rolling local backup before every schema migration.
