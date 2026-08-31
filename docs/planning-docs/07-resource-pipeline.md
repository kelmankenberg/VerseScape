# 07 — Resource Pipeline

## Principles

- **Only open or licensed content.** Public-domain texts (KJV, ASV, WEB, YLT,
  Darby) and openly licensed texts where terms permit redistribution.
- **No proprietary format reverse-engineering.** We do not read Logos, Accordance,
  or any encrypted/DRM resource format.
- Ingestion happens **offline in a build tool**, not in the shipped app. The app
  only consumes the compiled resource DB format from doc 06.

## Source formats

| Format          | Use                                  | Notes                                                         |
| --------------- | ------------------------------------ | ------------------------------------------------------------- |
| USFM / USX      | Primary import for Bibles            | Industry standard from Paratext/DBL                           |
| OSIS XML        | Secondary                            | Common for public-domain texts                                |
| Zefania / ThML  | Best-effort                          | Widely available legacy XML                                   |
| SWORD modules   | **TBD**                              | GPL tooling; licence implications need review before adoption |
| Markdown / HTML | Commentaries and user-supplied books | Sanitised                                                     |

## Compiler tool (`tools/resource-compiler`)

```
source (USFM dir) ──▶ parse ──▶ normalise ──▶ validate ──▶ emit SQLite ──▶ sign/checksum
```

Stages:

1. **Parse** into an intermediate AST (books → chapters → verses → inline runs).
2. **Normalise** — map book names to OSIS ids, resolve versification scheme,
   normalise whitespace and quotation marks, extract headings/footnotes/xrefs.
3. **Validate** — every declared book/chapter/verse present, no empty verses,
   verse keys monotonic, encoding is valid UTF-8 NFC.
4. **Emit** — write the resource DB, build FTS index, write `manifest.json`
   with per-file SHA-256.
5. **Report** — diff against the previous build; fail CI on unexpected verse-count changes.

Output is deterministic: same input → byte-identical DB (fixed page size, no
timestamps in content).

## Inline text markup

Verse text uses a minimal, safe inline format (not raw HTML) so the renderer
never injects untrusted markup:

```
The <wj>Son of Man</wj> came, <i>added word</i>, <n id="fn1"/> and said
```

Allowed tags: `wj` (words of Christ), `i` (translator-supplied), `sc` (small
caps / divine name), `n` (footnote marker), `q` (poetry indent level attr),
`b` (line break). The renderer maps these to components; anything else is
stripped at compile time.

## Import at runtime (FR-LB-02)

- User imports a `.vsres` file (zip containing `manifest.json` + DB + assets).
- App validates the manifest, verifies checksums, checks `schemaVersion`
  compatibility, extracts to `userData/resources/<id>/`.
- Import runs in a utility process; the archive is extracted with path
  traversal protection (reject entries with `..` or absolute paths), a size
  cap, and an entry-count cap (zip-bomb defence).
- Failed imports leave no partial directory (extract to temp, then atomic rename).

## Catalogue and download (FR-LB-03)

- A static, signed `catalog.json` served over HTTPS lists available resources
  with id, version, size, sha256, licence, and download URL.
- Catalogue signature verified with a bundled public key before use.
- Downloads are resumable, checksum-verified, and installed atomically.
- **TBD:** hosting (GitHub Releases vs object storage vs CDN).

## Indexing and search

- FTS index is built at compile time, shipped inside the resource DB — no
  first-run indexing cost.
- Cross-resource search fans out queries per enabled resource in the utility
  process and merges ranked results (BM25 with a per-resource weight).
- Query parsing: our own small parser → FTS5 MATCH expression, so user input is
  never concatenated raw into SQL.
- Diacritic-insensitive and case-insensitive by default; original-language
  resources use a dedicated tokenizer configuration.

## Versification mapping

- Mapping data ships as a compiled table: `(schemeA, keyA) → (schemeB, keyB)`.
- Source: an openly licensed mapping dataset (**TBD** — evaluate the
  `versification-mappings` / Copenhagen Alliance data and its licence).
- Unmappable references degrade to chapter-level with a UI indicator.
