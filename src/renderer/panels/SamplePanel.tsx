import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  formatReference,
  fromVerseKey,
  getBook,
  nextVerse,
  previousVerse,
  nextChapter,
  previousChapter,
  toVerseKey,
  parseReference,
} from '@shared/reference/index.js';
import type { ChapterData, ResourceSummary } from '@shared/ipc/contracts.js';
import type { BibleDisplayOptions } from '@shared/settings.js';
import type { JsonValue } from '@shared/workspace/index.js';
import { useVerseSync } from '../workspace/use-verse-sync.js';
import { useWorkspace } from '../workspace/store.js';
import { useSettings } from '../stores/settings.js';
import { BibleText } from './BibleText.js';
import { CrossReferencesButton } from './CrossReferencesButton.js';
import { DisplayOptionsButton } from './DisplayOptionsButton.js';
import { SelectionToolbar } from './SelectionToolbar.js';
import type { BibleSelection } from './SelectionToolbar.js';
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

function panelDisplayOverride(state: JsonValue): Partial<BibleDisplayOptions> {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return {};
  const value = (state as Record<string, JsonValue>)['displayOptions'];
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Partial<BibleDisplayOptions>)
    : {};
}

export function SamplePanel({ tabId, state, setState }: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialScrollKey = useRef('');
  const pendingRestore = useRef<{ verseKey: number; offset: number } | null>(null);
  const positioningTarget = useRef<number | null>(null);
  const suppressWindowShiftUntil = useRef(0);
  const navigateTab = useWorkspace((store) => store.navigateTab);
  const followTab = useWorkspace((store) => store.followTab);
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [selection, setSelection] = useState<BibleSelection | null>(null);
  const globalDisplayOptions = useSettings((store) => store.settings.reading);
  const displayOverride = panelDisplayOverride(state);
  const displayOptions: BibleDisplayOptions = { ...globalDisplayOptions, ...displayOverride };

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

  // Build a map of chapter -> max verse for keyboard navigation
  const versesByChapter = useMemo(() => {
    const map = new Map<number, number>();
    for (const chapter of chapters) {
      if (chapter.verses.length > 0) {
        const maxVerse = Math.max(...chapter.verses.map((v) => v.verse));
        map.set(chapter.chapter, maxVerse);
      }
    }
    return map;
  }, [chapters]);

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
    const top = virtualizer.getVirtualItemForOffset(containerRef.current?.scrollTop ?? 0);
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
      const scrollOffset = containerRef.current.scrollTop;
      const top = virtualizer.getVirtualItemForOffset(scrollOffset);
      const verse = top ? verses[top.index] : null;
      if (!top || !verse) return;

      positioningTarget.current = null;
      pendingRestore.current = {
        verseKey: verse.key,
        offset: scrollOffset - top.start,
      };
      suppressWindowShiftUntil.current = Date.now() + 500;
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

      if (positioningTarget.current !== null) {
        return;
      }
      updateLiveReference(verse);
      if (Date.now() < suppressWindowShiftUntil.current) return;
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

  // Keyboard navigation: Arrow keys for verse, Page Up/Down for chapter
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Don't navigate if focus is on an input or contenteditable element
      const target = event.target as Element;
      if (target?.matches('input, textarea, [contenteditable]')) return;

      const anchorKey = toVerseKey(anchor);
      let nextKey: number | null = null;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        nextKey = nextVerse(anchorKey, versesByChapter) ?? anchorKey;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        nextKey = previousVerse(anchorKey, versesByChapter) ?? anchorKey;
      } else if (event.key === 'PageDown') {
        event.preventDefault();
        nextKey = nextChapter(anchorKey) ?? anchorKey;
      } else if (event.key === 'PageUp') {
        event.preventDefault();
        nextKey = previousChapter(anchorKey) ?? anchorKey;
      }

      if (nextKey !== null) {
        navigateToVerse(nextKey);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [anchor, navigateToVerse, versesByChapter]);

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

    positioningTarget.current = target.key;
    suppressWindowShiftUntil.current = Date.now() + 500;
    let frame: number | null = null;
    let attempts = 0;
    const position = (): void => {
      attempts += 1;
      if (scrollToVerse(target.key)) initialScrollKey.current = key;
      frame = requestAnimationFrame(() => {
        const atTarget = getAnchorVerse() === target.key;
        if (atTarget || attempts >= 8) {
          positioningTarget.current = null;
        } else {
          position();
        }
      });
    };
    frame = requestAnimationFrame(position);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (positioningTarget.current === target.key) positioningTarget.current = null;
    };
  }, [
    verses,
    resourceId,
    anchor.book,
    anchor.chapter,
    anchor.verse,
    getAnchorVerse,
    scrollToVerse,
  ]);

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

  const captureSelection = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const text = range.toString().trim();
    const common = range.commonAncestorContainer;
    const element = common instanceof Element ? common : common.parentElement;
    const verse = element?.closest<HTMLElement>('[data-verse]');
    const verseKey = Number(verse?.dataset['verse']);
    if (!text || !verse || !Number.isInteger(verseKey)) return;
    const source = verses.find((item) => item.key === verseKey);
    if (!source) return;
    setSelection({
      text,
      verseKey,
      verseText: source.text,
      reference: formatReference({ start: fromVerseKey(verseKey)!, end: fromVerseKey(verseKey)! }),
      translation:
        resources.find((resource) => resource.id === resourceId)?.abbreviation ?? resourceId,
      rect: range.getBoundingClientRect(),
    });
  };

  return (
    <div
      className={`bible-panel${displayOptions.redLetter ? ' bible-panel--red-letter' : ''}${
        displayOptions.versePerLine ? '' : ' bible-panel--paragraph'
      }`}
    >
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
        <DisplayOptionsButton
          options={displayOptions}
          overridden={Object.keys(displayOverride).length > 0}
          onChange={(patch) =>
            setState(
              patchState(state, {
                displayOptions: { ...displayOverride, ...patch } as JsonValue,
              }),
            )
          }
          onReset={() => setState(patchState(state, { displayOptions: {} }))}
        />
      </div>

      {error ? (
        <div className="bible-panel__message" role="alert">
          {error}
        </div>
      ) : loading || verses.length === 0 ? (
        <div className="bible-panel__message">Loading chapter...</div>
      ) : (
        <div
          ref={containerRef}
          className="bible-panel__scroll"
          data-testid="bible-scroll"
          onMouseUp={captureSelection}
          onScroll={() => setSelection(null)}
        >
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
                    verse.chapter === anchor.chapter && verse.verse === anchor.verse
                      ? ' bible-panel__verse--current'
                      : ''
                  }${verse.poetry > 0 ? ' bible-panel__verse--poetry' : ''}${
                    verse.paragraphStart ? ' bible-panel__verse--para-start' : ''
                  }`}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  onClick={() => navigateToVerse(verse.key)}
                >
                  {verse.verse === 1 && verse.chapter !== anchor.chapter && (
                    <h3 className="bible-panel__chapter-marker" data-chapter={verse.chapter}>
                      {book?.name ?? anchor.book} {verse.chapter}
                    </h3>
                  )}
                  {displayOptions.showHeadings &&
                    headings.get(verse.key)?.map((heading) => (
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
                    {displayOptions.showCrossReferences && (
                      <CrossReferencesButton verseKey={verse.key} onNavigate={navigateToVerse} />
                    )}
                    <BibleText
                      text={verse.text}
                      footnotes={footnotes}
                      verseKey={verse.key}
                      showFootnotes={displayOptions.showFootnotes}
                    />
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {selection && <SelectionToolbar selection={selection} onDismiss={() => setSelection(null)} />}
    </div>
  );
}
