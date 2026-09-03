import Database from 'better-sqlite3';
import { z } from 'zod';
import { getBook, toVerseKey } from '@shared/reference/index.js';
import type { ParsedBook } from './types.js';

export const resourceMeta = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  title: z.string().min(1),
  abbreviation: z.string().min(1),
  type: z.enum(['bible', 'commentary']),
  language: z.string().min(2),
  versification: z.string().min(1),
  licence: z.string().min(1),
  licenceSpdx: z.string().min(1),
  source: z.url(),
  retrieved: z.iso.date(),
  attribution: z.string().min(1).optional(),
  redistributable: z.boolean(),
  restrictions: z.string().min(1).optional(),
});

export type ResourceMeta = z.infer<typeof resourceMeta>;

export const RESOURCE_SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE book (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  chapters INTEGER NOT NULL
);

CREATE TABLE verse (
  verse_key INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES book(id),
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  para_start INTEGER NOT NULL DEFAULT 0,
  poetry INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_verse_chapter ON verse(book_id, chapter);

CREATE TABLE heading (
  verse_key INTEGER NOT NULL,
  level INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX idx_heading_key ON heading(verse_key);

CREATE TABLE footnote (
  id TEXT PRIMARY KEY,
  verse_key INTEGER NOT NULL,
  marker TEXT NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX idx_footnote_key ON footnote(verse_key);

CREATE TABLE cross_ref (
  from_key INTEGER NOT NULL,
  to_start INTEGER NOT NULL,
  to_end INTEGER NOT NULL
);
CREATE INDEX idx_cross_ref_from ON cross_ref(from_key);

CREATE TABLE strong_verse (
  strong_num TEXT NOT NULL,
  verse_key INTEGER NOT NULL,
  PRIMARY KEY (strong_num, verse_key)
);
CREATE INDEX idx_strong_num ON strong_verse(strong_num);

CREATE VIRTUAL TABLE verse_fts USING fts5(
  text,
  tokenize='unicode61 remove_diacritics 2'
);
`;

/**
 * Strips the compiler's inline markup down to plain reading text, purely for
 * FTS5 indexing. The stored \`verse.text\` keeps its markup for display; if the
 * index were built from that raw text directly, the \`<s n="G26"/>\` tag the
 * compiler inserts before every Strong's-tagged word would sit as extra
 * tokens between adjacent words and silently break phrase-adjacency queries
 * (FR-SE-02) for any Bible with per-word Strong's numbers.
 */
function stripToPlainTextForIndex(value: string): string {
  return value
    .replace(/<n id="[^"]+"\/>/gu, '')
    .replace(/<s n="[^"]+"\/>/gu, '')
    .replace(/<\/?(?:wj|i|sc)>/gu, '')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}

/**
 * Writes a compiled resource database.
 *
 * Output is deterministic for identical input: a fixed page size, no
 * timestamps, and rows inserted in verse-key order, so CI can diff two builds
 * (doc 07).
 */
export function emitResource(
  outputPath: string,
  meta: ResourceMeta,
  books: ParsedBook[],
): { verses: number; books: number } {
  const db = new Database(outputPath);

  try {
    db.pragma('page_size = 4096');
    db.pragma('journal_mode = DELETE');
    db.exec(SCHEMA);

    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    const insertBook = db.prepare(
      'INSERT INTO book (id, ordinal, name, short_name, chapters) VALUES (?, ?, ?, ?, ?)',
    );
    const insertVerse = db.prepare(
      'INSERT INTO verse (verse_key, book_id, chapter, verse, text, para_start, poetry) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const insertHeading = db.prepare(
      'INSERT INTO heading (verse_key, level, text) VALUES (?, ?, ?)',
    );
    const insertFootnote = db.prepare(
      'INSERT INTO footnote (id, verse_key, marker, text) VALUES (?, ?, ?, ?)',
    );
    const insertStrongVerse = db.prepare(
      'INSERT OR IGNORE INTO strong_verse (strong_num, verse_key) VALUES (?, ?)',
    );
    const insertFts = db.prepare('INSERT INTO verse_fts (rowid, text) VALUES (?, ?)');

    let verseCount = 0;

    const write = db.transaction(() => {
      const entries: Array<[string, string]> = [
        ['schemaVersion', String(RESOURCE_SCHEMA_VERSION)],
        ['id', meta.id],
        ['title', meta.title],
        ['abbreviation', meta.abbreviation],
        ['type', meta.type],
        ['language', meta.language],
        ['versification', meta.versification],
        ['licence', meta.licence],
        ['licenceSpdx', meta.licenceSpdx],
        ['source', meta.source],
        ['retrieved', meta.retrieved],
        ['attribution', meta.attribution ?? ''],
        ['redistributable', meta.redistributable ? '1' : '0'],
        ['restrictions', meta.restrictions ?? ''],
      ];
      for (const [key, value] of entries) insertMeta.run(key, value);

      const ordered = [...books].sort(
        (a, b) => (getBook(a.id)?.ordinal ?? 0) - (getBook(b.id)?.ordinal ?? 0),
      );

      for (const book of ordered) {
        const info = getBook(book.id);
        if (!info) continue;

        const chapters = new Set(book.verses.map((verse) => verse.chapter)).size;
        insertBook.run(book.id, info.ordinal, info.name, book.shortName, chapters);

        const sorted = [...book.verses].sort(
          (a, b) =>
            toVerseKey({ book: book.id, chapter: a.chapter, verse: a.verse }) -
            toVerseKey({ book: book.id, chapter: b.chapter, verse: b.verse }),
        );

        for (const verse of sorted) {
          const key = toVerseKey({ book: book.id, chapter: verse.chapter, verse: verse.verse });
          insertVerse.run(
            key,
            book.id,
            verse.chapter,
            verse.verse,
            verse.text,
            verse.paraStart ? 1 : 0,
            verse.poetry,
          );

          // Extract Strong's numbers and index them for concordance
          const strongMatches = verse.text.matchAll(/<s n="([^"]+)"\/>/gu);
          for (const match of strongMatches) {
            const strongNum = match[1]!;
            insertStrongVerse.run(strongNum, key);
          }

          insertFts.run(key, stripToPlainTextForIndex(verse.text));

          verseCount += 1;
        }

        for (const heading of book.headings) {
          insertHeading.run(
            toVerseKey({ book: book.id, chapter: heading.chapter, verse: heading.verse }),
            heading.level,
            heading.text,
          );
        }

        for (const note of book.footnotes) {
          insertFootnote.run(
            `${book.id}.${note.id}`,
            toVerseKey({ book: book.id, chapter: note.chapter, verse: note.verse }),
            note.marker,
            note.text,
          );
        }
      }
    });

    write();
    db.exec('VACUUM');

    return { verses: verseCount, books: books.length };
  } finally {
    db.close();
  }
}
