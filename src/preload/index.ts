import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, IpcEvents } from '@shared/ipc/channels.js';
import type { VerseScapeBridge } from '@shared/bridge.js';
import type {
  AppInfo,
  ChapterData,
  CrossReference,
  ResourceSummary,
  WindowState,
} from '@shared/ipc/contracts.js';
import type { AppSettings } from '@shared/settings.js';
import type { Workspace } from '@shared/workspace/types.js';
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
  workspace: {
    get: () => ipcRenderer.invoke(IpcChannels.workspaceGet) as Promise<IpcResult<Workspace | null>>,
    save: (workspace) =>
      ipcRenderer.invoke(IpcChannels.workspaceSave, workspace) as Promise<IpcResult<null>>,
  },
  resources: {
    list: () =>
      ipcRenderer.invoke(IpcChannels.resourceList) as Promise<IpcResult<ResourceSummary[]>>,
    getChapter: (request) =>
      ipcRenderer.invoke(IpcChannels.resourceGetChapter, request) as Promise<
        IpcResult<ChapterData>
      >,
    getCrossReferences: (request) =>
      ipcRenderer.invoke(IpcChannels.resourceGetCrossReferences, request) as Promise<
        IpcResult<CrossReference[]>
      >,
  },
  clipboard: {
    writeText: (payload) =>
      ipcRenderer.invoke(IpcChannels.clipboardWriteText, payload) as Promise<IpcResult<null>>,
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
