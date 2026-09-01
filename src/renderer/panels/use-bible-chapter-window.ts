import { useCallback, useEffect, useRef, useState } from 'react';
import { getBook } from '@shared/reference/index.js';
import type { ChapterData } from '@shared/ipc/contracts.js';

const WINDOW_SIZE = 3;

type Direction = 'before' | 'after';

export interface BibleChapterWindow {
  chapters: ChapterData[];
  loading: boolean;
  error: string | null;
  extend: (direction: Direction) => Promise<boolean>;
}

async function readChapter(
  resourceId: string,
  bookId: string,
  chapter: number,
): Promise<ChapterData> {
  const result = await window.versescape.resources.getChapter({ resourceId, bookId, chapter });
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

export function useBibleChapterWindow(
  resourceId: string,
  bookId: string,
  anchorChapter: number,
): BibleChapterWindow {
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chaptersRef = useRef(chapters);
  const identityRef = useRef('');
  const extending = useRef<Direction | null>(null);
  chaptersRef.current = chapters;

  useEffect(() => {
    let cancelled = false;
    const identity = `${resourceId}:${bookId}`;
    if (
      identityRef.current === identity &&
      chaptersRef.current.some((chapter) => chapter.chapter === anchorChapter)
    ) {
      return;
    }
    identityRef.current = identity;
    const book = getBook(bookId);
    const chapterNumbers = [anchorChapter - 1, anchorChapter, anchorChapter + 1].filter(
      (chapter) => chapter >= 1 && chapter <= (book?.chapters ?? anchorChapter),
    );

    setLoading(true);
    setError(null);
    setChapters([]);
    void Promise.all(
      chapterNumbers.map((chapter) => readChapter(resourceId, bookId, chapter)),
    ).then(
      (loaded) => {
        if (cancelled) return;
        setChapters(loaded.sort((left, right) => left.chapter - right.chapter));
        setLoading(false);
      },
      (cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The chapter could not be loaded.');
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [resourceId, bookId, anchorChapter]);

  const extend = useCallback(
    async (direction: Direction): Promise<boolean> => {
      if (extending.current) return false;
      const loaded = chaptersRef.current;
      const book = getBook(bookId);
      if (loaded.length === 0 || !book) return false;

      const target =
        direction === 'before' ? loaded[0]!.chapter - 1 : loaded[loaded.length - 1]!.chapter + 1;
      if (target < 1 || target > book.chapters) return false;

      extending.current = direction;
      try {
        const adjacent = await readChapter(resourceId, bookId, target);
        setChapters((current) => {
          const next = direction === 'before' ? [adjacent, ...current] : [...current, adjacent];
          return direction === 'before' ? next.slice(0, WINDOW_SIZE) : next.slice(-WINDOW_SIZE);
        });
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The chapter could not be loaded.');
        return false;
      } finally {
        extending.current = null;
      }
    },
    [resourceId, bookId],
  );

  return { chapters, loading, error, extend };
}
