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

/**
 * Navigate to the next verse, handling chapter boundaries and book limits.
 * Requires a map of chapter -> max verse number for the current book.
 * Returns null if already at the last verse of the Bible (Rev 22:21).
 */
export function nextVerse(key: VerseKey, versesByChapter: Map<number, number>): VerseKey | null {
  const current = fromVerseKey(key);
  if (!current) return null;

  const book = getBook(current.book);
  if (!book) return null;

  const maxVerseInChapter = versesByChapter.get(current.chapter);
  if (maxVerseInChapter === undefined) return null;

  // Can advance within the chapter
  if (current.verse < maxVerseInChapter) {
    return toVerseKey({ ...current, verse: current.verse + 1 });
  }

  // Already at last verse of chapter; try to go to next chapter
  if (current.chapter < book.chapters) {
    return toVerseKey({ ...current, chapter: current.chapter + 1, verse: 1 });
  }

  // At the end of the book; try to go to next book
  const nextBook = getBookByOrdinal(book.ordinal + 1);
  if (nextBook) {
    return toVerseKey({ book: nextBook.id, chapter: 1, verse: 1 });
  }

  // Already at the end of the Bible
  return null;
}

/**
 * Navigate to the previous verse, handling chapter boundaries and book limits.
 * Requires a map of chapter -> max verse number for the current book.
 * Returns null if already at the first verse of the Bible (Gen 1:1).
 */
export function previousVerse(key: VerseKey, versesByChapter: Map<number, number>): VerseKey | null {
  const current = fromVerseKey(key);
  if (!current) return null;

  const book = getBook(current.book);
  if (!book) return null;

  // Can go back within the chapter
  if (current.verse > 1) {
    return toVerseKey({ ...current, verse: current.verse - 1 });
  }

  // Already at verse 1 of chapter; try to go to previous chapter
  if (current.chapter > 1) {
    const prevChapter = current.chapter - 1;
    const maxVerseInPrevChapter = versesByChapter.get(prevChapter);
    if (maxVerseInPrevChapter !== undefined) {
      return toVerseKey({ ...current, chapter: prevChapter, verse: maxVerseInPrevChapter });
    }
  }

  // At the start of the book; try to go to previous book
  const prevBook = getBookByOrdinal(book.ordinal - 1);
  if (prevBook) {
    // Need to know the last chapter's verse count of the previous book
    // This will be provided via versesByChapter in the caller's context
    const lastChapter = prevBook.chapters;
    const maxVerseInLastChapter = versesByChapter.get(lastChapter);
    if (maxVerseInLastChapter !== undefined) {
      return toVerseKey({ book: prevBook.id, chapter: lastChapter, verse: maxVerseInLastChapter });
    }
  }

  // Already at the start of the Bible
  return null;
}

/**
 * Navigate to the first verse of the next chapter.
 * Returns null if already at the last chapter of the Bible.
 */
export function nextChapter(key: VerseKey): VerseKey | null {
  const current = fromVerseKey(key);
  if (!current) return null;

  const book = getBook(current.book);
  if (!book) return null;

  // Try to go to next chapter
  if (current.chapter < book.chapters) {
    return toVerseKey({ ...current, chapter: current.chapter + 1, verse: 1 });
  }

  // At the end of the book; try to go to next book
  const nextBook = getBookByOrdinal(book.ordinal + 1);
  if (nextBook) {
    return toVerseKey({ book: nextBook.id, chapter: 1, verse: 1 });
  }

  // Already at the end of the Bible
  return null;
}

/**
 * Navigate to the first verse of the previous chapter.
 * Returns null if already at the first chapter of the Bible.
 */
export function previousChapter(key: VerseKey): VerseKey | null {
  const current = fromVerseKey(key);
  if (!current) return null;

  const book = getBook(current.book);
  if (!book) return null;

  // Try to go to previous chapter
  if (current.chapter > 1) {
    return toVerseKey({ ...current, chapter: current.chapter - 1, verse: 1 });
  }

  // At the start of the book; try to go to previous book
  const prevBook = getBookByOrdinal(book.ordinal - 1);
  if (prevBook) {
    return toVerseKey({ book: prevBook.id, chapter: prevBook.chapters, verse: 1 });
  }

  // Already at the start of the Bible
  return null;
}
