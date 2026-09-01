import type { PanelProps } from './registry.js';

const LINES = Array.from({ length: 120 }, (_, index) => index + 1);

/**
 * Placeholder for the M3 Bible panel: a long scrollable list of verse-numbered
 * lines. Each line carries `data-verse` so step 7 can wire verse sync against
 * something real before the reader exists.
 */
export function SamplePanel({ state }: PanelProps): React.JSX.Element {
  const scrollVerse =
    typeof state === 'object' && state !== null && 'scrollVerse' in state
      ? Number((state as { scrollVerse: unknown }).scrollVerse ?? 1)
      : 1;

  return (
    <div className="sample-panel">
      {LINES.map((verse) => (
        <p
          key={verse}
          className={`sample-panel__line${verse === scrollVerse ? ' sample-panel__line--current' : ''}`}
          data-verse={verse}
        >
          <span className="sample-panel__number">{verse}</span>
          Sample verse text for line {verse}, long enough to wrap on a narrow panel and give the
          scroll container something to work with.
        </p>
      ))}
    </div>
  );
}
