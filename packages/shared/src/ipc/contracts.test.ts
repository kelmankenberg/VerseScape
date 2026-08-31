import { describe, expect, it } from 'vitest';
import { contracts, appInfo } from './contracts.js';
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
});

describe('ipc result', () => {
  it('discriminates success and failure', () => {
    const success = ok(42);
    const failure = err(IpcErrorCodes.notFound, 'nope');
    expect(success.ok && success.data).toBe(42);
    expect(!failure.ok && failure.code).toBe(IpcErrorCodes.notFound);
  });
});
