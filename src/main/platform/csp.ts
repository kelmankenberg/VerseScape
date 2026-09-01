/**
 * Content Security Policy.
 *
 * Production is strict: no inline or eval'd script, no inline style.
 * Development additionally allows inline script and eval because Vite injects
 * the React Fast Refresh preamble inline and uses eval for HMR. The packaged
 * app never takes this branch.
 *
 * Kept free of Electron imports so it can be unit tested.
 */
export function contentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";
  const styleSrc = isDev ? "'self' 'unsafe-inline'" : "'self'";
  const connectSrc = isDev ? "'self' ws: http://localhost:*" : "'self'";

  return [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
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
