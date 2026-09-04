import { Copy, FileText, Highlighter, StickyNote } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { stripToPlainText } from './text-utils.js';
import type { BibleSelection } from './SelectionToolbar.js';

const HIGHLIGHT_COLOURS: Array<{ name: string; hex: string }> = [
  { name: 'Yellow', hex: '#fde68a' },
  { name: 'Green', hex: '#bbf7d0' },
  { name: 'Blue', hex: '#bfdbfe' },
  { name: 'Pink', hex: '#fbcfe8' },
  { name: 'Purple', hex: '#e9d5ff' },
];

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

export function SelectionContextMenu({
  selection,
  onDismiss,
  onCreateNote,
  onCreateHighlight,
  onSearch,
}: {
  selection: BibleSelection;
  onDismiss: () => void;
  onCreateNote?: (title: string) => void;
  onCreateHighlight?: (colour: string, style: 'fill' | 'text') => void;
  onSearch?: (query: string) => void;
}): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: PointerEvent): void => {
      if (!(event.target instanceof Element) || !event.target.closest('.selection-context-menu')) {
        onDismiss();
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };

    window.addEventListener('pointerdown', onClickOutside, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onClickOutside, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss]);

  const header = verseHeader(selection);
  const lines = `${header}\n${stripToPlainText(selection.verseText)}`;
  const styled = `<p><strong>${header}</strong></p><p>${styledText(selection.verseText)}</p>`;

  const left = Math.max(8, Math.min(selection.rect.left, window.innerWidth - 280));
  const below = selection.rect.bottom + 8;
  const preferredTop = below + 200 <= window.innerHeight ? below : selection.rect.top - 210;
  const top = Math.max(8, Math.min(preferredTop, window.innerHeight - 210));

  return (
    <div
      ref={menuRef}
      className="selection-context-menu"
      role="menu"
      style={{ left, top }}
    >
      <div className="selection-context-menu__group">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            copyPayload(selection.text);
            onDismiss();
          }}
        >
          <Copy size={14} aria-hidden />
          Copy
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!onSearch}
          title="Search this text"
          onClick={() => {
            onSearch?.(selection.text);
            onDismiss();
          }}
        >
          <FileText size={14} aria-hidden />
          Search
        </button>
      </div>

      <div className="selection-context-menu__divider" />

      <div className="selection-context-menu__group">
        <button
          type="button"
          role="menuitem"
          disabled={!onCreateNote}
          title="Create a note anchored to this verse"
          onClick={() => {
            onCreateNote?.(selection.text);
            onDismiss();
          }}
        >
          <StickyNote size={14} aria-hidden />
          New Note
        </button>
      </div>

      <div className="selection-context-menu__divider" />

      <div className="selection-context-menu__group">
        <span className="selection-context-menu__label">
          <Highlighter size={14} aria-hidden />
          Highlight
        </span>
        <div className="selection-context-menu__colors">
          {HIGHLIGHT_COLOURS.map((colour) => (
            <button
              key={colour.hex}
              type="button"
              role="menuitem"
              className="selection-context-menu__color-button"
              title={`Highlight ${colour.name.toLowerCase()}`}
              disabled={!onCreateHighlight}
              style={{ backgroundColor: colour.hex }}
              onClick={() => {
                onCreateHighlight?.(colour.hex, 'fill');
                onDismiss();
              }}
              aria-label={`Highlight ${colour.name.toLowerCase()}`}
            />
          ))}
        </div>
      </div>

      <div className="selection-context-menu__divider" />

      <div className="selection-context-menu__group">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            copyPayload(selection.text, undefined);
            onDismiss();
          }}
        >
          Copy Text
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            copyPayload(lines, undefined);
            onDismiss();
          }}
        >
          Copy with Reference
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            copyPayload(lines, styled);
            onDismiss();
          }}
        >
          Copy Styled
        </button>
      </div>
    </div>
  );
}
