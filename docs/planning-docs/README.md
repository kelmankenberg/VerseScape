# VerseScape — Planning Docs

Desktop Bible study application for Linux and Windows, built on Electron + Node.
UI inspiration: Logos Bible Study.

> Status: **DRAFT v0.1** — pending decisions tracked in [09-open-questions.md](09-open-questions.md).

## Index

| Doc                                                          | Purpose                                        |
| ------------------------------------------------------------ | ---------------------------------------------- |
| [00-vision-and-scope.md](00-vision-and-scope.md)             | Product vision, target users, in/out of scope  |
| [01-requirements.md](01-requirements.md)                     | Functional and non-functional requirements     |
| [02-architecture.md](02-architecture.md)                     | Process model, module boundaries, IPC contract |
| [03-tech-stack.md](03-tech-stack.md)                         | Chosen libraries and rationale                 |
| [04-ui-ux-spec.md](04-ui-ux-spec.md)                         | App shell, rail, toolbar, page area, theming   |
| [05-workspace-panel-system.md](05-workspace-panel-system.md) | Tabbed, splittable study panel system          |
| [06-data-model.md](06-data-model.md)                         | Storage, schema, resource format               |
| [07-resource-pipeline.md](07-resource-pipeline.md)           | Bible/book ingestion, indexing, search         |
| [08-security-and-privacy.md](08-security-and-privacy.md)     | Hardening, licensing, telemetry stance         |
| [09-open-questions.md](09-open-questions.md)                 | Decisions needed before implementation         |
| [10-roadmap.md](10-roadmap.md)                               | Milestones and delivery slices                 |
| [11-project-structure.md](11-project-structure.md)           | Repo layout and conventions                    |
| [12-build-and-release.md](12-build-and-release.md)           | Packaging, signing, auto-update                |
| [13-decision-log.md](13-decision-log.md)                     | Settled decisions and their consequences       |
| [14-personal-commentary-redesign.md](14-personal-commentary-redesign.md) | Proposed PC resource-reader redesign and decisions |

## Conventions

- Every requirement has a stable ID (`FR-*`, `NFR-*`) and is referenced from roadmap items.
- Decisions that are not yet made are marked `**TBD**` and mirrored into `09-open-questions.md`.
