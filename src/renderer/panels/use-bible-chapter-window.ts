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
  loadWholeBook = false,
): BibleChapterWindow {
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chaptersRef = useRef(chapters);
  const identityRef = useRef('');
  const extending = useRef<Direction | null>(null);
  const wholeBookLoaded = useRef(false);
  chaptersRef.current = chapters;

  useEffect(() => {
    let cancelled = false;
    const identity = `${resourceId}:${bookId}`;
    const hasAnchor =
      identityRef.current === identity &&
      chaptersRef.current.some((chapter) => chapter.chapter === anchorChapter);

    if (hasAnchor && (!loadWholeBook || wholeBookLoaded.current)) {
      return;
    }

    // Upgrading an already-loaded window to whole-book mode (e.g. the user
    // clicked a word to highlight it): fetch only the missing chapters and
    // append them. Never replace chapters already on screen — doing so would
    // hand the virtualizer fresh row instances mid-scroll and it would
    // silently re-anchor to whatever ended up under the viewport.
    if (hasAnchor) {
      const book = getBook(bookId);
      const total = book?.chapters ?? anchorChapter;
      const have = new Set(chaptersRef.current.map((chapter) => chapter.chapter));
      const missing = Array.from({ length: total }, (_, index) => index + 1).filter(
        (chapter) => !have.has(chapter),
      );
      if (missing.length === 0) {
        wholeBookLoaded.current = true;
        return;
      }
      void Promise.allSettled(missing.map((chapter) => readChapter(resourceId, bookId, chapter))).then(
        (results) => {
          if (cancelled) return;
          const loaded = results
            .filter(
              (result): result is PromiseFulfilledResult<ChapterData> =>
                result.status === 'fulfilled',
            )
            .map((result) => result.value);
          setChapters((current) =>
            [...current, ...loaded].sort((left, right) => left.chapter - right.chapter),
          );
          wholeBookLoaded.current = true;
        },
      );
      return () => {
        cancelled = true;
      };
    }

    identityRef.current = identity;
    wholeBookLoaded.current = false;
    const book = getBook(bookId);
    const initialNumbers = [anchorChapter - 1, anchorChapter, anchorChapter + 1].filter(
      (chapter) => chapter >= 1 && chapter <= (book?.chapters ?? anchorChapter),
    );
    const chapterNumbers = Array.from(
      { length: book?.chapters ?? anchorChapter },
      (_, index) => index + 1,
    );
    const backgroundNumbers = loadWholeBook
      ? chapterNumbers.filter((chapter) => !initialNumbers.includes(chapter))
      : [];

    setLoading(true);
    setError(null);
    setChapters([]);
    void Promise.allSettled(
      initialNumbers.map((chapter) => readChapter(resourceId, bookId, chapter)),
    ).then(
      (results) => {
        if (cancelled) return;
        const loaded = results
          .filter(
            (result): result is PromiseFulfilledResult<ChapterData> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value)
          .sort((left, right) => left.chapter - right.chapter);
        if (loaded.length === 0) {
          const rejected = results.find(
            (result): result is PromiseRejectedResult => result.status === 'rejected',
          );
          setError(
            rejected?.reason instanceof Error
              ? rejected.reason.message
              : 'The chapter could not be loaded.',
          );
          setLoading(false);
          return;
        }
        setChapters(loaded);
        setLoading(false);

        if (!loadWholeBook || backgroundNumbers.length === 0) {
          wholeBookLoaded.current = loadWholeBook;
          return;
        }

        void Promise.allSettled(
          backgroundNumbers.map((chapter) => readChapter(resourceId, bookId, chapter)),
        ).then((backgroundResults) => {
          if (cancelled) return;
          const background = backgroundResults
            .filter(
              (result): result is PromiseFulfilledResult<ChapterData> =>
                result.status === 'fulfilled',
            )
            .map((result) => result.value);
          setChapters((current) =>
            [...current, ...background].sort((left, right) => left.chapter - right.chapter),
          );
          wholeBookLoaded.current = true;
        });
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
  }, [resourceId, bookId, anchorChapter, loadWholeBook]);

  const extend = useCallback(
    async (direction: Direction): Promise<boolean> => {
      if (loadWholeBook) return false;
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
    [resourceId, bookId, loadWholeBook],
  );

  return { chapters, loading, error, extend };
}
