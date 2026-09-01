import { describe, expect, it } from 'vitest';
import {
  contracts,
  appInfo,
  chapterData,
  chapterRequest,
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
});

describe('ipc result', () => {
  it('discriminates success and failure', () => {
    const success = ok(42);
    const failure = err(IpcErrorCodes.notFound, 'nope');
    expect(success.ok && success.data).toBe(42);
    expect(!failure.ok && failure.code).toBe(IpcErrorCodes.notFound);
  });
});
