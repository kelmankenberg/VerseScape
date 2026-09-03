import { Fragment } from 'react';
import type { ChapterData } from '@shared/ipc/contracts.js';

type Footnote = ChapterData['footnotes'][number];

function decodeText(value: string): string {
  return value.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&');
}

// Word/separator boundary: letters, marks and digits count as "word" characters.
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const TOKEN_PATTERN = /[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+/gu;

/**
 * Splits decoded text into word and separator tokens. Every word becomes its
 * own element carrying its lowercased form in `data-word`, so click handling
 * and highlight matching both read the same value instead of independently
 * reconstructing word boundaries from raw text or mouse coordinates.
 */
function renderText(value: string, highlightWord: string | undefined, keyPrefix: string): React.ReactNode[] {
  const decoded = decodeText(value);
  const normalizedHighlight = highlightWord?.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = TOKEN_PATTERN.exec(decoded)) !== null) {
    const token = match[0];
    if (!WORD_CHAR.test(token[0]!)) {
      nodes.push(token);
      index += 1;
      continue;
    }
    const normalized = token.toLowerCase();
    const isHighlighted = normalizedHighlight !== undefined && normalized === normalizedHighlight;
    nodes.push(
      <span
        key={`${keyPrefix}-w-${index}`}
        data-word={normalized}
        className={isHighlighted ? 'bible-text__word-highlight' : undefined}
      >
        {token}
      </span>,
    );
    index += 1;
  }
  return nodes;
}

function renderMarkup(
  value: string,
  footnotes: ReadonlyMap<string, Footnote>,
  keyPrefix: string,
  showFootnotes: boolean,
  highlightWord: string | undefined,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Also capture Strong's metadata tags, rendered as hidden spans.
  const marker = /<(wj|i|sc)>|<s n="([^"]+)"\/>|<s>([^<]+)<\/s>|<n id="([^"]+)"\/>/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(value)) !== null) {
    if (match.index > cursor)
      nodes.push(
        ...renderText(
          value.slice(cursor, match.index),
          highlightWord,
          `${keyPrefix}-text-${nodes.length}`,
        ),
      );

    const tag = match[1];
    const strong = match[2] ?? match[3];
    const noteId = match[4];

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
        <span
          key={`${keyPrefix}-strong-${nodes.length}-${strong}`}
          data-strong={strong}
          className="bible-text__strong"
        />,
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
      highlightWord,
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

  if (cursor < value.length)
    nodes.push(...renderText(value.slice(cursor), highlightWord, `${keyPrefix}-tail`));
  return nodes;
}

export function BibleText({
  text,
  footnotes,
  verseKey,
  showFootnotes = true,
  highlightWord,
}: {
  text: string;
  footnotes: ReadonlyMap<string, Footnote>;
  verseKey: number;
  showFootnotes?: boolean;
  highlightWord?: string;
}): React.JSX.Element {
  return (
    <Fragment>{renderMarkup(text, footnotes, String(verseKey), showFootnotes, highlightWord)}</Fragment>
  );
}
