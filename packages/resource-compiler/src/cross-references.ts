import Database from 'better-sqlite3';
import { lookupBook, toVerseKey } from '@shared/reference/index.js';

export interface CrossReference {
  fromKey: number;
  toStart: number;
  toEnd: number;
  votes: number;
}

function parseKey(value: string): number {
  const match = /^(\d?[A-Za-z]+)\.(\d+)\.(\d+)$/u.exec(value);
  if (!match) throw new Error(`Invalid cross-reference: ${value}`);
  const book = lookupBook(match[1]!);
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!book || chapter < 1 || chapter > book.chapters || verse < 1) {
    throw new Error(`Invalid cross-reference: ${value}`);
  }
  return toVerseKey({ book: book.id, chapter, verse });
}

export function parseCrossReferences(source: string): CrossReference[] {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  if (!lines[0]?.startsWith('From Verse\tTo Verse\tVotes')) {
    throw new Error('Cross-reference header is missing.');
  }

  return lines.slice(1).flatMap((line, index) => {
    if (!line.trim()) return [];
    const [from, target, votesText, ...extra] = line.split('\t');
    if (!from || !target || !votesText || extra.length > 0) {
      throw new Error(`Malformed cross-reference row ${index + 2}.`);
    }
    const [start, explicitEnd] = target.split('-', 2);
    const votes = Number(votesText);
    if (!Number.isInteger(votes)) {
      throw new Error(`Invalid vote count at cross-reference row ${index + 2}.`);
    }
    return [
      {
        fromKey: parseKey(from),
        toStart: parseKey(start!),
        toEnd: parseKey(explicitEnd ?? start!),
        votes,
      },
    ];
  });
}

export function emitCrossReferences(outputPath: string, rows: CrossReference[]): void {
  const db = new Database(outputPath);
  try {
    db.pragma('page_size = 4096');
    db.pragma('journal_mode = DELETE');
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE cross_ref (
        from_key INTEGER NOT NULL,
        to_start INTEGER NOT NULL,
        to_end INTEGER NOT NULL,
        votes INTEGER NOT NULL,
        PRIMARY KEY (from_key, to_start, to_end)
      );
      CREATE INDEX idx_cross_ref_from_votes ON cross_ref(from_key, votes DESC);
    `);
    db.prepare('INSERT INTO meta VALUES (?, ?)').run('schemaVersion', '1');
    const insert = db.prepare('INSERT INTO cross_ref VALUES (?, ?, ?, ?)');
    db.transaction(() => {
      for (const row of rows) insert.run(row.fromKey, row.toStart, row.toEnd, row.votes);
    })();
    db.exec('VACUUM');
  } finally {
    db.close();
  }
}
