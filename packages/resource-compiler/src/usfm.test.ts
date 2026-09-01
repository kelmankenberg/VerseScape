import { describe, expect, it } from 'vitest';
import { parseUsfm } from './usfm.js';
import { validateBook, hasErrors } from './validate.js';

const parse = (source: string) => {
  const outcome = parseUsfm(source);
  if (!outcome.book) throw new Error(`expected a book, got: ${outcome.diagnostics[0]?.message}`);
  return outcome;
};

const JUDE = String.raw`
\id JUD Jude - Test
\h Jude
\mt1 Jude
\c 1
\s1 Greeting
\p
\v 1 Jude, a servant of Jesus Christ,
\v 2 Mercy unto you, and peace, and love, be multiplied.
`;

describe('parseUsfm', () => {
  it('reads the book id, header and title', () => {
    const { book } = parse(JUDE);
    expect(book!.id).toBe('JUD');
    expect(book!.shortName).toBe('Jude');
    expect(book!.title).toBe('Jude');
  });

  it('collects verses with chapter and verse numbers', () => {
    const { book } = parse(JUDE);
    expect(book!.verses).toHaveLength(2);
    expect(book!.verses[0]).toMatchObject({ chapter: 1, verse: 1 });
    expect(book!.verses[0]!.text).toBe('Jude, a servant of Jesus Christ,');
  });

  it('attaches a section heading to the verse that follows it', () => {
    const { book } = parse(JUDE);
    expect(book!.headings).toEqual([{ chapter: 1, verse: 1, level: 1, text: 'Greeting' }]);
  });

  it('marks the first verse of a paragraph', () => {
    const { book } = parse(JUDE);
    expect(book!.verses[0]!.paraStart).toBe(true);
    expect(book!.verses[1]!.paraStart).toBe(false);
  });

  it('joins text continued on following lines', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\p
\v 1 First part
of the same verse.
`);
    expect(book!.verses[0]!.text).toBe('First part of the same verse.');
  });

  it('splits paragraph and multiple verse markers on one line', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\p \v 1 First verse. \v 2 Second verse.
`);
    expect(book!.verses).toMatchObject([
      { verse: 1, text: 'First verse.', paraStart: true },
      { verse: 2, text: 'Second verse.', paraStart: false },
    ]);
  });

  it('balances character markup that spans verse markers', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\p \wj \v 1 First saying. \v 2 Second saying.\wj*
`);
    expect(book!.verses[0]!.text).toBe('<wj>First saying.</wj>');
    expect(book!.verses[1]!.text).toBe('<wj>Second saying.</wj>');
  });

  it('maps character markers to the restricted tag set', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\p
\v 1 And he said, \wj Follow me\wj*, \add and\add* the \nd Lord\nd* spoke.
`);
    expect(book!.verses[0]!.text).toBe(
      'And he said, <wj>Follow me</wj>, <i>and</i> the <sc>Lord</sc> spoke.',
    );
  });

  it('drops unknown character markers but keeps their text', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\p
\v 1 Text with \xyz odd\xyz* markup.
`);
    expect(book!.verses[0]!.text).toBe('Text with odd markup.');
  });

  it('keeps word-field text and drops Strong attributes', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\p
\v 1 \wj  \+w Let|strong="G5015"\+w* not your \w heart|strong="G2588"\w* be troubled.\wj*
`);
    expect(book!.verses[0]!.text).toBe('<wj>Let not your heart be troubled.</wj>');
  });

  it('extracts footnotes and leaves a marker behind', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\p
\v 1 Jude, a servant\f + \fr 1:1 \ft Or slave.\f* of Jesus.
`);
    expect(book!.footnotes).toHaveLength(1);
    expect(book!.footnotes[0]!.text).toBe('Or slave.');
    expect(book!.verses[0]!.text).toBe('Jude, a servant<n id="fn1"/> of Jesus.');
  });

  it('extracts cross-references without leaving a marker', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\p
\v 1 Jude\x - \xo 1:1 \xt Rom 1:1\x* wrote.
`);
    expect(book!.crossRefs).toHaveLength(1);
    expect(book!.crossRefs[0]!.text).toContain('Rom 1:1');
    expect(book!.verses[0]!.text).toBe('Jude wrote.');
  });

  it('keeps only the visible label from USFM reference fields', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\r (\ref Genesis 22:1–10|GEN 22:1-10\ref*)
\v 1 Text.
`);
    expect(book!.headings[0]!.text).toBe('(Genesis 22:1–10)');
  });

  it('records poetry indent level', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\q1
\v 1 A line of poetry.
`);
    expect(book!.verses[0]!.poetry).toBe(1);
  });

  it('escapes markup characters in the source text', () => {
    const { book } = parse(String.raw`
\id JUD
\c 1
\p
\v 1 Bread & wine < water.
`);
    expect(book!.verses[0]!.text).toBe('Bread &amp; wine &lt; water.');
  });

  it('reports a missing \\id', () => {
    const outcome = parseUsfm('\\c 1\n\\p\n\\v 1 Text.');
    expect(outcome.book).toBeNull();
    expect(outcome.diagnostics.some((d) => d.code === 'missing-id')).toBe(true);
  });

  it('reports an unknown book code', () => {
    const outcome = parseUsfm('\\id ZZZ\n\\c 1\n\\v 1 Text.');
    expect(outcome.diagnostics.some((d) => d.code === 'unknown-book')).toBe(true);
  });

  it('warns about text before the first verse', () => {
    const outcome = parseUsfm('\\id JUD\n\\c 1\n\\p Stray text.\n\\v 1 Real text.');
    expect(outcome.diagnostics.some((d) => d.code === 'text-outside-verse')).toBe(true);
  });
});

describe('validateBook', () => {
  it('accepts a complete single-chapter book', () => {
    const { book } = parse(JUDE);
    const report = validateBook(book!);
    expect(hasErrors(report.diagnostics)).toBe(false);
    expect(report.verseCount).toBe(2);
    expect(report.chapterCount).toBe(1);
  });

  it('rejects a book with a missing chapter', () => {
    const { book } = parse('\\id MRK\n\\c 1\n\\p\n\\v 1 Text.');
    const report = validateBook(book!);
    expect(report.diagnostics.filter((d) => d.code === 'missing-chapter')).toHaveLength(15);
    expect(hasErrors(report.diagnostics)).toBe(true);
  });

  it('rejects a chapter beyond the book’s range', () => {
    const { book } = parse('\\id JUD\n\\c 2\n\\p\n\\v 1 Text.');
    const report = validateBook(book!);
    expect(report.diagnostics.some((d) => d.code === 'chapter-out-of-range')).toBe(true);
  });

  it('rejects duplicate and out-of-order verses', () => {
    const { book } = parse('\\id JUD\n\\c 1\n\\p\n\\v 2 Second.\n\\v 1 First.');
    const report = validateBook(book!);
    expect(report.diagnostics.some((d) => d.code === 'out-of-order')).toBe(true);
  });

  it('warns about an empty verse', () => {
    const { book } = parse('\\id JUD\n\\c 1\n\\p\n\\v 1 Text.\n\\v 2 \\f + note\\f*');
    const report = validateBook(book!);
    expect(report.diagnostics.some((d) => d.code === 'empty-verse')).toBe(true);
  });
});
