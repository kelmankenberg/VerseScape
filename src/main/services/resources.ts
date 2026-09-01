import { app } from 'electron';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, sep } from 'node:path';
import Database from 'better-sqlite3';
import { getBook } from '@shared/reference/canon.js';
import type {
  ChapterData,
  ChapterRequest,
  CrossReference,
  CrossReferenceRequest,
  ResourceSummary,
} from '@shared/ipc/contracts.js';

const RESOURCE_SCHEMA_VERSION = '1';
const openDatabases = new Map<string, Database.Database>();

function resourceRoot(): string {
  if (process.env.VERSESCAPE_RESOURCE_DIR) return process.env.VERSESCAPE_RESOURCE_DIR;
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(process.cwd(), 'resources', 'compiled');
}

export function isResourceInstalled(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) && existsSync(join(resourceRoot(), id, `${id}.db`));
}

export function resolveResourceAsset(id: string, relativePath: string): string | null {
  if (!isResourceInstalled(id)) return null;

  const assetRoot = join(resourceRoot(), id, 'assets');
  const candidate = join(assetRoot, ...relativePath.split('/'));
  if (!existsSync(candidate)) return null;

  const realRoot = realpathSync(assetRoot);
  const realCandidate = realpathSync(candidate);
  return realCandidate.startsWith(`${realRoot}${sep}`) ? realCandidate : null;
}

function metadata(db: Database.Database): Map<string, string> {
  const rows = db.prepare('SELECT key, value FROM meta').all() as Array<{
    key: string;
    value: string;
  }>;
  return new Map(rows.map((row) => [row.key, row.value]));
}

function openResource(id: string): Database.Database {
  const cached = openDatabases.get(id);
  if (cached) return cached;

  const path = join(resourceRoot(), id, `${id}.db`);
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const meta = metadata(db);
    if (
      meta.get('schemaVersion') !== RESOURCE_SCHEMA_VERSION ||
      meta.get('id') !== id ||
      meta.get('type') !== 'bible'
    ) {
      throw new Error(`Resource ${id} is incompatible with this version of VerseScape.`);
    }
    openDatabases.set(id, db);
    return db;
  } catch (cause) {
    db.close();
    throw cause;
  }
}

function openCrossReferences(): Database.Database | null {
  const id = 'cross-references';
  const cached = openDatabases.get(id);
  if (cached) return cached;

  const path = join(resourceRoot(), id, `${id}.db`);
  if (!existsSync(path)) return null;
  const db = new Database(path, { readonly: true, fileMustExist: true });
  const schemaVersion = db
    .prepare("SELECT value FROM meta WHERE key = 'schemaVersion'")
    .pluck()
    .get();
  if (schemaVersion !== RESOURCE_SCHEMA_VERSION) {
    db.close();
    throw new Error('Cross-reference data is incompatible with this version of VerseScape.');
  }
  openDatabases.set(id, db);
  return db;
}

export function listResources(): ResourceSummary[] {
  const root = resourceRoot();
  if (!existsSync(root)) return [];

  const resources: ResourceSummary[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.name)) continue;
    if (!existsSync(join(root, entry.name, `${entry.name}.db`))) continue;

    let meta: Map<string, string>;
    try {
      meta = metadata(openResource(entry.name));
    } catch {
      // Auxiliary databases (versification, cross-references) and incompatible
      // resources are not Bible choices, but must not hide valid Bibles.
      continue;
    }
    resources.push({
      id: entry.name,
      title: meta.get('title') ?? entry.name,
      abbreviation: meta.get('abbreviation') ?? entry.name.toUpperCase(),
      language: meta.get('language') ?? 'und',
      versification: meta.get('versification') ?? 'unknown',
    });
  }

  return resources.sort((left, right) => left.title.localeCompare(right.title));
}

export function getChapter(request: ChapterRequest): ChapterData {
  const book = getBook(request.bookId);
  if (!book || request.chapter > book.chapters) {
    throw new Error(`Invalid chapter ${request.bookId} ${request.chapter}.`);
  }

  const db = openResource(request.resourceId);
  const verses = db
    .prepare(
      `SELECT verse_key, verse, text, para_start, poetry
       FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse`,
    )
    .all(request.bookId, request.chapter) as Array<{
    verse_key: number;
    verse: number;
    text: string;
    para_start: number;
    poetry: number;
  }>;
  if (verses.length === 0) {
    throw new Error(`Chapter ${request.bookId} ${request.chapter} is absent from the resource.`);
  }

  const firstKey = verses[0]!.verse_key;
  const lastKey = verses[verses.length - 1]!.verse_key;
  const headings = db
    .prepare(
      'SELECT verse_key, level, text FROM heading WHERE verse_key BETWEEN ? AND ? ORDER BY verse_key',
    )
    .all(firstKey, lastKey) as Array<{ verse_key: number; level: number; text: string }>;
  const footnotes = db
    .prepare(
      'SELECT id, verse_key, marker, text FROM footnote WHERE verse_key BETWEEN ? AND ? ORDER BY verse_key, id',
    )
    .all(firstKey, lastKey) as Array<{
    id: string;
    verse_key: number;
    marker: string;
    text: string;
  }>;

  return {
    resourceId: request.resourceId,
    bookId: request.bookId,
    chapter: request.chapter,
    verses: verses.map((verse) => ({
      key: verse.verse_key,
      verse: verse.verse,
      text: verse.text,
      paragraphStart: verse.para_start === 1,
      poetry: verse.poetry,
    })),
    headings: headings.map((heading) => ({
      key: heading.verse_key,
      level: heading.level,
      text: heading.text,
    })),
    footnotes: footnotes.map((footnote) => ({
      id: footnote.id,
      key: footnote.verse_key,
      marker: footnote.marker,
      text: footnote.text,
    })),
  };
}

export function getCrossReferences(request: CrossReferenceRequest): CrossReference[] {
  const db = openCrossReferences();
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT to_start, to_end, votes
       FROM cross_ref WHERE from_key = ? ORDER BY votes DESC, to_start LIMIT ?`,
    )
    .all(request.verseKey, request.limit) as Array<{
    to_start: number;
    to_end: number;
    votes: number;
  }>;
  return rows.map((row) => ({ startKey: row.to_start, endKey: row.to_end, votes: row.votes }));
}

export function closeResources(): void {
  for (const db of openDatabases.values()) db.close();
  openDatabases.clear();
}
