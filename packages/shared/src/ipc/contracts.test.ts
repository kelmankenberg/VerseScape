import { describe, expect, it } from 'vitest';
import {
  contracts,
  appInfo,
  chapterData,
  chapterRequest,
  createHighlightRequest,
  createNoteRequest,
  crossReferenceRequest,
} from './contracts.js';
import { IpcChannels } from './channels.js';
import { err, ok, IpcErrorCodes } from './result.js';

describe('ipc contracts', () => {
  it('defines a contract for every request/response channel', () => {
    for (const channel of Object.values(IpcChannels)) {
      expect(contracts).toHaveProperty(channel);
    }
  });

  it('rejects unknown keys on the app info payload', () => {
    const valid = {
      name: 'VerseScape',
      version: '0.0.1',
      electron: '40.0.0',
      chrome: '140.0.0',
      node: '22.0.0',
      platform: 'linux',
      isDev: true,
    };
    expect(appInfo.safeParse(valid).success).toBe(true);
    expect(appInfo.safeParse({ ...valid, platform: 'solaris' }).success).toBe(false);
    expect(appInfo.safeParse({ ...valid, version: '' }).success).toBe(false);
  });

  it('constrains resource chapter requests before they reach a file path', () => {
    expect(chapterRequest.safeParse({ resourceId: 'bsb', bookId: 'JHN', chapter: 3 }).success).toBe(
      true,
    );
    expect(
      chapterRequest.safeParse({ resourceId: '../private', bookId: 'JHN', chapter: 3 }).success,
    ).toBe(false);
    expect(
      chapterRequest.safeParse({ resourceId: 'bsb', bookId: 'john', chapter: 0 }).success,
    ).toBe(false);
  });

  it('validates chapter data returned across the bridge', () => {
    expect(
      chapterData.safeParse({
        resourceId: 'bsb',
        bookId: 'JHN',
        chapter: 3,
        verses: [
          {
            key: 43_003_016,
            verse: 16,
            text: 'For God so loved...',
            paragraphStart: true,
            poetry: 0,
          },
        ],
        headings: [],
        footnotes: [],
      }).success,
    ).toBe(true);
  });

  it('bounds cross-reference lookup work and supplies a default limit', () => {
    expect(crossReferenceRequest.parse({ verseKey: 1_001_001 })).toEqual({
      verseKey: 1_001_001,
      limit: 12,
    });
    expect(crossReferenceRequest.safeParse({ verseKey: 1_001_001, limit: 51 }).success).toBe(false);
  });

  it('allows an empty note title but rejects a non-positive verse key', () => {
    expect(createNoteRequest.safeParse({ verseKey: 43_003_016, title: 'God so loved' }).success).toBe(
      true,
    );
    expect(createNoteRequest.safeParse({ verseKey: 43_003_016, title: '' }).success).toBe(true);
    expect(createNoteRequest.safeParse({ verseKey: 0, title: 'x' }).success).toBe(false);
  });

  it('requires a well-formed hex colour and a positive-length highlight range', () => {
    const base = { verseKey: 43_003_016, startOffset: 0, endOffset: 3, colour: '#fde68a', style: 'fill' as const };
    expect(createHighlightRequest.safeParse(base).success).toBe(true);
    expect(createHighlightRequest.safeParse({ ...base, colour: 'yellow' }).success).toBe(false);
    expect(createHighlightRequest.safeParse({ ...base, startOffset: 3, endOffset: 3 }).success).toBe(
      false,
    );
  });
});

describe('ipc result', () => {
  it('discriminates success and failure', () => {
    const success = ok(42);
    const failure = err(IpcErrorCodes.notFound, 'nope');
    expect(success.ok && success.data).toBe(42);
    expect(!failure.ok && failure.code).toBe(IpcErrorCodes.notFound);
  });
});
