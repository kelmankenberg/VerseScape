import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import type {
  CreateHighlightRequest,
  CreateNoteRequest,
  HighlightRecord,
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

  database
    .prepare(
      `INSERT INTO note (id, notebook_id, title, body_md, created_at, updated_at)
       VALUES (?, ?, ?, '', ?, ?)`,
    )
    .run(id, DEFAULT_NOTEBOOK_ID, request.title, now, now);
  database
    .prepare(
      `INSERT INTO note_anchor (note_id, start_key, end_key, resource_id) VALUES (?, ?, ?, ?)`,
    )
    .run(id, request.verseKey, request.verseKey, request.resourceId ?? null);

  return { id, verseKey: request.verseKey, title: request.title, resourceId: request.resourceId };
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
      `SELECT note.id, note.title, note.body_md AS bodyMd, note.notebook_id,
          MIN(note_anchor.start_key) AS verseKey
       FROM note
       INNER JOIN note_anchor ON note.id = note_anchor.note_id
       ${range ? 'WHERE note_anchor.start_key >= ? AND note_anchor.end_key <= ?' : ''}
       GROUP BY note.id, note.title, note.body_md, note.notebook_id
       ORDER BY note.created_at DESC`,
    )
    .all(...(range ? [startKey, endKey] : [])) as Array<{
    id: string;
    title: string;
    bodyMd: string;
    notebook_id: string;
    verseKey: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    verseKey: row.verseKey,
    title: row.title,
    bodyMd: row.bodyMd,
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

export function updateNote(noteId: string, bodyMd: string): NoteRecord {
  const database = open();
  const now = new Date().toISOString();
  database.prepare('UPDATE note SET body_md = ?, updated_at = ? WHERE id = ?').run(bodyMd, now, noteId);
  const row = database
    .prepare(
      `SELECT note.id, note.title, note.body_md AS bodyMd, note_anchor.start_key AS verseKey
       FROM note INNER JOIN note_anchor ON note.id = note_anchor.note_id
       WHERE note.id = ? ORDER BY note_anchor.start_key LIMIT 1`,
    )
    .get(noteId) as { id: string; title: string; bodyMd: string; verseKey: number } | undefined;
  if (!row) throw new Error('Note not found.');
  return row;
}
