import { getBook, getBookByOrdinal } from './canon.js';
import type { BookId } from './canon.js';

export interface Reference {
  book: BookId;
  chapter: number;
  verse: number;
}

export interface ReferenceRange {
  start: Reference;
  end: Reference;
}

/**
 * Verse keys are `ordinal * 1e6 + chapter * 1e3 + verse` (doc 06), which makes
 * range queries and ordering plain integer comparisons.
 */
export type VerseKey = number;

const BOOK_FACTOR = 1_000_000;
const CHAPTER_FACTOR = 1_000;

export function toVerseKey(reference: Reference): VerseKey {
  const book = getBook(reference.book);
  if (!book) throw new Error(`Unknown book: ${reference.book}`);
  return book.ordinal * BOOK_FACTOR + reference.chapter * CHAPTER_FACTOR + reference.verse;
}

export function fromVerseKey(key: VerseKey): Reference | null {
  const ordinal = Math.floor(key / BOOK_FACTOR);
  const book = getBookByOrdinal(ordinal);
  if (!book) return null;

  const remainder = key - ordinal * BOOK_FACTOR;
  return {
    book: book.id,
    chapter: Math.floor(remainder / CHAPTER_FACTOR),
    verse: remainder % CHAPTER_FACTOR,
  };
}

export function rangeToKeys(range: ReferenceRange): { start: VerseKey; end: VerseKey } {
  return { start: toVerseKey(range.start), end: toVerseKey(range.end) };
}

export function keyIsWithin(key: VerseKey, range: ReferenceRange): boolean {
  const { start, end } = rangeToKeys(range);
  return key >= start && key <= end;
}

/** Clamps a reference to a chapter and verse the book actually has. */
export function clampToBook(reference: Reference): Reference {
  const book = getBook(reference.book);
  if (!book) return reference;
  return {
    book: reference.book,
    chapter: Math.min(Math.max(reference.chapter, 1), book.chapters),
    verse: Math.max(reference.verse, 1),
  };
}
