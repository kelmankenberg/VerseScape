import { Search as SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, formatReference, fromVerseKey, getBook } from '@shared/reference/index.js';
import type { SearchHit, ResourceSummary } from '@shared/ipc/contracts.js';
import type { JsonValue } from '@shared/workspace/index.js';
import { useWorkspace } from '../workspace/store.js';
import type { PanelProps } from './registry.js';
import './SearchResultsPanel.css';

interface SearchPanelState {
  query: string;
  resourceIds: string[];
  testament: 'OT' | 'NT' | '';
  startBook: string;
  endBook: string;
}

const EMPTY_STATE: SearchPanelState = {
  query: '',
  resourceIds: [],
  testament: '',
  startBook: '',
  endBook: '',
};

function readState(state: JsonValue): SearchPanelState {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return EMPTY_STATE;
  const record = state as Record<string, JsonValue>;
  return {
    query: typeof record['query'] === 'string' ? record['query'] : '',
    resourceIds: Array.isArray(record['resourceIds'])
      ? record['resourceIds'].filter((id): id is string => typeof id === 'string')
      : [],
    testament: record['testament'] === 'OT' || record['testament'] === 'NT' ? record['testament'] : '',
    startBook: typeof record['startBook'] === 'string' ? record['startBook'] : '',
    endBook: typeof record['endBook'] === 'string' ? record['endBook'] : '',
  };
}

/** Splits a `snippet()` result on the sentinel bytes the compiler-shared SQL uses (never real verse text). */
function renderSnippet(snippet: string): React.ReactNode[] {
  // eslint-disable-next-line no-control-regex -- \u0001/\u0002 are the snippet() sentinel bytes, never real verse text
  const parts = snippet.split(/[\u0001\u0002]/u);
  // Odd-indexed parts are always the highlighted spans: split() alternates
  // outside/inside/outside/... around each \u0001..\u0002 pair.
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="search-results__mark">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function SearchResultsPanel({ state, setState }: PanelProps): React.JSX.Element {
  const panelState = readState(state);
  const openPanel = useWorkspace((store) => store.openPanel);
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState(panelState.query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.versescape.resources.list().then((result) => {
      if (cancelled || !result.ok) return;
      setResources(result.data);
      if (panelState.resourceIds.length === 0 && result.data.length > 0) {
        setState({ ...(state as object), resourceIds: result.data.map((r) => r.id) } as JsonValue);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = (next: Partial<SearchPanelState>): void => {
    setState({ ...panelState, ...next } as unknown as JsonValue);
  };

  const runSearch = (query: string, scope: SearchPanelState): void => {
    if (!query.trim() || scope.resourceIds.length === 0) {
      setHits([]);
      setStatus('idle');
      setError(null);
      return;
    }
    setStatus('loading');
    setError(null);
    void window.versescape.search
      .query({
        query,
        scope: {
          resourceIds: scope.resourceIds,
          ...(scope.testament ? { testament: scope.testament } : {}),
          ...(scope.startBook ? { startBook: scope.startBook } : {}),
          ...(scope.endBook ? { endBook: scope.endBook } : {}),
        },
        limit: 100,
      })
      .then((result) => {
        if (result.ok) {
          setHits(result.data);
          setStatus('idle');
        } else {
          setHits([]);
          setStatus('error');
          setError(result.message);
        }
      });
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      patch({ query: queryInput });
      runSearch(queryInput, { ...panelState, query: queryInput });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [queryInput, panelState.resourceIds, panelState.testament, panelState.startBook, panelState.endBook]);

  const toggleResource = (id: string): void => {
    const next = panelState.resourceIds.includes(id)
      ? panelState.resourceIds.filter((existing) => existing !== id)
      : [...panelState.resourceIds, id];
    patch({ resourceIds: next });
  };

  const openResult = (hit: SearchHit): void => {
    const reference = fromVerseKey(hit.verseKey);
    if (!reference) return;
    openPanel('sample', undefined, {
      reference: formatReference({ start: reference, end: reference }),
      resourceId: hit.resourceId,
      verseKey: hit.verseKey,
    });
  };

  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  return (
    <div className="search-results">
      <div className="search-results__query">
        <SearchIcon size={14} aria-hidden />
        <input
          type="text"
          className="search-results__input"
          placeholder='Search... "phrase", word*, AND/OR/NOT'
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              patch({ query: queryInput });
              runSearch(queryInput, { ...panelState, query: queryInput });
            }
          }}
        />
      </div>

      <div className="search-results__scope">
        <div className="search-results__resources" role="group" aria-label="Resources to search">
          {resources.map((resource) => (
            <label key={resource.id} className="search-results__chip">
              <input
                type="checkbox"
                checked={panelState.resourceIds.includes(resource.id)}
                onChange={() => toggleResource(resource.id)}
              />
              {resource.abbreviation}
            </label>
          ))}
        </div>
        <select
          className="search-results__select"
          aria-label="Testament"
          value={panelState.testament}
          onChange={(event) => patch({ testament: event.target.value as 'OT' | 'NT' | '' })}
        >
          <option value="">Any testament</option>
          <option value="OT">Old Testament</option>
          <option value="NT">New Testament</option>
        </select>
        <select
          className="search-results__select"
          aria-label="Start book"
          value={panelState.startBook}
          onChange={(event) => patch({ startBook: event.target.value })}
        >
          <option value="">Any start book</option>
          {BOOKS.map((book) => (
            <option key={book.id} value={book.id}>
              {book.name}
            </option>
          ))}
        </select>
        <select
          className="search-results__select"
          aria-label="End book"
          value={panelState.endBook}
          onChange={(event) => patch({ endBook: event.target.value })}
        >
          <option value="">Any end book</option>
          {BOOKS.map((book) => (
            <option key={book.id} value={book.id}>
              {book.name}
            </option>
          ))}
        </select>
      </div>

      <div className="search-results__list">
        {status === 'error' && <div className="search-results__empty">{error}</div>}
        {status === 'loading' && <div className="search-results__empty">Searching…</div>}
        {status === 'idle' && !queryInput.trim() && (
          <div className="search-results__empty">Type to search across selected resources.</div>
        )}
        {status === 'idle' && queryInput.trim() && hits.length === 0 && (
          <div className="search-results__empty">No matches.</div>
        )}
        {status === 'idle' &&
          hits.map((hit) => {
            const reference = fromVerseKey(hit.verseKey);
            const book = reference ? getBook(reference.book) : null;
            return (
              <button
                key={`${hit.resourceId}-${hit.verseKey}`}
                type="button"
                className="search-results__item"
                onClick={() => openResult(hit)}
              >
                <div className="search-results__meta">
                  <span className="search-results__badge">
                    {resourceById.get(hit.resourceId)?.abbreviation ?? hit.resourceId}
                  </span>
                  <span className="search-results__reference">
                    {book && reference ? `${book.name} ${reference.chapter}:${reference.verse}` : '?'}
                  </span>
                </div>
                <div className="search-results__snippet">{renderSnippet(hit.snippet)}</div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
