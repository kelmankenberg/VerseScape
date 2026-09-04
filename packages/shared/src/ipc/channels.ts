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
  resourceListLibrary: 'resource:list-library',
  resourceListCatalog: 'resource:list-catalog',
  resourceInstallCatalogItem: 'resource:install-catalog-item',
  resourceSetEnabled: 'resource:set-enabled',
  resourceRemove: 'resource:remove',
  resourceImportArchive: 'resource:import-archive',
  resourceChooseLibraryLocation: 'resource:choose-library-location',
  resourceSetLibraryLocation: 'resource:set-library-location',
  resourceGetLibraryLocation: 'resource:get-library-location',
  resourceListCommentaryEntries: 'resource:list-commentary-entries',
  resourceGetChapter: 'resource:get-chapter',
  resourceGetConcordance: 'resource:get-concordance',
  resourceGetLexiconEntry: 'resource:get-lexicon-entry',
  resourceGetCrossReferences: 'resource:get-cross-references',
  clipboardWriteText: 'clipboard:write-text',
  annotationsCreateNote: 'annotations:create-note',
  annotationsCreateHighlight: 'annotations:create-highlight',
  annotationsListHighlights: 'annotations:list-highlights',
  annotationsCreateBookmark: 'annotations:create-bookmark',
  annotationsListBookmarks: 'annotations:list-bookmarks',
  annotationsDeleteBookmark: 'annotations:delete-bookmark',
  annotationsSetReadingPosition: 'annotations:set-reading-position',
  annotationsGetReadingPosition: 'annotations:get-reading-position',
  annotationsListTags: 'annotations:list-tags',
  annotationsCreateTag: 'annotations:create-tag',
  annotationsAddTagLink: 'annotations:add-tag-link',
  annotationsDeleteTagLink: 'annotations:delete-tag-link',
  annotationsListTagsForTarget: 'annotations:list-tags-for-target',
  annotationsCreateCommentaryEntry: 'annotations:create-commentary-entry',
  annotationsListCommentaryEntries: 'annotations:list-commentary-entries',
  annotationsCopyNoteToCommentary: 'annotations:copy-note-to-commentary',
  annotationsExportPersonalCommentaryXml: 'annotations:export-personal-commentary-xml',
  annotationsDeletePersonalCommentary: 'annotations:delete-personal-commentary',
  annotationsListNotes: 'annotations:list-notes',
  annotationsListNoteAnchors: 'annotations:list-note-anchors',
  annotationsAddNoteAnchor: 'annotations:add-note-anchor',
  annotationsDeleteNoteAnchor: 'annotations:delete-note-anchor',
  annotationsDeleteNote: 'annotations:delete-note',
  annotationsUpdateNote: 'annotations:update-note',
  annotationsListNotebooks: 'annotations:list-notebooks',
  annotationsCreateNotebook: 'annotations:create-notebook',
  annotationsExportNote: 'annotations:export-note',
  annotationsExportNotebook: 'annotations:export-notebook',
  searchQuery: 'search:query',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** Pushed from main to renderer; not a request/response channel. */
export const IpcEvents = {
  windowStateChanged: 'window:state-changed',
} as const;

export type IpcEvent = (typeof IpcEvents)[keyof typeof IpcEvents];
