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
});
export type CreateNoteRequest = z.infer<typeof createNoteRequest>;

export const noteRecord = z.object({
  id: z.string().min(1),
  verseKey: z.number().int().positive(),
  title: z.string(),
});
export type NoteRecord = z.infer<typeof noteRecord>;

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
} as const;

export type Contracts = typeof contracts;
export type ContractChannel = keyof Contracts;
export type RequestOf<C extends ContractChannel> = z.infer<Contracts[C]['request']>;
export type ResponseOf<C extends ContractChannel> = z.infer<Contracts[C]['response']>;
