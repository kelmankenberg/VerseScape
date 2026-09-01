import { describe, expect, it } from 'vitest';
import { normalise, removeNode, replaceNode, collectTabIds, findParent } from './tree.js';
import type { LayoutNode } from './types.js';
import { shape } from './test-helpers.js';

const group = (id: string, ...tabs: string[]): LayoutNode => ({
  kind: 'group',
  id,
  tabs,
  activeTab: tabs[0]!,
});

const split = (
  id: string,
  direction: 'row' | 'column',
  children: LayoutNode[],
  sizes?: number[],
): LayoutNode => ({
  kind: 'split',
  id,
  direction,
  children,
  sizes: sizes ?? children.map(() => 1 / children.length),
});

describe('normalise', () => {
  it('leaves a canonical tree untouched', () => {
    const tree = split('s1', 'row', [group('g1', 't1'), group('g2', 't2')]);
    expect(shape(normalise(tree))).toBe('([t1] | [t2])');
  });

  it('collapses a split with a single child into that child', () => {
    const tree = split('s1', 'row', [group('g1', 't1')], [1]);
    expect(shape(normalise(tree))).toBe('[t1]');
  });

  it('flattens nested splits of the same direction', () => {
    const tree = split('s1', 'row', [
      group('g1', 't1'),
      split('s2', 'row', [group('g2', 't2'), group('g3', 't3')]),
    ]);
    expect(shape(normalise(tree))).toBe('([t1] | [t2] | [t3])');
  });

  it('preserves nested splits of the opposite direction', () => {
    const tree = split('s1', 'row', [
      group('g1', 't1'),
      split('s2', 'column', [group('g2', 't2'), group('g3', 't3')]),
    ]);
    expect(shape(normalise(tree))).toBe('([t1] | ([t2] / [t3]))');
  });

  it('scales inner sizes when flattening so proportions are preserved', () => {
    const tree = split(
      's1',
      'row',
      [group('g1', 't1'), split('s2', 'row', [group('g2', 't2'), group('g3', 't3')], [0.25, 0.75])],
      [0.5, 0.5],
    );
    const result = normalise(tree);
    expect(result.kind).toBe('split');
    if (result.kind !== 'split') return;
    expect(result.sizes[0]).toBeCloseTo(0.5);
    expect(result.sizes[1]).toBeCloseTo(0.125);
    expect(result.sizes[2]).toBeCloseTo(0.375);
  });

  it('renormalises sizes that do not sum to one', () => {
    const tree = split('s1', 'row', [group('g1', 't1'), group('g2', 't2')], [2, 6]);
    const result = normalise(tree);
    if (result.kind !== 'split') throw new Error('expected split');
    expect(result.sizes[0]).toBeCloseTo(0.25);
    expect(result.sizes[1]).toBeCloseTo(0.75);
  });

  it('flattens recursively through several levels', () => {
    const tree = split('s1', 'row', [
      split('s2', 'row', [
        split('s3', 'row', [group('g1', 't1'), group('g2', 't2')]),
        group('g3', 't3'),
      ]),
      group('g4', 't4'),
    ]);
    expect(shape(normalise(tree))).toBe('([t1] | [t2] | [t3] | [t4])');
  });
});

describe('removeNode', () => {
  it('returns null when removing the root', () => {
    expect(removeNode(group('g1', 't1'), 'g1')).toBeNull();
  });

  it('collapses the parent split when one child remains', () => {
    const tree = split('s1', 'row', [group('g1', 't1'), group('g2', 't2')]);
    expect(shape(removeNode(tree, 'g2')!)).toBe('[t1]');
  });

  it('redistributes sizes proportionally among survivors', () => {
    const tree = split(
      's1',
      'row',
      [group('g1', 't1'), group('g2', 't2'), group('g3', 't3')],
      [0.2, 0.3, 0.5],
    );
    const result = removeNode(tree, 'g2');
    if (!result || result.kind !== 'split') throw new Error('expected split');
    expect(result.sizes[0]).toBeCloseTo(0.2 / 0.7);
    expect(result.sizes[1]).toBeCloseTo(0.5 / 0.7);
  });

  it('is a no-op for an unknown id', () => {
    const tree = split('s1', 'row', [group('g1', 't1'), group('g2', 't2')]);
    expect(shape(removeNode(tree, 'nope')!)).toBe('([t1] | [t2])');
  });
});

describe('replaceNode', () => {
  it('returns the same reference when nothing matched', () => {
    const tree = split('s1', 'row', [group('g1', 't1'), group('g2', 't2')]);
    expect(replaceNode(tree, 'missing', group('gx', 'tx'))).toBe(tree);
  });

  it('swaps a nested node', () => {
    const tree = split('s1', 'row', [group('g1', 't1'), group('g2', 't2')]);
    expect(shape(replaceNode(tree, 'g2', group('g2', 'tA', 'tB')))).toBe('([t1] | [tA,tB])');
  });
});

describe('traversal', () => {
  it('collects tab ids in visual order', () => {
    const tree = split('s1', 'row', [
      group('g1', 't1', 't2'),
      split('s2', 'column', [group('g2', 't3'), group('g3', 't4')]),
    ]);
    expect(collectTabIds(tree)).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('finds the parent split of a node', () => {
    const inner = split('s2', 'column', [group('g2', 't3'), group('g3', 't4')]);
    const tree = split('s1', 'row', [group('g1', 't1'), inner]);
    expect(findParent(tree, 'g3')?.id).toBe('s2');
    expect(findParent(tree, 's2')?.id).toBe('s1');
    expect(findParent(tree, 's1')).toBeNull();
  });
});
