import { z } from 'zod';
import { appSettings, settingsPatch } from '../settings.js';
import { workspace as workspaceSchema } from '../workspace/schema.js';

/**
 * Request/response schemas for every IPC channel. Main validates the request
 * before use; tests validate the response so the contract stays honest.
 */

export const emptyRequest = z.object({}).strict();
export type EmptyRequest = z.infer<typeof emptyRequest>;

export const appInfo = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  electron: z.string().min(1),
  chrome: z.string().min(1),
  node: z.string().min(1),
  platform: z.enum(['linux', 'win32', 'darwin']),
  isDev: z.boolean(),
});
export type AppInfo = z.infer<typeof appInfo>;

export const windowState = z.object({
  isMaximized: z.boolean(),
  isFullScreen: z.boolean(),
  isFocused: z.boolean(),
});
export type WindowState = z.infer<typeof windowState>;

export const resourceSummary = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  title: z.string().min(1),
  abbreviation: z.string().min(1),
  language: z.string().min(2),
  versification: z.string().min(1),
});
export type ResourceSummary = z.infer<typeof resourceSummary>;

export const chapterRequest = z.object({
  resourceId: resourceSummary.shape.id,
  bookId: z.string().regex(/^(?:[1-3])?[A-Z]{3}$/u),
  chapter: z.number().int().positive(),
});
export type ChapterRequest = z.infer<typeof chapterRequest>;

export const chapterData = z.object({
  resourceId: resourceSummary.shape.id,
  bookId: chapterRequest.shape.bookId,
  chapter: z.number().int().positive(),
  verses: z.array(
    z.object({
      key: z.number().int().positive(),
      verse: z.number().int().positive(),
      text: z.string(),
      paragraphStart: z.boolean(),
      poetry: z.number().int().nonnegative(),
    }),
  ),
  headings: z.array(
    z.object({ key: z.number().int().positive(), level: z.number().int(), text: z.string() }),
  ),
  footnotes: z.array(
    z.object({
      id: z.string().min(1),
      key: z.number().int().positive(),
      marker: z.string(),
      text: z.string(),
    }),
  ),
});
export type ChapterData = z.infer<typeof chapterData>;

export const crossReferenceRequest = z.object({
  verseKey: z.number().int().positive(),
  limit: z.number().int().min(1).max(50).default(12),
});
export type CrossReferenceRequest = z.infer<typeof crossReferenceRequest>;

export const crossReference = z.object({
  startKey: z.number().int().positive(),
  endKey: z.number().int().positive(),
  votes: z.number().int(),
});
export type CrossReference = z.infer<typeof crossReference>;

export const clipboardWriteRequest = z.object({
  text: z.string().min(1).max(100_000),
  html: z.string().min(1).max(200_000).optional(),
});
export type ClipboardWriteRequest = z.infer<typeof clipboardWriteRequest>;

export const concordanceRequest = z.object({
  resourceId: resourceSummary.shape.id,
  strongNumber: z.string().regex(/^[GH]\d+$/u),
});
export type ConcordanceRequest = z.infer<typeof concordanceRequest>;

export const concordanceResult = z.object({
  verseKey: z.number().int().positive(),
  text: z.string(),
});

export const lexiconEntry = z.object({
  strongNumber: z.string(),
  definition: z.string(),
});
export type LexiconEntry = z.infer<typeof lexiconEntry>;

export const highlightStyle = z.enum(['fill', 'text']);
export type HighlightStyle = z.infer<typeof highlightStyle>;

export const createNoteRequest = z.object({
  verseKey: z.number().int().positive(),
  title: z.string().max(500),
  resourceId: resourceSummary.shape.id.optional(),
  notebookId: z.string().min(1).optional(),
  startKey: z.number().int().positive().optional(),
  endKey: z.number().int().positive().optional(),
});
export type CreateNoteRequest = z.infer<typeof createNoteRequest>;

export const noteRecord = z.object({
  id: z.string().min(1),
  verseKey: z.number().int().positive(),
  title: z.string(),
  bodyMd: z.string().optional(),
  resourceId: resourceSummary.shape.id.optional(),
  notebookId: z.string().min(1).optional(),
  notebookKind: z.string().min(1).optional(),
});
export type NoteRecord = z.infer<typeof noteRecord>;

export const notebookRecord = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  kind: z.string().min(1),
  noteCount: z.number().int().nonnegative(),
});
export type NotebookRecord = z.infer<typeof notebookRecord>;

export const createNotebookRequest = z.object({
  name: z.string().trim().min(1).max(200),
  parentId: z.string().min(1).nullable().default(null),
  kind: z.enum(['notebook', 'commentary']).default('notebook'),
});
export type CreateNotebookRequest = z.infer<typeof createNotebookRequest>;

export const exportFormat = z.enum(['markdown', 'html', 'pdf']);
export type ExportFormat = z.infer<typeof exportFormat>;

export const exportNoteRequest = z.object({
  id: z.string().min(1),
  format: exportFormat,
});
export type ExportNoteRequest = z.infer<typeof exportNoteRequest>;

export const exportNotebookRequest = z.object({
  id: z.string().min(1),
  format: exportFormat,
});
export type ExportNotebookRequest = z.infer<typeof exportNotebookRequest>;

export const updateNoteRequest = z.object({
  id: z.string().min(1),
  bodyMd: z.string().max(100000).optional(),
  title: z.string().max(500).optional(),
  notebookId: z.string().min(1).optional(),
}).refine((value) => value.bodyMd !== undefined || value.title !== undefined || value.notebookId !== undefined, {
  message: 'A note title or body is required.',
});
export type UpdateNoteRequest = z.infer<typeof updateNoteRequest>;

export const noteAnchorRecord = z.object({
  noteId: z.string().min(1),
  startKey: z.number().int().positive(),
  endKey: z.number().int().positive(),
  resourceId: resourceSummary.shape.id.optional(),
});
export type NoteAnchorRecord = z.infer<typeof noteAnchorRecord>;

export const noteIdRequest = z.object({ id: z.string().min(1) });
export type NoteIdRequest = z.infer<typeof noteIdRequest>;

export const createNoteAnchorRequest = z.object({
  noteId: z.string().min(1),
  startKey: z.number().int().positive(),
  endKey: z.number().int().positive(),
  resourceId: resourceSummary.shape.id.optional(),
});
export type CreateNoteAnchorRequest = z.infer<typeof createNoteAnchorRequest>;

export const deleteNoteAnchorRequest = createNoteAnchorRequest;
export type DeleteNoteAnchorRequest = z.infer<typeof deleteNoteAnchorRequest>;

export const createHighlightRequest = z
  .object({
    verseKey: z.number().int().positive(),
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().nonnegative(),
    colour: z.string().regex(/^#[0-9a-fA-F]{6}$/u),
    style: highlightStyle,
  })
  .refine((value) => value.endOffset > value.startOffset, {
    message: 'endOffset must be greater than startOffset.',
  });
export type CreateHighlightRequest = z.infer<typeof createHighlightRequest>;

export const highlightRecord = z.object({
  id: z.string().min(1),
  verseKey: z.number().int().positive(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  colour: z.string(),
  style: highlightStyle,
});
export type HighlightRecord = z.infer<typeof highlightRecord>;

export const listHighlightsRequest = z.object({
  startKey: z.number().int().positive(),
  endKey: z.number().int().positive(),
});
export type ListHighlightsRequest = z.infer<typeof listHighlightsRequest>;

export const bookmarkRecord = z.object({
  id: z.string().min(1),
  label: z.string().nullable(),
  verseKey: z.number().int().positive(),
  resourceId: resourceSummary.shape.id.nullable(),
  createdAt: z.string().min(1),
});
export type BookmarkRecord = z.infer<typeof bookmarkRecord>;

export const createBookmarkRequest = z.object({
  label: z.string().trim().max(500).nullable().default(null),
  verseKey: z.number().int().positive(),
  resourceId: resourceSummary.shape.id.nullable().default(null),
});
export type CreateBookmarkRequest = z.infer<typeof createBookmarkRequest>;

export const readingPositionRecord = z.object({
  resourceId: resourceSummary.shape.id,
  verseKey: z.number().int().positive(),
  updatedAt: z.string().min(1),
});
export type ReadingPositionRecord = z.infer<typeof readingPositionRecord>;

export const readingPositionRequest = z.object({
  resourceId: resourceSummary.shape.id,
  verseKey: z.number().int().positive(),
});
export type ReadingPositionRequest = z.infer<typeof readingPositionRequest>;

export const resourceIdRequest = z.object({ resourceId: resourceSummary.shape.id });
export type ResourceIdRequest = z.infer<typeof resourceIdRequest>;

export const tagRecord = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colour: z.string().nullable(),
});
export type TagRecord = z.infer<typeof tagRecord>;

export const createTagRequest = z.object({
  name: z.string().trim().min(1).max(100),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/u).nullable().default(null),
});
export type CreateTagRequest = z.infer<typeof createTagRequest>;

export const tagLinkRequest = z.object({
  tagId: z.string().min(1),
  targetKind: z.enum(['note', 'highlight', 'bookmark']),
  targetId: z.string().min(1),
});
export type TagLinkRequest = z.infer<typeof tagLinkRequest>;

export const tagsForTargetRequest = tagLinkRequest.omit({ tagId: true });
export type TagsForTargetRequest = z.infer<typeof tagsForTargetRequest>;

export const listNotesRequest = z.object({
  start: z.number().int().positive().optional(),
  end: z.number().int().positive().optional(),
});
export type ListNotesRequest = z.infer<typeof listNotesRequest>;

const bookIdPattern = /^(?:[1-3])?[A-Z]{3}$/u;

export const searchScope = z.object({
  resourceIds: z.array(resourceSummary.shape.id).min(1).max(20),
  testament: z.enum(['OT', 'NT']).optional(),
  startBook: z.string().regex(bookIdPattern).optional(),
  endBook: z.string().regex(bookIdPattern).optional(),
});
export type SearchScope = z.infer<typeof searchScope>;

export const searchRequest = z.object({
  query: z.string().min(1).max(200),
  scope: searchScope,
  limit: z.number().int().min(1).max(200).default(100),
});
export type SearchRequest = z.infer<typeof searchRequest>;

export const searchHit = z.object({
  resourceId: resourceSummary.shape.id,
  verseKey: z.number().int().positive(),
  snippet: z.string(),
  rank: z.number(),
});
export type SearchHit = z.infer<typeof searchHit>;

export const contracts = {
  'app:get-info': { request: emptyRequest, response: appInfo },
  'window:minimize': { request: emptyRequest, response: z.null() },
  'window:toggle-maximize': { request: emptyRequest, response: windowState },
  'window:close': { request: emptyRequest, response: z.null() },
  'window:get-state': { request: emptyRequest, response: windowState },
  'settings:get': { request: emptyRequest, response: appSettings },
  'settings:patch': { request: settingsPatch, response: appSettings },
  'workspace:get': { request: emptyRequest, response: workspaceSchema.nullable() },
  'workspace:save': { request: workspaceSchema, response: z.null() },
  'resource:list': { request: emptyRequest, response: z.array(resourceSummary) },
  'resource:get-chapter': { request: chapterRequest, response: chapterData },
  'resource:get-cross-references': {
    request: crossReferenceRequest,
    response: z.array(crossReference),
  },
  'resource:get-concordance': {
    request: concordanceRequest,
    response: z.array(concordanceResult),
  },
  'resource:get-lexicon-entry': {
    request: concordanceRequest,
    response: lexiconEntry.nullable(),
  },
  'clipboard:write-text': { request: clipboardWriteRequest, response: z.null() },
  'annotations:create-note': { request: createNoteRequest, response: noteRecord },
  'annotations:create-highlight': { request: createHighlightRequest, response: highlightRecord },
  'annotations:list-highlights': {
    request: listHighlightsRequest,
    response: z.array(highlightRecord),
  },
  'annotations:create-bookmark': { request: createBookmarkRequest, response: bookmarkRecord },
  'annotations:list-bookmarks': { request: emptyRequest, response: z.array(bookmarkRecord) },
  'annotations:delete-bookmark': { request: noteIdRequest, response: z.null() },
  'annotations:set-reading-position': { request: readingPositionRequest, response: readingPositionRecord },
  'annotations:get-reading-position': { request: resourceIdRequest, response: readingPositionRecord.nullable() },
  'annotations:list-tags': { request: emptyRequest, response: z.array(tagRecord) },
  'annotations:create-tag': { request: createTagRequest, response: tagRecord },
  'annotations:add-tag-link': { request: tagLinkRequest, response: z.null() },
  'annotations:delete-tag-link': { request: tagLinkRequest, response: z.null() },
  'annotations:list-tags-for-target': { request: tagsForTargetRequest, response: z.array(tagRecord) },
  'annotations:list-notes': {
    request: listNotesRequest,
    response: z.array(noteRecord),
  },
  'annotations:list-note-anchors': {
    request: noteIdRequest,
    response: z.array(noteAnchorRecord),
  },
  'annotations:add-note-anchor': {
    request: createNoteAnchorRequest,
    response: noteAnchorRecord,
  },
  'annotations:delete-note-anchor': {
    request: deleteNoteAnchorRequest,
    response: z.null(),
  },
  'annotations:delete-note': { request: noteIdRequest, response: z.null() },
  'annotations:update-note': { request: updateNoteRequest, response: noteRecord },
  'annotations:list-notebooks': { request: emptyRequest, response: z.array(notebookRecord) },
  'annotations:create-notebook': { request: createNotebookRequest, response: notebookRecord },
  'annotations:export-note': { request: exportNoteRequest, response: z.string() },
  'annotations:export-notebook': { request: exportNotebookRequest, response: z.string() },
  'search:query': { request: searchRequest, response: z.array(searchHit) },
} as const;

export type Contracts = typeof contracts;
export type ContractChannel = keyof Contracts;
export type RequestOf<C extends ContractChannel> = z.infer<Contracts[C]['request']>;
export type ResponseOf<C extends ContractChannel> = z.infer<Contracts[C]['response']>;
