import { app, BrowserWindow, clipboard, ClipboardItem } from 'electron';
import { is } from '@electron-toolkit/utils';
import { IpcChannels } from '@shared/ipc/channels.js';
import type { AppInfo, WindowState } from '@shared/ipc/contracts.js';
import type { AppSettings } from '@shared/settings.js';
import { handle } from './handle.js';
import { readWindowState } from '../platform/window-manager.js';
import { loadSettings, patchSettings } from '../services/settings.js';
import { loadWorkspace, saveWorkspace } from '../services/workspace.js';
import { getChapter, getConcordance, getCrossReferences, getLexiconEntry, listResources } from '../services/resources.js';
import {
  addNoteAnchor,
  createHighlight,
  createNote,
  createNotebook,
  deleteNote,
  deleteNoteAnchor,
  listHighlights,
  listNoteAnchors,
  listNotes,
  listNotebooks,
  updateNote,
} from '../services/annotations.js';
import { runSearch } from '../services/search.js';
import type { Workspace } from '@shared/workspace/types.js';

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

  handle(IpcChannels.settingsGet, (): AppSettings => loadSettings());

  handle(IpcChannels.settingsPatch, (patch): AppSettings => patchSettings(patch));

  handle(IpcChannels.workspaceGet, (): Workspace | null => loadWorkspace());

  handle(IpcChannels.workspaceSave, (workspace): null => {
    saveWorkspace(workspace as Workspace);
    return null;
  });

  handle(IpcChannels.resourceList, () => listResources());

  handle(IpcChannels.resourceGetChapter, (request) => getChapter(request));

  handle(IpcChannels.resourceGetConcordance, (request) => getConcordance(request));
  handle(IpcChannels.resourceGetLexiconEntry, (request) => getLexiconEntry(request));

  handle(IpcChannels.resourceGetCrossReferences, (request) => getCrossReferences(request));

  handle(IpcChannels.clipboardWriteText, async (payload): Promise<null> => {
    await clipboard.write([
      new ClipboardItem({
        'text/plain': payload.text,
        ...(payload.html ? { 'text/html': payload.html } : {}),
      }),
    ]);
    return null;
  });

  handle(IpcChannels.annotationsCreateNote, (request) => createNote(request));

  handle(IpcChannels.annotationsCreateHighlight, (request) => createHighlight(request));

  handle(IpcChannels.annotationsListHighlights, (request) =>
    listHighlights(request.startKey, request.endKey),
  );

  handle(IpcChannels.annotationsListNotes, (request) =>
    listNotes(request.start, request.end),
  );

  handle(IpcChannels.annotationsListNoteAnchors, (request) => listNoteAnchors(request.id));

  handle(IpcChannels.annotationsAddNoteAnchor, (request) => addNoteAnchor(request));

  handle(IpcChannels.annotationsDeleteNote, (request) => {
    deleteNote(request.id);
    return null;
  });

  handle(IpcChannels.annotationsDeleteNoteAnchor, (request) => {
    deleteNoteAnchor(request.noteId, request.startKey, request.endKey);
    return null;
  });

  handle(IpcChannels.annotationsUpdateNote, (request) =>
    updateNote(request.id, request.bodyMd, request.title, request.notebookId),
  );

  handle(IpcChannels.annotationsListNotebooks, () => listNotebooks());
  handle(IpcChannels.annotationsCreateNotebook, (request) => createNotebook(request));

  handle(IpcChannels.searchQuery, (request) => runSearch(request));
}
