import { describe, expect, it } from 'vitest';
import { BOOKS, getBook, lookupBook, suggestBooks } from './canon.js';
import { formatReference, parseReference } from './parse.js';
import { fromVerseKey, toVerseKey } from './verse-key.js';

const parsed = (input: string) => {
  const result = parseReference(input);
  if (!result.ok) throw new Error(`expected ${input} to parse, got ${result.reason}`);
  return result.range;
};

describe('canon', () => {
  it('has 66 books in canonical order', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS[0]!.id).toBe('GEN');
    expect(BOOKS[38]!.id).toBe('MAL');
    expect(BOOKS[39]!.id).toBe('MAT');
    expect(BOOKS[65]!.id).toBe('REV');
  });

  it('numbers ordinals from one with no gaps', () => {
    BOOKS.forEach((book, index) => expect(book.ordinal).toBe(index + 1));
  });

  it('knows chapter counts', () => {
    expect(getBook('PSA')!.chapters).toBe(150);
    expect(getBook('JHN')!.chapters).toBe(21);
    expect(getBook('OBA')!.chapters).toBe(1);
  });

  it.each([
    ['John', 'JHN'],
    ['john', 'JHN'],
    ['Jn', 'JHN'],
    ['JHN', 'JHN'],
    ['1 John', '1JN'],
    ['1john', '1JN'],
    ['I John', '1JN'],
    ['II Corinthians', '2CO'],
    ['iChr', '1CH'],
    ['Song of Solomon', 'SNG'],
    ['Ps', 'PSA'],
    ['Psalms', 'PSA'],
  ])('resolves %s to %s', (input, expected) => {
    expect(lookupBook(input)?.id).toBe(expected);
  });

  it('returns null for an unknown book', () => {
    expect(lookupBook('Hezekiah')).toBeNull();
  });

  it('suggests books by prefix', () => {
    expect(suggestBooks('ez').map((book) => book.id)).toContain('EZR');
    expect(suggestBooks('ez').map((book) => book.id)).toContain('EZK');
    expect(suggestBooks('rev')[0]!.id).toBe('REV');
    expect(suggestBooks('')).toEqual([]);
  });
});

describe('verse keys', () => {
  it('round-trips', () => {
    const reference = { book: 'JHN', chapter: 3, verse: 16 };
    expect(fromVerseKey(toVerseKey(reference))).toEqual(reference);
  });

  it('orders across books, chapters and verses', () => {
    const genesis = toVerseKey({ book: 'GEN', chapter: 1, verse: 1 });
    const johnEarly = toVerseKey({ book: 'JHN', chapter: 3, verse: 16 });
    const johnLate = toVerseKey({ book: 'JHN', chapter: 4, verse: 1 });
    const revelation = toVerseKey({ book: 'REV', chapter: 22, verse: 21 });

    expect(genesis).toBeLessThan(johnEarly);
    expect(johnEarly).toBeLessThan(johnLate);
    expect(johnLate).toBeLessThan(revelation);
  });

  it('returns null for a key with no book', () => {
    expect(fromVerseKey(999_000_000)).toBeNull();
  });
});

describe('parseReference', () => {
  it('parses a single verse', () => {
    expect(parsed('John 3:16')).toEqual({
      start: { book: 'JHN', chapter: 3, verse: 16 },
      end: { book: 'JHN', chapter: 3, verse: 16 },
    });
  });

  it.each(['Jn 3:16', 'jn3:16', 'John 3.16', 'JHN 3:16', '  John   3:16  '])(
    'accepts the variant %s',
    (input) => {
      expect(parsed(input).start).toEqual({ book: 'JHN', chapter: 3, verse: 16 });
    },
  );

  it('parses a verse range within a chapter', () => {
    expect(parsed('Ezra 1:1-11')).toEqual({
      start: { book: 'EZR', chapter: 1, verse: 1 },
      end: { book: 'EZR', chapter: 1, verse: 11 },
    });
  });

  it('accepts an en dash', () => {
    expect(parsed('Ezra 1:1–11').end.verse).toBe(11);
  });

  it('parses a range across chapters', () => {
    expect(parsed('John 3:16-4:2')).toEqual({
      start: { book: 'JHN', chapter: 3, verse: 16 },
      end: { book: 'JHN', chapter: 4, verse: 2 },
    });
  });

  it('parses a whole chapter', () => {
    const range = parsed('Ps 23');
    expect(range.start).toEqual({ book: 'PSA', chapter: 23, verse: 1 });
    expect(range.end.chapter).toBe(23);
  });

  it('parses a chapter range', () => {
    const range = parsed('John 3-5');
    expect(range.start.chapter).toBe(3);
    expect(range.end.chapter).toBe(5);
  });

  it('parses a whole book', () => {
    const range = parsed('Jude');
    expect(range.start).toEqual({ book: 'JUD', chapter: 1, verse: 1 });
    expect(range.end.chapter).toBe(1);
  });

  it('parses an ordinal book without confusing the number for a chapter', () => {
    expect(parsed('1 John 2:1').start).toEqual({ book: '1JN', chapter: 2, verse: 1 });
    expect(parsed('2 Timothy 3').start.book).toBe('2TI');
  });

  it.each([
    ['', 'empty'],
    ['Hezekiah 3:1', 'unknown-book'],
    ['12345', 'malformed'],
    ['John 0:1', 'malformed'],
  ])('rejects %s as %s', (input, reason) => {
    const result = parseReference(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(reason);
  });
});

describe('formatReference', () => {
  it.each([
    'John 3:16',
    'John 3:16-18',
    'John 3:16-4:2',
    'Ezra 1:1-11',
    'Psalms 23',
    'John 3-5',
    'Jude',
  ])('round-trips %s', (input) => {
    expect(formatReference(parsed(input))).toBe(input);
  });

  it('expands an abbreviation to the full book name', () => {
    expect(formatReference(parsed('Jn 3:16'))).toBe('John 3:16');
  });
});
