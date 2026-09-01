import { describe, expect, it } from 'vitest';
import { parseCrossReferences } from './cross-references.js';

const fixture = `From Verse\tTo Verse\tVotes\t#www.openbible.info CC-BY 2026-08-31
Gen.1.1\tPs.121.2\t65
Gen.1.1\tJohn.1.1-John.1.3\t378
Gen.1.1\tExod.31.18\t-38
`;

describe('parseCrossReferences', () => {
  it('converts source and target references to canonical keys', () => {
    expect(parseCrossReferences(fixture)[0]).toEqual({
      fromKey: 1_001_001,
      toStart: 19_121_002,
      toEnd: 19_121_002,
      votes: 65,
    });
  });

  it('preserves target ranges and vote strength', () => {
    expect(parseCrossReferences(fixture)[1]).toEqual({
      fromKey: 1_001_001,
      toStart: 43_001_001,
      toEnd: 43_001_003,
      votes: 378,
    });
    expect(parseCrossReferences(fixture)[2]!.votes).toBe(-38);
  });

  it('rejects malformed input', () => {
    expect(() => parseCrossReferences('Gen.1.1\tPs.1.1\t2')).toThrow(/header/u);
    expect(() => parseCrossReferences(`${fixture}Gen.1.1\tbad\t2\n`)).toThrow(/Invalid/u);
  });
});
