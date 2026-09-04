import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { getBook } from '@shared/reference/index.js';
import { RESOURCE_SCHEMA_VERSION } from './emit.js';
import type { ResourceMeta } from './emit.js';

const commentarySource = z.object({
  entries: z.array(z.object({
    id: z.string().min(1).optional(),
    bookId: z.string().regex(/^(?:[1-3])?[A-Z]{2,3}$/u),
    chapter: z.number().int().positive().nullable().default(null),
    startKey: z.number().int().positive().nullable().default(null),
    endKey: z.number().int().positive().nullable().default(null),
    title: z.string().max(500).default(''),
    body: z.string().min(1).max(1_000_000),
  })).min(1),
});

const schema = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE entry (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  chapter INTEGER,
  start_key INTEGER,
  end_key INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE INDEX idx_entry_book_chapter ON entry(book_id, chapter);
CREATE INDEX idx_entry_range ON entry(start_key, end_key);
CREATE VIRTUAL TABLE entry_fts USING fts5(title, body, content='entry', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
`;

/** Compiles a normalized, source-format-independent commentary entry document. */
export function compileCommentary(sourcePath: string, outputDir: string, meta: ResourceMeta): number {
  if (meta.type !== 'commentary') throw new Error('Commentary metadata must use type "commentary".');
  const source = commentarySource.parse(JSON.parse(readFileSync(sourcePath, 'utf8')));
  for (const entry of source.entries) {
    if (!getBook(entry.bookId as never)) throw new Error(`Unknown commentary book ${entry.bookId}.`);
    if ((entry.startKey === null) !== (entry.endKey === null)) throw new Error('Commentary range entries require both startKey and endKey.');
    if (entry.startKey !== null && entry.endKey !== null && entry.startKey > entry.endKey) throw new Error('Commentary entry range is reversed.');
  }

  mkdirSync(outputDir, { recursive: true });
  const databasePath = join(outputDir, `${meta.id}.db`);
  rmSync(databasePath, { force: true });
  const database = new Database(databasePath);
  try {
    database.pragma('page_size = 4096');
    database.pragma('journal_mode = DELETE');
    database.exec(schema);
    const write = database.transaction(() => {
      const insertMeta = database.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
      for (const [key, value] of Object.entries({
        schemaVersion: String(RESOURCE_SCHEMA_VERSION), id: meta.id, title: meta.title,
        abbreviation: meta.abbreviation, type: meta.type, language: meta.language,
        versification: meta.versification, licence: meta.licence, licenceSpdx: meta.licenceSpdx,
        source: meta.source, retrieved: meta.retrieved, attribution: meta.attribution ?? '',
        redistributable: meta.redistributable ? '1' : '0', restrictions: meta.restrictions ?? '',
      })) insertMeta.run(key, value);
      const insertEntry = database.prepare('INSERT INTO entry (id, book_id, chapter, start_key, end_key, title, body) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const insertFts = database.prepare('INSERT INTO entry_fts (rowid, title, body) VALUES (?, ?, ?)');
      [...source.entries].sort((left, right) => (left.startKey ?? 0) - (right.startKey ?? 0) || (left.endKey ?? 0) - (right.endKey ?? 0) || left.title.localeCompare(right.title)).forEach((entry, index) => {
        const id = entry.id ?? `entry-${String(index + 1).padStart(6, '0')}`;
        insertEntry.run(id, entry.bookId, entry.chapter, entry.startKey, entry.endKey, entry.title, entry.body);
        const rowid = database.prepare('SELECT rowid FROM entry WHERE id = ?').pluck().get(id) as number;
        insertFts.run(rowid, entry.title, entry.body);
      });
    });
    write();
  } finally {
    database.close();
  }

  const checksum = createHash('sha256').update(readFileSync(databasePath)).digest('hex');
  writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify({
    schemaVersion: RESOURCE_SCHEMA_VERSION, id: meta.id, title: meta.title, abbreviation: meta.abbreviation,
    type: meta.type, language: meta.language, versification: meta.versification, deliveryMode: 'local',
    licence: { spdx: meta.licenceSpdx, text: meta.licence, attribution: meta.attribution ?? null, source: meta.source, retrieved: meta.retrieved, redistributable: meta.redistributable, restrictions: meta.restrictions ?? null },
    files: [{ path: `${meta.id}.db`, sha256: checksum }],
  }, null, 2)}\n`, 'utf8');
  return source.entries.length;
}
