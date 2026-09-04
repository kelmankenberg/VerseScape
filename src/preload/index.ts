import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, IpcEvents } from '@shared/ipc/channels.js';
import type { VerseScapeBridge } from '@shared/bridge.js';
import type {
  AppInfo,
  BookmarkRecord,
  CommentaryEntryRecord,
  ChapterData,
  CrossReference,
  HighlightRecord,
  LexiconEntry,
  NoteRecord,
  NoteAnchorRecord,
  NotebookRecord,
  ResourceSummary,
  ReadingPositionRecord,
  SearchHit,
  WindowState,
  TagRecord,
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
    getConcordance: (request) =>
      ipcRenderer.invoke(IpcChannels.resourceGetConcordance, request) as Promise<
        IpcResult<Array<{ verseKey: number; text: string }>>
      >,
    getLexiconEntry: (request) =>
      ipcRenderer.invoke(IpcChannels.resourceGetLexiconEntry, request) as Promise<
        IpcResult<LexiconEntry | null>
      >,
  },
  clipboard: {
    writeText: (payload) =>
      ipcRenderer.invoke(IpcChannels.clipboardWriteText, payload) as Promise<IpcResult<null>>,
  },
  annotations: {
    createNote: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsCreateNote, request) as Promise<
        IpcResult<NoteRecord>
      >,
    createHighlight: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsCreateHighlight, request) as Promise<
        IpcResult<HighlightRecord>
      >,
    listHighlights: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsListHighlights, request) as Promise<
        IpcResult<HighlightRecord[]>
      >,
    createBookmark: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsCreateBookmark, request) as Promise<IpcResult<BookmarkRecord>>,
    listBookmarks: () =>
      ipcRenderer.invoke(IpcChannels.annotationsListBookmarks) as Promise<IpcResult<BookmarkRecord[]>>,
    deleteBookmark: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsDeleteBookmark, request) as Promise<IpcResult<null>>,
    setReadingPosition: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsSetReadingPosition, request) as Promise<IpcResult<ReadingPositionRecord>>,
    getReadingPosition: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsGetReadingPosition, request) as Promise<IpcResult<ReadingPositionRecord | null>>,
    listTags: () => ipcRenderer.invoke(IpcChannels.annotationsListTags) as Promise<IpcResult<TagRecord[]>>,
    createTag: (request) => ipcRenderer.invoke(IpcChannels.annotationsCreateTag, request) as Promise<IpcResult<TagRecord>>,
    addTagLink: (request) => ipcRenderer.invoke(IpcChannels.annotationsAddTagLink, request) as Promise<IpcResult<null>>,
    deleteTagLink: (request) => ipcRenderer.invoke(IpcChannels.annotationsDeleteTagLink, request) as Promise<IpcResult<null>>,
    listTagsForTarget: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsListTagsForTarget, request) as Promise<IpcResult<TagRecord[]>>,
    createCommentaryEntry: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsCreateCommentaryEntry, request) as Promise<IpcResult<CommentaryEntryRecord>>,
    listCommentaryEntries: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsListCommentaryEntries, request) as Promise<IpcResult<CommentaryEntryRecord[]>>,
    copyNoteToCommentary: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsCopyNoteToCommentary, request) as Promise<IpcResult<CommentaryEntryRecord>>,
    exportPersonalCommentaryXml: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsExportPersonalCommentaryXml, request) as Promise<IpcResult<string>>,
    deletePersonalCommentary: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsDeletePersonalCommentary, request) as Promise<IpcResult<null>>,
    listNotes: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsListNotes, request) as Promise<
        IpcResult<NoteRecord[]>
      >,
    listNoteAnchors: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsListNoteAnchors, request) as Promise<
        IpcResult<NoteAnchorRecord[]>
      >,
    addNoteAnchor: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsAddNoteAnchor, request) as Promise<
        IpcResult<NoteAnchorRecord>
      >,
    deleteNoteAnchor: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsDeleteNoteAnchor, request) as Promise<
        IpcResult<null>
      >,
    deleteNote: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsDeleteNote, request) as Promise<IpcResult<null>>,
    updateNote: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsUpdateNote, request) as Promise<
        IpcResult<NoteRecord>
      >,
    listNotebooks: () =>
      ipcRenderer.invoke(IpcChannels.annotationsListNotebooks) as Promise<IpcResult<NotebookRecord[]>>,
    createNotebook: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsCreateNotebook, request) as Promise<
        IpcResult<NotebookRecord>
      >,
    exportNote: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsExportNote, request) as Promise<
        IpcResult<string>
      >,
    exportNotebook: (request) =>
      ipcRenderer.invoke(IpcChannels.annotationsExportNotebook, request) as Promise<
        IpcResult<string>
      >,
  },
  search: {
    query: (request) =>
      ipcRenderer.invoke(IpcChannels.searchQuery, request) as Promise<IpcResult<SearchHit[]>>,
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
