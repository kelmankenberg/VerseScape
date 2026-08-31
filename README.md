# VerseScape

An offline-first desktop Bible study workspace for **Linux and Windows**, built with
Electron, TypeScript and React. UI inspiration: Logos Bible Study.

> **Status: pre-alpha.** Milestone M0 (foundations) — the app builds and runs a
> hardened window, but there is no Bible reading yet. See the
> [roadmap](docs/planning-docs/10-roadmap.md).

## Why

Serious Bible study software is either expensive and heavyweight, or lightweight
but weak on multi-resource workflows — and Linux support in the serious tier is
poor. VerseScape aims for a real study _workspace_: many resources side by side,
linked by scripture reference, with notes you own and can export.

## Pillars

- **Offline-first.** Everything works with no network.
- **A workspace, not a reader.** Arbitrary rows and columns of tabbed panels.
- **Linked reading.** Panels follow one another by scripture reference.
- **Own your data.** Notes are Markdown in a local SQLite database.
- **Linux is first-class**, not an afterthought.
- **No telemetry.** Ever, by default.

## Getting started

Requires Node.js 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev          # run the app with HMR
pnpm typecheck
pnpm lint
pnpm test
pnpm dist         # package for the current platform
```

## Project layout

```
packages/shared/   Pure code shared by main and renderer (IPC contracts, types)
src/main/          Electron main process — privileged, owns the database
src/preload/       contextBridge surface (sandboxed, dependency-free)
src/renderer/      React UI — no Node access
docs/planning-docs Product, architecture and design documentation
```

Full detail in [docs/planning-docs](docs/planning-docs/README.md), including the
[architecture](docs/planning-docs/02-architecture.md),
[panel system](docs/planning-docs/05-workspace-panel-system.md) and
[decision log](docs/planning-docs/13-decision-log.md).

## Security posture

Every renderer runs with `contextIsolation: true`, `nodeIntegration: false` and
`sandbox: true`, under a strict CSP with no `unsafe-inline` or `unsafe-eval`.
The renderer has no filesystem or database access; all privileged work goes
through an explicitly enumerated, schema-validated preload bridge. See
[08-security-and-privacy.md](docs/planning-docs/08-security-and-privacy.md).

## Resources and licensing

VerseScape ships only public-domain or explicitly licensed texts, compiled from
open formats (USFM/OSIS) by our own tooling. It does **not** read proprietary or
encrypted resource formats from other Bible software.

## Licence

[GPL-3.0-or-later](LICENSE). Copyright © 2026 VerseScape contributors.
