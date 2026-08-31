import { app, BrowserWindow } from 'electron';
import { is } from '@electron-toolkit/utils';
import { IpcChannels } from '@shared/ipc/channels.js';
import type { AppInfo, WindowState } from '@shared/ipc/contracts.js';
import { handle } from './handle.js';
import { readWindowState } from '../platform/window-manager.js';

function requireWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error('No window is associated with this request.');
  }
  return window;
}

export function registerIpcHandlers(): void {
  handle(IpcChannels.appGetInfo, (): AppInfo => {
    const platform = process.platform;
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: platform === 'win32' || platform === 'darwin' ? platform : 'linux',
      isDev: is.dev,
    };
  });

  handle(IpcChannels.windowMinimize, (_payload, event): null => {
    requireWindow(event).minimize();
    return null;
  });

  handle(IpcChannels.windowToggleMaximize, (_payload, event): WindowState => {
    const window = requireWindow(event);
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
    return readWindowState(window);
  });

  handle(IpcChannels.windowClose, (_payload, event): null => {
    requireWindow(event).close();
    return null;
  });

  handle(IpcChannels.windowGetState, (_payload, event): WindowState =>
    readWindowState(requireWindow(event)),
  );
}
