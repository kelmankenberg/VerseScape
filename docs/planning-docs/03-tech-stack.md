# 03 — Tech Stack

All choices marked **TBD** are open for discussion in [09-open-questions.md](09-open-questions.md).

| Concern            | Proposal                                                 | Rationale / alternatives                                                                                                                |
| ------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime            | Electron (latest stable major)                           | Required by the brief; Chromium gives us the layout engine the panel system needs.                                                      |
| Language           | TypeScript, `strict: true`                               | Shared types across process boundary.                                                                                                   |
| Build              | electron-vite                                            | Fast HMR for renderer, sane main/preload bundling. Alt: Forge + Webpack.                                                                |
| Packaging          | electron-builder                                         | AppImage + deb + NSIS from one config; auto-update support. Alt: Forge makers.                                                          |
| UI framework       | React 18                                                 | Ecosystem depth for the drag/drop and virtualisation we need. Alt: Svelte (leaner), Solid.                                              |
| Styling            | Tailwind CSS + CSS variables for theme tokens            | Fast iteration, tokens allow runtime theming. Alt: vanilla-extract.                                                                     |
| Components         | Radix UI primitives (unstyled)                           | Accessible menus/dialogs/tooltips without visual lock-in.                                                                               |
| Icons              | Lucide                                                   | Consistent, permissive licence.                                                                                                         |
| Client state       | Zustand + Immer                                          | Workspace tree mutations read cleanly; minimal boilerplate. Alt: Redux Toolkit.                                                         |
| Server-state cache | TanStack Query                                           | Caching/invalidation for IPC-backed reads.                                                                                              |
| Panel layout       | **Custom engine** (decided, D-03)                        | Off-the-shelf (dockview, rc-dock, golden-layout) is heavy and hard to theme; our tree model is simple. No fallback — this is committed. |
| Drag and drop      | dnd-kit                                                  | Pointer-based, works for tab drag + edge drop zones.                                                                                    |
| Virtualisation     | TanStack Virtual                                         | Long-chapter and search-result scrolling.                                                                                               |
| Text editor        | TipTap (ProseMirror)                                     | Rich notes with custom `ref` nodes; serialises to Markdown. Alt: Lexical, CodeMirror.                                                   |
| Database           | SQLite via better-sqlite3                                | Synchronous, fast, FTS5 built in. Runs in main/utility process only.                                                                    |
| Migrations         | Hand-rolled numbered SQL migrations                      | Small surface; avoids ORM weight. Alt: Drizzle ORM.                                                                                     |
| Search             | SQLite FTS5 + custom tokenizer config                    | No extra runtime; good enough for v1.                                                                                                   |
| Validation         | Zod                                                      | IPC boundary schemas, config parsing, resource manifest parsing.                                                                        |
| Logging            | electron-log                                             | Rotating files, main + renderer transport.                                                                                              |
| Updates            | electron-updater                                         | Behind a user-facing opt-in.                                                                                                            |
| Testing            | Vitest (unit) + Playwright for Electron (e2e)            | e2e drives real window chrome and panel drag.                                                                                           |
| Lint/format        | ESLint (flat) + Prettier                                 |                                                                                                                                         |
| CI                 | GitHub Actions matrix: `ubuntu-latest`, `windows-latest` |                                                                                                                                         |
| Package manager    | pnpm                                                     |                                                                                                                                         |

## Licence compatibility (D-08)

The project is **GPL-3.0-or-later**, so every production dependency must be
GPL-compatible. MIT/BSD/ISC/Apache-2.0 are fine. Anything under SSPL, BSL,
CC-BY-NC, or a proprietary/"source available" licence is disqualified — including
fonts and resource data. CI enforces this; see doc 12.

All libraries listed above were selected partly on this basis.

## Explicit non-choices

- **No remote code loading.** The renderer only loads bundled assets and
  `versespace://` resources. `will-navigate` and `setWindowOpenHandler` are
  locked down.
- **No native modules beyond `better-sqlite3`** unless justified — each one adds
  cross-platform build pain.
- **No Node integration in any renderer**, including panels rendering imported
  resource HTML (sanitised before render).

## Minimum supported targets

- Windows 10 21H2 and later (x64, arm64 best-effort)
- Linux: glibc 2.31+ (Ubuntu 20.04 baseline), X11 and Wayland, x64 and arm64
