import { getBook, lookupBook } from './canon.js';
import type { Reference, ReferenceRange } from './verse-key.js';

export type ParseFailure =
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'unknown-book'; token: string }
  | { ok: false; reason: 'malformed'; token: string };

export type ParseResult = { ok: true; range: ReferenceRange } | ParseFailure;

/** Highest verse number we will accept; real bounds come from the resource. */
const MAX_VERSE = 999;

/**
 * Splits `1 John 2:1-5` into its book token and the numeric remainder.
 * The leading digit of an ordinal book ("1 John") must not be mistaken for a
 * chapter, so a leading number is only treated as part of the book name.
 */
function splitBookAndNumbers(input: string): { book: string; rest: string } | null {
  const match = /^\s*((?:[1-3]|i{1,3})\s*)?([A-Za-z][A-Za-z\s.'’]*?)\s*([\d:.\-–—\s]*)$/u.exec(
    input,
  );
  if (!match) return null;

  const [, ordinal, name, rest] = match;
  return { book: `${ordinal ?? ''}${name ?? ''}`.trim(), rest: (rest ?? '').trim() };
}

function makeRange(
  book: string,
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number,
): ReferenceRange {
  return {
    start: { book, chapter: startChapter, verse: startVerse },
    end: { book, chapter: endChapter, verse: endVerse },
  };
}

/**
 * Parses a human reference into a range.
 *
 * Accepts `John 3:16`, `Jn 3:16-18`, `John 3:16-4:2`, `Ps 23`, `Ezra 1:1-11`,
 * `1 John 2`, `Jude`, with `.` or `:` separators and hyphen or dash ranges.
 */
export function parseReference(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  const split = splitBookAndNumbers(trimmed);
  if (!split || !split.book) return { ok: false, reason: 'malformed', token: trimmed };

  const book = lookupBook(split.book);
  if (!book) return { ok: false, reason: 'unknown-book', token: split.book };

  const rest = split.rest.replace(/\s+/g, '');

  // Book only: the whole book.
  if (!rest) return { ok: true, range: makeRange(book.id, 1, 1, book.chapters, MAX_VERSE) };

  const match = /^(\d+)(?:[:.](\d+))?(?:[-–—](?:(\d+)[:.])?(\d+))?$/u.exec(rest);
  if (!match) return { ok: false, reason: 'malformed', token: split.rest };

  const chapter = Number(match[1]);
  const verse = match[2] === undefined ? null : Number(match[2]);
  const endLeft = match[3] === undefined ? null : Number(match[3]);
  const endRight = match[4] === undefined ? null : Number(match[4]);

  if (chapter < 1) return { ok: false, reason: 'malformed', token: split.rest };

  // "John 3" — a whole chapter.
  if (verse === null && endRight === null) {
    return { ok: true, range: makeRange(book.id, chapter, 1, chapter, MAX_VERSE) };
  }

  // "John 3-5" — a chapter range.
  if (verse === null && endRight !== null && endLeft === null) {
    return { ok: true, range: makeRange(book.id, chapter, 1, endRight, MAX_VERSE) };
  }

  // "John 3:16" — a single verse.
  if (verse !== null && endRight === null) {
    return { ok: true, range: makeRange(book.id, chapter, verse, chapter, verse) };
  }

  // "John 3:16-18" — within one chapter.
  if (verse !== null && endRight !== null && endLeft === null) {
    return { ok: true, range: makeRange(book.id, chapter, verse, chapter, endRight) };
  }

  // "John 3:16-4:2" — across chapters.
  if (verse !== null && endRight !== null && endLeft !== null) {
    return { ok: true, range: makeRange(book.id, chapter, verse, endLeft, endRight) };
  }

  return { ok: false, reason: 'malformed', token: split.rest };
}

/** Formats a range the way it would be typed back in. */
export function formatReference(range: ReferenceRange): string {
  const book = getBook(range.start.book);
  const name = book?.name ?? range.start.book;
  const { start, end } = range;

  const wholeBook =
    start.chapter === 1 && start.verse === 1 && end.chapter === (book?.chapters ?? 0);
  if (wholeBook && end.verse >= MAX_VERSE) return name;

  if (start.chapter === end.chapter) {
    if (start.verse === 1 && end.verse >= MAX_VERSE) return `${name} ${start.chapter}`;
    if (start.verse === end.verse) return `${name} ${start.chapter}:${start.verse}`;
    return `${name} ${start.chapter}:${start.verse}-${end.verse}`;
  }

  if (start.verse === 1 && end.verse >= MAX_VERSE) {
    return `${name} ${start.chapter}-${end.chapter}`;
  }

  return `${name} ${start.chapter}:${start.verse}-${end.chapter}:${end.verse}`;
}

export function formatSingle(reference: Reference): string {
  const book = getBook(reference.book);
  return `${book?.name ?? reference.book} ${reference.chapter}:${reference.verse}`;
}
