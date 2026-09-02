import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatReference, fromVerseKey, getBook, parseReference } from '@shared/reference/index.js';
import type { ChapterData, ResourceSummary } from '@shared/ipc/contracts.js';
import type { JsonValue } from '@shared/workspace/index.js';
import { useVerseSync } from '../workspace/use-verse-sync.js';
import { useWorkspace } from '../workspace/store.js';
import { BibleText } from './BibleText.js';
import type { PanelProps } from './registry.js';

const DEFAULT_REFERENCE = 'John 3';

function panelReference(state: JsonValue): string {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return DEFAULT_REFERENCE;
  const reference = state['reference'];
  return typeof reference === 'string' && reference ? reference : DEFAULT_REFERENCE;
}

export function PassageComparePanel({ tabId, state }: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const followTab = useWorkspace((store) => store.followTab);
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reference = panelReference(state);
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
    if (resources.length === 0) return;
    let cancelled = false;
    setError(null);
    setChapters([]);
    void Promise.all(
      resources.map(async (resource) => {
        const result = await window.versescape.resources.getChapter({
          resourceId: resource.id,
          bookId: anchor.book,
          chapter: anchor.chapter,
        });
        if (!result.ok) throw new Error(result.message);
        return result.data;
      }),
    ).then(
      (loaded) => {
        if (!cancelled) setChapters(loaded);
      },
      (cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : 'The passage could not be loaded.');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [anchor.book, anchor.chapter, resources]);

  const chapterByResource = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.resourceId, chapter])),
    [chapters],
  );

  const scrollToVerse = useCallback((verseKey: number): boolean => {
    const target = containerRef.current?.querySelector<HTMLElement>(`[data-verse="${verseKey}"]`);
    if (!target || !containerRef.current) return false;
    containerRef.current.scrollTop +=
      target.getBoundingClientRect().top - containerRef.current.getBoundingClientRect().top;
    return true;
  }, []);

  const getAnchorVerse = useCallback((): number | null => {
    const container = containerRef.current;
    if (!container) return null;
    const top = container.getBoundingClientRect().top;
    for (const verse of container.querySelectorAll<HTMLElement>('[data-verse]')) {
      if (verse.getBoundingClientRect().bottom > top + 1)
        return Number(verse.dataset['verse']) || null;
    }
    return null;
  }, []);

  const followVerse = useCallback(
    (verseKey: number) => {
      const target = fromVerseKey(verseKey);
      if (!target) return;
      followTab(tabId, verseKey, formatReference({ start: target, end: target }));
    },
    [followTab, tabId],
  );

  useVerseSync({ tabId, containerRef, onNavigate: followVerse, getAnchorVerse, scrollToVerse });

  if (error)
    return (
      <div className="compare-panel__message" role="alert">
        {error}
      </div>
    );
  if (resources.length === 0 || chapters.length !== resources.length)
    return <div className="compare-panel__message">Loading passage...</div>;

  return (
    <div className="compare-panel">
      <div className="compare-panel__heading">
        {book?.name ?? anchor.book} {anchor.chapter}
      </div>
      <div ref={containerRef} className="compare-panel__scroll">
        <div className="compare-panel__columns">
          {resources.map((resource) => {
            const chapter = chapterByResource.get(resource.id)!;
            const footnotes = new Map<string, ChapterData['footnotes'][number]>();
            for (const note of chapter.footnotes) {
              footnotes.set(note.id, note);
              footnotes.set(note.id.slice(note.id.lastIndexOf('.') + 1), note);
            }
            return (
              <article className="compare-panel__column" key={resource.id}>
                <h2 className="compare-panel__translation">{resource.abbreviation}</h2>
                {chapter.verses.map((verse) => (
                  <p className="compare-panel__verse" data-verse={verse.key} key={verse.key}>
                    <sup>{verse.verse}</sup>
                    <BibleText text={verse.text} footnotes={footnotes} verseKey={verse.key} />
                  </p>
                ))}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
