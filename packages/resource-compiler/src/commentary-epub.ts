import AdmZip from 'adm-zip';
import { BOOKS, lookupBook, normaliseBookToken, toVerseKey } from '@shared/reference/index.js';

export interface CommentarySourceEntry {
  id: string;
  bookId: string;
  chapter: number | null;
  startKey: number | null;
  endKey: number | null;
  title: string;
  body: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/giu, '\n')
    .replace(/<\/p\s*>/giu, '\n\n')
    .replace(/<[^>]+>/gu, '')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#(?:x27|39);/giu, "'")
    .replace(/\s+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

function parseReference(value: string): { bookId: string; chapter: number; startVerse: number; endVerse: number } | null {
  const match = /(?:Bible_)?([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-([1-3]?[A-Za-z]+)\.(\d+)\.(\d+))?/u.exec(value);
  if (!match) return null;
  const book = lookupBook(match[1] ?? '');
  const endBook = lookupBook(match[4] ?? match[1] ?? '');
  const chapter = Number(match[2]);
  const startVerse = Number(match[3]);
  const endChapter = Number(match[5] ?? match[2]);
  const endVerse = Number(match[6] ?? match[3]);
  if (!book || !endBook || book.id !== endBook.id || chapter !== endChapter || !chapter || !startVerse || !endVerse) return null;
  return { bookId: book.id, chapter, startVerse, endVerse };
}

function rangeEntry(reference: { bookId: string; chapter: number; startVerse: number; endVerse: number }, _title: string, body: string, index: number): CommentarySourceEntry {
  const range = reference.startVerse === reference.endVerse
    ? `${reference.bookId} ${reference.chapter}:${reference.startVerse}`
    : `${reference.bookId} ${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
  return {
    id: `${reference.bookId.toLowerCase()}-${String(reference.chapter).padStart(3, '0')}-${String(reference.startVerse).padStart(3, '0')}-${index}`,
    bookId: reference.bookId,
    chapter: reference.chapter,
    startKey: toVerseKey({ book: reference.bookId as never, chapter: reference.chapter, verse: reference.startVerse }),
    endKey: toVerseKey({ book: reference.bookId as never, chapter: reference.chapter, verse: reference.endVerse }),
    title: range,
    body,
  };
}

function chapterContexts(archive: AdmZip): Map<string, { bookId: string; chapter: number }> {
  const toc = archive.getEntries().find((entry) => entry.entryName === 'OEBPS/toc.ncx');
  if (!toc) return new Map();
  const contexts = new Map<string, { bookId: string; chapter: number }>();
  const navigation = toc.getData().toString('utf8');
  const stack: Array<{ bookId: string | null; chapter: number | null }> = [];
  const tokens = /<navPoint\b[^>]*>|<\/navPoint>|<text>([^<]+)<\/text>|<content\s+src="([^"]+)"/giu;
  for (const token of navigation.matchAll(tokens)) {
    const markup = token[0];
    if (markup.startsWith('<navPoint')) {
      const parent = stack.at(-1);
      stack.push({ bookId: parent?.bookId ?? null, chapter: parent?.chapter ?? null });
    } else if (markup === '</navPoint>') {
      stack.pop();
    } else if (token[1] !== undefined) {
      const current = stack.at(-1);
      if (!current) continue;
      const label = decodeHtml(token[1]);
      const book = lookupBook(label) ?? BOOKS.find((candidate) => normaliseBookToken(label).includes(normaliseBookToken(candidate.name)));
      if (book) {
        current.bookId = book.id;
        current.chapter = null;
      } else {
        const chapter = /^Chapter\s+(\d+)$/iu.exec(decodeHtml(token[1]));
        if (chapter?.[1]) current.chapter = Number(chapter[1]);
      }
    } else if (token[2] !== undefined) {
      const current = stack.at(-1);
      const source = token[2].split('#')[0];
      if (current?.bookId && current.chapter && source) {
        contexts.set(`OEBPS/${source}`, { bookId: current.bookId, chapter: current.chapter });
      }
    }
  }
  return contexts;
}

/** Extracts only anchored commentary blocks from CCEL EPUB XHTML, discarding all presentation markup. */
export function normalizeCcelCommentaryEpub(path: string): CommentarySourceEntry[] {
  const archive = new AdmZip(path);
  const entries: CommentarySourceEntry[] = [];
  const contexts = chapterContexts(archive);
  for (const file of archive.getEntries().filter((entry) => /^OEBPS\/.*\.html$/u.test(entry.entryName))) {
    const html = file.getData().toString('utf8');
    const context = contexts.get(file.entryName) ?? null;
    const ccelJudeFile = /^(?:OEBPS\/mhcc\.lvii\.i|OEBPS\/jfb\.xi\.xxvi\.i)\.html$/u.test(file.entryName);
    const commentaryBlocks = [...html.matchAll(/<div\s+class="Commentary"[^>]*?(?:id="([^"]*)")?[^>]*>([\s\S]*?)<\/div>/giu)];
    const blocks = commentaryBlocks.length > 0
      ? commentaryBlocks
      : [...html.matchAll(/<p(?:[^>]*\sid="([^"]*)")?[^>]*>([\s\S]*?)<\/p>/giu)];
    let current: { bookId: string; chapter: number } | null = null;
    for (const [blockIndex, block] of blocks.entries()) {
      const markup = block[2] ?? '';
      const directId = block[1] ? parseReference(block[1]) : null;
      const linked = /href="[^"]*#([A-Za-z0-9]+\.\d+\.\d+(?:-[A-Za-z0-9]+\.\d+\.\d+)?)"/u.exec(markup);
      const linkedReference = linked?.[1] ? parseReference(linked[1]) : null;
      const contextualLink = linkedReference && context && linkedReference.bookId === context.bookId && linkedReference.chapter === context.chapter
        ? linkedReference : null;
      // CCEL's concise edition stores its entry anchor as the first link in a
      // paragraph, whereas incidental cross-references occur later in prose.
      const leadingLink = /^\s*(?:<p[^>]*>)?\s*(?:<b>)?\s*<a\s+class="scripRef"/iu.test(markup)
        ? linkedReference
        : null;
      const sourceContext = context ?? (ccelJudeFile ? { bookId: 'JUD', chapter: 1 } : null);
      const contextualDirect = directId && sourceContext && (directId.bookId !== sourceContext.bookId || directId.chapter !== sourceContext.chapter)
        ? { ...sourceContext, startVerse: directId.startVerse, endVerse: directId.endVerse }
        : directId;
      const explicit = contextualDirect ?? contextualLink ?? leadingLink;
      const body = decodeHtml(markup);
      if (!body) continue;
      if (explicit) {
        current = { bookId: explicit.bookId, chapter: explicit.chapter };
        entries.push(rangeEntry(explicit, body.split('\n')[0] ?? '', body, entries.length + blockIndex));
        continue;
      }
      const verseMarker = /^\s*(?:<p[^>]*>)?\s*<b>\s*(\d+)\./iu.exec(markup);
      if (!current && context) current = context;
      if (!current || !verseMarker?.[1]) continue;
      const verse = Number(verseMarker[1]);
      entries.push(rangeEntry({ ...current, startVerse: verse, endVerse: verse }, body.split('\n')[0] ?? '', body, entries.length + blockIndex));
    }
  }
  if (entries.length === 0) throw new Error('No canonically anchored commentary entries were found in the EPUB.');
  return entries.sort((left, right) => (left.startKey ?? 0) - (right.startKey ?? 0) || left.id.localeCompare(right.id));
}
