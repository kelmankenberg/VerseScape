import { lookupBook } from '@shared/reference/canon.js';
import type {
  ParseDiagnostic,
  ParsedBook,
  ParsedCrossRef,
  ParsedFootnote,
  ParsedHeading,
  ParsedVerse,
  ParseOutcome,
} from './types.js';

/**
 * USFM parser.
 *
 * Reduces USFM to the restricted inline markup from doc 07 (`wj`, `i`, `sc`,
 * `n`, `q`, `b`, `s` for Strong's numbers) rather than passing markup through,
 * so the renderer never has to sanitise anything at display time.
 */

/** Character markers whose content we keep, mapped to our own tags. */
const INLINE_TAGS: Record<string, string> = {
  wj: 'wj', // words of Christ
  add: 'i', // translator-supplied
  nd: 'sc', // divine name
  it: 'i',
  em: 'i',
  bk: 'i',
  qt: 'i',
  s: 's', // Strong's number
};

/** Character markers whose content we keep, unwrapped. */
const TRANSPARENT_MARKERS = new Set(['k', 'w', 'pn', 'sls', 'tl', 'ord', 'no', 'sc', 'lit', 'rq']);

/** Paragraph markers that begin prose. */
const PROSE_PARAGRAPHS = new Set([
  'p',
  'm',
  'pi',
  'pi1',
  'pi2',
  'nb',
  'pc',
  'pr',
  'cls',
  'po',
  'pmo',
  'li1',
  'li2',
]);

/** Markers whose entire line is dropped. */
const IGNORED_LINES = new Set([
  'ide',
  'rem',
  'sts',
  'toc1',
  'toc2',
  'toc3',
  'toca1',
  'toca2',
  'toca3',
  'cl',
  'cp',
  'usfm',
  'h1',
  'h2',
  'h3',
]);

interface Line {
  marker: string | null;
  content: string;
  number: number;
}

function splitLines(source: string): Line[] {
  const raw = source.replace(/\r\n?/g, '\n').split('\n');
  const lines: Line[] = [];

  raw.forEach((text, index) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const match = /^\\(\S+)\s?([\s\S]*)$/u.exec(trimmed);
    if (match) {
      const marker = match[1]!.toLowerCase();
      const content = match[2] ?? '';
      const embeddedVerses = [...content.matchAll(/\\v\s+(?=\d)/gu)];

      if (embeddedVerses.length === 0) {
        lines.push({ marker, content, number: index + 1 });
        return;
      }

      const prefix = content.slice(0, embeddedVerses[0]!.index).trim();
      const leadingCharacterMarkup = /^\\[a-z0-9]+(?:\s+\\[a-z0-9]+)*\s*$/iu.test(prefix)
        ? prefix
        : '';
      lines.push({ marker, content: leadingCharacterMarkup ? '' : prefix, number: index + 1 });
      embeddedVerses.forEach((verse, verseIndex) => {
        const start = verse.index + verse[0].length;
        const end = embeddedVerses[verseIndex + 1]?.index ?? content.length;
        const verseContent = content.slice(start, end).trim();
        lines.push({
          marker: 'v',
          content:
            verseIndex === 0 && leadingCharacterMarkup
              ? verseContent.replace(/^(\d+[a-z]?\s*)/u, `$1${leadingCharacterMarkup} `)
              : verseContent,
          number: index + 1,
        });
      });
    } else {
      // Continuation of the previous marker's content.
      const previous = lines[lines.length - 1];
      if (previous) previous.content = `${previous.content} ${trimmed}`.trim();
      else lines.push({ marker: null, content: trimmed, number: index + 1 });
    }
  });

  return lines;
}

interface NoteCapture {
  footnotes: Array<{ marker: string; text: string }>;
  crossRefs: string[];
}

/** Strips `\f ... \f*` and `\x ... \x*`, returning them separately. */
function extractNotes(input: string): { text: string; notes: NoteCapture } {
  const notes: NoteCapture = { footnotes: [], crossRefs: [] };

  const withoutFootnotes = input.replace(
    /\\f\s*(\S*)\s*([\s\S]*?)\\f\*/gu,
    (_match, caller: string, body: string) => {
      notes.footnotes.push({ marker: caller || '+', text: cleanNoteBody(body) });
      return `\uE000FN${notes.footnotes.length - 1}\uE000`;
    },
  );

  const withoutCrossRefs = withoutFootnotes.replace(
    /\\x\s*\S*\s*([\s\S]*?)\\x\*/gu,
    (_match, body: string) => {
      notes.crossRefs.push(cleanNoteBody(body));
      return '';
    },
  );

  return { text: withoutCrossRefs, notes };
}

function cleanNoteBody(body: string): string {
  return (
    body
      .replace(/\\ref\s+([^|\\]+)\|[^\\]+\\ref\*/gu, '$1')
      // \fr and \xo carry the origin reference, which the UI supplies itself.
      .replace(/\\(?:fr|xo)\s+[^\\]*/gu, ' ')
      .replace(/\\[a-z]+\d*\*?/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

function escapeText(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

/** Converts surviving USFM character markers into our restricted tag set. */
function toInlineMarkup(input: string, noteIds: string[], activeTags: string[], strongNumbers: string[]): string {
  // Extract Strong's numbers from word fields and replace with placeholders.
  // USFM word field: \w word|strong="G123"\w* or \+w word|strong="G123"\+w*
  const displayText = input.replace(
    /\\\+?w\s+([^|\\]+)(?:\|strong="([^"]+)")?(?:\|[^\\]*)?\\\+?w\*/gu,
    (_field, word: string, strong: string | undefined) => {
      if (strong) {
        strongNumbers.push(strong);
        return `\uE000ST${strongNumbers.length - 1}\uE000${word}`;
      }
      return word;
    },
  );
  let output = activeTags.map((tag) => `<${tag}>`).join('');
  let index = 0;
  const open = [...activeTags];

  while (index < displayText.length) {
    const next = displayText.indexOf('\\', index);
    if (next === -1) {
      output += escapeText(displayText.slice(index));
      break;
    }

    output += escapeText(displayText.slice(index, next));

    const match = /^\\([a-z0-9]+)(\*?)/iu.exec(displayText.slice(next));
    if (!match) {
      index = next + 1;
      continue;
    }

    const marker = match[1]!.toLowerCase();
    const closing = match[2] === '*';
    index = next + match[0].length;

    // Only an opening marker is followed by a delimiting space; a closing
    // marker is not, and swallowing it would join words together.
    if (!closing && displayText[index] === ' ') index += 1;

    if (closing) {
      const tag = INLINE_TAGS[marker];
      if (tag && open[open.length - 1] === tag) {
        output += `</${tag}>`;
        open.pop();
        activeTags.pop();
      }
      continue;
    }

    const tag = INLINE_TAGS[marker];
    if (tag) {
      output += `<${tag}>`;
      open.push(tag);
      activeTags.push(tag);
    } else if (!TRANSPARENT_MARKERS.has(marker)) {
      // Unknown marker: drop the marker, keep any text that follows.
      continue;
    }
  }

  for (let position = open.length - 1; position >= 0; position -= 1) {
    output += `</${open[position]}>`;
  }

  // Restore footnote markers as self-closing references.
  return output
    .replace(/\uE000FN(\d+)\uE000/gu, (_match, id: string) => {
      const noteId = noteIds[Number(id)];
      return noteId ? `<n id="${noteId}"/>` : '';
    })
    .replace(/\uE000ST(\d+)\uE000/gu, (_match, id: string) => {
      const strong = strongNumbers[Number(id)];
      return strong ? `<s>${strong}</s>` : '';
    })
    .replace(/\s+/gu, ' ')
    .replace(/(<(?:wj|i|sc)>)\s+/gu, '$1')
    .replace(/\s+(<\/(?:wj|i|sc)>)/gu, '$1')
    .trim();
}

export function parseUsfm(source: string): ParseOutcome {
  const diagnostics: ParseDiagnostic[] = [];
  const verses: ParsedVerse[] = [];
  const headings: ParsedHeading[] = [];
  const footnotes: ParsedFootnote[] = [];
  const crossRefs: ParsedCrossRef[] = [];

  let bookId: string | null = null;
  let shortName: string | null = null;
  let title: string | null = null;

  let chapter = 0;
  let current: ParsedVerse | null = null;
  let pendingParagraph = false;
  let pendingPoetry = 0;
  let pendingHeadings: Array<{ level: number; text: string }> = [];
  let footnoteCounter = 0;
  const activeInlineTags: string[] = [];

  const flush = (): void => {
    if (current && current.text.length > 0) verses.push(current);
    current = null;
  };

  const appendToCurrent = (line: Line, content: string): void => {
    if (!current) {
      if (content.trim()) {
        diagnostics.push({
          severity: 'warning',
          code: 'text-outside-verse',
          message: `Text before the first \\v in chapter ${chapter} was dropped`,
          line: line.number,
        });
      }
      return;
    }

    const { text, notes } = extractNotes(content);
    const noteIds: string[] = notes.footnotes.map((note) => {
      footnoteCounter += 1;
      const id = `fn${footnoteCounter}`;
      footnotes.push({
        id,
        chapter: current!.chapter,
        verse: current!.verse,
        marker: note.marker,
        text: note.text,
      });
      return id;
    });

    for (const reference of notes.crossRefs) {
      crossRefs.push({ chapter: current.chapter, verse: current.verse, text: reference });
    }

    const markup = toInlineMarkup(text, noteIds, activeInlineTags, []);
    current.text = current.text ? `${current.text} ${markup}`.trim() : markup;
  };

  for (const line of splitLines(source)) {
    const marker = line.marker;

    if (!marker) {
      appendToCurrent(line, line.content);
      continue;
    }

    if (IGNORED_LINES.has(marker)) continue;

    if (marker === 'id') {
      const token = line.content.trim().split(/\s+/)[0] ?? '';
      const book = lookupBook(token);
      if (!book) {
        diagnostics.push({
          severity: 'error',
          code: 'unknown-book',
          message: `Unrecognised book code "${token}"`,
          line: line.number,
        });
      } else {
        bookId = book.id;
      }
      continue;
    }

    if (marker === 'h') {
      shortName = line.content.trim() || null;
      continue;
    }

    if (/^mt\d?$/u.test(marker)) {
      title = title ? `${title} ${line.content.trim()}`.trim() : line.content.trim() || null;
      continue;
    }

    if (marker === 'c') {
      flush();
      const value = Number(line.content.trim().split(/\s+/)[0]);
      if (!Number.isInteger(value) || value < 1) {
        diagnostics.push({
          severity: 'error',
          code: 'bad-chapter',
          message: `Invalid chapter number "${line.content.trim()}"`,
          line: line.number,
        });
        continue;
      }
      chapter = value;
      pendingParagraph = true;
      pendingPoetry = 0;
      continue;
    }

    if (marker === 'v') {
      flush();
      const match = /^(\d+[a-z]?)\s?([\s\S]*)$/u.exec(line.content.trim());
      if (!match) {
        diagnostics.push({
          severity: 'error',
          code: 'bad-verse',
          message: `Invalid verse marker "${line.content.trim()}"`,
          line: line.number,
        });
        continue;
      }

      const verseNumber = Number.parseInt(match[1]!, 10);
      current = {
        chapter,
        verse: verseNumber,
        text: '',
        paraStart: pendingParagraph,
        poetry: pendingPoetry,
      };
      pendingParagraph = false;

      for (const heading of pendingHeadings) {
        headings.push({
          chapter,
          verse: verseNumber,
          level: heading.level,
          text: heading.text,
        });
      }
      pendingHeadings = [];

      appendToCurrent(line, match[2] ?? '');
      continue;
    }

    if (/^s\d?$/u.test(marker)) {
      const level = Number(marker.slice(1) || '1');
      const text = cleanNoteBody(line.content);
      if (text) pendingHeadings.push({ level, text });
      continue;
    }

    if (marker === 'b') {
      pendingParagraph = true;
      continue;
    }

    if (/^q\d?$/u.test(marker) || marker === 'qr') {
      pendingPoetry = marker === 'qr' ? 1 : Number(marker.slice(1) || '1');
      pendingParagraph = true;
      if (line.content.trim()) {
        if (current) current.poetry = pendingPoetry;
        appendToCurrent(line, line.content);
      }
      continue;
    }

    if (PROSE_PARAGRAPHS.has(marker)) {
      pendingParagraph = true;
      pendingPoetry = 0;
      if (line.content.trim()) appendToCurrent(line, line.content);
      continue;
    }

    if (marker === 'd' || marker === 'r' || marker === 'sp' || marker === 'qa') {
      // Psalm ascriptions and parallel references become headings.
      const text = cleanNoteBody(line.content);
      if (text) pendingHeadings.push({ level: 4, text });
      continue;
    }

    if (marker === 'ms' || marker === 'mr') {
      const text = cleanNoteBody(line.content);
      if (text) pendingHeadings.push({ level: 3, text });
      continue;
    }

    // Anything else: keep the text, drop the marker, and say so once.
    diagnostics.push({
      severity: 'warning',
      code: 'unhandled-marker',
      message: `Unhandled marker \\${marker}`,
      line: line.number,
    });
    if (line.content.trim()) appendToCurrent(line, line.content);
  }

  flush();

  if (!bookId) {
    diagnostics.push({
      severity: 'error',
      code: 'missing-id',
      message: 'File has no \\id marker naming its book',
      line: 1,
    });
    return { book: null, diagnostics };
  }

  const book: ParsedBook = {
    id: bookId,
    shortName,
    title,
    verses,
    headings,
    footnotes,
    crossRefs,
  };

  return { book, diagnostics };
}
