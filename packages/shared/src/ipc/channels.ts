/**
 * IPC channel names. Namespaced `domain:action`.
 *
 * This module must stay dependency-free: the sandboxed preload imports it at
 * runtime and cannot pull in node modules.
 */
export const IpcChannels = {
  appGetInfo: 'app:get-info',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowGetState: 'window:get-state',
  settingsGet: 'settings:get',
  settingsPatch: 'settings:patch',
  workspaceGet: 'workspace:get',
  workspaceSave: 'workspace:save',
  resourceList: 'resource:list',
  resourceGetChapter: 'resource:get-chapter',
  resourceGetConcordance: 'resource:get-concordance',
  resourceGetLexiconEntry: 'resource:get-lexicon-entry',
  resourceGetCrossReferences: 'resource:get-cross-references',
  clipboardWriteText: 'clipboard:write-text',
  annotationsCreateNote: 'annotations:create-note',
  annotationsCreateHighlight: 'annotations:create-highlight',
  annotationsListHighlights: 'annotations:list-highlights',
  annotationsListNotes: 'annotations:list-notes',
  annotationsListNoteAnchors: 'annotations:list-note-anchors',
  annotationsAddNoteAnchor: 'annotations:add-note-anchor',
  annotationsDeleteNoteAnchor: 'annotations:delete-note-anchor',
  annotationsDeleteNote: 'annotations:delete-note',
  annotationsUpdateNote: 'annotations:update-note',
  searchQuery: 'search:query',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** Pushed from main to renderer; not a request/response channel. */
export const IpcEvents = {
  windowStateChanged: 'window:state-changed',
} as const;

export type IpcEvent = (typeof IpcEvents)[keyof typeof IpcEvents];
