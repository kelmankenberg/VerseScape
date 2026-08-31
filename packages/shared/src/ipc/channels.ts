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
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** Pushed from main to renderer; not a request/response channel. */
export const IpcEvents = {
  windowStateChanged: 'window:state-changed',
} as const;

export type IpcEvent = (typeof IpcEvents)[keyof typeof IpcEvents];
