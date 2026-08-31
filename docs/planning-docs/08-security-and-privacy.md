# 08 — Security and Privacy

## Threat model

Primary risks for an offline desktop app that renders third-party content:

1. Malicious or malformed **imported resource** → RCE or data exfiltration.
2. **XSS in the renderer** escalating to Node via a leaky preload.
3. **Path traversal / zip-slip** during resource import.
4. **SQL injection** through search queries or reference input.
5. Supply-chain compromise of a dependency or the update channel.

## Electron hardening (mandatory)

```ts
new BrowserWindow({
  frame: false,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

Plus:

- `app.enableSandbox()` at startup.
- CSP with no `unsafe-inline`/`unsafe-eval`:
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' versescape: data:; font-src 'self'; connect-src 'self'`.
- `will-navigate` → block all external navigation.
- `setWindowOpenHandler` → deny; external links open via `shell.openExternal`
  after an allowlist scheme check (`https:` only) and a user confirmation for
  unknown hosts.
- `webview` tag disabled; `<iframe>` only with `sandbox` and no allow-scripts.
- `session.setPermissionRequestHandler` → deny everything not explicitly needed
  (camera, mic, geolocation, notifications default-deny).
- Remote module not used (removed in modern Electron anyway).

## IPC discipline

- Preload exposes named methods only; no dynamic channel names.
- Every handler validates input with Zod and returns
  `{ ok: true, data } | { ok: false, code, message }` — internal errors and
  stack traces never cross the bridge.
- Handlers that touch the filesystem accept **ids, never paths**. Path
  construction happens in main from a known root.
- Rate-limit expensive handlers (search, import) per window.

## Content sanitisation

- Compiled resources contain only the restricted inline markup from doc 07;
  the renderer maps tags to components rather than using `dangerouslySetInnerHTML`.
- Any HTML that must be rendered (user-imported articles) passes through
  DOMPurify in the renderer **and** is stripped at import time in main.
- User note Markdown is rendered through a hardened pipeline with raw HTML disabled.

## File and archive handling

- Archive extraction: reject absolute paths, `..` segments, symlinks, and
  entries exceeding size/count caps; extract to a temp dir then atomic rename.
- All resource files are opened **read-only** (`sqlite` in readonly mode).
- Verify SHA-256 before trusting any downloaded or imported file.

## Database

- Parameterised statements only. Search input is parsed into a structured AST
  and re-serialised into an FTS5 MATCH expression — never string-concatenated.
- User DB writes wrapped in transactions; WAL mode; backup before migration.

## Updates and supply chain

- `electron-updater` over HTTPS with signature verification.
- Windows: Authenticode code signing (**TBD** — certificate procurement).
- Linux: detached GPG signature on AppImage/deb; repository metadata signed.
- `pnpm` lockfile committed; CI runs `pnpm audit` and a license check; Dependabot enabled.
- Renovate/Dependabot PRs require a human review for any native module bump.

## Privacy stance

- **No telemetry by default.** Any analytics would be opt-in, documented,
  and anonymous — decision deferred to v2.
- No network requests at all unless the user checks for updates or uses the
  resource catalogue. A visible "offline mode" setting hard-blocks the net.
- Notes and reading history never leave the machine in v1.
- Crash reports are opt-in and scrubbed of file paths and note content.

## Secrets

- No API keys shipped in the client. If a future service requires auth, use a
  device-code flow and store tokens in the OS keychain (`keytar`/`safeStorage`),
  never in `settings.json`.
