import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, IpcEvents } from '@shared/ipc/channels.js';
import type { VerseScapeBridge } from '@shared/bridge.js';
import type { AppInfo, WindowState } from '@shared/ipc/contracts.js';
import type { AppSettings } from '@shared/settings.js';
import type { IpcResult } from '@shared/ipc/result.js';

/**
 * The preload runs sandboxed. It may only import `electron` and code bundled
 * into this file, and it exposes a fixed set of named methods — never a
 * generic `invoke(channel, args)` passthrough.
 */
const bridge: VerseScapeBridge = {
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannels.appGetInfo) as Promise<IpcResult<AppInfo>>,
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet) as Promise<IpcResult<AppSettings>>,
    patch: (patch) =>
      ipcRenderer.invoke(IpcChannels.settingsPatch, patch) as Promise<IpcResult<AppSettings>>,
  },
  window: {
    minimize: () => ipcRenderer.invoke(IpcChannels.windowMinimize) as Promise<IpcResult<null>>,
    toggleMaximize: () =>
      ipcRenderer.invoke(IpcChannels.windowToggleMaximize) as Promise<IpcResult<WindowState>>,
    close: () => ipcRenderer.invoke(IpcChannels.windowClose) as Promise<IpcResult<null>>,
    getState: () =>
      ipcRenderer.invoke(IpcChannels.windowGetState) as Promise<IpcResult<WindowState>>,
    onStateChanged: (listener) => {
      const wrapped = (_event: unknown, state: WindowState): void => listener(state);
      ipcRenderer.on(IpcEvents.windowStateChanged, wrapped);
      return () => ipcRenderer.off(IpcEvents.windowStateChanged, wrapped);
    },
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('versescape', bridge);
} else {
  throw new Error('contextIsolation must be enabled.');
}
