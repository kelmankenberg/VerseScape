import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { BibleDisplayOptions } from '@shared/settings.js';

const TOGGLES: Array<{ key: keyof BibleDisplayOptions; label: string }> = [
  { key: 'versePerLine', label: 'Verse per line' },
  { key: 'redLetter', label: 'Red letter' },
  { key: 'showFootnotes', label: 'Footnotes' },
  { key: 'showHeadings', label: 'Section headings' },
  { key: 'showCrossReferences', label: 'Cross references' },
];

export function DisplayOptionsButton({
  options,
  overridden,
  onChange,
  onReset,
}: {
  options: BibleDisplayOptions;
  overridden: boolean;
  onChange: (patch: Partial<BibleDisplayOptions>) => void;
  onReset: () => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <span className="displayopts">
      <button
        type="button"
        className="icon-button icon-button--small"
        aria-label="Display options"
        aria-expanded={open}
        title="Display options"
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={14} aria-hidden />
      </button>

      {open && (
        <span className="displayopts__popover" role="dialog" aria-label="Display options">
          <span className="displayopts__header">
            Display options
            <button
              type="button"
              className="displayopts__close"
              aria-label="Close display options"
              onClick={() => setOpen(false)}
            >
              <X size={12} aria-hidden />
            </button>
          </span>

          {TOGGLES.map(({ key, label }) => (
            <label className="displayopts__row" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(event) => onChange({ [key]: event.target.checked })}
              />
            </label>
          ))}

          {overridden && (
            <button type="button" className="displayopts__reset" onClick={onReset}>
              Reset to global default
            </button>
          )}
        </span>
      )}
    </span>
  );
}
