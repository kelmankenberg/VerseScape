import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatReference, fromVerseKey, getBook, parseReference } from '@shared/reference/index.js';
import type { ChapterData, ResourceSummary } from '@shared/ipc/contracts.js';
import type { JsonValue } from '@shared/workspace/index.js';
import { useVerseSync } from '../workspace/use-verse-sync.js';
import { useWorkspace } from '../workspace/store.js';
import { BibleText } from './BibleText.js';
import { useBibleChapterWindow } from './use-bible-chapter-window.js';
import type { PanelProps } from './registry.js';

const DEFAULT_REFERENCE = 'John 3';
const DEFAULT_RESOURCE = 'bsb';

function panelValue(state: JsonValue, key: string, fallback: string): string {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return fallback;
  const value = state[key];
  return typeof value === 'string' && value ? value : fallback;
}

function patchState(state: JsonValue, patch: Record<string, JsonValue>): JsonValue {
  const current =
    typeof state === 'object' && state !== null && !Array.isArray(state)
      ? (state as Record<string, JsonValue>)
      : {};
  return { ...current, ...patch };
}

export function SamplePanel({ tabId, state, setState }: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialScrollKey = useRef('');
  const pendingRestore = useRef<{ verseKey: number; offset: number } | null>(null);
  const ignoreAnchorsUntil = useRef(0);
  const navigateTab = useWorkspace((store) => store.navigateTab);
  const followTab = useWorkspace((store) => store.followTab);
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const reference = panelValue(state, 'reference', DEFAULT_REFERENCE);
  const resourceId = panelValue(state, 'resourceId', DEFAULT_RESOURCE);
  const parsed = parseReference(reference);
  const anchor = parsed.ok ? parsed.range.start : { book: 'JHN', chapter: 3, verse: 1 };
  const book = getBook(anchor.book);
  const [visibleChapter, setVisibleChapter] = useState(anchor.chapter);
  const {
    chapters,
    loading,
    error: chapterError,
    extend,
  } = useBibleChapterWindow(resourceId, anchor.book, anchor.chapter);

  const verses = useMemo(
    () =>
      chapters.flatMap((chapter) =>
        chapter.verses.map((verse) => ({ ...verse, chapter: chapter.chapter })),
      ),
    [chapters],
  );

  useEffect(() => {
    let cancelled = false;
    void window.versescape.resources.list().then((result) => {
      if (cancelled) return;
      if (result.ok) setResources(result.data);
      else setResourceError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const virtualizer = useVirtualizer({
    count: verses.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 52,
    overscan: 8,
    getItemKey: (index) => verses[index]?.key ?? index,
  });

  const scrollToVerse = useCallback(
    (verseKey: number): boolean => {
      if (!containerRef.current) return false;
      const index = verses.findIndex((verse) => verse.key === verseKey);
      if (index < 0) return false;
      virtualizer.scrollToIndex(index, { align: 'start' });
      return true;
    },
    [verses, virtualizer],
  );

  const getAnchorVerse = useCallback((): number | null => {
    const top = virtualizer.getVirtualItemForOffset(virtualizer.scrollOffset ?? 0);
    return top ? (verses[top.index]?.key ?? null) : null;
  }, [verses, virtualizer]);

  const updateLiveReference = useCallback(
    (verse: (typeof verses)[number]) => {
      setVisibleChapter(verse.chapter);
      if (verse.chapter === anchor.chapter) return;
      const target = fromVerseKey(verse.key);
      if (!target) return;

      initialScrollKey.current = `${resourceId}:${anchor.book}:${verse.chapter}:${verse.verse}`;
      followTab(tabId, verse.key, formatReference({ start: target, end: target }));
    },
    [anchor.book, anchor.chapter, followTab, resourceId, tabId],
  );

  const shiftWindow = useCallback(
    async (direction: 'before' | 'after'): Promise<void> => {
      if (pendingRestore.current || !containerRef.current) return;
      const top = virtualizer.getVirtualItemForOffset(virtualizer.scrollOffset ?? 0);
      const verse = top ? verses[top.index] : null;
      if (!top || !verse) return;

      ignoreAnchorsUntil.current = 0;
      pendingRestore.current = {
        verseKey: verse.key,
        offset: (virtualizer.scrollOffset ?? 0) - top.start,
      };
      setRestoring(true);
      if (!(await extend(direction))) {
        pendingRestore.current = null;
        setRestoring(false);
      }
    },
    [extend, verses, virtualizer],
  );

  const onAnchorVerse = useCallback(
    (verseKey: number) => {
      if (pendingRestore.current) return;
      const index = verses.findIndex((verse) => verse.key === verseKey);
      const verse = verses[index];
      if (!verse) return;

      if (Date.now() >= ignoreAnchorsUntil.current) {
        updateLiveReference(verse);
      }
      if (index < 8) void shiftWindow('before');
      const last = virtualizer.getVirtualItems().at(-1);
      if (last && last.index >= verses.length - 8) void shiftWindow('after');
    },
    [shiftWindow, updateLiveReference, verses, virtualizer],
  );

  const followVerse = useCallback(
    (verseKey: number) => {
      const target = fromVerseKey(verseKey);
      if (!target) return;
      followTab(tabId, verseKey, formatReference({ start: target, end: target }));
    },
    [followTab, tabId],
  );

  const navigateToVerse = useCallback(
    (verseKey: number) => {
      const target = fromVerseKey(verseKey);
      if (!target) return;
      navigateTab(tabId, verseKey, formatReference({ start: target, end: target }));
    },
    [navigateTab, tabId],
  );

  useVerseSync({
    tabId,
    containerRef,
    onNavigate: followVerse,
    getAnchorVerse,
    scrollToVerse,
    onAnchorVerse,
  });

  useEffect(() => {
    setVisibleChapter(anchor.chapter);
  }, [anchor.book, anchor.chapter]);

  useEffect(() => {
    if (verses.length === 0) return;
    const key = `${resourceId}:${anchor.book}:${anchor.chapter}:${anchor.verse}`;
    if (initialScrollKey.current === key) return;
    const target = verses.find(
      (verse) => verse.chapter === anchor.chapter && verse.verse === anchor.verse,
    );
    if (!target) return;

    const frame = requestAnimationFrame(() => {
      ignoreAnchorsUntil.current = Date.now() + 240;
      if (scrollToVerse(target.key)) initialScrollKey.current = key;
    });
    return () => cancelAnimationFrame(frame);
  }, [verses, resourceId, anchor.book, anchor.chapter, anchor.verse, scrollToVerse]);

  useEffect(() => {
    const restore = pendingRestore.current;
    if (!restore || !containerRef.current) return;
    const index = verses.findIndex((verse) => verse.key === restore.verseKey);
    if (index < 0) {
      pendingRestore.current = null;
      return;
    }

    let offsetFrame: number | null = null;
    const positionFrame = requestAnimationFrame(() => {
      virtualizer.scrollToIndex(index, { align: 'start' });
      offsetFrame = requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.scrollTop += restore.offset;
        const restoredVerse = verses[index];
        if (restoredVerse) updateLiveReference(restoredVerse);
        pendingRestore.current = null;
        setRestoring(false);
      });
    });
    return () => {
      cancelAnimationFrame(positionFrame);
      if (offsetFrame !== null) cancelAnimationFrame(offsetFrame);
    };
  }, [updateLiveReference, verses, virtualizer]);

  const headings = new Map<number, ChapterData['headings']>();
  const footnotes = new Map<string, ChapterData['footnotes'][number]>();
  for (const chapter of chapters) {
    for (const heading of chapter.headings) {
      const atVerse = headings.get(heading.key) ?? [];
      atVerse.push(heading);
      headings.set(heading.key, atVerse);
    }
    for (const note of chapter.footnotes) {
      footnotes.set(note.id, note);
      footnotes.set(note.id.slice(note.id.lastIndexOf('.') + 1), note);
    }
  }

  const error = resourceError ?? chapterError;

  return (
    <div className="bible-panel">
      <div className="bible-panel__toolbar">
        <h2 className="bible-panel__heading">
          {book?.name ?? anchor.book} {visibleChapter}
        </h2>
        <select
          className="bible-panel__translation"
          aria-label="Translation"
          value={resourceId}
          onChange={(event) => setState(patchState(state, { resourceId: event.target.value }))}
        >
          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.abbreviation}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="bible-panel__message" role="alert">
          {error}
        </div>
      ) : loading || verses.length === 0 ? (
        <div className="bible-panel__message">Loading chapter...</div>
      ) : (
        <div ref={containerRef} className="bible-panel__scroll" data-testid="bible-scroll">
          <div
            className="bible-panel__virtual"
            data-loaded-chapters={chapters.map((loaded) => loaded.chapter).join(',')}
            data-restoring={restoring}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const verse = verses[virtualRow.index]!;
              return (
                <div
                  key={verse.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  data-verse={verse.key}
                  className={`bible-panel__verse${
                    verse.verse === anchor.verse ? ' bible-panel__verse--current' : ''
                  }${verse.poetry > 0 ? ' bible-panel__verse--poetry' : ''}`}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  onClick={() => navigateToVerse(verse.key)}
                >
                  {verse.verse === 1 && verse.chapter !== anchor.chapter && (
                    <h3 className="bible-panel__chapter-marker" data-chapter={verse.chapter}>
                      {book?.name ?? anchor.book} {verse.chapter}
                    </h3>
                  )}
                  {headings.get(verse.key)?.map((heading) => (
                    <h3
                      key={`${heading.key}-${heading.level}-${heading.text}`}
                      className="bible-panel__section"
                    >
                      {heading.text}
                    </h3>
                  ))}
                  <p
                    className={
                      verse.paragraphStart ? 'bible-panel__paragraph' : 'bible-panel__line'
                    }
                  >
                    <span className="bible-panel__number">{verse.verse}</span>
                    <BibleText text={verse.text} footnotes={footnotes} verseKey={verse.key} />
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
