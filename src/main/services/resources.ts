import { app } from 'electron';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, normalize, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { getBook } from '@shared/reference/canon.js';
import { loadSettings, patchSettings } from './settings.js';
import type {
  ChapterData,
  ChapterRequest,
  CommentaryResourceEntriesRequest,
  CommentaryResourceEntry,
  ConcordanceRequest,
  CrossReference,
  CrossReferenceRequest,
  LibraryResource,
  LibraryLocation,
  ResourceEnabledRequest,
  ResourceSummary,
} from '@shared/ipc/contracts.js';

function openLexicon(strongNumber: string): Database.Database | null {
  const id = strongNumber.startsWith('H') ? 'tbesh' : 'tbesg';
  const path = join(resourceRoot(), id, `${id}.db`);
  if (!existsSync(path)) return null;
  const cached = openDatabases.get(id);
  if (cached) return cached;
  const db = new Database(path, { readonly: true, fileMustExist: true });
  openDatabases.set(id, db);
  return db;
}

const RESOURCE_SCHEMA_VERSION = '1';
const openDatabases = new Map<string, Database.Database>();

const libraryManifest = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  title: z.string().min(1),
  abbreviation: z.string().min(1),
  type: z.enum(['bible', 'commentary']),
  language: z.string().min(2),
  versification: z.string().min(1),
  licence: z.object({
    spdx: z.string().min(1),
    text: z.string().min(1),
    attribution: z.string().nullable(),
    source: z.url(),
    retrieved: z.string().min(1),
    redistributable: z.boolean(),
    restrictions: z.string().nullable(),
  }),
  files: z.array(z.object({ path: z.string().min(1), sha256: z.string().min(1) })).min(1),
});

function resourceRoot(): string {
  if (process.env.VERSESCAPE_RESOURCE_DIR) return process.env.VERSESCAPE_RESOURCE_DIR;
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(process.cwd(), 'resources', 'compiled');
}

function userResourceRoot(): string {
  return loadSettings().library.location ?? join(app.getPath('userData'), 'resources');
}

export function setLibraryLocation(location: string): string {
  const destination = normalize(location);
  if (!isAbsolute(destination)) throw new Error('Library location must be absolute.');
  mkdirSync(destination, { recursive: true });
  accessSync(destination, constants.W_OK);
  const source = userResourceRoot();
  if (source === destination || !existsSync(source)) {
    patchSettings({ library: { location: destination } });
    return destination;
  }
  const directories = readdirSync(source, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.name));
  const moved: string[] = [];
  try {
    for (const entry of directories) {
      const from = join(source, entry.name);
      const to = join(destination, entry.name);
      if (existsSync(to)) throw new Error(`The destination already contains ${entry.name}.`);
      renameSync(from, to);
      moved.push(entry.name);
    }
    patchSettings({ library: { location: destination } });
    return destination;
  } catch (cause) {
    for (const id of moved.reverse()) renameSync(join(destination, id), join(source, id));
    throw cause;
  }
}

export function libraryLocationStatus(): LibraryLocation {
  const configured = loadSettings().library.location;
  if (!configured) return { path: null, available: true };
  try {
    accessSync(configured, constants.R_OK | constants.W_OK);
    return { path: configured, available: true };
  } catch {
    return { path: configured, available: false };
  }
}

function resourceRoots(): string[] {
  return [...new Set([userResourceRoot(), resourceRoot()])];
}

function resourceDirectory(id: string): string | null {
  for (const root of resourceRoots()) {
    const directory = join(root, id);
    if (existsSync(join(directory, `${id}.db`))) return directory;
  }
  return null;
}

function auxiliaryLibraryResource(id: string, directory: string, disabled: Set<string>): LibraryResource | null {
  const kinds: Record<string, { type: 'lexicon' | 'study-data'; abbreviation: string }> = {
    tbesh: { type: 'lexicon', abbreviation: 'TBESH' },
    tbesg: { type: 'lexicon', abbreviation: 'TBESG' },
    'cross-references': { type: 'study-data', abbreviation: 'XREF' },
    versification: { type: 'study-data', abbreviation: 'TVTMS' },
  };
  const kind = kinds[id];
  if (!kind) return null;
  const manifestPath = join(directory, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  const files = Array.isArray(manifest['files']) ? manifest['files'] : [];
  const sizeBytes = files.reduce((total, file) => {
    const relativePath = typeof file === 'object' && file !== null
      ? (file as Record<string, unknown>)['path']
      : null;
    const path = typeof relativePath === 'string' ? join(directory, relativePath) : null;
    return total + (path && existsSync(path) ? statSync(path).size : 0);
  }, 0);
  return {
    id,
    title: typeof manifest['title'] === 'string' ? manifest['title'] : id,
    abbreviation: kind.abbreviation,
    type: kind.type,
    language: 'und',
    versification: 'kjv',
    enabled: !disabled.has(id),
    removable: directory.startsWith(`${userResourceRoot()}${sep}`),
    sizeBytes,
    licence: {
      spdx: typeof manifest['licence'] === 'string' ? manifest['licence'] : 'See source',
      text: typeof manifest['licence'] === 'string' ? manifest['licence'] : 'See source.',
      attribution: typeof manifest['attribution'] === 'string' ? manifest['attribution'] : null,
      source: typeof manifest['source'] === 'string' ? manifest['source'] : 'https://versescape.app/',
      retrieved: typeof manifest['retrieved'] === 'string' ? manifest['retrieved'] : 'unknown',
      redistributable: true,
      restrictions: null,
    },
  };
}

export function isResourceInstalled(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) && resourceDirectory(id) !== null;
}

export function resolveResourceAsset(id: string, relativePath: string): string | null {
  if (!isResourceInstalled(id)) return null;

  const directory = resourceDirectory(id);
  if (!directory) return null;
  const assetRoot = join(directory, 'assets');
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

  const directory = resourceDirectory(id);
  if (!directory) throw new Error(`Resource ${id} is not installed.`);
  const path = join(directory, `${id}.db`);
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

function openCommentaryResource(id: string): Database.Database {
  const cached = openDatabases.get(id);
  if (cached) return cached;
  const directory = resourceDirectory(id);
  if (!directory) throw new Error(`Commentary ${id} is not installed.`);
  const database = new Database(join(directory, `${id}.db`), { readonly: true, fileMustExist: true });
  try {
    const meta = metadata(database);
    if (meta.get('schemaVersion') !== RESOURCE_SCHEMA_VERSION || meta.get('id') !== id || meta.get('type') !== 'commentary') {
      throw new Error(`Commentary ${id} is incompatible with this version of VerseScape.`);
    }
    openDatabases.set(id, database);
    return database;
  } catch (cause) {
    database.close();
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
  const resources: ResourceSummary[] = [];
  const seen = new Set<string>();
  for (const root of resourceRoots()) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.name)) continue;
    if (seen.has(entry.name)) continue;
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
    seen.add(entry.name);
    }
  }

  const disabled = new Set(loadSettings().library.disabledResourceIds);
  return resources.filter((resource) => !disabled.has(resource.id)).sort((left, right) => left.title.localeCompare(right.title));
}

export function listLibraryResources(): LibraryResource[] {
  const disabled = new Set(loadSettings().library.disabledResourceIds);
  const resources: LibraryResource[] = [];
  const seen = new Set<string>();
  for (const root of resourceRoots()) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (seen.has(entry.name)) continue;
    const directory = join(root, entry.name);
    const manifestPath = join(directory, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = libraryManifest.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
      const sizeBytes = manifest.files.reduce((total, file) => {
        const filePath = join(directory, file.path);
        return total + (existsSync(filePath) ? statSync(filePath).size : 0);
      }, 0);
      resources.push({
        id: manifest.id,
        title: manifest.title,
        abbreviation: manifest.abbreviation,
        type: manifest.type,
        language: manifest.language,
        versification: manifest.versification,
        enabled: !disabled.has(manifest.id),
        removable: directory.startsWith(`${userResourceRoot()}${sep}`),
        sizeBytes,
        licence: manifest.licence,
      });
      seen.add(manifest.id);
    } catch {
      const auxiliary = auxiliaryLibraryResource(entry.name, directory, disabled);
      if (auxiliary) {
        resources.push(auxiliary);
        seen.add(entry.name);
      }
    }
    }
  }
  return resources.sort((left, right) => left.title.localeCompare(right.title));
}

export function setResourceEnabled(request: ResourceEnabledRequest): LibraryResource {
  const resource = listLibraryResources().find((candidate) => candidate.id === request.id);
  if (!resource) throw new Error('Resource not found.');
  const disabled = new Set(loadSettings().library.disabledResourceIds);
  if (request.enabled) disabled.delete(request.id);
  else disabled.add(request.id);
  patchSettings({ library: { disabledResourceIds: [...disabled].sort() } });
  return { ...resource, enabled: request.enabled };
}

export function removeUserResource(id: string): void {
  const directory = join(userResourceRoot(), id);
  if (!existsSync(directory)) throw new Error('Only user-imported resources can be removed.');
  const database = openDatabases.get(id);
  if (database) {
    database.close();
    openDatabases.delete(id);
  }
  rmSync(directory, { recursive: true, force: false });
  const disabled = new Set(loadSettings().library.disabledResourceIds);
  disabled.delete(id);
  patchSettings({ library: { disabledResourceIds: [...disabled].sort() } });
}

export function importResourceArchive(archivePath: string): LibraryResource {
  const archive = new AdmZip(archivePath);
  const entries = archive.getEntries();
  if (entries.length === 0 || entries.length > 1_000) throw new Error('Resource archive has an unsafe entry count.');
  const manifestEntry = entries.find((entry) => entry.entryName === 'manifest.json' && !entry.isDirectory);
  if (!manifestEntry) throw new Error('Resource archive has no manifest.');
  const manifest = libraryManifest.parse(JSON.parse(manifestEntry.getData().toString('utf8')));
  const allowed = new Set(['manifest.json', ...manifest.files.map((file) => file.path)]);
  let totalSize = 0;
  for (const entry of entries) {
    const name = entry.entryName;
    if (entry.isDirectory) continue;
    if (isAbsolute(name) || normalize(name).startsWith(`..${sep}`) || basename(name) !== name && name.includes('..')) throw new Error('Resource archive contains an unsafe path.');
    if (!allowed.has(name)) throw new Error('Resource archive contains undeclared files.');
    totalSize += entry.header.size;
  }
  if (totalSize > 1_000_000_000) throw new Error('Resource archive is too large.');
  const fileData = new Map(entries.filter((entry) => !entry.isDirectory).map((entry) => [entry.entryName, entry.getData()]));
  for (const file of manifest.files) {
    const data = fileData.get(file.path);
    if (!data || createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error(`Resource checksum failed for ${file.path}.`);
  }
  const target = join(userResourceRoot(), manifest.id);
  if (existsSync(target)) throw new Error('A resource with this id is already installed.');
  const temporary = `${target}.tmp-${randomUUID()}`;
  try {
    mkdirSync(temporary, { recursive: true });
    for (const [name, data] of fileData) {
      const destination = join(temporary, name);
      mkdirSync(join(destination, '..'), { recursive: true });
      writeFileSync(destination, data);
    }
    renameSync(temporary, target);
  } catch (cause) {
    rmSync(temporary, { recursive: true, force: true });
    throw cause;
  }
  const resource = listLibraryResources().find((candidate) => candidate.id === manifest.id);
  if (!resource) throw new Error('Imported resource could not be catalogued.');
  return resource;
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

export function listCommentaryResourceEntries(request: CommentaryResourceEntriesRequest): CommentaryResourceEntry[] {
  const database = openCommentaryResource(request.resourceId);
  const clauses = ['book_id = ?'];
  const values: Array<string | number> = [request.bookId];
  if (request.chapter !== undefined) {
    clauses.push('(chapter IS NULL OR chapter = ?)');
    values.push(request.chapter);
  }
  const rows = database.prepare(`SELECT id, title, body, start_key AS startKey, end_key AS endKey
    FROM entry WHERE ${clauses.join(' AND ')}
    ORDER BY start_key IS NULL, start_key, end_key, id`).all(...values) as Array<{
    id: string;
    title: string;
    body: string;
    startKey: number | null;
    endKey: number | null;
  }>;
  return rows.map((row) => ({ ...row, resourceId: request.resourceId }));
}

export function getConcordance(request: ConcordanceRequest): Array<{ verseKey: number; text: string }> {
  const db = openResource(request.resourceId);
  const rows = db
    .prepare(
      `SELECT strong_verse.verse_key, verse.text
       FROM strong_verse JOIN verse ON verse.verse_key = strong_verse.verse_key
       WHERE strong_verse.strong_num = ? ORDER BY strong_verse.verse_key`,
    )
    .all(request.strongNumber) as Array<{ verse_key: number; text: string }>;
  return rows.map((row) => ({ verseKey: row.verse_key, text: row.text }));
}

export function getLexiconEntry(request: ConcordanceRequest): { strongNumber: string; definition: string } | null {
  const db = openLexicon(request.strongNumber);
  if (!db) return null;
  const row = db.prepare('SELECT source FROM entry WHERE strong_num = ?').get(request.strongNumber) as
    | { source: string }
    | undefined;
  return row ? { strongNumber: request.strongNumber, definition: row.source } : null;
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

export interface VerseSearchHit {
  verseKey: number;
  snippet: string;
  rank: number;
}

/**
 * `verse_fts` is an external-content FTS5 table with `content_rowid='verse_key'`,
 * so its `rowid` already **is** the verse key — no join against `verse` needed.
 * The snippet delimiters are control characters, never real verse text, so the
 * renderer can split on them to build highlight spans without touching HTML.
 */
export function searchVerses(
  resourceId: string,
  matchExpression: string,
  keyRange: { minKey: number; maxKey: number } | null,
  limit: number,
): VerseSearchHit[] {
  const db = openResource(resourceId);
  const params: Array<string | number> = [matchExpression];
  let sql = `
    SELECT verse_fts.rowid AS verseKey,
           snippet(verse_fts, 0, '\u0001', '\u0002', '\u2026', 10) AS snippet,
           bm25(verse_fts) AS rank
    FROM verse_fts
    WHERE verse_fts MATCH ?`;
  if (keyRange) {
    sql += ' AND verse_fts.rowid BETWEEN ? AND ?';
    params.push(keyRange.minKey, keyRange.maxKey);
  }
  sql += ' ORDER BY rank LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params) as VerseSearchHit[];
}

export function closeResources(): void {
  for (const db of openDatabases.values()) db.close();
  openDatabases.clear();
}
