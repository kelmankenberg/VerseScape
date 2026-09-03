# Resource provenance and licences

Evidence for NFR-14: every resource VerseScape compiles or ships must have its
licence read **at the source**, quoted verbatim, and dated. This file is that
record.

Nothing here is legal advice. Where a statement is ambiguous it is marked as
such rather than resolved.

**Conventions**

- _Retrieved_ is the date the statement below was read from the source URL.
- _Obligation_ is what we must actually do — attribution text, naming limits,
  or nothing at all.
- A resource may not be compiled into a shipped `.vsres` until its row here is
  marked **Verified**.

---

## Summary

| Resource                          | Licence                 | Status                     | Obligation                                                     |
| --------------------------------- | ----------------------- | -------------------------- | -------------------------------------------------------------- |
| Berean Standard Bible (BSB)       | CC0 1.0 / public domain | **Verified**               | None required; naming limit on derivatives                     |
| BSB Translation Tables (Strong's alignment) | CC0 1.0 / public domain | **Verified**        | None required                                                   |
| King James Version (KJV)          | Public domain by age    | **Verified (with caveat)** | None; UK Crown copyright caveat                                |
| World English Bible (WEB)         | Public domain           | **Verified**               | Trademark limit on the name                                    |
| STEPBible **TVTMS** versification | CC BY 4.0               | **Verified**               | Credit "STEP Bible" + link; record changes                     |
| STEPBible **TBESH/TBESG** lexicons | CC BY 4.0              | **Verified**               | Credit STEPBible; record transformation                         |
| openbible.info cross-references   | CC BY 4.0               | **Verified**               | Attribution                                                    |
| CCEL (as a source)                | Text is public domain   | **Verified**               | Attribution (courtesy); take text only, never their formatting |
| Matthew Henry / JFB (the works)   | Public domain by age    | **Verified**               | Confirm the edition is not a CCEL exception                    |

---

## Berean Standard Bible (BSB)

- **Source:** https://berean.bible/terms.htm (also https://berean.bible/licensing.htm)
- **Retrieved:** 2026-09-01
- **Licence:** CC0 1.0 Universal — public domain dedication

> Terms and Conditions:
>
> The Berean Bible and Majority Bible texts are officially dedicated to the
> public domain as of April 30, 2023.
>
> All uses are freely permitted.
>
> Attribution Notice (appreciated but not required):
>
> The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with
> Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation
> Committee. This text of God's Word has been dedicated to the public domain.

> Derivatives and Adaptations
>
> By definition all public domain materials may be freely reproduced,
> integrated, and adapted for both free and commercial resources. All
> applications that maintain the verbatim text from the above Berean sites are
> invited to bear the Berean name. […] For derivative works that vary from the
> official text, we respectfully request that the Berean name is not used.

**Obligation:** none is required. We will carry the attribution notice anyway,
since it costs nothing and is courteous.

**Constraint to respect:** we may call it "Berean Standard Bible" only while the
text is verbatim. The compiler must not alter wording — markup normalisation is
fine, editorial change is not. If we ever modify the text, the resource must be
renamed.

---

## BSB Translation Tables (Strong's alignment)

- **Source:** https://bereanbible.com/bsb_tables.tsv
- **Terms:** same as the BSB text above (https://berean.bible/terms.htm,
  https://berean.bible/licensing.htm) — the translation tables are published by
  the same project under the same CC0 1.0 dedication.
- **Retrieved:** 2026-09-03
- **SHA-256:** `09bbee6f9fe4fa22b5df28e8a9ffa99bf9c33435f4eb8c47c2dc221d855d35cb`
- **Licence:** CC0 1.0 Universal — public domain dedication

**Purpose:** the BSB USFM text does not itself carry per-word Strong's numbers
(unlike the KJV USFM, which does). The Translation Tables are a
verse-by-verse, word-by-word interlinear alignment of the BSB against the
underlying Hebrew/Greek, published separately by the same project. The
resource compiler (`bsb-tables.ts`) uses this file to inject `<s n="…"/>`
markers into the BSB verse text via best-effort tokenised alignment; it does
not alter any BSB wording, only annotates it.

**Obligation:** none is required.

**Constraint to respect:** the injected markup must never change the
verbatim BSB wording — only add non-visible `<s n="…"/>` annotations, per the
same naming constraint as the BSB text itself.

---

## King James Version (KJV)

- **Source:** https://ebible.org/find/details.php?id=eng-kjv2006
- **Data:** https://ebible.org/Scriptures/eng-kjv2006_usfm.zip
- **Retrieved:** 2026-09-01
- **Licence:** Public domain outside the United Kingdom.

The selected archive is eBible's standardized 1769 text, **protocanon only**,
with Strong's numbers added. The compiler retains those per-word Strong's
attributes as restricted `<s>` metadata alongside the display text. The similarly named `eng-kjv` archive includes the
Apocrypha and is not used.

**Caveat (open question E9):** within the UK the KJV is under perpetual Crown
copyright, administered through letters patent held by Cambridge University
Press and Oxford University Press. It is public domain everywhere else.

VerseScape is not distributed commercially (see D-02), which reduces but does not
formally eliminate this. Recorded as a known, accepted risk rather than a
resolved question.

**Obligation:** none.

## STEPBible — TBESH/TBESG Strong's lexicons

- **Source:** https://github.com/STEPBible/STEPBible-Data/tree/master/Lexicons
- **Data:** TBESH and TBESG tab-separated text files
- **Retrieved:** 2026-09-02
- **SHA-256:** TBESH `464dccadd95fd8620dd05fa0d7a4caba58ec3c4d5db3ebf38e43d046ca25b591`; TBESG `312f723d7b8ef263bbdfb0451c9b8057125804dfff390b6f8544cff2a84b57f4`
- **Licence:** CC BY 4.0

The brief Hebrew and Greek lexicons provide definitions for extended Strong's
numbers. VerseScape stores the source record in a local SQLite entry table and
strips its HTML tags for the panel's plain-text definition display. The source
records are not editorially changed.

**Obligation:** credit STEPBible and retain the source and transformation record.

---

## World English Bible (WEB) and other eBible.org texts

- **Source:** https://ebible.org/legal.php
- **Retrieved:** 2026-09-01
- **Licence:** varies per translation; WEB is public domain.

> These sites contain a mixture of copyrighted and Public Domain works. The
> copyrighted works are individually licensed for use on this site, each with
> their own terms agreed to by the copyright owners. Unless they are posted
> along with a license statement that specifically allows your intended copying
> activity, and which you agree to be bound by, you may not copy them without
> getting permission from the copyright owners.

> You may copy any Public Domain work freely, and in any format you please.

> "World English Bible" is a trademark. Permission is granted to use the name
> "World English Bible" and its logo only to identify faithful copies of the
> Public Domain translation of the Holy Bible of that name published at
> eBible.org and WorldEnglish.Bible. The World English Bible is not copyrighted.

**Obligation:** none for the text. The **name** is trademarked, so the same rule
as the BSB applies — we may call it "World English Bible" only for a faithful
copy.

**Process requirement:** eBible hosts both public-domain and licensed texts, and
the policy puts the burden on us:

> Check the "about" page associated with each Bible translation or other work on
> this site for more information about the copyright and permission status of
> that particular work.

So **each eBible translation needs its own row in this file before it is
compiled.** "It came from eBible" is not evidence of anything.

---

## STEPBible — TVTMS versification data

- **Source:** https://github.com/STEPBible/STEPBible-Data
- **Pinned commit:** `02843f07cbb5009e00999a7c0efead6430dbb6e7`
- **Source SHA-256:** `63058e0f20201af4bdaa7d830da5be8f493455d947c5f147d84840b33db9ddf8`
- **Retrieved:** 2026-09-01
- **Licence:** CC BY 4.0

Note the repository is `STEPBible/STEPBible-Data`, not `tyndale/…` as doc 07
originally recorded.

> # STEPBible Data Repository CC BY 4.0
>
> Data created initially by Tyndale House Cambridge, now curated by
> www.STEPBible.org

> This public licence allows you to:
>
> - Include any part of STEPBible-Data in any software or publications without
>   requesting permission
> - Make changes to the data and record the differences. […] Any changes made to
>   data should be recorded and made available to subsequent users.
> - Refer others to this repository as the source of the data.
>
> And you should:
>
> - Credit it to "STEP Bible" linked to www.STEPBible.org

**Obligations:**

1. Credit **"STEP Bible"** with a link to `www.STEPBible.org`, in the resource
   manifest and visibly in the Library (FR-LB-05).
2. If we transform the versification tables — and we do, into a compiled mapping
   table — **record the changes and make them available.** The compiler's
   transformation code being in this GPL repository satisfies that, provided the
   transformation stays inspectable.

**Transformation record:** the compiler reads only the source's
machine-oriented **Expanded** section. Its semantic columns 1–9 are copied to
indexed SQLite rows without correction or inference. Conditional `Tests`,
actions and subverse markers are preserved verbatim. Empty padding columns
10–13, explanatory prose, the human-oriented Condensed section, and notes
outside Expanded are omitted. The pinned source produces **22,874 mappings**.
The exact recipe is `resources/recipes/tvtms.json`; implementation and tests are
in `packages/resource-compiler/src/tvtms.ts` and `tvtms.test.ts`.

---

## openbible.info cross-references

- **Source:** https://www.openbible.info/labs/cross-references/
- **Data:** https://a.openbible.info/data/cross-references.zip (~2 MB)
- **Retrieved:** 2026-09-01
- **Archive SHA-256:** `aafb5bbad45f9b70e9ad67aef393c1987e61950f266d62aba8823f222b6558bf`
- **Licence:** CC BY 4.0

> This data draws primarily from public-domain sources, especially the Treasury
> of Scripture Knowledge, which provides most of the data.

> Unless otherwise indicated, all content is licensed under a Creative Commons
> Attribution License.

**Obligation:** attribution to OpenBible.info.

**Note:** the page also carries ESV quotations, which are copyrighted by
Crossway. We take only the **reference data** — verse-key pairs — and no
Scripture text, so that copyright is not engaged.

**Transformation record:** `From Verse` and `To Verse` references are converted
to VerseScape's canonical integer keys. Target ranges and signed `Votes` are
preserved; no prose or Scripture text is imported. The pinned archive emits
**344,799 rows**. Recipe and implementation are recorded in
`resources/recipes/cross-references.json` and
`packages/resource-compiler/src/cross-references.ts`.

---

## CCEL — CLEARED (text is public domain; their files are not)

- **Source:** https://www.ccel.org/about/copyright.html
- **Clarification received:** 2026-09-01, by email from Quincy at CCEL
- **Status:** **Verified.** Redistributable, because the basis is the public
  domain status of the works — not a licence grant from CCEL.

The published policy reads:

> These books may be used for personal, educational, or non-profit purposes.
> Contact us for permission to republish CCEL works or to use them commercially.

CCEL clarified what that covers, verbatim:

> That being said, the texts of nearly all of the works on CCEL.org are public
> domain; CCEL.org claims copyright on the _files_ we create and distribute. In
> other words, quoting or translating books on our site is generally fine; the
> most important thing we restrict is selling our files, the formatting
> contained within those files, or some derivative thereof.
>
> Of course, when using our works, mentioning our site somewhere in your
> publication is always deeply appreciated by us, as is any donation from your
> proceeds.

### What this means

Their claim is over **the files and the formatting**, not the text. Since
Matthew Henry (d. 1714) and Jamieson-Fausset-Brown (1871) are public domain, we
may use the text freely and our recipients may redistribute it. `redistributable`
is therefore `true`, and the resource licence is **PublicDomain** — CCEL is
recorded as the _source_, not the licensor.

### Binding constraint on the compiler

We must take **text only** and discard CCEL's formatting. Their restriction
covers "the formatting contained within those files, or some derivative
thereof", so a compiled resource must not reproduce their ThML structure or
presentational choices.

The pipeline already satisfies this: doc 07 reduces every source to our own
restricted inline markup (`wj`, `i`, `sc`, `n`, `q`) at compile time. That rule
was written for security reasons, and it happens to be exactly what is required
here. **It must not be relaxed for ThML input.**

### Obligation

Attribution is _appreciated but not required_. We do it anyway: CCEL is credited
in the About dialog alongside the other resource sources.

### Still to confirm

CCEL says "nearly all" works are public domain, and their policy notes that a
few titles are used under another publisher's copyright, "noted on the book
information page". Before compiling, check the book information page for the
specific Matthew Henry and JFB editions used and confirm neither is one of the
exceptions.

---

## Outstanding

| Item                                                   | Why it matters                                        |
| ------------------------------------------------------ | ----------------------------------------------------- |
| Confirm the Henry/JFB editions are not CCEL exceptions | "Nearly all" works are public domain; a few are not   |
| Per-translation eBible rows                            | Each text needs its own verified row before compiling |
| E9 — UK Crown copyright on the KJV                     | Accepted risk; non-commercial distribution only       |
