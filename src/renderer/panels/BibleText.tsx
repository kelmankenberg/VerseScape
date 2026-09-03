import type { ChapterData } from '@shared/ipc/contracts.js';

type Footnote = ChapterData['footnotes'][number];

/** A persisted highlight or text-colour span, in plain-text offset space (see `plainOffsetInVerse`). */
export interface HighlightSpan {
  start: number;
  end: number;
  colour: string;
  style: 'fill' | 'text';
}

function decodeText(value: string): string {
  return value.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&');
}

// Word/separator boundary: letters, marks and digits count as "word" characters.
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const TOKEN_PATTERN = /[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+/gu;

function styleFor(span: HighlightSpan | undefined): React.CSSProperties | undefined {
  if (!span) return undefined;
  return span.style === 'text' ? { color: span.colour } : { backgroundColor: span.colour };
}

/**
 * Splits decoded text into word and separator tokens. Every word becomes its
 * own element carrying its lowercased form in `data-word`, so click handling
 * and highlight matching both read the same value instead of independently
 * reconstructing word boundaries from raw text or mouse coordinates.
 *
 * `offset` tracks the running plain-text position (shared across the whole
 * verse via the same mutable object) so persisted highlight spans, which are
 * stored in that offset space, can be matched against each token.
 */
function renderText(
  value: string,
  highlightWord: string | undefined,
  keyPrefix: string,
  highlights: HighlightSpan[],
  offset: { pos: number },
): React.ReactNode[] {
  const decoded = decodeText(value);
  const normalizedHighlight = highlightWord?.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = TOKEN_PATTERN.exec(decoded)) !== null) {
    const token = match[0];
    const tokenStart = offset.pos;
    const tokenEnd = tokenStart + token.length;
    offset.pos = tokenEnd;
    const span = highlights.find((h) => tokenStart < h.end && tokenEnd > h.start);
    const style = styleFor(span);

    if (!WORD_CHAR.test(token[0]!)) {
      nodes.push(
        style ? (
          <span key={`${keyPrefix}-sep-${index}`} style={style}>
            {token}
          </span>
        ) : (
          token
        ),
      );
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
        style={style}
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
  highlights: HighlightSpan[],
  offset: { pos: number },
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Also capture Strong's metadata tags, rendered as hidden spans.
  const marker = /<(wj|i|sc)>|<s n="([^"]+)"\/>|<s>([^<]+)<\/s>|<n id="([^"]+)"\/>/gu;
  let rawCursor = 0;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(value)) !== null) {
    if (match.index > rawCursor)
      nodes.push(
        ...renderText(
          value.slice(rawCursor, match.index),
          highlightWord,
          `${keyPrefix}-text-${nodes.length}`,
          highlights,
          offset,
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
      rawCursor = marker.lastIndex;
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
      rawCursor = marker.lastIndex;
      continue;
    }

    const closing = `</${tag}>`;
    const closeAt = value.indexOf(closing, marker.lastIndex);
    if (closeAt === -1) {
      rawCursor = marker.lastIndex;
      continue;
    }

    const children = renderMarkup(
      value.slice(marker.lastIndex, closeAt),
      footnotes,
      `${keyPrefix}-${nodes.length}`,
      showFootnotes,
      highlightWord,
      highlights,
      offset,
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

    rawCursor = closeAt + closing.length;
    marker.lastIndex = rawCursor;
  }

  if (rawCursor < value.length)
    nodes.push(
      ...renderText(value.slice(rawCursor), highlightWord, `${keyPrefix}-tail`, highlights, offset),
    );
  return nodes;
}

export function BibleText({
  text,
  footnotes,
  verseKey,
  showFootnotes = true,
  highlightWord,
  highlights = [],
}: {
  text: string;
  footnotes: ReadonlyMap<string, Footnote>;
  verseKey: number;
  showFootnotes?: boolean;
  highlightWord?: string;
  highlights?: HighlightSpan[];
}): React.JSX.Element {
  return (
    <span className="bible-text">
      {renderMarkup(text, footnotes, String(verseKey), showFootnotes, highlightWord, highlights, {
        pos: 0,
      })}
    </span>
  );
}
