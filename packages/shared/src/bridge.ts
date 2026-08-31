import type { AppInfo, WindowState } from './ipc/contracts.js';
import type { AppSettings, SettingsPatch } from './settings.js';
import type { IpcResult } from './ipc/result.js';

/**
 * The complete surface exposed to the renderer via contextBridge.
 *
 * Deliberately enumerated: there is no generic `invoke(channel, args)`
 * passthrough, so the renderer cannot reach a handler we did not intend.
 */
export interface VerseScapeBridge {
  readonly app: {
    getInfo(): Promise<IpcResult<AppInfo>>;
  };
  readonly settings: {
    get(): Promise<IpcResult<AppSettings>>;
    patch(patch: SettingsPatch): Promise<IpcResult<AppSettings>>;
  };
  readonly window: {
    minimize(): Promise<IpcResult<null>>;
    toggleMaximize(): Promise<IpcResult<WindowState>>;
    close(): Promise<IpcResult<null>>;
    getState(): Promise<IpcResult<WindowState>>;
    onStateChanged(listener: (state: WindowState) => void): () => void;
  };
}

declare global {
  interface Window {
    readonly versescape: VerseScapeBridge;
  }
}
