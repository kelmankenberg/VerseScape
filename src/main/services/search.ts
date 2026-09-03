import { getBook } from '@shared/reference/canon.js';
import { parseSearchQuery } from '@shared/search/query.js';
import type { SearchHit, SearchRequest, SearchScope } from '@shared/ipc/contracts.js';
import { searchVerses } from './resources.js';

const BOOK_FACTOR = 1_000_000;

/** Book ordinals are contiguous OT-then-NT (canon.ts), so a whole book's verse
 * keys always fall within `[ordinal * 1e6, ordinal * 1e6 + 999_999]`. */
function bookKeyRange(bookId: string): { minKey: number; maxKey: number } | null {
  const book = getBook(bookId);
  if (!book) return null;
  return { minKey: book.ordinal * BOOK_FACTOR, maxKey: book.ordinal * BOOK_FACTOR + 999_999 };
}

function resolveKeyRange(scope: SearchScope): { minKey: number; maxKey: number } | null {
  let startBook = scope.startBook;
  let endBook = scope.endBook;
  if (scope.testament === 'OT') {
    startBook ??= 'GEN';
    endBook ??= 'MAL';
  } else if (scope.testament === 'NT') {
    startBook ??= 'MAT';
    endBook ??= 'REV';
  }
  if (!startBook && !endBook) return null;

  const start = bookKeyRange(startBook ?? endBook!);
  const end = bookKeyRange(endBook ?? startBook!);
  if (!start || !end) return null;

  return {
    minKey: Math.min(start.minKey, end.minKey),
    maxKey: Math.max(start.maxKey, end.maxKey),
  };
}

/**
 * Fans a parsed query out across every requested resource and merges the
 * ranked results. Runs directly in main rather than a separate utility
 * process (D-32): FTS5 queries here are sub-millisecond per resource, and
 * every other resource read (doc 02's `resource:get-chapter` etc.) already
 * takes the same shortcut, so this stays consistent with the rest of M3.
 */
export function runSearch(request: SearchRequest): SearchHit[] {
  const parsed = parseSearchQuery(request.query);
  if (!parsed.ok) throw new Error(parsed.error);

  const keyRange = resolveKeyRange(request.scope);
  const hits: SearchHit[] = [];

  for (const resourceId of request.scope.resourceIds) {
    try {
      const rows = searchVerses(resourceId, parsed.match, keyRange, request.limit);
      for (const row of rows) {
        hits.push({ resourceId, verseKey: row.verseKey, snippet: row.snippet, rank: row.rank });
      }
    } catch (cause) {
      console.warn(`[search] resource "${resourceId}" failed`, cause);
    }
  }

  hits.sort((a, b) => a.rank - b.rank);
  return hits.slice(0, request.limit);
}
