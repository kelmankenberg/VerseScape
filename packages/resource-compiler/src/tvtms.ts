import Database from 'better-sqlite3';
import { z } from 'zod';

export interface VersificationMapping {
  sourceType: string;
  sourceRef: string;
  standardRef: string;
  action: string;
  noteMarker: string;
  reversificationNote: string;
  versificationNote: string;
  ancientVersions: string;
  tests: string;
}

const EXPANDED_START = '#DataStart(Expanded)';
const EXPANDED_END = '#DataEnd(Expanded)';

export function parseTvtms(source: string): VersificationMapping[] {
  const normalized = source.replace(/\r\n?/gu, '\n');
  const start = normalized.indexOf(EXPANDED_START);
  const end = normalized.indexOf(EXPANDED_END);
  if (start < 0 || end < start) throw new Error('TVTMS expanded data section is missing.');

  const lines = normalized.slice(start + EXPANDED_START.length, end).split('\n');
  const headerIndex = lines.findIndex((line) => line.startsWith('SourceType\tSourceRef\t'));
  if (headerIndex < 0) throw new Error('TVTMS expanded column header is missing.');

  const mappings: VersificationMapping[] = [];
  for (const [offset, line] of lines.slice(headerIndex + 1).entries()) {
    if (!line.trim() || line.startsWith("'=") || line.startsWith('#')) continue;
    const fields = line.split('\t');
    if (fields.length < 9) {
      throw new Error(`Malformed TVTMS expanded record at data line ${offset + 1}.`);
    }

    const [
      sourceType = '',
      sourceRef = '',
      standardRef = '',
      action = '',
      noteMarker = '',
      reversificationNote = '',
      versificationNote = '',
      ancientVersions = '',
      tests = '',
    ] = fields;
    if (!sourceType || !sourceRef || !standardRef || !action) {
      throw new Error(`Incomplete TVTMS expanded record at data line ${offset + 1}.`);
    }

    mappings.push({
      sourceType,
      sourceRef,
      standardRef,
      action,
      noteMarker,
      reversificationNote,
      versificationNote,
      ancientVersions,
      tests,
    });
  }
  if (mappings.length === 0) throw new Error('TVTMS expanded data section is empty.');
  return mappings;
}

const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE mapping (
  id INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  standard_ref TEXT NOT NULL,
  action TEXT NOT NULL,
  note_marker TEXT NOT NULL,
  reversification_note TEXT NOT NULL,
  versification_note TEXT NOT NULL,
  ancient_versions TEXT NOT NULL,
  tests TEXT NOT NULL
);
CREATE INDEX idx_mapping_source_ref ON mapping(source_ref);
CREATE INDEX idx_mapping_standard_ref ON mapping(standard_ref);
CREATE INDEX idx_mapping_source_type ON mapping(source_type);
`;

export const versificationMeta = z.object({
  id: z.literal('versification'),
  title: z.string().min(1),
  source: z.url(),
  sourceCommit: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  retrieved: z.iso.date(),
  licence: z.literal('CC-BY-4.0'),
  attribution: z.string().min(1),
  transformation: z.string().min(1),
});

export type VersificationMeta = z.infer<typeof versificationMeta>;

export function emitVersification(
  outputPath: string,
  meta: VersificationMeta,
  mappings: VersificationMapping[],
): number {
  const db = new Database(outputPath);
  try {
    db.pragma('page_size = 4096');
    db.pragma('journal_mode = DELETE');
    db.exec(SCHEMA);

    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    const insert = db.prepare(
      `INSERT INTO mapping (
        id, source_type, source_ref, standard_ref, action, note_marker,
        reversification_note, versification_note, ancient_versions, tests
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    db.transaction(() => {
      const entries = Object.entries(meta).sort(([left], [right]) => left.localeCompare(right));
      for (const [key, value] of entries) insertMeta.run(key, value);
      insertMeta.run('schemaVersion', '1');

      mappings.forEach((mapping, index) => {
        insert.run(
          index + 1,
          mapping.sourceType,
          mapping.sourceRef,
          mapping.standardRef,
          mapping.action,
          mapping.noteMarker,
          mapping.reversificationNote,
          mapping.versificationNote,
          mapping.ancientVersions,
          mapping.tests,
        );
      });
    })();
    db.exec('VACUUM');
    return mappings.length;
  } finally {
    db.close();
  }
}
