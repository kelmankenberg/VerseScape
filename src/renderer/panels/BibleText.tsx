import { Fragment } from 'react';
import type { ChapterData } from '@shared/ipc/contracts.js';

type Footnote = ChapterData['footnotes'][number];

function decodeText(value: string): string {
  return value.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&');
}

function renderMarkup(
  value: string,
  footnotes: ReadonlyMap<string, Footnote>,
  keyPrefix: string,
  showFootnotes: boolean,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Also capture <s>strong</s> tags for Strong's numbers (rendered as hidden spans)
  const marker = /<(wj|i|sc)>|<s>([^<]+)<\/s>|<n id="([^"]+)"\/>/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(value)) !== null) {
    if (match.index > cursor) nodes.push(decodeText(value.slice(cursor, match.index)));

    const tag = match[1];
    const strong = match[2];
    const noteId = match[3];

    if (noteId) {
      if (showFootnotes) {
        const note = footnotes.get(noteId);
        nodes.push(
          <button
            key={`${keyPrefix}-note-${noteId}`}
            type="button"
            className="bible-text__note"
            aria-label={note ? `Footnote: ${note.text}` : 'Footnote'}
            title={note?.text}
          >
            {note?.marker && note.marker !== '+' ? note.marker : '*'}
          </button>,
        );
      }
      cursor = marker.lastIndex;
      continue;
    }

    if (strong) {
      // Render Strong's number as hidden span with data attribute
      nodes.push(
        <span key={`${keyPrefix}-strong-${strong}`} data-strong={strong} className="bible-text__strong" />,
      );
      cursor = marker.lastIndex;
      continue;
    }

    const closing = `</${tag}>`;
    const closeAt = value.indexOf(closing, marker.lastIndex);
    if (closeAt === -1) {
      cursor = marker.lastIndex;
      continue;
    }

    const children = renderMarkup(
      value.slice(marker.lastIndex, closeAt),
      footnotes,
      `${keyPrefix}-${nodes.length}`,
      showFootnotes,
    );
    const key = `${keyPrefix}-${tag}-${match.index}`;
    if (tag === 'wj')
      nodes.push(
        <span key={key} className="bible-text__words">
          {children}
        </span>,
      );
    if (tag === 'i') nodes.push(<i key={key}>{children}</i>);
    if (tag === 'sc')
      nodes.push(
        <span key={key} className="bible-text__smallcaps">
          {children}
        </span>,
      );

    cursor = closeAt + closing.length;
    marker.lastIndex = cursor;
  }

  if (cursor < value.length) nodes.push(decodeText(value.slice(cursor)));
  return nodes;
}

export function BibleText({
  text,
  footnotes,
  verseKey,
  showFootnotes = true,
}: {
  text: string;
  footnotes: ReadonlyMap<string, Footnote>;
  verseKey: number;
  showFootnotes?: boolean;
}): React.JSX.Element {
  return <Fragment>{renderMarkup(text, footnotes, String(verseKey), showFootnotes)}</Fragment>;
}
