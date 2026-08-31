import { z } from 'zod';

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

export const contracts = {
  'app:get-info': { request: emptyRequest, response: appInfo },
  'window:minimize': { request: emptyRequest, response: z.null() },
  'window:toggle-maximize': { request: emptyRequest, response: windowState },
  'window:close': { request: emptyRequest, response: z.null() },
  'window:get-state': { request: emptyRequest, response: windowState },
} as const;

export type Contracts = typeof contracts;
export type ContractChannel = keyof Contracts;
export type RequestOf<C extends ContractChannel> = z.infer<Contracts[C]['request']>;
export type ResponseOf<C extends ContractChannel> = z.infer<Contracts[C]['response']>;
