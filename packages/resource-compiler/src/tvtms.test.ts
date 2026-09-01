import { describe, expect, it } from 'vitest';
import { parseTvtms } from './tvtms.js';

const fixture = `
Preamble that is not data.
#DataStart(Expanded)
SourceType\tSourceRef\tStandardRef\tAction\tNoteMarker\tReversification Note\tVersification Note\tAncient Versions\tTests\t\t\t\t
'==============================\t\t\t\t\t\t\t\t\t\t\t\t
Latin+Greek\tAct.19:40!b\tAct.19:41\tMergedPrev verse\tOpt. (41)^\tReverse note\t\t(Latin=19:40b)\tAct.19:40=Exist & Act.19:40=Last\t\t\t\t
Greek\tPhp.1:16\tPhp.1:17\tRenumber verse*\tOpt. (17)^16\tNormally...\t1:17 in most Bibles\t(Greek=1:16 / 1:17)\tPhp.1:16=Exist & Php.1:16<Php.1:17\t\t\t\t
Greek\tPhp.1:17\tPhp.1:16\tRenumber verse*\tOpt. (16)^17\tNormally...\t1:16 in most Bibles\t(Greek=1:16 / 1:17)\tPhp.1:17=Exist & Php.1:16<Php.1:17\t\t\t\t
# ALL BIBLES:\t\t\t\t\t\t\t\t\t\t\t\t
#DataEnd(Expanded)
Discursive notes that are not data.
`;

describe('parseTvtms', () => {
  it('reads only the expanded machine-oriented records', () => {
    const mappings = parseTvtms(fixture);
    expect(mappings).toHaveLength(3);
    expect(mappings[0]).toMatchObject({
      sourceType: 'Latin+Greek',
      sourceRef: 'Act.19:40!b',
      standardRef: 'Act.19:41',
      action: 'MergedPrev verse',
    });
  });

  it('preserves conditional tests and subverse markers verbatim', () => {
    const [mapping] = parseTvtms(fixture);
    expect(mapping!.sourceRef).toBe('Act.19:40!b');
    expect(mapping!.tests).toBe('Act.19:40=Exist & Act.19:40=Last');
  });

  it('preserves reversed verse-number mappings as distinct rows', () => {
    const mappings = parseTvtms(fixture);
    expect(mappings.slice(1).map(({ sourceRef, standardRef }) => [sourceRef, standardRef])).toEqual(
      [
        ['Php.1:16', 'Php.1:17'],
        ['Php.1:17', 'Php.1:16'],
      ],
    );
  });

  it('rejects input without a complete expanded section', () => {
    expect(() => parseTvtms('#DataStart(Condensed)')).toThrow(/expanded data section/u);
  });

  it('rejects incomplete mapping rows', () => {
    expect(() =>
      parseTvtms(
        '#DataStart(Expanded)\nSourceType\tSourceRef\tStandardRef\tAction\tNoteMarker\tReversification Note\tVersification Note\tAncient Versions\tTests\nGreek\tPhp.1:16\n#DataEnd(Expanded)',
      ),
    ).toThrow(/Malformed TVTMS/u);
  });
});
