import { app, BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import type {
  CreateHighlightRequest,
  CreateNoteRequest,
  CreateNotebookRequest,
  HighlightRecord,
  NotebookRecord,
  NoteRecord,
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
              COUNT(note.id) AS noteCount
       FROM notebook LEFT JOIN note ON note.notebook_id = notebook.id
       GROUP BY notebook.id, notebook.name, notebook.parent_id, notebook.kind
       ORDER BY notebook.sort_order, notebook.name`,
    )
    .all() as Array<{
    id: string;
    name: string;
    parentId: string | null;
    kind: string;
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
      `INSERT INTO notebook (id, name, parent_id, sort_order, kind, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(id, request.name, request.parentId, request.kind, now, now);
  return { id, name: request.name, parentId: request.parentId, kind: request.kind, noteCount: 0 };
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
