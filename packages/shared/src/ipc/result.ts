/**
 * Every IPC handler returns a discriminated result rather than throwing across
 * the bridge. Internal errors and stack traces must never reach the renderer.
 */
export type IpcResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: IpcErrorCode; readonly message: string };

export const IpcErrorCodes = {
  invalidRequest: 'INVALID_REQUEST',
  notFound: 'NOT_FOUND',
  internal: 'INTERNAL',
  unsupported: 'UNSUPPORTED',
} as const;

export type IpcErrorCode = (typeof IpcErrorCodes)[keyof typeof IpcErrorCodes];

export function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

export function err(code: IpcErrorCode, message: string): IpcResult<never> {
  return { ok: false, code, message };
}
