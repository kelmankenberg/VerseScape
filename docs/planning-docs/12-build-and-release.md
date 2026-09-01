# 12 — Build and Release

## Local development

```bash
pnpm install
pnpm dev            # electron-vite dev, HMR renderer, restart on main change
pnpm typecheck
pnpm lint
pnpm test           # vitest
pnpm test:e2e       # playwright + electron
pnpm build          # compile only
pnpm dist           # build + package for the current platform
```

Native modules (`better-sqlite3`) are rebuilt for the Electron ABI via
`electron-builder install-app-deps` in a `postinstall` script.

## Targets

| Platform    | Artifacts                                           |
| ----------- | --------------------------------------------------- |
| Linux x64   | AppImage, `.deb`, `.tar.gz` (arm64 best-effort)     |
| Windows x64 | NSIS installer, portable `.exe` (arm64 best-effort) |

App id: `app.versescape.VerseScape` (**TBD**, question G2).
Linux `.desktop` entry with categories `Education;Literature;Viewer;`.

## Versioning

- Semantic versioning. `main` is always releasable.
- Channels: `latest` (stable) and `beta`. Auto-update reads the channel from settings.
- Two independent version numbers are also tracked in `app_meta`:
  **DB schema version** and **layout JSON version** — both migrate forward only.

## CI (GitHub Actions)

`ci.yml` on every PR:

1. matrix `[ubuntu-latest, windows-latest]`
2. install (pnpm cache) → typecheck → lint → unit tests → build
3. Playwright e2e on Linux (headless via xvfb) and Windows
4. `pnpm audit --prod` and a **GPL-3.0 compatibility licence check** on all
   production dependencies and bundled fonts (D-08, NFR-12) — the build fails on
   an incompatible licence. Resource data is checked separately for
   redistribution permission (NFR-13), not GPL compatibility.

`release.yml` on tag `v*`:

1. build and package both platforms
2. sign (Windows per D-12, GPG detached signature on Linux)
3. generate `latest.yml` / `latest-linux.yml` for electron-updater
4. publish to GitHub Releases with generated changelog
5. optionally publish the resource `catalog.json` if resources changed

### Windows signing (D-12)

No certificate is purchased. In priority order:

1. **SignPath.io free OSS plan** — signs from CI with a managed certificate;
   requires an approved public repo and a defined signing policy.
2. **`winget` and Chocolatey** listings — reduces the number of users who
   download the raw `.exe`, though it does not remove the warning by itself.
3. **Unsigned fallback** — release notes must explain the SmartScreen prompt and
   publish SHA-256 checksums so users can verify the download independently.

This must be settled before the first public beta, not at M8.

## Auto-update

- `electron-updater`, GitHub provider, signature verification enabled.
- Default behaviour: check on launch and every 6 h, download in the background,
  prompt to restart. All of it disableable in Settings → Advanced.
- If "offline mode" is enabled, no update checks occur.

## Release checklist

- [ ] All milestone requirements ticked in doc 01
- [ ] Migrations tested forward from the previous release's DB
- [ ] Layout JSON migration tested from the previous release's snapshot
- [ ] Performance budgets (NFR-01..03) measured and recorded
- [ ] Fresh-install and upgrade-install verified on both platforms
- [ ] Licence file bundled for every shipped resource
- [ ] Changelog written for users, not commits
