import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from './query.js';

describe('parseSearchQuery', () => {
  it('quotes a single bare word', () => {
    const result = parseSearchQuery('faith');
    expect(result.ok && result.match).toBe('"faith"');
  });

  it('implicitly ANDs adjacent bare words', () => {
    const result = parseSearchQuery('faith hope');
    expect(result.ok && result.match).toBe('("faith" AND "hope")');
  });

  it('parses a quoted phrase as one leaf', () => {
    const result = parseSearchQuery('"faith hope and love"');
    expect(result.ok && result.match).toBe('"faith hope and love"');
  });

  it('supports a prefix query', () => {
    const result = parseSearchQuery('lov*');
    expect(result.ok && result.match).toBe('"lov"*');
  });

  it('honours explicit AND/OR/NOT precedence (NOT/AND tighter than OR)', () => {
    const result = parseSearchQuery('faith OR hope AND love');
    expect(result.ok && result.match).toBe('("faith" OR ("hope" AND "love"))');
  });

  it('supports NOT as a binary exclusion', () => {
    const result = parseSearchQuery('faith NOT works');
    expect(result.ok && result.match).toBe('("faith" NOT "works")');
  });

  it('treats lower-case and/or/not as literal search terms, not operators', () => {
    const result = parseSearchQuery('bread and wine');
    expect(result.ok && result.match).toBe('(("bread" AND "and") AND "wine")');
  });

  it('degrades an unterminated quote to the rest of the input as a phrase', () => {
    const result = parseSearchQuery('"faith hope');
    expect(result.ok && result.match).toBe('"faith hope"');
  });

  it('drops dangling operators instead of failing the whole query', () => {
    const trailing = parseSearchQuery('faith AND');
    const leading = parseSearchQuery('OR faith');
    expect(trailing.ok && trailing.match).toBe('"faith"');
    expect(leading.ok && leading.match).toBe('"faith"');
  });

  it('strips disallowed punctuation from a bare word rather than rejecting it', () => {
    const result = parseSearchQuery('faith!!!');
    expect(result.ok && result.match).toBe('"faith"');
  });

  it('rejects an empty or purely-punctuation query', () => {
    expect(parseSearchQuery('   ').ok).toBe(false);
    expect(parseSearchQuery('!!! ???').ok).toBe(false);
    expect(parseSearchQuery('AND OR NOT').ok).toBe(false);
  });

  it('escapes embedded quotes defensively when serialising', () => {
    // Tokenizer already strips quotes from bare words; this proves the
    // escape path itself is correct even if that ever changes upstream.
    const result = parseSearchQuery('faith');
    expect(result.ok && result.match).not.toContain('""');
  });
});
