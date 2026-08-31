import { app, BrowserWindow } from 'electron';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { applySecurityPolicy, enableProcessSandbox } from './platform/security.js';
import { createMainWindow, getMainWindow } from './platform/window-manager.js';
import { registerIpcHandlers } from './ipc/index.js';
import { flushSettings } from './services/settings.js';

enableProcessSandbox();

// Single window in v1 (decision D-15): a second launch focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = getMainWindow();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('app.versescape.VerseScape');
    applySecurityPolicy(is.dev);
    registerIpcHandlers();

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('will-quit', flushSettings);
}
