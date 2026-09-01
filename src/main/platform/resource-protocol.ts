import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';
import { resolveResourceAsset } from '../services/resources.js';
import { parseResourceAssetUrl } from './resource-url.js';

const SCHEME = 'versescape';

/** Must run before app readiness so the renderer treats the scheme as secure. */
export function registerResourceScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

export function installResourceProtocol(): void {
  protocol.handle(SCHEME, (request) => {
    const parsed = parseResourceAssetUrl(request.url);
    if (!parsed) return new Response('Not found', { status: 404 });

    const asset = resolveResourceAsset(parsed.id, parsed.relativePath);
    return asset
      ? net.fetch(pathToFileURL(asset).toString())
      : new Response('Not found', { status: 404 });
  });
}
