import { Copy, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatReference, fromVerseKey } from '@shared/reference/index.js';

export interface BibleSelection {
  text: string;
  verseKey: number;
  verseText: string;
  reference: string;
  translation: string;
  rect: DOMRect;
}

function plainText(value: string): string {
  return value
    .replace(/<n id="[^"]+"\/>/gu, '')
    .replace(/<\/?(?:wj|i|sc)>/gu, '')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}

function styledText(value: string): string {
  return value
    .replace(/<n id="[^"]+"\/>/gu, '')
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
}: {
  selection: BibleSelection;
  onDismiss: () => void;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const target = fromVerseKey(selection.verseKey);
  const reference = target ? formatReference({ start: target, end: target }) : selection.reference;
  const left = Math.max(8, Math.min(selection.rect.left, window.innerWidth - 292));
  const below = selection.rect.bottom + 8;
  const preferredTop = below + 108 <= window.innerHeight ? below : selection.rect.top - 116;
  const top = Math.max(8, Math.min(preferredTop, window.innerHeight - 116));

  useEffect(() => {
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
  }, [onDismiss]);

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
          className="selection-toolbar__dismiss"
          aria-label="Dismiss selection toolbar"
          onClick={onDismiss}
        >
          <X size={13} aria-hidden />
        </button>
      </div>
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
