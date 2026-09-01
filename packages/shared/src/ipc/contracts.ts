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
} as const;

export type Contracts = typeof contracts;
export type ContractChannel = keyof Contracts;
export type RequestOf<C extends ContractChannel> = z.infer<Contracts[C]['request']>;
export type ResponseOf<C extends ContractChannel> = z.infer<Contracts[C]['response']>;
