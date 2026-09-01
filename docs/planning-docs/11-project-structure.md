# 11 — Project Structure

Proposed pnpm workspace layout.

```
VerseScape/
├─ package.json                  # workspace root, shared scripts
├─ pnpm-workspace.yaml
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ tsconfig.base.json
├─ docs/
│  └─ planning-docs/
├─ resources/                    # build-time assets: icons, bundled KJV, fonts
├─ packages/
│  ├─ shared/                    # zero-dependency, used by main + renderer
│  │  └─ src/
│  │     ├─ reference/           # Reference, parser, formatter, verse keys
│  │     ├─ canon/               # OSIS book list, versification schemes
│  │     ├─ workspace/           # layout tree, reducers, invariants, schema
│  │     ├─ ipc/                 # channel names + Zod schemas + result types
│  │     └─ types/
│  └─ resource-compiler/         # CLI: USFM/OSIS -> .vsres
│     └─ src/{parse,normalise,validate,emit}/
├─ src/
│  ├─ main/
│  │  ├─ index.ts                # app lifecycle, single instance
│  │  ├─ platform/               # window manager, paths, protocol, menus
│  │  ├─ ipc/                    # handler registration, validation wrapper
│  │  ├─ services/               # resource, search, notes, settings, plans, update
│  │  ├─ db/                     # connection, migrations/, repositories/
│  │  └─ workers/                # utility-process entrypoints (search, import)
│  ├─ preload/
│  │  └─ index.ts                # contextBridge surface only
│  └─ renderer/
│     ├─ index.html
│     ├─ main.tsx
│     ├─ shell/                  # TitleBar, Rail, Toolbar, StatusBar, PageRouter
│     ├─ workspace/              # layout model, reducers, Split, TabStrip, DnD
│     ├─ panels/
│     │  ├─ registry.ts
│     │  ├─ bible/
│     │  ├─ notes/
│     │  ├─ search/
│     │  ├─ compare/
│     │  └─ reader/
│     ├─ pages/                  # dashboard, library, notes, plans, settings, account
│     ├─ components/             # shared primitives (Button, Menu, Dialog…)
│     ├─ services/               # typed IPC clients + TanStack Query hooks
│     ├─ stores/                 # zustand stores
│     ├─ theme/                  # tokens.css, themes
│     └─ hooks/
├─ tests/
│  ├─ unit/                      # colocated preferred; cross-cutting here
│  └─ e2e/                       # Playwright + Electron
└─ .github/workflows/            # ci.yml, release.yml
```

## Conventions

- **Path aliases:** `@shared/*`, `@main/*`, `@renderer/*`. No deep relative imports.
- **The workspace layout model lives in `packages/shared/src/workspace`,** not in
  the renderer, because the main process validates persisted layouts against the
  same Zod schema. `src/renderer/workspace` holds only the React components that
  render the tree and the drag-and-drop glue.
- **No cross-layer imports.** Renderer may import `@shared` but never `@main`.
  Enforced with an ESLint `no-restricted-imports` rule.
- **Files:** components `PascalCase.tsx`, everything else `kebab-case.ts`.
- **Tests colocated** as `*.test.ts` next to the unit under test.
- **Barrel files only at package boundaries**, not inside feature folders.
- **Panel folders are self-contained**: component, state, descriptor, tests,
  and register themselves in `panels/registry.ts` — the only shared touchpoint.
- **IPC channels** are constants in `@shared/ipc`, namespaced `domain:action`
  (e.g. `resource:list`, `search:query`, `workspace:save`).
- **Commits:** Conventional Commits. **Branches:** `feat/`, `fix/`, `chore/`.
- **Every PR** must pass typecheck, lint, unit tests, and build on both OSes.
