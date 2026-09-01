# 07 — Resource Pipeline

## Principles

- **Only open or licensed content.** Public-domain texts and openly licensed
  texts where terms permit redistribution.
- **No proprietary format reverse-engineering.** We do not read Logos, Accordance,
  or any encrypted/DRM resource format.
- Ingestion happens **offline in a build tool**, not in the shipped app. The app
  only consumes the compiled resource DB format from doc 06.
- **Licence terms are read at the source and recorded before anything ships.**
  Nothing below is authoritative; every entry needs verification against the
  publisher's current terms.

## Where resources come from

[get.bible/bible-data-sets](https://get.bible/bible-data-sets/) (American Bible
Society, `.BIBLE` registry) is a useful **discovery index** of data sets and
APIs. It is a directory, not a source — licences still apply per resource.

### v1 shortlist (D-26)

| Resource                        | Source                          | Licence               | Delivery  |
| ------------------------------- | ------------------------------- | --------------------- | --------- |
| KJV                             | eBible.org / Project Gutenberg  | Public domain\*       | Bundled   |
| **Berean Standard Bible (BSB)** | berean.bible                    | **Public domain** (30 Apr 2023, confirmed) | Bundled   |
| WEB / WEB British               | eBible.org, worldenglish.bible  | Public domain         | Catalogue |
| ASV                             | openbibleinfo ASV repo (USX)    | Public domain         | Catalogue |
| YLT, Darby, Webster, Geneva 1599 | eBible.org                     | Public domain         | Catalogue |
| Douay-Rheims, Catholic PD Version | GitHub USFM repos             | Public domain         | Catalogue |
| Matthew Henry (Concise)         | CCEL, htmlbible.com             | Public domain         | Catalogue |
| Jamieson-Fausset-Brown          | CCEL                            | Public domain         | Catalogue |
| **Cross-references**            | openbible.info (TSK-derived)    | Verify                | Bundled   |
| **Versification mapping**       | STEPBible **TVTMS**             | CC BY 4.0 — verify    | Bundled   |

\* The KJV is under **perpetual Crown copyright in the UK** (Cambridge/Oxford
letters patent); public domain elsewhere. Flagged, not resolved.

### Bulk sources worth preferring over raw scraping

| Source           | What it gives                                              |
| ---------------- | ---------------------------------------------------------- |
| **fetch.bible**  | 1,100+ translations, normalised USX 3+/USFM — least cleanup |
| **eBible.org**   | Hundreds of translations in USFM, per-translation licence pages |
| **open.bible**   | Biblica's CC-licensed texts, 700+ languages, USX/USFM      |
| **CCEL**         | Public-domain commentaries in ThML                          |
| **openbible.info** | Cross-references and place geocoding (atlas, v2)          |
| **STEPBible**    | Versification, tagged texts, lexicons (originals are v2)    |

### Deliberately not used

- **Bible Hub, StudyLight, Blue Letter Bible** — the underlying texts are public
  domain, but their site terms forbid scraping and their compilations are their
  own work. Use the original transcriptions instead.
- **CrossWire / SWORD modules** — distribution permission is frequently granted
  to CrossWire specifically and is not transferable. Also raises a GPL-2.0 vs
  GPL-3.0 question if the library were linked. Excluded for v1 (**E2**).
- **NET Bible, ESV, NIV, NASB, CSB, NKJV, NLT, LSB** — commercially licensed.
  See D-27 for why the online-API route is not taken either.

### Provenance record

The compiler maintains `tools/resource-compiler/LICENSES.md` recording, per
resource: source URL, retrieval date, stated licence, full licence text, and
any attribution string the terms require. `manifest.json` carries the same
licence text so it ships with the resource (FR-LB-05).

## Source formats

| Format          | Use                                  | Notes                                                         |
| --------------- | ------------------------------------ | ------------------------------------------------------------- |
| USFM / USX      | Primary import for Bibles            | Industry standard from Paratext/DBL                           |
| OSIS XML        | Secondary                            | Common for public-domain texts                                |
| Zefania / ThML  | Best-effort                          | Widely available legacy XML; CCEL commentaries are ThML        |
| SWORD modules   | **Excluded**                         | Licence chain not transferable — see above                    |
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
- **Source: STEPBible `TVTMS`** — "Versification Traditions with Methodology for
  Standardisation: Eng+Heb+Lat+Grk+Others" from Tyndale House. Covers OT
  differences across Hebrew, Latin and Greek traditions plus NT versification,
  compared against an English standard. Licence CC BY 4.0 — **verify before
  shipping**, and carry the attribution string. Resolves **E4**.
- Unmappable references degrade to chapter-level with a UI indicator.

## Cross-references

- Source: [openbible.info](https://www.openbible.info/labs/cross-references/) —
  roughly 340,000 cross-references compiled from public-domain sources,
  principally the Treasury of Scripture Knowledge.
- Compiled into the `cross_ref` table (doc 06) keyed by verse key, so a Bible
  panel can offer them inline without a separate resource.
- Licence terms need verification before shipping.

## Online-delivered resources (deferred — D-27)

Commercially licensed translations (ESV, LSB, NIV, NASB, CSB, NKJV, NLT) offer
free non-commercial **APIs**, but VerseScape does not use them in v1.

The model stays open: `manifest.json` carries
`deliveryMode: 'local' | 'online'`, defaulting to `local`. If an online resource
is ever added, these rules apply and are non-negotiable:

- It is **excluded from full-text search**, because a reference API cannot serve
  ranked full-text results. The UI must say so explicitly at the point of
  search — silent omission from results is a wrong answer, not a limitation.
- It is badged "online" in the Library and on its tab, and is unavailable in
  offline mode by design rather than by failure.
- It cannot be a member of a sync set unless the network is available, or the
  set breaks in a way that reads as a bug.
- Any API key is **supplied by the user**, never shipped. An open-source binary
  cannot hold a secret.
