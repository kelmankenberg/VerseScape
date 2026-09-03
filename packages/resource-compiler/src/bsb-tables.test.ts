import { describe, expect, it } from 'vitest';
import { injectStrongMarkers, parseBsbTables } from './bsb-tables.js';

describe('parseBsbTables', () => {
  it('parses a simple verse and carries the VerseId forward across rows', () => {
    const tsv = [
      'Heb Sort\tGreek Sort\tBSB Sort\tVerse\tLanguage\tWLC\tOther\tTranslit\tParsing\tParsing\tStr Heb\tStr Grk\tVerseId\tHdg\tCrossref\tPar\tSpace\tbegQ\tBSB version\tpnc\tendQ\tfootnotes\tEnd text',
      '1\t0\t1\t1\tHebrew\t\t\t\t\t\t7225\t\tGenesis 1:1\t\t\t\t\t\t In the beginning \t\t\t\t',
      '3\t0\t2\t1\tHebrew\t\t\t\t\t\t430\t\t\t\t\t\t\t\t God \t\t\t\t',
      '4\t0\t3\t1\tHebrew\t\t\t\t\t\t853\t\t\t\t\t\t\t\t - \t\t\t\t',
      '2\t0\t4\t1\tHebrew\t\t\t\t\t\t1254\t\t\t\t\t\t\t\t created \t\t\t\t',
    ].join('\n');

    const table = parseBsbTables(tsv);
    expect(table.get('Genesis 1:1')).toEqual([
      { strong: 'H7225', word: 'In' },
      { strong: 'H7225', word: 'the' },
      { strong: 'H7225', word: 'beginning' },
      { strong: 'H0430', word: 'God' },
      { strong: 'H1254', word: 'created' },
    ]);
  });

  it('prefixes Greek numbers and pads to four digits', () => {
    const tsv = [
      'Str Heb\tStr Grk\tVerseId\tBSB version',
      '\t976\tMatthew 1:1\t Biblos ',
    ].join('\n');

    const table = parseBsbTables(tsv);
    expect(table.get('Matthew 1:1')).toEqual([{ strong: 'G0976', word: 'Biblos' }]);
  });

  it('drops rows with no Strong reference', () => {
    const tsv = ['Str Heb\tStr Grk\tVerseId\tBSB version', '\t\tGenesis 1:1\t and '].join('\n');
    const table = parseBsbTables(tsv);
    expect(table.get('Genesis 1:1')).toBeUndefined();
  });
});

describe('injectStrongMarkers', () => {
  it('tags every matching word when the streams align exactly', () => {
    const words = [
      { strong: 'H1063', word: 'For' },
      { strong: 'H2316', word: 'God' },
      { strong: 'H0025', word: 'loved' },
    ];
    const result = injectStrongMarkers('For God loved the world.', words);
    expect(result.tagged).toBe(true);
    expect(result.text).toBe(
      '<s n="H1063"/>For <s n="H2316"/>God <s n="H0025"/>loved the world.',
    );
  });

  it('matches case-insensitively', () => {
    const result = injectStrongMarkers('for GOD so loved', [
      { strong: 'H1063', word: 'For' },
      { strong: 'H2316', word: 'god' },
      { strong: 'H3779', word: 'SO' },
      { strong: 'H0025', word: 'Loved' },
    ]);
    expect(result.text).toBe(
      '<s n="H1063"/>for <s n="H2316"/>GOD <s n="H3779"/>so <s n="H0025"/>loved',
    );
  });

  it('resyncs past a small number of inserted or dropped words', () => {
    const words = [
      { strong: 'H1063', word: 'For' },
      { strong: 'H2316', word: 'God' },
      { strong: 'H0025', word: 'loved' },
      { strong: 'H2889', word: 'world' },
    ];
    // "so" and "the" appear in the rendered text but have no table entry.
    const result = injectStrongMarkers('For God so loved the world', words);
    expect(result.tagged).toBe(true);
    expect(result.text).toContain('<s n="H2316"/>God');
    expect(result.text).toContain('<s n="H2889"/>world');
  });

  it('preserves inline markup untouched around tagged words', () => {
    const words = [{ strong: 'H2316', word: 'God' }];
    const result = injectStrongMarkers('<wj>God</wj>', words);
    expect(result.text).toBe('<wj><s n="H2316"/>God</wj>');
  });

  it('discards tagging when the streams diverge beyond the coverage floor', () => {
    const words = [
      { strong: 'G0976', word: 'record' },
      { strong: 'G1078', word: 'genealogy' },
    ];
    const result = injectStrongMarkers(
      'This is a completely different sentence with no relation whatsoever',
      words,
    );
    expect(result.tagged).toBe(false);
    expect(result.text).toBe('This is a completely different sentence with no relation whatsoever');
  });

  it('returns the original text unchanged when there are no words to align', () => {
    const result = injectStrongMarkers('Some text.', []);
    expect(result).toEqual({ text: 'Some text.', tagged: false });
  });
});
