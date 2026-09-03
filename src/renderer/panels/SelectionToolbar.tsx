import { Copy, FileText, Palette, Search, StickyNote, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatReference, fromVerseKey } from '@shared/reference/index.js';

export interface BibleSelection {
  text: string;
  verseKey: number;
  verseText: string;
  startOffset: number;
  endOffset: number;
  strongNumber?: string;
  reference: string;
  translation: string;
  rect: DOMRect;
}

/** Fixed v1 palette — enough range to distinguish topics without a full colour picker (highlight swatches, FR-RD-06 Row 2). */
const HIGHLIGHT_COLOURS: Array<{ name: string; hex: string }> = [
  { name: 'Yellow', hex: '#fde68a' },
  { name: 'Green', hex: '#bbf7d0' },
  { name: 'Blue', hex: '#bfdbfe' },
  { name: 'Pink', hex: '#fbcfe8' },
  { name: 'Purple', hex: '#e9d5ff' },
];

function plainText(value: string): string {
  return value
    .replace(/<n id="[^"]+"\/>/gu, '')
    .replace(/<s n="[^"]+"\/>/gu, '')
    .replace(/<\/?(?:wj|i|sc)>/gu, '')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}

function styledText(value: string): string {
  return value
    .replace(/<n id="[^"]+"\/>/gu, '')
    .replace(/<s n="[^"]+"\/>/gu, '')
    .replace(/<wj>/gu, '<span style="color:#c62c31">')
    .replace(/<\/wj>/gu, '</span>')
    .replace(/<sc>/gu, '<span style="font-variant:small-caps">')
    .replace(/<\/sc>/gu, '</span>');
}

function copyPayload(text: string, html?: string): void {
  void window.versescape.clipboard.writeText({ text, ...(html ? { html } : {}) });
}

function verseHeader(selection: BibleSelection): string {
  return `${selection.reference} (${selection.translation})`;
}

export function SelectionToolbar({
  selection,
  onDismiss,
  onStrongLookup,
  onCreateNote,
  onCreateHighlight,
}: {
  selection: BibleSelection;
  onDismiss: () => void;
  onStrongLookup?: (strongNumber: string) => void;
  onCreateNote?: (title: string) => void;
  onCreateHighlight?: (colour: string, style: 'fill' | 'text') => void;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const colourInputRef = useRef<HTMLInputElement>(null);
  const target = fromVerseKey(selection.verseKey);
  const reference = target ? formatReference({ start: target, end: target }) : selection.reference;
  const left = Math.max(8, Math.min(selection.rect.left, window.innerWidth - 292));
  const below = selection.rect.bottom + 8;
  const preferredTop = below + 152 <= window.innerHeight ? below : selection.rect.top - 160;
  const top = Math.max(8, Math.min(preferredTop, window.innerHeight - 160));

  useEffect(() => {
    if (noteDraft !== null) return;
    const onKeyDown = (): void => onDismiss();
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Element) || !event.target.closest('.selection-toolbar'))
        onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onDismiss, noteDraft]);

  const copy = (text: string, html?: string): void => {
    copyPayload(text, html);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  const header = verseHeader({ ...selection, reference });
  const lines = `${header}\n${plainText(selection.verseText)}`;
  const styled = `<p><strong>${header}</strong></p><p>${styledText(selection.verseText)}</p>`;

  return (
    <div
      className="selection-toolbar"
      role="toolbar"
      aria-label="Selection actions"
      style={{ left, top }}
    >
      <div className="selection-toolbar__row">
        <button type="button" onClick={() => copy(selection.text)}>
          <Copy size={13} aria-hidden />
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" disabled title="Search Results is coming in M4.">
          <FileText size={13} aria-hidden />
          Search
        </button>
        <button
          type="button"
          disabled={!onStrongLookup}
          title={selection.strongNumber ? "Open Strong's Concordance" : "No Strong's number is available for this selection"}
          onClick={() => {
            onStrongLookup?.(selection.strongNumber ?? '');
          }}
        >
          <Search size={13} aria-hidden />
          Strong's
        </button>
        <button
          type="button"
          className="selection-toolbar__dismiss"
          aria-label="Dismiss selection toolbar"
          onClick={onDismiss}
        >
          <X size={13} aria-hidden />
        </button>
      </div>
      {noteDraft === null ? (
        <div className="selection-toolbar__row">
          <button
            type="button"
            disabled={!onCreateNote}
            title="Create a note anchored to this verse"
            onClick={() => setNoteDraft(selection.text)}
          >
            <StickyNote size={13} aria-hidden />
            Note
          </button>
          <span className="selection-toolbar__swatches" role="group" aria-label="Highlight colour">
            {HIGHLIGHT_COLOURS.map(({ name, hex }) => (
              <button
                key={hex}
                type="button"
                className="selection-toolbar__swatch"
                aria-label={`Highlight with ${name}`}
                disabled={!onCreateHighlight}
                style={{ backgroundColor: hex }}
                onClick={() => {
                  onCreateHighlight?.(hex, 'fill');
                  onDismiss();
                }}
              />
            ))}
          </span>
          <button
            type="button"
            disabled={!onCreateHighlight}
            title="Set the selected text's colour"
            onClick={() => colourInputRef.current?.click()}
          >
            <Palette size={13} aria-hidden />
            Colour Text
          </button>
          <input
            ref={colourInputRef}
            type="color"
            className="selection-toolbar__colour-input"
            aria-hidden
            tabIndex={-1}
            defaultValue="#c62c31"
            onChange={(event) => {
              onCreateHighlight?.(event.target.value, 'text');
              onDismiss();
            }}
          />
        </div>
      ) : (
        <div className="selection-toolbar__row selection-toolbar__note">
          <StickyNote size={13} aria-hidden />
          <input
            type="text"
            className="selection-toolbar__note-input"
            value={noteDraft}
            placeholder="Note title"
            autoFocus
            onChange={(event) => setNoteDraft(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                onCreateNote?.(noteDraft);
                onDismiss();
              }
              if (event.key === 'Escape') setNoteDraft(null);
            }}
          />
          <button
            type="button"
            onClick={() => {
              onCreateNote?.(noteDraft);
              onDismiss();
            }}
          >
            Save
          </button>
          <button type="button" onClick={() => setNoteDraft(null)}>
            Cancel
          </button>
        </div>
      )}
      <div className="selection-toolbar__row selection-toolbar__row--copy-verse">
        <span>Copy verse</span>
        <button type="button" onClick={() => copy(lines, styled)}>
          Styled
        </button>
        <button type="button" onClick={() => copy(lines)}>
          Lines
        </button>
        <button type="button" onClick={() => copy(selection.text)}>
          Text Only
        </button>
      </div>
    </div>
  );
}
