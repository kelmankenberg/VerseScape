import { useCallback, useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatReference, fromVerseKey, getBook, parseReference } from '@shared/reference/index.js';
import type { ChapterData, ResourceSummary } from '@shared/ipc/contracts.js';
import type { JsonValue } from '@shared/workspace/index.js';
import { useVerseSync } from '../workspace/use-verse-sync.js';
import { useWorkspace } from '../workspace/store.js';
import { BibleText } from './BibleText.js';
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
  const navigateTab = useWorkspace((store) => store.navigateTab);
  const followTab = useWorkspace((store) => store.followTab);
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reference = panelValue(state, 'reference', DEFAULT_REFERENCE);
  const resourceId = panelValue(state, 'resourceId', DEFAULT_RESOURCE);
  const parsed = parseReference(reference);
  const anchor = parsed.ok ? parsed.range.start : { book: 'JHN', chapter: 3, verse: 1 };
  const book = getBook(anchor.book);

  useEffect(() => {
    let cancelled = false;
    void window.versescape.resources.list().then((result) => {
      if (cancelled) return;
      if (result.ok) setResources(result.data);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void window.versescape.resources
      .getChapter({ resourceId, bookId: anchor.book, chapter: anchor.chapter })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setChapter(result.data);
        else {
          setChapter(null);
          setError(result.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resourceId, anchor.book, anchor.chapter]);

  const virtualizer = useVirtualizer({
    count: chapter?.verses.length ?? 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 52,
    overscan: 8,
    getItemKey: (index) => chapter?.verses[index]?.key ?? index,
  });

  const scrollToVerse = useCallback(
    (verseKey: number): boolean => {
      if (!containerRef.current) return false;
      const index = chapter?.verses.findIndex((verse) => verse.key === verseKey) ?? -1;
      if (index < 0) return false;
      virtualizer.scrollToIndex(index, { align: 'start' });
      return true;
    },
    [chapter, virtualizer],
  );

  const getAnchorVerse = useCallback((): number | null => {
    const first = virtualizer.getVirtualItems()[0];
    return first && chapter ? (chapter.verses[first.index]?.key ?? null) : null;
  }, [chapter, virtualizer]);

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
  });

  useEffect(() => {
    if (!chapter) return;
    const key = `${resourceId}:${anchor.book}:${anchor.chapter}:${anchor.verse}`;
    if (initialScrollKey.current === key) return;
    const target = chapter.verses.find((verse) => verse.verse === anchor.verse);
    if (!target) return;

    const frame = requestAnimationFrame(() => {
      if (scrollToVerse(target.key)) initialScrollKey.current = key;
    });
    return () => cancelAnimationFrame(frame);
  }, [chapter, resourceId, anchor.book, anchor.chapter, anchor.verse, scrollToVerse]);

  const headings = new Map<number, ChapterData['headings']>();
  const footnotes = new Map(chapter?.footnotes.map((note) => [note.id, note]) ?? []);
  for (const heading of chapter?.headings ?? []) {
    const atVerse = headings.get(heading.key) ?? [];
    atVerse.push(heading);
    headings.set(heading.key, atVerse);
  }

  return (
    <div className="bible-panel">
      <div className="bible-panel__toolbar">
        <h2 className="bible-panel__heading">
          {book?.name ?? anchor.book} {anchor.chapter}
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
      ) : !chapter ? (
        <div className="bible-panel__message">Loading chapter...</div>
      ) : (
        <div ref={containerRef} className="bible-panel__scroll" data-testid="bible-scroll">
          <div className="bible-panel__virtual" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const verse = chapter.verses[virtualRow.index]!;
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
