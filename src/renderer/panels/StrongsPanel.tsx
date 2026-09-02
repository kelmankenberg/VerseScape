import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatReference, fromVerseKey, getBook } from '@shared/reference/index.js';
import { useWorkspace } from '../workspace/store.js';
import type { PanelProps } from './registry.js';
import './StrongsPanel.css';

export type StrongsPanelState = { strongNumber: string; resourceId?: string };

export const StrongsPanel: React.FC<PanelProps> = ({ tabId, state }) => {
  const panelState: StrongsPanelState =
    typeof state === 'object' && state !== null && !Array.isArray(state)
      ? {
          strongNumber:
            typeof state.strongNumber === 'string' ? state.strongNumber : '',
          ...(typeof state.resourceId === 'string' ? { resourceId: state.resourceId } : {}),
        }
      : { strongNumber: '' };
  const navigateTab = useWorkspace((store) => store.navigateTab);
  const resourceId = panelState.resourceId ?? 'bsb';
  const { concordance, isLoading } = useConcordance(resourceId, panelState.strongNumber);
  const { definition } = useLexiconEntry(panelState.strongNumber);
  const items = useMemo(
    () => concordance.map((match) => {
      const reference = fromVerseKey(match.verseKey);
      const book = reference ? getBook(reference.book) : null;
      return {
        verseKey: match.verseKey,
        text: stripMarkup(match.text),
        reference: reference && book ? `${book.name} ${reference.chapter}:${reference.verse}` : '?',
      };
    }),
    [concordance],
  );
  const openVerse = useCallback((verseKey: number) => {
    const reference = fromVerseKey(verseKey);
    if (reference) navigateTab(tabId, verseKey, formatReference({ start: reference, end: reference }));
  }, [navigateTab, tabId]);

  if (!panelState.strongNumber) {
    return <div className="strongs-panel"><div className="strongs-panel__empty">No Strong's number is available for this selection</div></div>;
  }
  return (
    <div className="strongs-panel">
      <div className="strongs-panel__header">
        <h2 className="strongs-panel__title">Strong's {panelState.strongNumber}</h2>
        <div className="strongs-panel__count">{items.length} verses</div>
      </div>
      {definition && <div className="strongs-panel__definition">{stripMarkup(definition)}</div>}
      {isLoading ? <div className="strongs-panel__loading">Loading...</div> : items.length === 0 ? <div className="strongs-panel__empty">No verses found</div> : (
        <div className="strongs-panel__list">
          {items.map((item) => <button key={item.verseKey} className="strongs-panel__item" onClick={() => openVerse(item.verseKey)} type="button"><div className="strongs-panel__reference">{item.reference}</div><div className="strongs-panel__text">{item.text}</div></button>)}
        </div>
      )}
    </div>
  );
};

function useConcordance(resourceId: string, strongNumber: string): { concordance: Array<{ verseKey: number; text: string }>; isLoading: boolean } {
  const [concordance, setConcordance] = useState<Array<{ verseKey: number; text: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!strongNumber) { setConcordance([]); return; }
    let cancelled = false;
    setIsLoading(true);
    window.versescape.resources.getConcordance({ resourceId, strongNumber }).then((result) => {
      if (!cancelled && result.ok) setConcordance(result.data);
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [resourceId, strongNumber]);
  return { concordance, isLoading };
}

function useLexiconEntry(strongNumber: string): { definition: string | null } {
  const [definition, setDefinition] = useState<string | null>(null);
  useEffect(() => {
    if (!strongNumber) { setDefinition(null); return; }
    let cancelled = false;
    window.versescape.resources.getLexiconEntry({ resourceId: 'bsb', strongNumber }).then((result) => {
      if (!cancelled) setDefinition(result.ok ? result.data?.definition ?? null : null);
    });
    return () => { cancelled = true; };
  }, [strongNumber]);
  return { definition };
}

function stripMarkup(value: string): string {
  return value
    .replace(/<s>[^<]*<\/s>/gu, '')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

