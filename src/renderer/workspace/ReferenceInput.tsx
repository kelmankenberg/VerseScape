import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatReference,
  parseReference,
  suggestBooks,
  toVerseKey,
} from '@shared/reference/index.js';
import { useWorkspace } from './store.js';
import type { TabId } from '@shared/workspace/index.js';

function currentReference(state: unknown): string {
  return typeof state === 'object' && state !== null && 'reference' in state
    ? String((state as { reference: unknown }).reference ?? '')
    : '';
}

/**
 * Reference input in a panel header (FR-WS-17). Typing a reference navigates
 * this panel and publishes to its sync set, so any panel can drive the others.
 */
export function ReferenceInput({ tabId }: { tabId: TabId }): React.JSX.Element {
  const stored = useWorkspace((state) => currentReference(state.workspace.tabs[tabId]?.state));
  const navigateTab = useWorkspace((state) => state.navigateTab);

  const [draft, setDraft] = useState(stored);
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Follow external navigation (a sync partner, or a restored layout).
  useEffect(() => {
    setDraft(stored);
  }, [stored]);

  const suggestions = useMemo(() => {
    const token = draft.trim().split(/\s+/)[0] ?? '';
    return token.length >= 1 && !/^\d+$/.test(token) ? suggestBooks(token, 6) : [];
  }, [draft]);

  const commit = (value: string): void => {
    const result = parseReference(value);
    if (!result.ok) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setOpen(false);
    navigateTab(tabId, toVerseKey(result.range.start), formatReference(result.range));
    inputRef.current?.blur();
  };

  return (
    <div className="reference">
      <input
        ref={inputRef}
        className={`reference__input${invalid ? ' reference__input--invalid' : ''}`}
        value={draft}
        placeholder="Go to reference…"
        aria-label="Go to reference"
        aria-invalid={invalid}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(draft);
          if (event.key === 'Escape') {
            setDraft(stored);
            setInvalid(false);
            setOpen(false);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />

      {open && suggestions.length > 0 && (
        <ul className="reference__suggestions" role="listbox">
          {suggestions.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="reference__suggestion"
                onMouseDown={(event) => {
                  event.preventDefault();
                  const rest = draft.trim().split(/\s+/).slice(1).join(' ');
                  const next = `${book.name} ${rest}`.trim();
                  setDraft(next);
                  if (rest) commit(next);
                }}
              >
                <span className="reference__suggestion-name">{book.name}</span>
                <span className="reference__suggestion-meta">{book.chapters} ch</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
