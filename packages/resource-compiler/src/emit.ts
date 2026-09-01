import Database from 'better-sqlite3';
import { getBook, toVerseKey } from '@shared/reference/index.js';
import type { ParsedBook } from './types.js';

export interface ResourceMeta {
  id: string;
  title: string;
  abbreviation: string;
  type: 'bible' | 'commentary';
  language: string;
  versification: string;
  licence: string;
  licenceSpdx: string;
  source: string;
  retrieved: string;
  attribution?: string;
}

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

CREATE VIRTUAL TABLE verse_fts USING fts5(
  text,
  content='verse',
  content_rowid='verse_key',
  tokenize='unicode61 remove_diacritics 2'
);
`;

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

      // Built here so the shipped resource needs no first-run indexing.
      db.exec("INSERT INTO verse_fts(verse_fts) VALUES('rebuild')");
    });

    write();
    db.exec('VACUUM');

    return { verses: verseCount, books: books.length };
  } finally {
    db.close();
  }
}
