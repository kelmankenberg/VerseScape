import { useCallback, useRef } from 'react';
import {
  formatReference,
  fromVerseKey,
  getBook,
  parseReference,
  toVerseKey,
} from '@shared/reference/index.js';
import { useVerseSync } from '../workspace/use-verse-sync.js';
import { useWorkspace } from '../workspace/store.js';
import type { PanelProps } from './registry.js';

const DEFAULT_REFERENCE = 'John 3';
/** Stand-in until real verse counts arrive with the resource layer in M3. */
const VERSES_PER_CHAPTER = 40;

function readReference(state: unknown): string {
  const value =
    typeof state === 'object' && state !== null && 'reference' in state
      ? String((state as { reference: unknown }).reference ?? '')
      : '';
  return value || DEFAULT_REFERENCE;
}

/**
 * Stand-in for the M3 Bible panel. Renders a chapter of numbered lines carrying
 * `data-verse` verse keys, which is all verse sync needs to work.
 */
export function SamplePanel({ tabId, state }: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigateTab = useWorkspace((store) => store.navigateTab);

  const reference = readReference(state);
  const parsed = parseReference(reference);
  const anchor = parsed.ok ? parsed.range.start : { book: 'JHN', chapter: 3, verse: 1 };
  const book = getBook(anchor.book);

  // When a sync partner moves us outside this chapter, load the right one.
  const onNavigate = useCallback(
    (verseKey: number) => {
      const target = fromVerseKey(verseKey);
      if (!target) return;
      navigateTab(tabId, verseKey, formatReference({ start: target, end: target }));
    },
    [navigateTab, tabId],
  );

  useVerseSync({ tabId, containerRef, onNavigate });

  const verses = Array.from({ length: VERSES_PER_CHAPTER }, (_, index) => index + 1);

  return (
    <div className="sample-panel" ref={containerRef}>
      <h2 className="sample-panel__heading">
        {book?.name ?? anchor.book} {anchor.chapter}
      </h2>

      {verses.map((verse) => {
        const key = toVerseKey({ book: anchor.book, chapter: anchor.chapter, verse });
        return (
          <p
            key={key}
            data-verse={key}
            className={`sample-panel__line${verse === anchor.verse ? ' sample-panel__line--current' : ''}`}
          >
            <span className="sample-panel__number">{verse}</span>
            Sample text for {book?.name ?? anchor.book} {anchor.chapter}:{verse}, long enough to
            wrap on a narrow panel and give the scroll container something to work with.
          </p>
        );
      })}
    </div>
  );
}
