import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { contracts } from '@shared/ipc/contracts.js';
import type { ContractChannel, RequestOf, ResponseOf } from '@shared/ipc/contracts.js';
import { err, ok, IpcErrorCodes } from '@shared/ipc/result.js';
import type { IpcResult } from '@shared/ipc/result.js';

/**
 * Registers a validated IPC handler.
 *
 * The payload is parsed against the channel's schema before the handler sees
 * it, and thrown errors are converted into an opaque result so no internal
 * detail crosses the bridge.
 */
export function handle<C extends ContractChannel>(
  channel: C,
  handler: (
    payload: RequestOf<C>,
    event: IpcMainInvokeEvent,
  ) => ResponseOf<C> | Promise<ResponseOf<C>>,
): void {
  ipcMain.handle(channel, async (event, raw: unknown): Promise<IpcResult<ResponseOf<C>>> => {
    const parsed = contracts[channel].request.safeParse(raw ?? {});
    if (!parsed.success) {
      console.warn(`[ipc] rejected malformed payload on ${channel}`);
      return err(IpcErrorCodes.invalidRequest, `Invalid payload for ${channel}.`);
    }

    try {
      const data = await handler(parsed.data as RequestOf<C>, event);
      return ok(data);
    } catch (cause) {
      console.error(`[ipc] handler for ${channel} threw`, cause);
      return err(IpcErrorCodes.internal, 'The operation could not be completed.');
    }
  });
}
