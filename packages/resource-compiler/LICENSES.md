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

| Resource                               | Licence                 | Status                     | Obligation                                 |
| -------------------------------------- | ----------------------- | -------------------------- | ------------------------------------------ |
| Berean Standard Bible (BSB)            | CC0 1.0 / public domain | **Verified**               | None required; naming limit on derivatives |
| King James Version (KJV)               | Public domain by age    | **Verified (with caveat)** | None; UK Crown copyright caveat            |
| World English Bible (WEB)              | Public domain           | **Verified**               | Trademark limit on the name                |
| STEPBible **TVTMS** versification      | CC BY 4.0               | **Verified**               | Credit "STEP Bible" + link; record changes |
| openbible.info cross-references        | CC BY 4.0               | **Verified**               | Attribution                                |
| CCEL commentaries (Matthew Henry, JFB) | Presumed public domain  | **UNVERIFIED**             | Must be checked before M6                  |

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

## King James Version (KJV)

- **Source:** No licence document exists; public domain by age.
- **Retrieved:** 2026-09-01
- **Licence:** Public domain outside the United Kingdom.

**Caveat (open question E9):** within the UK the KJV is under perpetual Crown
copyright, administered through letters patent held by Cambridge University
Press and Oxford University Press. It is public domain everywhere else.

VerseScape is not distributed commercially (see D-02), which reduces but does not
formally eliminate this. Recorded as a known, accepted risk rather than a
resolved question.

**Obligation:** none.

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

---

## openbible.info cross-references

- **Source:** https://www.openbible.info/labs/cross-references/
- **Data:** https://a.openbible.info/data/cross-references.zip (~2 MB)
- **Retrieved:** 2026-09-01
- **Licence:** CC BY 4.0

> This data draws primarily from public-domain sources, especially the Treasury
> of Scripture Knowledge, which provides most of the data.

> Unless otherwise indicated, all content is licensed under a Creative Commons
> Attribution License.

**Obligation:** attribution to OpenBible.info.

**Note:** the page also carries ESV quotations, which are copyrighted by
Crossway. We take only the **reference data** — verse-key pairs — and no
Scripture text, so that copyright is not engaged.

---

## CCEL commentaries — NOT YET VERIFIED

- **Intended source:** https://www.ccel.org/ (Matthew Henry, Jamieson-Fausset-Brown)
- **Attempted:** 2026-09-01 — `ccel.org/copyright` and `ccel.org/info/copyright`
  could not be retrieved.
- **Status:** **unverified.**

Both works are almost certainly public domain by age (Henry d. 1714; JFB 1871).
The open question is whether CCEL asserts any rights over **its own
transcriptions and ThML markup**, which is a distinct claim from the underlying
text.

**Blocks M6.** Do not compile either commentary until this row is completed with
a quoted statement and a date.

---

## Outstanding

| Item                               | Why it matters                                        |
| ---------------------------------- | ----------------------------------------------------- |
| CCEL transcription terms           | Blocks compiling Matthew Henry and JFB (M6)           |
| Per-translation eBible rows        | Each text needs its own verified row before compiling |
| E9 — UK Crown copyright on the KJV | Accepted risk; non-commercial distribution only       |
