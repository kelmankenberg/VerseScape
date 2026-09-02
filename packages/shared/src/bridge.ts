import type {
  AppInfo,
  ChapterData,
  ChapterRequest,
  ConcordanceRequest,
  LexiconEntry,
  CrossReference,
  CrossReferenceRequest,
  ResourceSummary,
  WindowState,
} from './ipc/contracts.js';
import type { AppSettings, SettingsPatch } from './settings.js';
import type { Workspace } from './workspace/types.js';
import type { IpcResult } from './ipc/result.js';

/**
 * The complete surface exposed to the renderer via contextBridge.
 *
 * Deliberately enumerated: there is no generic `invoke(channel, args)`
 * passthrough, so the renderer cannot reach a handler we did not intend.
 */
export interface VerseScapeBridge {
  readonly app: {
    getInfo(): Promise<IpcResult<AppInfo>>;
  };
  readonly settings: {
    get(): Promise<IpcResult<AppSettings>>;
    patch(patch: SettingsPatch): Promise<IpcResult<AppSettings>>;
  };
  readonly workspace: {
    get(): Promise<IpcResult<Workspace | null>>;
    save(workspace: Workspace): Promise<IpcResult<null>>;
  };
  readonly resources: {
    list(): Promise<IpcResult<ResourceSummary[]>>;
    getChapter(request: ChapterRequest): Promise<IpcResult<ChapterData>>;
    getCrossReferences(request: CrossReferenceRequest): Promise<IpcResult<CrossReference[]>>;
    getConcordance(request: ConcordanceRequest): Promise<IpcResult<Array<{ verseKey: number; text: string }>>>;
    getLexiconEntry(request: ConcordanceRequest): Promise<IpcResult<LexiconEntry | null>>;
  };
  readonly clipboard: {
    writeText(payload: { text: string; html?: string }): Promise<IpcResult<null>>;
  };
  readonly window: {
    minimize(): Promise<IpcResult<null>>;
    toggleMaximize(): Promise<IpcResult<WindowState>>;
    close(): Promise<IpcResult<null>>;
    getState(): Promise<IpcResult<WindowState>>;
    onStateChanged(listener: (state: WindowState) => void): () => void;
  };
}

declare global {
  interface Window {
    readonly versescape: VerseScapeBridge;
  }
}
