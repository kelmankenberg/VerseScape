import { lookupBook } from '@shared/reference/canon.js';
import type { ParsedBook } from './types.js';

/** One original-language word aligned to its rendered BSB wording. */
export interface BsbWord {
  /** Extended Strong's number, testament-prefixed and zero-padded (e.g. "H7225", "G0976"). */
  strong: string;
  word: string;
}

/**
 * Parses the Berean Bible Translation Tables (bsb_tables.tsv): one row per
 * original-language word, aligned to the BSB wording it produced, keyed by
 * the file's own "VerseId" column (e.g. "Genesis 1:1"). VerseId is blank on
 * continuation rows within the same verse and must be carried forward.
 */
export function parseBsbTables(tsv: string): Map<string, BsbWord[]> {
  const lines = tsv.split(/\r?\n/u);
  const result = new Map<string, BsbWord[]>();
  if (lines.length === 0) return result;

  const header = lines[0]!.split('\t');
  const columnIndex = (name: string): number => header.findIndex((cell) => cell.trim() === name);
  const iStrongHeb = columnIndex('Str Heb');
  const iStrongGrk = columnIndex('Str Grk');
  const iVerseId = columnIndex('VerseId');
  const iBsbVersion = columnIndex('BSB version');
  if (iStrongHeb < 0 || iStrongGrk < 0 || iVerseId < 0 || iBsbVersion < 0) {
    throw new Error('Unrecognised BSB translation table columns.');
  }

  let currentVerseId = '';
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const columns = line.split('\t');

    const verseIdCell = columns[iVerseId]?.trim();
    if (verseIdCell) currentVerseId = verseIdCell;
    if (!currentVerseId) continue;

    const bsbCell = columns[iBsbVersion]?.trim();
    if (!bsbCell) continue;

    const hebrew = columns[iStrongHeb]?.trim();
    const greek = columns[iStrongGrk]?.trim();
    const raw = hebrew || greek;
    // Connector words with no original-language anchor cannot be tagged.
    if (!raw) continue;
    const strong = `${hebrew ? 'H' : 'G'}${raw.padStart(4, '0')}`;

    const entries = result.get(currentVerseId) ?? [];
    for (const word of bsbCell.split(/\s+/u)) {
      if (!word || word === '-') continue;
      entries.push({ strong, word });
    }
    if (entries.length > 0) result.set(currentVerseId, entries);
  }

  return result;
}

const SEGMENT = /<[^>]*>|[\p{L}\p{M}\p{N}]+/gu;
/** How far ahead to look for a resync point after a mismatch. */
const RESYNC_WINDOW = 4;
/** Below this fraction of matched words, discard tagging rather than guess. */
const MIN_COVERAGE = 0.6;

/**
 * Aligns a verse's already-parsed inline text against its Translation Table
 * words and injects `<s n="...">` markers at matched word positions. BSB's
 * flowing prose sometimes reorders or adds words beyond any single
 * interlinear gloss (e.g. genealogies), so alignment is a best-effort,
 * resyncing walk: verses that fall below a coverage floor are left untagged
 * rather than risk mislabelling a word.
 */
export function injectStrongMarkers(text: string, words: BsbWord[]): { text: string; tagged: boolean } {
  if (words.length === 0) return { text, tagged: false };

  // Walk tags-or-words together so inline markup (existing <s>, <wj>, <n
  // id="..."/>) never has its element names mistaken for word tokens.
  const tokens: Array<{ start: number; end: number; word: string }> = [];
  let match: RegExpExecArray | null;
  SEGMENT.lastIndex = 0;
  while ((match = SEGMENT.exec(text)) !== null) {
    if (match[0].startsWith('<')) continue;
    tokens.push({ start: match.index, end: match.index + match[0].length, word: match[0] });
  }
  if (tokens.length === 0) return { text, tagged: false };

  const normalize = (value: string): string => value.toLowerCase();
  const strongAtToken = new Map<number, string>();
  let tokenIndex = 0;
  let wordIndex = 0;
  let matched = 0;

  while (tokenIndex < tokens.length && wordIndex < words.length) {
    if (normalize(tokens[tokenIndex]!.word) === normalize(words[wordIndex]!.word)) {
      strongAtToken.set(tokenIndex, words[wordIndex]!.strong);
      matched += 1;
      tokenIndex += 1;
      wordIndex += 1;
      continue;
    }

    let resynced = false;
    for (let total = 1; total <= RESYNC_WINDOW * 2 && !resynced; total += 1) {
      for (let skipTokens = 0; skipTokens <= total && !resynced; skipTokens += 1) {
        const skipWords = total - skipTokens;
        if (skipTokens > RESYNC_WINDOW || skipWords > RESYNC_WINDOW) continue;
        const nextTokenIndex = tokenIndex + skipTokens;
        const nextWordIndex = wordIndex + skipWords;
        if (nextTokenIndex >= tokens.length || nextWordIndex >= words.length) continue;
        if (normalize(tokens[nextTokenIndex]!.word) === normalize(words[nextWordIndex]!.word)) {
          tokenIndex = nextTokenIndex;
          wordIndex = nextWordIndex;
          resynced = true;
        }
      }
    }
    if (!resynced) {
      tokenIndex += 1;
      wordIndex += 1;
    }
  }

  if (matched / tokens.length < MIN_COVERAGE) return { text, tagged: false };

  let output = '';
  let cursor = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const strong = strongAtToken.get(index);
    output += text.slice(cursor, token.start);
    if (strong) output += `<s n="${strong}"/>`;
    output += text.slice(token.start, token.end);
    cursor = token.end;
  }
  output += text.slice(cursor);
  return { text: output, tagged: true };
}

export interface StrongsAlignmentStats {
  taggedVerses: number;
  totalVerses: number;
}

/** Applies the Translation Table to every verse across the given books, in place. */
export function applyStrongMarkers(
  books: ParsedBook[],
  table: Map<string, BsbWord[]>,
): StrongsAlignmentStats {
  let taggedVerses = 0;
  let totalVerses = 0;

  for (const book of books) {
    const bookInfo = lookupBook(book.id);
    if (!bookInfo) continue;

    for (const verse of book.verses) {
      totalVerses += 1;
      const verseId = `${bookInfo.name} ${verse.chapter}:${verse.verse}`;
      const words = table.get(verseId);
      if (!words) continue;

      const result = injectStrongMarkers(verse.text, words);
      if (result.tagged) {
        verse.text = result.text;
        taggedVerses += 1;
      }
    }
  }

  return { taggedVerses, totalVerses };
}
