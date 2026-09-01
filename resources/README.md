# Bundled resource recipes

The JSON files in `recipes/` are the reproducible inputs for VerseScape's
bundled resources. Each recipe pins an authoritative archive by SHA-256 and
contains the metadata copied into the compiled database and manifest.

Source archives and compiled databases are deliberately gitignored. Build them
locally with:

```sh
pnpm resources:build
```

To fetch or compile one resource:

```sh
pnpm resources:fetch -- bsb
pnpm resources:compile -- bsb
pnpm resources:fetch -- tvtms
pnpm resources:compile -- tvtms
```

A checksum mismatch is intentional failure, not a transient warning. It means
the publisher changed the archive at the same URL. Review the new text and
licence, update `packages/resource-compiler/LICENSES.md` and its retrieval date,
then update the recipe hash. Never update a hash only to make the build pass.

The KJV recipe uses eBible's `eng-kjv2006` archive: the standardized 1769 text,
protocanon only. The similarly named `eng-kjv` archive includes Apocrypha and is
not the source used by VerseScape.

The TVTMS recipe pins a single file and repository commit rather than a moving
branch. Its transformation is intentionally lossless for mapping semantics:
columns 1–9 of the machine-oriented Expanded section become indexed SQLite
columns. Conditional tests and `!a`/`!b` subverse markers are retained verbatim.
Empty TSV padding columns, explanatory prose, the human-oriented Condensed
section and notes outside Expanded are omitted. No mapping is corrected or
inferred. The current pinned input emits 22,874 rows.
