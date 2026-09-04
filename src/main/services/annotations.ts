import { app, BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { fromVerseKey } from '@shared/reference/index.js';
import type {
  BookmarkRecord,
  CommentaryEntriesRequest,
  CommentaryEntryRecord,
  CopyNoteToCommentaryRequest,
  CreateBookmarkRequest,
  CreateHighlightRequest,
  CreateCommentaryEntryRequest,
  CreateNoteRequest,
  CreateNotebookRequest,
  CreateTagRequest,
  HighlightRecord,
  NotebookRecord,
  NoteRecord,
  ReadingPositionRecord,
  TagRecord,
  TagLinkRequest,
  TagsForTargetRequest,
} from '@shared/ipc/contracts.js';

/**
 * Minimal per-user store for the selection toolbar's Note and highlight
 * actions (FR-RD-06, FR-NT-14). Schema mirrors the `note`/`note_anchor`/
 * `highlight` tables in doc 06; the notebook tree, editor and highlight
 * margin indicators arrive with the rest of the Notes feature in M5.
 */

  const DEFAULT_NOTEBOOK_ID = 'default';

let db: Database.Database | null = null;

function userDbPath(): string {
  return join(app.getPath('userData'), 'versescape.db');
}

function open(): Database.Database {
  if (db) return db;

  const path = userDbPath();
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS notebook (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT REFERENCES notebook(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'notebook',
      abbreviation TEXT, description TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS note (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
      title TEXT NOT NULL, body_md TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS note_anchor (
      note_id TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
      start_key INTEGER NOT NULL, end_key INTEGER NOT NULL,
      resource_id TEXT,
      PRIMARY KEY (note_id, start_key, end_key)
    );
    CREATE INDEX IF NOT EXISTS idx_note_anchor_range ON note_anchor(start_key, end_key);
    CREATE TABLE IF NOT EXISTS highlight (
      id TEXT PRIMARY KEY,
      start_key INTEGER NOT NULL, end_key INTEGER NOT NULL,
      start_offset INTEGER, end_offset INTEGER,
      colour TEXT NOT NULL, style TEXT NOT NULL DEFAULT 'fill',
      resource_id TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_highlight_range ON highlight(start_key, end_key);
    CREATE TABLE IF NOT EXISTS bookmark (
      id TEXT PRIMARY KEY, label TEXT, verse_key INTEGER NOT NULL,
      resource_id TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmark_verse ON bookmark(verse_key);
    CREATE TABLE IF NOT EXISTS tag (
      id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, colour TEXT
    );
    CREATE TABLE IF NOT EXISTS tag_link (
      tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
      target_kind TEXT NOT NULL CHECK(target_kind IN ('note', 'highlight', 'bookmark')),
      target_id TEXT NOT NULL,
      PRIMARY KEY (tag_id, target_kind, target_id)
    );
    CREATE INDEX IF NOT EXISTS idx_tag_link_target ON tag_link(target_kind, target_id);
    CREATE TABLE IF NOT EXISTS reading_position (
      resource_id TEXT PRIMARY KEY, verse_key INTEGER NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS commentary_entry (
      note_id TEXT PRIMARY KEY REFERENCES note(id) ON DELETE CASCADE,
      anchor_kind TEXT NOT NULL CHECK(anchor_kind IN ('book', 'chapter', 'verse_range')),
      book_id TEXT NOT NULL,
      chapter INTEGER,
      start_key INTEGER,
      end_key INTEGER,
      resource_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_commentary_entry_order ON commentary_entry(book_id, chapter, start_key, end_key);
  `);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO notebook (id, name, sort_order, kind, created_at, updated_at)
     VALUES (?, 'Notes', 0, 'notebook', ?, ?)`,
  ).run(DEFAULT_NOTEBOOK_ID, now, now);

  return db;
}

export function createNote(request: CreateNoteRequest): NoteRecord {
  const database = open();
  const id = randomUUID();
  const now = new Date().toISOString();
  const notebookId = request.notebookId ?? DEFAULT_NOTEBOOK_ID;
  const notebook = database
    .prepare('SELECT id, kind FROM notebook WHERE id = ?')
    .get(notebookId) as { id: string; kind: string } | undefined;
  const targetNotebookId = notebook?.id ?? DEFAULT_NOTEBOOK_ID;
  const targetNotebookKind = notebook?.kind ?? 'notebook';

  database
    .prepare(
      `INSERT INTO note (id, notebook_id, title, body_md, created_at, updated_at)
       VALUES (?, ?, ?, '', ?, ?)`,
    )
    .run(id, targetNotebookId, request.title, now, now);
  database
    .prepare(
      `INSERT INTO note_anchor (note_id, start_key, end_key, resource_id) VALUES (?, ?, ?, ?)`,
    )
    .run(
      id,
      request.startKey ?? request.verseKey,
      request.endKey ?? request.verseKey,
      request.resourceId ?? null,
    );
  return {
    id,
    verseKey: request.startKey ?? request.verseKey,
    title: request.title,
    resourceId: request.resourceId,
    notebookId: targetNotebookId,
    notebookKind: targetNotebookKind,
  };
}

function commentaryEntryRecord(noteId: string): CommentaryEntryRecord {
  const row = open().prepare(`SELECT note.id AS noteId, note.notebook_id AS commentaryId, note.title,
    note.body_md AS bodyMd, commentary_entry.anchor_kind AS anchorKind, commentary_entry.book_id AS bookId,
    commentary_entry.chapter, commentary_entry.start_key AS startKey, commentary_entry.end_key AS endKey,
    commentary_entry.resource_id AS resourceId, note.created_at AS createdAt
    FROM commentary_entry INNER JOIN note ON note.id = commentary_entry.note_id WHERE note.id = ?`).get(noteId) as CommentaryEntryRecord | undefined;
  if (!row) throw new Error('Commentary entry not found.');
  return row;
}

export function createCommentaryEntry(request: CreateCommentaryEntryRequest): CommentaryEntryRecord {
  const database = open();
  const commentary = database.prepare("SELECT id FROM notebook WHERE id = ? AND kind = 'commentary'").get(request.commentaryId);
  if (!commentary) throw new Error('Personal Commentary not found.');
  if (request.anchorKind === 'chapter' && request.chapter === null) throw new Error('Chapter entries require a chapter.');
  if (request.anchorKind === 'verse_range' && (request.startKey === null || request.endKey === null)) throw new Error('Verse entries require a range.');
  const id = randomUUID();
  const now = new Date().toISOString();
  database.transaction(() => {
    database.prepare('INSERT INTO note (id, notebook_id, title, body_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, request.commentaryId, request.title, request.bodyMd, now, now);
    database.prepare('INSERT INTO commentary_entry (note_id, anchor_kind, book_id, chapter, start_key, end_key, resource_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, request.anchorKind, request.bookId, request.chapter, request.startKey, request.endKey, request.resourceId);
  })();
  return commentaryEntryRecord(id);
}

export function listCommentaryEntries(request: CommentaryEntriesRequest): CommentaryEntryRecord[] {
  const clauses = ['note.notebook_id = ?'];
  const values: Array<string | number> = [request.commentaryId];
  if (request.bookId) { clauses.push('commentary_entry.book_id = ?'); values.push(request.bookId); }
  if (request.chapter) { clauses.push("(commentary_entry.anchor_kind = 'book' OR commentary_entry.chapter = ?)"); values.push(request.chapter); }
  if (request.verseKey) { clauses.push("(commentary_entry.anchor_kind IN ('book', 'chapter') OR (commentary_entry.start_key <= ? AND commentary_entry.end_key >= ?))"); values.push(request.verseKey, request.verseKey); }
  return open().prepare(`SELECT note.id AS noteId, note.notebook_id AS commentaryId, note.title,
    note.body_md AS bodyMd, commentary_entry.anchor_kind AS anchorKind, commentary_entry.book_id AS bookId,
    commentary_entry.chapter, commentary_entry.start_key AS startKey, commentary_entry.end_key AS endKey,
    commentary_entry.resource_id AS resourceId, note.created_at AS createdAt
    FROM commentary_entry INNER JOIN note ON note.id = commentary_entry.note_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY CASE commentary_entry.anchor_kind WHEN 'book' THEN 0 WHEN 'chapter' THEN 1 ELSE 2 END,
      commentary_entry.start_key, commentary_entry.end_key, note.created_at`).all(...values) as CommentaryEntryRecord[];
}

export function copyNoteToCommentary(request: CopyNoteToCommentaryRequest): CommentaryEntryRecord {
  const database = open();
  const source = database.prepare('SELECT title, body_md AS bodyMd FROM note WHERE id = ?').get(request.noteId) as { title: string; bodyMd: string } | undefined;
  if (!source) throw new Error('Source note not found.');
  const anchor = fromVerseKey(request.startKey);
  if (!anchor) throw new Error('Invalid source anchor.');
  const entry = createCommentaryEntry({
    commentaryId: request.commentaryId,
    title: source.title,
    bodyMd: source.bodyMd,
    anchorKind: 'verse_range',
    bookId: anchor.book,
    chapter: null,
    startKey: request.startKey,
    endKey: request.endKey,
    resourceId: request.resourceId,
  });
  const tags = database.prepare(`SELECT tag_id AS tagId FROM tag_link WHERE target_kind = 'note' AND target_id = ?`).all(request.noteId) as Array<{ tagId: string }>;
  for (const tag of tags) database.prepare("INSERT OR IGNORE INTO tag_link (tag_id, target_kind, target_id) VALUES (?, 'note', ?)").run(tag.tagId, entry.noteId);
  return entry;
}

export function exportPersonalCommentaryXml(commentaryId: string): string {
  const commentary = open().prepare("SELECT id, name, abbreviation, description FROM notebook WHERE id = ? AND kind = 'commentary'")
    .get(commentaryId) as { id: string; name: string; abbreviation: string | null; description: string | null } | undefined;
  if (!commentary) throw new Error('Personal Commentary not found.');
  const entries = listCommentaryEntries({ commentaryId });
  const escapeAttribute = (value: string | number | null): string => escapeHtml(String(value ?? ''));
  const entryXml = entries.map((entry) => {
    const tags = listTagsForTarget({ targetKind: 'note', targetId: entry.noteId });
    const tagXml = tags.map((tag) => `    <tag colour="${escapeAttribute(tag.colour)}">${escapeHtml(tag.name)}</tag>`).join('\n');
    return `  <entry anchor-kind="${entry.anchorKind}" book-id="${escapeAttribute(entry.bookId)}" chapter="${escapeAttribute(entry.chapter)}" start-key="${escapeAttribute(entry.startKey)}" end-key="${escapeAttribute(entry.endKey)}" resource-id="${escapeAttribute(entry.resourceId)}" created-at="${escapeAttribute(entry.createdAt)}">
    <title>${escapeHtml(entry.title)}</title>
    <body><![CDATA[${entry.bodyMd.replace(/\]\]>/gu, ']]]]><![CDATA[>')}]]></body>
${tagXml}
  </entry>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<versescape-personal-commentary version="1" title="${escapeAttribute(commentary.name)}" abbreviation="${escapeAttribute(commentary.abbreviation)}" description="${escapeAttribute(commentary.description)}">
${entryXml}
</versescape-personal-commentary>`;
}

export function deletePersonalCommentary(commentaryId: string, recover: boolean): void {
  const database = open();
  const commentary = database.prepare("SELECT name FROM notebook WHERE id = ? AND kind = 'commentary'").get(commentaryId) as { name: string } | undefined;
  if (!commentary) throw new Error('Personal Commentary not found.');
  database.transaction(() => {
    if (recover) {
      const recoveryId = randomUUID();
      const now = new Date().toISOString();
      database.prepare("INSERT INTO notebook (id, name, parent_id, sort_order, kind, created_at, updated_at) VALUES (?, ?, NULL, 0, 'notebook', ?, ?)")
        .run(recoveryId, `${commentary.name} recovery`, now, now);
      database.prepare('UPDATE note SET notebook_id = ? WHERE notebook_id = ?').run(recoveryId, commentaryId);
      database.prepare('DELETE FROM commentary_entry WHERE note_id IN (SELECT id FROM note WHERE notebook_id = ?)').run(recoveryId);
    }
    database.prepare('DELETE FROM notebook WHERE id = ?').run(commentaryId);
  })();
}

export function createHighlight(request: CreateHighlightRequest): HighlightRecord {
  const database = open();
  const id = randomUUID();
  const now = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO highlight
         (id, start_key, end_key, start_offset, end_offset, colour, style, resource_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .run(
      id,
      request.verseKey,
      request.verseKey,
      request.startOffset,
      request.endOffset,
      request.colour,
      request.style,
      now,
    );

  return {
    id,
    verseKey: request.verseKey,
    startOffset: request.startOffset,
    endOffset: request.endOffset,
    colour: request.colour,
    style: request.style,
  };
}

export function listHighlights(startKey: number, endKey: number): HighlightRecord[] {
  const database = open();
  const rows = database
    .prepare(
      `SELECT id, start_key AS verseKey, start_offset AS startOffset, end_offset AS endOffset,
              colour, style
       FROM highlight WHERE start_key >= ? AND end_key <= ?`,
    )
    .all(startKey, endKey) as Array<{
    id: string;
    verseKey: number;
    startOffset: number;
    endOffset: number;
    colour: string;
    style: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    verseKey: row.verseKey,
    startOffset: row.startOffset,
    endOffset: row.endOffset,
    colour: row.colour,
    style: row.style === 'text' ? 'text' : 'fill',
  }));
}

export function createBookmark(request: CreateBookmarkRequest): BookmarkRecord {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  open()
    .prepare('INSERT INTO bookmark (id, label, verse_key, resource_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, request.label, request.verseKey, request.resourceId, createdAt);
  return { id, label: request.label, verseKey: request.verseKey, resourceId: request.resourceId, createdAt };
}

export function listBookmarks(): BookmarkRecord[] {
  const rows = open()
    .prepare('SELECT id, label, verse_key AS verseKey, resource_id AS resourceId, created_at AS createdAt FROM bookmark ORDER BY created_at DESC')
    .all() as BookmarkRecord[];
  return rows;
}

export function deleteBookmark(id: string): void {
  open().prepare('DELETE FROM bookmark WHERE id = ?').run(id);
}

export function setReadingPosition(resourceId: string, verseKey: number): ReadingPositionRecord {
  const updatedAt = new Date().toISOString();
  open()
    .prepare(`INSERT INTO reading_position (resource_id, verse_key, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(resource_id) DO UPDATE SET verse_key = excluded.verse_key, updated_at = excluded.updated_at`)
    .run(resourceId, verseKey, updatedAt);
  return { resourceId, verseKey, updatedAt };
}

export function getReadingPosition(resourceId: string): ReadingPositionRecord | null {
  return (open()
    .prepare('SELECT resource_id AS resourceId, verse_key AS verseKey, updated_at AS updatedAt FROM reading_position WHERE resource_id = ?')
    .get(resourceId) as ReadingPositionRecord | undefined) ?? null;
}

export function listTags(): TagRecord[] {
  return open().prepare('SELECT id, name, colour FROM tag ORDER BY name COLLATE NOCASE').all() as TagRecord[];
}

export function createTag(request: CreateTagRequest): TagRecord {
  const database = open();
  const existing = database.prepare('SELECT id, name, colour FROM tag WHERE name = ? COLLATE NOCASE').get(request.name) as TagRecord | undefined;
  if (existing) return existing;
  const tag = { id: randomUUID(), name: request.name, colour: request.colour };
  database.prepare('INSERT INTO tag (id, name, colour) VALUES (?, ?, ?)').run(tag.id, tag.name, tag.colour);
  return tag;
}

export function addTagLink(request: TagLinkRequest): void {
  open().prepare('INSERT OR IGNORE INTO tag_link (tag_id, target_kind, target_id) VALUES (?, ?, ?)')
    .run(request.tagId, request.targetKind, request.targetId);
}

export function deleteTagLink(request: TagLinkRequest): void {
  open().prepare('DELETE FROM tag_link WHERE tag_id = ? AND target_kind = ? AND target_id = ?')
    .run(request.tagId, request.targetKind, request.targetId);
}

export function listTagsForTarget(request: TagsForTargetRequest): TagRecord[] {
  return open()
    .prepare(`SELECT tag.id, tag.name, tag.colour FROM tag
      INNER JOIN tag_link ON tag_link.tag_id = tag.id
      WHERE tag_link.target_kind = ? AND tag_link.target_id = ? ORDER BY tag.name COLLATE NOCASE`)
    .all(request.targetKind, request.targetId) as TagRecord[];
}

export function listNotes(startKey?: number, endKey?: number): NoteRecord[] {
  const database = open();
  const range = startKey !== undefined && endKey !== undefined;
  const rows = database
    .prepare(
        `SELECT note.id, note.title, note.body_md AS bodyMd, note.notebook_id AS notebookId,
          notebook.kind AS notebookKind,
          MIN(note_anchor.start_key) AS verseKey
       FROM note
       INNER JOIN note_anchor ON note.id = note_anchor.note_id
         INNER JOIN notebook ON notebook.id = note.notebook_id
       ${range ? 'WHERE note_anchor.start_key >= ? AND note_anchor.end_key <= ?' : ''}
       GROUP BY note.id, note.title, note.body_md, note.notebook_id
       ORDER BY note.created_at DESC`,
    )
    .all(...(range ? [startKey, endKey] : [])) as Array<{
    id: string;
    title: string;
    bodyMd: string;
    notebookId: string;
    notebookKind: string;
    notebook_id: string;
    verseKey: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    verseKey: row.verseKey,
    title: row.title,
    bodyMd: row.bodyMd,
    notebookId: row.notebookId,
    notebookKind: row.notebookKind,
  }));
}

export function listNoteAnchors(noteId: string): Array<{ noteId: string; startKey: number; endKey: number; resourceId?: string }> {
  const database = open();
  const rows = database
    .prepare(
      `SELECT note_id AS noteId, start_key AS startKey, end_key AS endKey, resource_id AS resourceId
       FROM note_anchor WHERE note_id = ? ORDER BY start_key`,
    )
    .all(noteId) as Array<{ noteId: string; startKey: number; endKey: number; resourceId: string | null }>;
  return rows.map((row) => ({
    noteId: row.noteId,
    startKey: row.startKey,
    endKey: row.endKey,
    ...(row.resourceId ? { resourceId: row.resourceId } : {}),
  }));
}

export function addNoteAnchor(request: {
  noteId: string;
  startKey: number;
  endKey: number;
  resourceId?: string | undefined;
}): { noteId: string; startKey: number; endKey: number; resourceId?: string } {
  const database = open();
  database
    .prepare(
      `INSERT OR IGNORE INTO note_anchor (note_id, start_key, end_key, resource_id)
      VALUES (?, ?, ?, ?)`,
    )
    .run(request.noteId, request.startKey, request.endKey, request.resourceId ?? null);
  return {
    noteId: request.noteId,
    startKey: request.startKey,
    endKey: request.endKey,
    ...(request.resourceId ? { resourceId: request.resourceId } : {}),
  };
}

export function deleteNote(noteId: string): void {
  const database = open();
  const transaction = database.transaction(() => {
    database.prepare('DELETE FROM note_anchor WHERE note_id = ?').run(noteId);
    database.prepare('DELETE FROM note WHERE id = ?').run(noteId);
  });
  transaction();
}

export function deleteNoteAnchor(noteId: string, startKey: number, endKey: number): void {
  open()
    .prepare('DELETE FROM note_anchor WHERE note_id = ? AND start_key = ? AND end_key = ?')
    .run(noteId, startKey, endKey);
}

export function updateNote(noteId: string, bodyMd?: string, title?: string, notebookId?: string): NoteRecord {
  const database = open();
  const now = new Date().toISOString();
  database
    .prepare(
      `UPDATE note SET
         body_md = COALESCE(?, body_md),
         title = COALESCE(?, title),
            notebook_id = COALESCE(?, notebook_id),
         updated_at = ?
       WHERE id = ?`,
    )
          .run(bodyMd ?? null, title ?? null, notebookId ?? null, now, noteId);
  const row = database
    .prepare(
      `SELECT note.id, note.title, note.body_md AS bodyMd, note.notebook_id AS notebookId,
              notebook.kind AS notebookKind, note_anchor.start_key AS verseKey
       FROM note INNER JOIN note_anchor ON note.id = note_anchor.note_id
       INNER JOIN notebook ON notebook.id = note.notebook_id
       WHERE note.id = ? ORDER BY note_anchor.start_key LIMIT 1`,
    )
    .get(noteId) as {
    id: string;
    title: string;
    bodyMd: string;
    notebookId: string;
    notebookKind: string;
    verseKey: number;
  } | undefined;
  if (!row) throw new Error('Note not found.');
  return row;
}

export function listNotebooks(): NotebookRecord[] {
  const database = open();
  const rows = database
    .prepare(
            `SELECT notebook.id, notebook.name, notebook.parent_id AS parentId, notebook.kind,
              notebook.abbreviation, notebook.description,
              COUNT(note.id) AS noteCount
       FROM notebook LEFT JOIN note ON note.notebook_id = notebook.id
             GROUP BY notebook.id, notebook.name, notebook.parent_id, notebook.kind, notebook.abbreviation, notebook.description
       ORDER BY notebook.sort_order, notebook.name`,
    )
    .all() as Array<{
    id: string;
    name: string;
    parentId: string | null;
    kind: string;
    abbreviation: string | null;
    description: string | null;
    noteCount: number;
  }>;
  return rows;
}

export function createNotebook(request: CreateNotebookRequest): NotebookRecord {
  const database = open();
  const id = randomUUID();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO notebook (id, name, parent_id, sort_order, kind, abbreviation, description, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    )
    .run(id, request.name, request.parentId, request.kind, request.abbreviation, request.description, now, now);
  return {
    id,
    name: request.name,
    parentId: request.parentId,
    kind: request.kind,
    abbreviation: request.abbreviation,
    description: request.description,
    noteCount: 0,
  };
}

export async function exportNote(noteId: string, format: 'markdown' | 'html' | 'pdf'): Promise<string> {
  const database = open();
  const note = database
    .prepare('SELECT title, body_md AS bodyMd FROM note WHERE id = ?')
    .get(noteId) as { title: string; bodyMd: string } | undefined;

  if (!note) throw new Error('Note not found.');

  const title = note.title || 'Untitled Note';
  const content = note.bodyMd || '';

  if (format === 'markdown') {
    return `# ${title}\n\n${htmlToMarkdown(content)}`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${content}
</body>
</html>`;

  return format === 'pdf' ? renderPdf(html) : html;
}

export async function exportNotebook(notebookId: string, format: 'markdown' | 'html' | 'pdf'): Promise<string> {
  const database = open();

  const notebook = database
    .prepare('SELECT id, name FROM notebook WHERE id = ?')
    .get(notebookId) as { id: string; name: string } | undefined;

  if (!notebook) throw new Error('Notebook not found.');

  const notes = database
    .prepare(`
      SELECT id, title, body_md AS bodyMd
      FROM note
      WHERE notebook_id = ?
      ORDER BY created_at ASC
    `)
    .all(notebookId) as Array<{ id: string; title: string; bodyMd: string }>;

  const title = notebook.name || 'Untitled Notebook';

  if (format === 'markdown') {
    const noteContent = notes
      .map((note) => `## ${note.title || 'Untitled'}\n\n${htmlToMarkdown(note.bodyMd || '')}`)
      .join('\n\n---\n\n');
    return `# ${title}\n\n${noteContent}`;
  }

  const notesHtml = notes
    .map((note) => `<section><h2>${escapeHtml(note.title || 'Untitled')}</h2>${note.bodyMd || ''}</section>`)
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    section { margin-bottom: 2em; padding-bottom: 2em; border-bottom: 1px solid #eee; }
    section:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${notesHtml}
</body>
</html>`;

  return format === 'pdf' ? renderPdf(html) : html;
}

async function renderPdf(html: string): Promise<string> {
  const exportWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });

  try {
    await exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await exportWindow.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
    return pdf.toString('base64');
  } finally {
    if (!exportWindow.isDestroyed()) exportWindow.destroy();
  }
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<span[^>]*data-versescape-reference="([^"]+)"[^>]*>.*?<\/span>/giu, '[[ref:$1]]')
    .replace(/<h1[^>]*>(.*?)<\/h1>/giu, '# $1\n\n')
    .replace(/<h([2-6])[^>]*>(.*?)<\/h\1>/giu, '## $2\n\n')
    .replace(/<(strong|b)>(.*?)<\/(strong|b)>/giu, '**$2**')
    .replace(/<(em|i)>(.*?)<\/(em|i)>/giu, '*$2*')
    .replace(/<li[^>]*>(.*?)<\/li>/giu, '- $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/giu, '$1\n\n')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}
