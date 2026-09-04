# 16 - Resource Maintenance Guide

## Purpose

This guide explains how VerseScape maintainers add, update, deprecate, and remove downloadable Bible-study resources. It also identifies safe places to discover candidate source material.

There are two different workflows:

| Role | Responsibility |
| --- | --- |
| VerseScape user | Browse **Available Resources** and install a trusted package. The user does not create packages or edit the catalog. |
| VerseScape maintainer | Vet source rights, add reproducible recipes, compile packages, and publish a signed catalog release. |

## Resource Selection Rules

A resource may be published only when all of the following are true:

1. The underlying text is public domain or has a license compatible with GPL-3.0-or-later redistribution.
2. The source page or rights holder explicitly supports the intended redistribution.
3. The exact edition is identified. Similar titles can have different rights, editorial changes, or trademarks.
4. The source is stable enough to pin with an HTTPS URL and SHA-256 checksum.
5. The resource can be transformed into VerseScape's safe compiled format without reproducing source-site layout or restricted formatting.
6. License evidence, source URL, retrieval date, attribution, and restrictions are recorded in `packages/resource-compiler/LICENSES.md`.
7. The compiled resource passes the relevant compiler and application checks.

Do not publish a resource merely because it is visible online, old, described as free, or available in another application's module format.

## Candidate Source Discovery

Use discovery sources to find candidates, but verify rights at the original publisher or rights-holder page before adding a recipe.

| Resource type | Preferred discovery/source locations | Notes |
| --- | --- | --- |
| Public-domain Bible translations | [eBible.org](https://ebible.org/), [fetch.bible](https://fetch.bible/), [open.bible](https://open.bible/) | eBible hosts both public-domain and licensed texts. Verify each translation separately. |
| USFM or USX Bible source archives | Translation publisher, eBible.org, or official open-source repositories | Prefer official USFM/USX over screen-scraped HTML. |
| Public-domain commentaries | [CCEL](https://ccel.org/), Project Gutenberg, Internet Archive, official author/publisher archives | CCEL text may be public domain, but its source-file formatting is not reusable. Extract text only. |
| Lexicons and original-language data | [STEPBible Data](https://github.com/STEPBible/STEPBible-Data) | Follow CC BY attribution and transformation requirements. |
| Cross-references | [OpenBible.info](https://www.openbible.info/labs/cross-references/) | Take reference data only; retain required attribution. |
| Maps, images, and media | Original rights-holder archive with an explicit compatible license | Do not import visual media without an explicit redistribution license. |

### Sources Not to Use

- Logos, Accordance, or other proprietary/DRM resource formats.
- CrossWire/SWORD modules as a distribution source. Rights are not universally transferable and the module format is intentionally excluded.
- Bible Hub, StudyLight, Blue Letter Bible, or similar sites through scraping.
- A GitHub mirror unless its provenance and license trace back to an original, compatible source.

See [07-resource-pipeline.md](07-resource-pipeline.md), [08-security-and-privacy.md](08-security-and-privacy.md), and `packages/resource-compiler/LICENSES.md` for the governing rules.

## Add a Resource

### 1. Choose the Exact Work and Edition

Record the work title, edition, language, abbreviation, source owner, source URL, license, and any naming or attribution requirements.

Examples already configured:

- BSB: official Berean Bible USFM source.
- KJV: eBible standardized 1769 USFM archive.
- MHCC: CCEL Matthew Henry Concise EPUB, text-only extraction.
- JFB: CCEL Jamieson-Fausset-Brown EPUB, text-only extraction.

### 2. Verify Rights and Record Provenance

Add a detailed entry to `packages/resource-compiler/LICENSES.md` before publishing.

Include:

- License statement or source quotation.
- Source and direct archive URL.
- Retrieval date.
- Archive SHA-256.
- Attribution text.
- Trademark/naming restrictions.
- A clear **Verified** status only after the source and edition are checked.

### 3. Add a Recipe

Create `resources/recipes/<resource-id>.json`.

A standard Bible/commentary recipe contains:

```json
{
  "file": {
    "url": "https://example.org/source.epub",
    "name": "source.epub",
    "sha256": "<64-hex-character-source-hash>"
  },
  "meta": {
    "id": "example-commentary",
    "title": "Example Commentary",
    "abbreviation": "EXC",
    "type": "commentary",
    "language": "en",
    "versification": "kjv",
    "licence": "Public domain text.",
    "licenceSpdx": "PublicDomain",
    "source": "https://example.org/work-page",
    "retrieved": "2026-09-04",
    "redistributable": true
  }
}
```

Use lower-case, hyphenated resource IDs. IDs become database names, catalog IDs, and local library directory names, so changing one after publication is a breaking migration.

### 4. Implement or Choose a Source Normalizer

The resource compiler needs normalized source input:

- **Bibles:** USFM/USX parsed into books, chapters, verses, headings, and footnotes.
- **Commentaries:** canonical `entry` records with book/chapter/range anchors, title, and plain text body.
- **Lexicons:** the dedicated lexicon parser.
- **Reference datasets:** dedicated parsers such as cross-references or versification.

Add a format-specific parser only when an existing supported input cannot be converted reproducibly. Keep source HTML/EPUB/ThML parsing conservative: extract text and canonical anchors, never preserve presentation HTML.

Add parser unit tests and a compiler self-test fixture for every new source format or edge case.

### 5. Fetch and Verify the Source

Run:

```bash
pnpm resources:fetch -- <resource-id>
```

The fetch command downloads the source archive to ignored `resources/sources/<resource-id>/` and verifies its pinned SHA-256. A hash mismatch is a stop condition: inspect the upstream change and update provenance before changing the recipe pin.

### 6. Compile Locally

Run:

```bash
pnpm resources:compile -- <resource-id>
pnpm compiler:check
```

The compiled output appears in ignored `resources/compiled/<resource-id>/` and includes:

```text
manifest.json
<resource-id>.db
assets/                 optional
```

Inspect the manifest, check canonical coverage, test a representative set of passages or entries in the app, and confirm the resource appears correctly in Library and its reader.

### 7. Add It to the Release Workflow

The current workflow packages `bsb`, `kjv`, `mhcc`, and `jfb`. For a new release resource, update the `for id in ...` list in `.github/workflows/publish-resources.yml`.

Do not add a resource to that list until its recipe and provenance are committed and its compiler path is verified.

### 8. Publish It

Trigger **Publish Resource Catalog** from GitHub Actions with a new immutable release tag, for example `resources-v2`.

The workflow:

1. Fetches and checksum-verifies sources.
2. Compiles resources.
3. Packages each compiled directory as `.vsres`.
4. Computes final package size and SHA-256.
5. Generates `catalog.json`.
6. Signs the raw catalog with `CATALOG_SIGNING_KEY_B64`.
7. Verifies the signature against the committed public key.
8. Uploads packages, `catalog.json`, and `catalog.sig` to the GitHub Release.

Do not manually edit the generated catalog or replace release assets after signing.

## Update a Resource

Use an update when a source has a corrected edition, a parser improvement changes normalized data, or package metadata needs a compatible correction.

1. Re-verify the source license and edition.
2. Update `LICENSES.md` with the new archive URL, retrieval date, and SHA-256 if the source changed.
3. Update the recipe pin.
4. Recompile and compare entry/verse counts against the previous build.
5. Increase the resource version in the release workflow/catalog generation. Do not reuse the old package filename.
6. Publish a new resource release tag, for example `resources-v2`.
7. Confirm an existing installation sees the newer catalog item and can install it safely.

Keep old packages available for a transition period. The catalog client should eventually distinguish installed versions from newer versions and offer an update action.

## Remove or Deprecate a Resource

### Deprecate First

Deprecation is preferred when possible:

1. Remove the resource from the next signed catalog or mark it unavailable in the next catalog schema revision.
2. Keep the existing package release asset available temporarily so current users retain working installations.
3. State the reason in release notes: source-rights concern, corrected edition, replacement resource, or technical incompatibility.
4. Provide a replacement resource where appropriate.

### Emergency Removal

Use emergency removal only for legal, security, or integrity problems:

1. Remove the package asset and affected catalog release if necessary.
2. Publish a new signed catalog without the item.
3. Release an application notice or update that explains the risk and recommended action.
4. Do not silently delete files from a user's local library. The application should flag the resource and require an explicit user decision.

### Removing a Resource from Local Development

For ignored development outputs:

```bash
rm -rf resources/sources/<resource-id>
rm -rf resources/compiled/<resource-id>
```

Remove its recipe, workflow package entry, and license record only when the project no longer intends to support it. Do not remove license evidence from release history.

## End-User Resource Flow

A normal VerseScape user does not use recipes or source archives:

1. Open **Library**.
2. Review **Available Resources** from the verified catalog.
3. Inspect title, source, license, attribution, size, and version.
4. Select **Install**.
5. VerseScape verifies the catalog signature, package SHA-256, internal manifest checksums, and archive safety before atomic installation.
6. The resource appears under **Installed Resources** and in the Library Resources sidebar.
7. Enable it if desired and open it in Study.

Users may also import a trusted local `.vsres` archive. Local import uses the same internal manifest, checksum, path-safety, and atomic-install checks, but it is not catalog-signed.

## Maintainer Checklist

- [ ] Exact work and edition selected.
- [ ] Rights and distribution terms verified at the source.
- [ ] Provenance and attribution recorded in `LICENSES.md`.
- [ ] Pinned recipe includes an HTTPS URL and source SHA-256.
- [ ] Parser/normalizer preserves canonical anchors and discards source presentation markup.
- [ ] Unit and compiler self-test coverage added or updated.
- [ ] Local fetch, compile, and application smoke test pass.
- [ ] Resource ID added to the release workflow package list.
- [ ] New immutable resource-release tag selected.
- [ ] Signed catalog workflow succeeds.
- [ ] Published catalog signature and package checksums verified from a clean profile.
