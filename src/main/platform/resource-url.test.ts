import { describe, expect, it } from 'vitest';
import { parseResourceAssetUrl } from './resource-url.js';

describe('parseResourceAssetUrl', () => {
  it('accepts an asset under a named resource', () => {
    expect(parseResourceAssetUrl('versescape://resource/bsb/images/map.webp')).toEqual({
      id: 'bsb',
      relativePath: 'images/map.webp',
    });
  });

  it.each([
    'https://resource/bsb/image.png',
    'versescape://other/bsb/image.png',
    'versescape://resource/bsb',
    'versescape://resource/../private.txt',
    'versescape://resource/bsb/%2e%2e/private.txt',
    'versescape://resource/bsb/images%2fprivate.txt',
    'versescape://resource/bsb/images%5cprivate.txt',
    'versescape://resource/BSB/image.png',
    'not a url',
  ])('rejects an unauthorised URL: %s', (url) => {
    expect(parseResourceAssetUrl(url)).toBeNull();
  });
});
