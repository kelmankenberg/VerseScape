import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { parseUsfm } from './usfm.js';
import { hasErrors, validateBook } from './validate.js';
import { emitResource, resourceMeta, RESOURCE_SCHEMA_VERSION } from './emit.js';
import type { ResourceMeta } from './emit.js';
import type { ParsedBook, ParseDiagnostic } from './types.js';
import { emitVersification, parseTvtms, versificationMeta } from './tvtms.js';
import type { VersificationMeta } from './tvtms.js';
import { emitCrossReferences, parseCrossReferences } from './cross-references.js';
import { compileLexicon, lexiconMeta } from './lexicon.js';
import { applyStrongMarkers, parseBsbTables } from './bsb-tables.js';

/**
 * Runs under Electron's Node (`ELECTRON_RUN_AS_NODE=1`), so better-sqlite3 is
 * the same binary the app loads. See decision D-28.
 */

function report(diagnostics: ParseDiagnostic[], label: string): void {
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  for (const error of errors) console.error(`  error  ${label}:${error.line} ${error.message}`);
  if (warnings.length > 0) {
    const shown = warnings.slice(0, 5);
    for (const warning of shown)
      console.warn(`  warn   ${label}:${warning.line} ${warning.message}`);
    if (warnings.length > shown.length) {
      console.warn(`  warn   ${label} … and ${warnings.length - shown.length} more`);
    }
  }
}

export function compileDirectory(
  sourceDir: string,
  outputDir: string,
  meta: ResourceMeta,
  strongsTablePath?: string,
): number {
  const files = readdirSync(sourceDir)
    .filter((name) => /\.usfm$|\.sfm$|\.usx$/iu.test(name))
    .sort();

  if (files.length === 0) {
    console.error(`No USFM files found in ${sourceDir}`);
    return 1;
  }

  const books: ParsedBook[] = [];
  let failed = false;

  for (const file of files) {
    const source = readFileSync(join(sourceDir, file), 'utf8');
    const outcome = parseUsfm(source);
    report(outcome.diagnostics, basename(file));

    if (!outcome.book || hasErrors(outcome.diagnostics)) {
      failed = true;
      continue;
    }

    const validation = validateBook(outcome.book);
    report(validation.diagnostics, basename(file));
    if (hasErrors(validation.diagnostics)) {
      failed = true;
      continue;
    }

    books.push(outcome.book);
    console.log(`  ok     ${outcome.book.id} — ${validation.verseCount} verses`);
  }

  if (failed) {
    console.error('Compilation failed; no resource written.');
    return 1;
  }

  if (strongsTablePath) {
    const table = parseBsbTables(readFileSync(strongsTablePath, 'utf8'));
    const stats = applyStrongMarkers(books, table);
    console.log(
      `  Strong's alignment: ${stats.taggedVerses}/${stats.totalVerses} verses tagged ` +
        `(${Math.round((stats.taggedVerses / stats.totalVerses) * 100)}%)`,
    );
  }

  mkdirSync(outputDir, { recursive: true });
  const dbPath = join(outputDir, `${meta.id}.db`);
  rmSync(dbPath, { force: true });

  const result = emitResource(dbPath, meta, books);
  const checksum = createHash('sha256').update(readFileSync(dbPath)).digest('hex');

  writeFileSync(
    join(outputDir, 'manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: RESOURCE_SCHEMA_VERSION,
        id: meta.id,
        title: meta.title,
        abbreviation: meta.abbreviation,
        type: meta.type,
        language: meta.language,
        versification: meta.versification,
        deliveryMode: 'local',
        licence: {
          spdx: meta.licenceSpdx,
          text: meta.licence,
          attribution: meta.attribution ?? null,
          source: meta.source,
          retrieved: meta.retrieved,
          redistributable: meta.redistributable,
          restrictions: meta.restrictions ?? null,
        },
        files: [{ path: `${meta.id}.db`, sha256: checksum }],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`Wrote ${result.books} books, ${result.verses} verses to ${dbPath}`);
  return 0;
}

export function compileVersification(
  sourcePath: string,
  outputDir: string,
  meta: VersificationMeta,
): number {
  const mappings = parseTvtms(readFileSync(sourcePath, 'utf8'));
  mkdirSync(outputDir, { recursive: true });
  const dbPath = join(outputDir, 'versification.db');
  rmSync(dbPath, { force: true });
  emitVersification(dbPath, meta, mappings);

  const checksum = createHash('sha256').update(readFileSync(dbPath)).digest('hex');
  writeFileSync(
    join(outputDir, 'manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: meta.id,
        title: meta.title,
        type: 'versification',
        licence: 'CC-BY-4.0',
        attribution: meta.attribution,
        source: meta.source,
        sourceCommit: meta.sourceCommit,
        sourceSha256: meta.sourceSha256,
        retrieved: meta.retrieved,
        transformation: meta.transformation,
        files: [{ path: 'versification.db', sha256: checksum }],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`Wrote ${mappings.length} conditional mappings to ${dbPath}`);
  return 0;
}

function compileCrossReferences(sourcePath: string, outputDir: string, recipePath: string): number {
  const recipe = JSON.parse(readFileSync(recipePath, 'utf8')) as { meta?: Record<string, unknown> };
  if (!recipe.meta) throw new Error(`Invalid cross-reference metadata in ${recipePath}.`);
  const rows = parseCrossReferences(readFileSync(sourcePath, 'utf8'));
  mkdirSync(outputDir, { recursive: true });
  const dbPath = join(outputDir, 'cross-references.db');
  rmSync(dbPath, { force: true });
  emitCrossReferences(dbPath, rows);
  const checksum = createHash('sha256').update(readFileSync(dbPath)).digest('hex');
  writeFileSync(
    join(outputDir, 'manifest.json'),
    `${JSON.stringify({ schemaVersion: 1, ...recipe.meta, files: [{ path: 'cross-references.db', sha256: checksum }] }, null, 2)}\n`,
    'utf8',
  );
  console.log(`Wrote ${rows.length} cross-references to ${dbPath}`);
  return 0;
}

const FIXTURE = String.raw`
\id JUD Jude
\h Jude
\mt1 The Letter of Jude
\c 1
\s1 Greeting
\p
\v 1 Jude, a servant of Jesus Christ\f + \fr 1:1 \ft Or slave.\f*, to those who are called.
\v 2 \w Mercy|strong="G1656"\w*, peace and love be yours in abundance.
\q1
\v 3 Beloved, while I was very diligent to write to you,
\v 4 For certain men have crept in unnoticed.
`;

const TVTMS_FIXTURE = `
#DataStart(Expanded)
SourceType\tSourceRef\tStandardRef\tAction\tNoteMarker\tReversification Note\tVersification Note\tAncient Versions\tTests\t\t\t\t
Greek\tPhp.1:16\tPhp.1:17\tRenumber verse*\tOpt. (17)^16\tNormally...\t1:17 in most Bibles\t(Greek=1:16 / 1:17)\tPhp.1:16=Exist & Php.1:16<Php.1:17\t\t\t\t
#DataEnd(Expanded)
`;

/**
 * End-to-end check: compile a fixture, read it back, and confirm the schema,
 * the verse text and the FTS index all survived the round trip.
 *
 * This is the emitter's test. It cannot run under Vitest because the native
 * module is built for Electron's ABI, not Node's (D-28).
 */
export function selfTest(): number {
  const dir = mkdtempSync(join(tmpdir(), 'versescape-compile-'));
  const failures: string[] = [];

  const check = (label: string, condition: boolean): void => {
    if (condition) console.log(`  ok     ${label}`);
    else {
      console.error(`  FAIL   ${label}`);
      failures.push(label);
    }
  };

  try {
    const source = join(dir, 'src');
    mkdirSync(source);
    writeFileSync(join(source, '65-JUD.usfm'), FIXTURE, 'utf8');

    const meta: ResourceMeta = {
      id: 'fixture',
      title: 'Fixture Bible',
      abbreviation: 'FIX',
      type: 'bible',
      language: 'en',
      versification: 'kjv',
      licence: 'Public domain test fixture.',
      licenceSpdx: 'PublicDomain',
      source: 'https://example.invalid/fixture',
      retrieved: '2026-09-01',
      redistributable: true,
    };

    const out = join(dir, 'out');
    check('compiles without errors', compileDirectory(source, out, meta) === 0);

    const db = new Database(join(out, 'fixture.db'), { readonly: true });

    const schemaVersion = db.prepare("SELECT value FROM meta WHERE key = 'schemaVersion'").get() as
      { value: string } | undefined;
    check('records the schema version', schemaVersion?.value === String(RESOURCE_SCHEMA_VERSION));

    const verses = db.prepare('SELECT COUNT(*) AS n FROM verse').get() as { n: number };
    check('stores every verse', verses.n === 4);

    const first = db.prepare('SELECT * FROM verse ORDER BY verse_key LIMIT 1').get() as {
      verse_key: number;
      book_id: string;
      text: string;
      para_start: number;
    };
    check('keys verses canonically', first.verse_key === 65_001_001);
    check('keeps the footnote marker inline', first.text.includes('<n id="fn1"/>'));
    check('records paragraph starts', first.para_start === 1);

    const poetry = db.prepare('SELECT poetry FROM verse WHERE verse_key = ?').get(65_001_003) as {
      poetry: number;
    };
    check('records poetry level', poetry.poetry === 1);

    const heading = db.prepare('SELECT text FROM heading LIMIT 1').get() as
      { text: string } | undefined;
    check('stores headings', heading?.text === 'Greeting');

    const footnote = db.prepare('SELECT text FROM footnote LIMIT 1').get() as
      { text: string } | undefined;
    check('stores footnote text without the origin reference', footnote?.text === 'Or slave.');

    const redistributable = db
      .prepare("SELECT value FROM meta WHERE key = 'redistributable'")
      .get() as { value: string } | undefined;
    check('records redistribution rights', redistributable?.value === '1');

    // External-content FTS5 exposes the content rowid as `rowid`, not by the
    // content table's column name.
    const hit = db.prepare("SELECT rowid FROM verse_fts WHERE verse_fts MATCH 'mercy'").get() as
      { rowid: number } | undefined;
    check('builds a queryable FTS index', hit?.rowid === 65_001_002);

    const missing = db
      .prepare("SELECT COUNT(*) AS n FROM verse_fts WHERE verse_fts MATCH 'zebra'")
      .get() as { n: number };
    check('FTS does not match absent words', missing.n === 0);

    const strong = db
      .prepare('SELECT COUNT(*) AS n FROM strong_verse WHERE strong_num = ?')
      .get('G1656') as { n: number };
    check('indexes Strong numbers for concordance', strong.n === 1);

    db.close();

    // Determinism: a second compile of the same input must be byte-identical.
    const outTwo = join(dir, 'out2');
    compileDirectory(source, outTwo, meta);
    const a = createHash('sha256')
      .update(readFileSync(join(out, 'fixture.db')))
      .digest('hex');
    const b = createHash('sha256')
      .update(readFileSync(join(outTwo, 'fixture.db')))
      .digest('hex');
    check('produces byte-identical output for identical input', a === b);

    const tvtmsSource = join(dir, 'tvtms.txt');
    const tvtmsOut = join(dir, 'versification');
    const versificationMeta: VersificationMeta = {
      id: 'versification',
      title: 'Fixture Versification',
      source: 'https://example.invalid/tvtms.txt',
      sourceCommit: 'fixture',
      sourceSha256: createHash('sha256').update(TVTMS_FIXTURE).digest('hex'),
      retrieved: '2026-09-01',
      licence: 'CC-BY-4.0',
      attribution: 'STEP Bible — https://www.STEPBible.org',
      transformation: 'Expanded rows copied to indexed SQLite without corrections.',
    };
    writeFileSync(tvtmsSource, TVTMS_FIXTURE, 'utf8');
    check(
      'compiles conditional versification mappings',
      compileVersification(tvtmsSource, tvtmsOut, versificationMeta) === 0,
    );
    const tvtmsDb = new Database(join(tvtmsOut, 'versification.db'), { readonly: true });
    const mapping = tvtmsDb.prepare("SELECT * FROM mapping WHERE source_ref = 'Php.1:16'").get() as
      { standard_ref: string; tests: string } | undefined;
    check('indexes mappings by source reference', mapping?.standard_ref === 'Php.1:17');
    check('retains mapping conditions', mapping?.tests.includes('Php.1:16<Php.1:17') === true);
    tvtmsDb.close();

    const tvtmsOutTwo = join(dir, 'versification2');
    compileVersification(tvtmsSource, tvtmsOutTwo, versificationMeta);
    const tvtmsA = createHash('sha256')
      .update(readFileSync(join(tvtmsOut, 'versification.db')))
      .digest('hex');
    const tvtmsB = createHash('sha256')
      .update(readFileSync(join(tvtmsOutTwo, 'versification.db')))
      .digest('hex');
    check('produces deterministic versification output', tvtmsA === tvtmsB);

    const crossRefPath = join(dir, 'cross-references.db');
    const crossRefs = parseCrossReferences(
      'From Verse\tTo Verse\tVotes\t# attribution\nGen.1.1\tJohn.1.1-John.1.3\t378\nGen.1.1\tExod.31.18\t-38\n',
    );
    emitCrossReferences(crossRefPath, crossRefs);
    const crossRefDb = new Database(crossRefPath, { readonly: true });
    const strongest = crossRefDb
      .prepare('SELECT to_start, to_end, votes FROM cross_ref ORDER BY votes DESC LIMIT 1')
      .get() as { to_start: number; to_end: number; votes: number } | undefined;
    check('stores cross-reference ranges', strongest?.to_end === 43_001_003);
    check('indexes cross-references by vote strength', strongest?.votes === 378);
    crossRefDb.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    return 1;
  }
  console.log('\nAll compiler integration checks passed.');
  return 0;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--selftest')) {
    process.exit(selfTest());
  }

  if (args[0] === '--versification') {
    const [, sourcePath, outputDir, metaPath] = args;
    if (!sourcePath || !outputDir || !metaPath) {
      console.error('Usage: cli --versification <tvtms-file> <output-dir> <meta.json>');
      process.exit(1);
    }
    const document: unknown = JSON.parse(readFileSync(metaPath, 'utf8'));
    const metadata =
      typeof document === 'object' && document !== null && 'meta' in document
        ? document.meta
        : document;
    const parsed = versificationMeta.safeParse(metadata);
    if (!parsed.success) {
      console.error(`Invalid versification metadata in ${metaPath}:`);
      console.error(z.prettifyError(parsed.error));
      process.exit(1);
    }
    process.exit(compileVersification(sourcePath, outputDir, parsed.data));
  }

  if (args[0] === '--cross-references') {
    const [, sourcePath, outputDir, metaPath] = args;
    if (!sourcePath || !outputDir || !metaPath) {
      console.error('Usage: cli --cross-references <data-file> <output-dir> <meta.json>');
      process.exit(1);
    }
    process.exit(compileCrossReferences(sourcePath, outputDir, metaPath));
  }

  if (args[0] === '--lexicon') {
    const [, sourcePath, outputDir, metaPath] = args;
    if (!sourcePath || !outputDir || !metaPath) {
      console.error('Usage: cli --lexicon <lexicon-file> <output-dir> <meta.json>');
      process.exit(1);
    }
    const document: unknown = JSON.parse(readFileSync(metaPath, 'utf8'));
    const metadata =
      typeof document === 'object' && document !== null && 'meta' in document
        ? document.meta
        : document;
    const parsed = lexiconMeta.safeParse(metadata);
    if (!parsed.success) {
      console.error(`Invalid lexicon metadata in ${metaPath}:`);
      console.error(z.prettifyError(parsed.error));
      process.exit(1);
    }
    const count = compileLexicon(sourcePath, outputDir, parsed.data);
    console.log(`Wrote ${count} lexicon entries to ${outputDir}`);
    process.exit(count > 0 ? 0 : 1);
  }

  const strongsFlagIndex = args.indexOf('--strongs-table');
  const strongsTablePath = strongsFlagIndex >= 0 ? args[strongsFlagIndex + 1] : undefined;
  const positional =
    strongsFlagIndex >= 0
      ? [...args.slice(0, strongsFlagIndex), ...args.slice(strongsFlagIndex + 2)]
      : args;

  const [sourceDir, outputDir, metaPath] = positional;
  if (!sourceDir || !outputDir || !metaPath) {
    console.error(
      'Usage:\n  cli --selftest\n  cli --versification <tvtms-file> <output-dir> <meta.json>\n  cli <usfm-dir> <output-dir> <meta.json> [--strongs-table <tsv-file>]',
    );
    process.exit(1);
  }

  const document: unknown = JSON.parse(readFileSync(metaPath, 'utf8'));
  const metadata =
    typeof document === 'object' && document !== null && 'meta' in document
      ? document.meta
      : document;
  const parsed = resourceMeta.safeParse(metadata);
  if (!parsed.success) {
    console.error(`Invalid resource metadata in ${metaPath}:`);
    console.error(z.prettifyError(parsed.error));
    process.exit(1);
  }
  process.exit(compileDirectory(sourceDir, outputDir, parsed.data, strongsTablePath));
}

main();
