import { describe, expect, it } from 'vitest';
import { parseLexicon } from './lexicon.js';

describe('parseLexicon', () => {
  it('parses Strong\'s rows and ignores prose', () => {
    const entries = parseLexicon(`Header\nG0001  G0001 = alpha <b>first</b>\nH0001  H0001 = father\n`);
    expect(entries).toEqual([
      { strongNumber: 'G0001', source: 'G0001 = alpha <b>first</b>' },
      { strongNumber: 'H0001', source: 'H0001 = father' },
    ]);
  });

  it('accepts extended Strong\'s suffixes', () => {
    expect(parseLexicon('G0001G  extended\n')[0]?.strongNumber).toBe('G0001G');
  });
});
