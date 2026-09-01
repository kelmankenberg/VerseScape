import { useState } from 'react';
import { Link2, X } from 'lucide-react';
import { formatReference, fromVerseKey } from '@shared/reference/index.js';
import type { CrossReference } from '@shared/ipc/contracts.js';

function label(reference: CrossReference): string {
  const start = fromVerseKey(reference.startKey);
  const end = fromVerseKey(reference.endKey);
  return start && end ? formatReference({ start, end }) : 'Unknown reference';
}

export function CrossReferencesButton({
  verseKey,
  onNavigate,
}: {
  verseKey: number;
  onNavigate: (verseKey: number) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [references, setReferences] = useState<CrossReference[] | null>(null);
  const [error, setError] = useState(false);

  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    if (!next || references) return;
    void window.versescape.resources.getCrossReferences({ verseKey, limit: 12 }).then((result) => {
      if (result.ok) setReferences(result.data);
      else setError(true);
    });
  };

  return (
    <span className="crossrefs">
      <button
        type="button"
        className="crossrefs__trigger"
        aria-label="Cross references"
        aria-expanded={open}
        title="Cross references"
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
      >
        <Link2 size={11} aria-hidden />
      </button>
      {open && (
        <span className="crossrefs__popover" role="dialog" aria-label="Cross references">
          <span className="crossrefs__header">
            Cross references
            <button
              type="button"
              className="crossrefs__close"
              aria-label="Close cross references"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            >
              <X size={12} aria-hidden />
            </button>
          </span>
          {error ? (
            <span className="crossrefs__empty">Could not load references.</span>
          ) : references === null ? (
            <span className="crossrefs__empty">Loading...</span>
          ) : references.length === 0 ? (
            <span className="crossrefs__empty">No cross references.</span>
          ) : (
            <span className="crossrefs__list">
              {references.map((reference) => (
                <button
                  key={`${reference.startKey}-${reference.endKey}`}
                  type="button"
                  className="crossrefs__item"
                  title={label(reference)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    onNavigate(reference.startKey);
                  }}
                >
                  {label(reference)}
                </button>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
