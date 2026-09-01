import { getBook, toVerseKey } from '@shared/reference/index.js';
import type { ParseDiagnostic, ParsedBook } from './types.js';

export interface ValidationReport {
  diagnostics: ParseDiagnostic[];
  verseCount: number;
  chapterCount: number;
}

/**
 * Structural checks run before a book is emitted. The compiler fails loudly
 * rather than shipping a resource with silent holes in it (doc 07).
 */
export function validateBook(book: ParsedBook): ValidationReport {
  const diagnostics: ParseDiagnostic[] = [];
  const info = getBook(book.id);

  if (!info) {
    diagnostics.push({
      severity: 'error',
      code: 'unknown-book',
      message: `Book ${book.id} is not in the canon`,
      line: 0,
    });
    return { diagnostics, verseCount: 0, chapterCount: 0 };
  }

  if (book.verses.length === 0) {
    diagnostics.push({
      severity: 'error',
      code: 'empty-book',
      message: `${info.name} has no verses`,
      line: 0,
    });
  }

  const chapters = new Set<number>();
  const seen = new Set<number>();
  let previousKey = -1;

  for (const verse of book.verses) {
    chapters.add(verse.chapter);

    if (verse.chapter < 1 || verse.chapter > info.chapters) {
      diagnostics.push({
        severity: 'error',
        code: 'chapter-out-of-range',
        message: `${info.name} ${verse.chapter}:${verse.verse} is outside the book's ${info.chapters} chapters`,
        line: 0,
      });
      continue;
    }

    const key = toVerseKey({ book: book.id, chapter: verse.chapter, verse: verse.verse });

    if (seen.has(key)) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-verse',
        message: `${info.name} ${verse.chapter}:${verse.verse} appears more than once`,
        line: 0,
      });
    }
    seen.add(key);

    // Verse keys must ascend, or range queries and sync anchoring break.
    if (key <= previousKey) {
      diagnostics.push({
        severity: 'error',
        code: 'out-of-order',
        message: `${info.name} ${verse.chapter}:${verse.verse} is out of canonical order`,
        line: 0,
      });
    }
    previousKey = key;

    // Tags alone are not text: a verse holding only a footnote marker is empty.
    if (!verse.text.replace(/<[^>]*>/gu, '').trim()) {
      diagnostics.push({
        severity: 'warning',
        code: 'empty-verse',
        message: `${info.name} ${verse.chapter}:${verse.verse} has no text`,
        line: 0,
      });
    }
  }

  for (let chapter = 1; chapter <= info.chapters; chapter += 1) {
    if (!chapters.has(chapter)) {
      diagnostics.push({
        severity: 'error',
        code: 'missing-chapter',
        message: `${info.name} ${chapter} is missing`,
        line: 0,
      });
    }
  }

  return { diagnostics, verseCount: book.verses.length, chapterCount: chapters.size };
}

export function hasErrors(diagnostics: ParseDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}
