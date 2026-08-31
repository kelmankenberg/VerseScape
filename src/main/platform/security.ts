import { app, session, shell } from 'electron';
import { URL } from 'node:url';

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:']);

/**
 * Content Security Policy. No inline or eval'd script anywhere.
 * `style-src` allows inline styles because Vite injects them in dev; this is
 * tightened to `'self'` for production builds below.
 */
function contentSecurityPolicy(isDev: boolean): string {
  const styleSrc = isDev ? "'self' 'unsafe-inline'" : "'self'";
  const connectSrc = isDev ? "'self' ws: http://localhost:*" : "'self'";
  return [
    "default-src 'none'",
    "script-src 'self'",
    `style-src ${styleSrc}`,
    "img-src 'self' data: versescape:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/**
 * Enables the Chromium sandbox for every renderer. Must be called at module
 * load: Electron rejects it once the app is ready.
 */
export function enableProcessSandbox(): void {
  app.enableSandbox();
}

/**
 * Session and navigation hardening. Requires the app to be ready.
 */
export function applySecurityPolicy(isDev: boolean): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy(isDev)],
      },
    });
  });

  // Deny every permission by default; opt in explicitly if a feature needs one.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      const isDevServer = isDev && new URL(url).hostname === 'localhost';
      if (!isDevServer) {
        event.preventDefault();
        console.warn(`[security] blocked in-app navigation to ${url}`);
      }
    });

    contents.setWindowOpenHandler(({ url }) => {
      try {
        if (ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) {
          void shell.openExternal(url);
        } else {
          console.warn(`[security] blocked window.open for ${url}`);
        }
      } catch {
        console.warn('[security] blocked window.open for a malformed URL');
      }
      return { action: 'deny' };
    });

    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
      console.warn('[security] blocked <webview> attachment');
    });
  });
}
