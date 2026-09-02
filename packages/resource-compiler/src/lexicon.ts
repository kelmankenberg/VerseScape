import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { z } from 'zod';

export const lexiconMeta = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  title: z.string().min(1),
  source: z.string().url(),
  retrieved: z.string().date(),
  licence: z.string().min(1),
});

export interface LexiconEntry {
  strongNumber: string;
  source: string;
}

export function parseLexicon(input: string): LexiconEntry[] {
  const entries: LexiconEntry[] = [];
  for (const line of input.split(/\r?\n/u)) {
    const match = /^(?:G|H)\d+[A-Z]?\s+/u.exec(line);
    if (!match) continue;
    const strongNumber = line.slice(0, match[0].length - 1).trim();
    entries.push({ strongNumber, source: line.slice(match[0].length) });
  }
  return entries;
}

export function compileLexicon(
  sourcePath: string,
  outputDir: string,
  meta: { id: string; title: string; source: string; retrieved: string; licence: string },
): number {
  const entries = parseLexicon(readFileSync(sourcePath, 'utf8'));
  if (entries.length === 0) return 1;
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `${meta.id}.db`);
  rmSync(outputPath, { force: true });
  const db = new Database(outputPath);
  try {
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE entry (strong_num TEXT PRIMARY KEY, source TEXT NOT NULL);
    `);
    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries({ ...meta, schemaVersion: '1' })) {
      insertMeta.run(key, value);
    }
    const insert = db.prepare('INSERT OR REPLACE INTO entry (strong_num, source) VALUES (?, ?)');
    const write = db.transaction(() => {
      for (const entry of entries) insert.run(entry.strongNumber, entry.source);
    });
    write();
  } finally {
    db.close();
  }
  writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify({ ...meta, schemaVersion: 1 }) + '\n');
  return entries.length;
}

export function lexiconChecksum(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
