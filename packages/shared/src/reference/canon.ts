/**
 * Canonical book list.
 *
 * Ids are **USFM 3-letter book codes** (`GEN`, `JHN`, `REV`), matching the
 * `[[ref:JHN.3.16]]` note syntax in doc 06. Deuterocanonical books are added in
 * M3, when a resource that contains them is first compiled.
 */

export type BookId = string;

export interface BookInfo {
  id: BookId;
  /** 1-based canonical position, used to build verse keys. */
  ordinal: number;
  name: string;
  testament: 'OT' | 'NT';
  chapters: number;
  /** Lower-case forms accepted by the parser, beyond the id and name. */
  aliases: string[];
}

const OT: Array<[string, string, number, string[]]> = [
  ['GEN', 'Genesis', 50, ['gen', 'ge', 'gn']],
  ['EXO', 'Exodus', 40, ['exo', 'ex', 'exod']],
  ['LEV', 'Leviticus', 27, ['lev', 'le', 'lv']],
  ['NUM', 'Numbers', 36, ['num', 'nu', 'nm', 'nb']],
  ['DEU', 'Deuteronomy', 34, ['deu', 'dt', 'deut']],
  ['JOS', 'Joshua', 24, ['jos', 'jsh', 'josh']],
  ['JDG', 'Judges', 21, ['jdg', 'jg', 'judg']],
  ['RUT', 'Ruth', 4, ['rut', 'ru', 'rth']],
  ['1SA', '1 Samuel', 31, ['1sa', '1sam', '1s', 'isam']],
  ['2SA', '2 Samuel', 24, ['2sa', '2sam', '2s', 'iisam']],
  ['1KI', '1 Kings', 22, ['1ki', '1kgs', '1k', 'ikgs']],
  ['2KI', '2 Kings', 25, ['2ki', '2kgs', '2k', 'iikgs']],
  ['1CH', '1 Chronicles', 29, ['1ch', '1chr', '1chron']],
  ['2CH', '2 Chronicles', 36, ['2ch', '2chr', '2chron']],
  ['EZR', 'Ezra', 10, ['ezr', 'ez']],
  ['NEH', 'Nehemiah', 13, ['neh', 'ne']],
  ['EST', 'Esther', 10, ['est', 'es', 'esth']],
  ['JOB', 'Job', 42, ['job', 'jb']],
  ['PSA', 'Psalms', 150, ['psa', 'ps', 'psalm', 'psalms', 'pss']],
  ['PRO', 'Proverbs', 31, ['pro', 'pr', 'prov', 'prv']],
  ['ECC', 'Ecclesiastes', 12, ['ecc', 'ec', 'eccl', 'qoh']],
  ['SNG', 'Song of Songs', 8, ['sng', 'song', 'sos', 'canticles', 'songofsolomon']],
  ['ISA', 'Isaiah', 66, ['isa', 'is']],
  ['JER', 'Jeremiah', 52, ['jer', 'je', 'jr']],
  ['LAM', 'Lamentations', 5, ['lam', 'la']],
  ['EZK', 'Ezekiel', 48, ['ezk', 'eze', 'ezek']],
  ['DAN', 'Daniel', 12, ['dan', 'da', 'dn']],
  ['HOS', 'Hosea', 14, ['hos', 'ho']],
  ['JOL', 'Joel', 3, ['jol', 'joel', 'jl']],
  ['AMO', 'Amos', 9, ['amo', 'am']],
  ['OBA', 'Obadiah', 1, ['oba', 'ob', 'obad']],
  ['JON', 'Jonah', 4, ['jon', 'jnh', 'jonah']],
  ['MIC', 'Micah', 7, ['mic', 'mc']],
  ['NAM', 'Nahum', 3, ['nam', 'na', 'nah']],
  ['HAB', 'Habakkuk', 3, ['hab', 'hb']],
  ['ZEP', 'Zephaniah', 3, ['zep', 'zph', 'zeph']],
  ['HAG', 'Haggai', 2, ['hag', 'hg']],
  ['ZEC', 'Zechariah', 14, ['zec', 'zch', 'zech']],
  ['MAL', 'Malachi', 4, ['mal', 'ml']],
];

const NT: Array<[string, string, number, string[]]> = [
  ['MAT', 'Matthew', 28, ['mat', 'mt', 'matt']],
  ['MRK', 'Mark', 16, ['mrk', 'mk', 'mar', 'mark']],
  ['LUK', 'Luke', 24, ['luk', 'lk', 'luke']],
  ['JHN', 'John', 21, ['jhn', 'jn', 'joh', 'john']],
  ['ACT', 'Acts', 28, ['act', 'ac', 'acts']],
  ['ROM', 'Romans', 16, ['rom', 'ro', 'rm']],
  ['1CO', '1 Corinthians', 16, ['1co', '1cor', 'icor']],
  ['2CO', '2 Corinthians', 13, ['2co', '2cor', 'iicor']],
  ['GAL', 'Galatians', 6, ['gal', 'ga']],
  ['EPH', 'Ephesians', 6, ['eph', 'ep']],
  ['PHP', 'Philippians', 4, ['php', 'phil', 'pp']],
  ['COL', 'Colossians', 4, ['col', 'cl']],
  ['1TH', '1 Thessalonians', 5, ['1th', '1thess', 'ithess']],
  ['2TH', '2 Thessalonians', 3, ['2th', '2thess', 'iithess']],
  ['1TI', '1 Timothy', 6, ['1ti', '1tim', 'itim']],
  ['2TI', '2 Timothy', 4, ['2ti', '2tim', 'iitim']],
  ['TIT', 'Titus', 3, ['tit', 'ti']],
  ['PHM', 'Philemon', 1, ['phm', 'phlm', 'philem']],
  ['HEB', 'Hebrews', 13, ['heb', 'hb']],
  ['JAS', 'James', 5, ['jas', 'jm', 'james']],
  ['1PE', '1 Peter', 5, ['1pe', '1pet', 'ipet']],
  ['2PE', '2 Peter', 3, ['2pe', '2pet', 'iipet']],
  ['1JN', '1 John', 5, ['1jn', '1john', 'ijohn', '1jo']],
  ['2JN', '2 John', 1, ['2jn', '2john', 'iijohn', '2jo']],
  ['3JN', '3 John', 1, ['3jn', '3john', 'iiijohn', '3jo']],
  ['JUD', 'Jude', 1, ['jud', 'jude']],
  ['REV', 'Revelation', 22, ['rev', 're', 'rv', 'apocalypse']],
];

function build(): BookInfo[] {
  let ordinal = 0;
  const make = (
    entries: Array<[string, string, number, string[]]>,
    testament: 'OT' | 'NT',
  ): BookInfo[] =>
    entries.map(([id, name, chapters, aliases]) => {
      ordinal += 1;
      return { id, ordinal, name, testament, chapters, aliases };
    });

  return [...make(OT, 'OT'), ...make(NT, 'NT')];
}

export const BOOKS: readonly BookInfo[] = build();

const byId = new Map(BOOKS.map((book) => [book.id, book]));
const byOrdinal = new Map(BOOKS.map((book) => [book.ordinal, book]));

/** Normalises for lookup: lower-case, no spaces, punctuation or roman prefixes. */
export function normaliseBookToken(value: string): string {
  return value.toLowerCase().replace(/[\s._'’]/g, '');
}

const aliasIndex = new Map<string, BookInfo>();
for (const book of BOOKS) {
  const forms = new Set([
    normaliseBookToken(book.id),
    normaliseBookToken(book.name),
    ...book.aliases.map(normaliseBookToken),
  ]);
  for (const form of forms) {
    if (!aliasIndex.has(form)) aliasIndex.set(form, book);
  }
}

export function getBook(id: BookId): BookInfo | null {
  return byId.get(id) ?? null;
}

export function getBookByOrdinal(ordinal: number): BookInfo | null {
  return byOrdinal.get(ordinal) ?? null;
}

export function lookupBook(token: string): BookInfo | null {
  return aliasIndex.get(normaliseBookToken(token)) ?? null;
}

/** Prefix matches for the panel header's book autocomplete (FR-WS-17). */
export function suggestBooks(query: string, limit = 8): BookInfo[] {
  const token = normaliseBookToken(query);
  if (!token) return [];

  const starts: BookInfo[] = [];
  const contains: BookInfo[] = [];

  for (const book of BOOKS) {
    const name = normaliseBookToken(book.name);
    const id = normaliseBookToken(book.id);
    if (name.startsWith(token) || id.startsWith(token)) starts.push(book);
    else if (book.aliases.some((alias) => normaliseBookToken(alias).startsWith(token)))
      starts.push(book);
    else if (name.includes(token)) contains.push(book);
  }

  return [...starts, ...contains].slice(0, limit);
}
