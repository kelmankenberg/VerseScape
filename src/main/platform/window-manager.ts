import { BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { IpcEvents } from '@shared/ipc/channels.js';
import type { WindowState } from '@shared/ipc/contracts.js';
import { loadSettings } from '../services/settings.js';
import { resolveInitialBounds, trackWindowState } from './window-state.js';

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function readWindowState(window: BrowserWindow): WindowState {
  return {
    isMaximized: window.isMaximized(),
    isFullScreen: window.isFullScreen(),
    isFocused: window.isFocused(),
  };
}

function broadcastState(window: BrowserWindow): void {
  if (!window.isDestroyed()) {
    window.webContents.send(IpcEvents.windowStateChanged, readWindowState(window));
  }
}

export function createMainWindow(): BrowserWindow {
  const settings = loadSettings();
  const window = new BrowserWindow({
    ...resolveInitialBounds(settings),
    minWidth: 940,
    minHeight: 600,
    show: false,
    // Frameless: the app draws its own titlebar and controls (FR-SH-01).
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0e1116',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => {
    if (settings.window.maximized) window.maximize();
    window.show();
  });

  trackWindowState(window);

  const notify = (): void => broadcastState(window);
  window.on('maximize', notify);
  window.on('unmaximize', notify);
  window.on('enter-full-screen', notify);
  window.on('leave-full-screen', notify);
  window.on('focus', notify);
  window.on('blur', notify);

  window.on('closed', () => {
    mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow = window;
  return window;
}
