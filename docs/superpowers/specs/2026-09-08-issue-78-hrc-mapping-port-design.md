# Port of annoq-site #78 into annoq-site-v2 — design

**Date:** 2026-09-08
**Owning issue:** [USCbiostats/annoq-site#78](https://github.com/USCbiostats/annoq-site/issues/78)
**Target branch:** `annoq-site-78-add-hrc-mapping-info` (this repo, annoq-site-v2)
**Source of truth for the port:** `annoq-site` branch `issue-78-add-hrc-mapping-info`, and
`annoq-site/docs/issue-78-hrc-mapping.md` (the as-built handoff note)
**Coordination hub:** [USCbiostats/annoq-proj](https://github.com/USCbiostats/annoq-proj)

---

## What this is

annoq-site#78 is the **TOPMed-cutover umbrella**: its end state is a *single* site serving TOPMed
with HRC available as a filter, rather than HRC and TOPMed being two separate deployments. The work
was built and validated in `annoq-site` (Angular 9, the TOPMed beta UI at topmed.annoq.org). Because
stage 4 is split by repo, the same change has to exist in `annoq-site-v2` (React, the production UI
at annoq.org) before the cutover can happen. This document specifies that port.

Per annoq-proj's branch convention, annoq-site-v2 is **not** the owning repo, so the branch carries
the owning-repo prefix — `annoq-site-78-add-hrc-mapping-info` — and any commit message would read
`For #USCbiostats/annoq-site/issues/78`.

### Starting state

The target branch is currently **identical to `main`** (`ff077fe`). Nothing has been ported yet.
`ff077fe` moved `metadata/annotation_tree.csv` into this repo; that is unrelated to this port and
is not touched here.

---

## Why: the three layers

The annoq-site #78 diff is not one change but three, and they are ported for different reasons.

1. **The HRC filter feature.** The actual "add HRC mapping info" work: a *Search HRC data* checkbox
   that restricts results to the HRC-mapped subset of TOPMed and flips the coordinate basis to hg19.
2. **TOPMed retargeting.** The site must query a TOPMed api-v2 instance, because the HRC filter is
   meaningless against an HRC-only dataset — `Mapped_in_HRC` is a TOPMed field.
3. **Content and branding.** Once the site serves TOPMed, every page that says "~39 million variants
   from the Haplotype Reference Consortium" is wrong. Shipping 1 and 2 without 3 produces a site that
   describes one dataset and queries another.

All three are in scope.

---

## The api-v2 contract (verified, not assumed)

Introspected against `https://api-v2-dev.topmed.annoq.org/graphql` on 2026-09-08. api-v2 runs
Strawberry with `auto_camel_case=False`, so the argument name is used **verbatim** — never camelCased.

- **Argument:** `search_hrc: Boolean`, a standalone top-level argument on the query field. It is
  **not** a member of `filter_args` or `page_args`. Default off.
- **Accepted by 21 operations:** `get_SNPs_by_*`, `get_aggs_by_*`, `count_SNPs_by_*` and
  `download_SNPs_by_*` for each of `chromosome`, `RsID`, `RsIDs`, `IDs`, `gene_product` — plus
  `gene_info`.
- **Rejected by:** the four `*_by_keyword` operations, and `annotations` / `count_annotations` /
  `download_annotations` / `scroll_annotations`.
- **Behaviour when true:** adds the subset filter `Mapped_in_HRC == "Y"`; chromosome `start`/`end`
  match against `pos_hg19`/`chr_hg19`; gene regions resolve to hg19; VCF-id search matches
  `HRC_chr_pos_ref_alt`; RsID search continues to match `rs_dbSNP`. **The response shape does not
  change** — the flag only changes which documents match.

### The annotation tree on that endpoint

`/annotations` returns **839 annotations, 819 of them leaves** — the source of the "800+" figure on
the home page. Relevant leaves:

| Field | Tree category | Id |
|---|---|---|
| `Mapped_in_HRC`, `HRC_chr_pos`, `HRC_chr_pos_ref_alt` | `HG19 Info` (700) | 1201–1203 |
| `chr_hg19`, `pos_hg19`, `ref_hg19`, `alt_hg19` | `HG19 Info` (700) | 747–750 |
| `chr_pos` | `Basic Info` (1) | 1204 |
| `rs_dbSNP` | `Basic Info` (1) | 756 |

Because these are ordinary tree leaves, **no code is needed to expose them.** Users tick them like
any other column. This matches the as-built decision in annoq-site (its handoff note's item 4):
hg19/HRC columns are user-selected, not auto-added.

---

## What does NOT need porting

Two items in the annoq-site diff have no v2 counterpart, because v2 already solved them generically.
Recording them so a later reader does not "discover" them as gaps.

- **`initialSelectedIds` `[2,3,4,5,6]` → `[2,3,4,5,756]` and `rs_dbSNP151` → `rs_dbSNP`.**
  annoq-site hardcodes annotation ids, so switching datasets meant editing the list. v2's
  `findRsidField` (`src/lib/annotations.ts`) resolves the RSID field **by name** per dataset, and
  `defaultSelectionForStore` returns `chr, pos, ref, alt, <rsidField>`. Already correct on both
  stacks; `SearchWorkspace.test.tsx` already covers it.
- **The `selectItemsById` fix in `annotation.service.ts`.** annoq-site matched tree ids with
  `ids.toString().includes(...)`, a substring bug. v2's `AnnotationSelectionProvider` selects by
  name, so the bug does not exist.

Also out of scope: `metadata/annotation_tree.csv` (moved separately in `ff077fe`), and anything on
`main`.

---

## Layer 1 — the HRC filter feature

### Where the flag lives

`searchHRC: boolean` becomes a **top-level field on `SearchState` and `QueryRequest`, alongside
`filters`**.

This follows the precedent already in the codebase. `filters` is exactly this shape: a cross-cutting
query modifier that applies regardless of query mode, held outside `values`. `QueryFormValues` is
strictly the per-mode string inputs — `chrom`/`start`/`end` for chromosome mode, `rsID` for rsID mode
— and only one mode's values are ever rendered. A flag that applies across all modes does not belong
there.

The considered alternative was adding `searchHRC` to `QueryFormValues`, which would be roughly 15
lines smaller because it inherits the drawer's existing `updateValues → dispatch → buildRequest`
path. Rejected on modelling grounds: this codebase is deliberate about the distinction (see the
`LOCKED_ANNOTATION_NAMES` comment in `config.ts` on locked vs. default selection), and blurring it
is how that earlier bug shipped.

Changes:

- `src/types.ts` — `QueryRequest` gains `searchHRC: boolean`.
- `src/features/search/searchState.tsx` — `SearchState` gains `searchHRC: boolean` (initial
  `false`); a `{ type: 'setSearchHRC'; searchHRC: boolean }` action and reducer case.
- `src/features/search/SearchWorkspace.tsx` — `submitSearch` takes the flag and passes it to
  `buildRequest`.
- `src/lib/queryBuilder.ts` — `buildRequest` accepts and records it.

### Threading it into the queries

The whole of the query-side change lands in **one function**: `buildArgs(request)` in
`src/lib/queryBuilder.ts`. `buildPageQuery`, `buildCountsQuery`, `buildStatsQuery` and
`buildDownloadQuery` all funnel through it, so count / snps / aggs / stats / download are covered by
a single edit. (annoq-site had to repeat the flag across each args object, which is why its download
path never got it.)

```ts
function buildArgs(request: QueryRequest): Record<string, unknown> {
  // Omitted for keyword: api-v2's *_by_keyword operations do not accept the
  // argument. Omitted when false rather than sent as `search_hrc: false`, so a
  // default search produces a byte-identical query string to before this change.
  const hrc = request.searchHRC && request.mode !== 'keyword' ? { search_hrc: true } : {};
  switch (request.mode) {
    case 'chromosome':
      return { chr: ..., start: ..., end: ..., ...hrc };
    // ...
  }
}
```

Two rules, both deliberate:

- **Omit for `keyword` mode.** The API rejects the argument on `*_by_keyword`. `ENABLE_KEYWORD_SEARCH`
  is currently `false`, but the code path exists and must stay correct.
- **Omit when false**, rather than sending `search_hrc: false`. api-v2's default is already off, so
  the two are equivalent to the server — but omitting means every existing query string is unchanged
  when the box is off, so no existing `queryBuilder.test.ts` expectation churns and the default
  behaviour is provably untouched.

`formatValue` already renders booleans correctly via its `String(value)` fallback; no change needed.

`buildGeneInfoQuery(gene)` gains a second parameter and emits `search_hrc: true` when set. Its caller
in `SearchWorkspace.tsx` passes `request.searchHRC`.

### The UI

In `src/features/search/QueryDrawer.tsx`:

- An MUI `FormControlLabel` + `Checkbox` labelled **"Search HRC data"**, placed directly under the
  Query Type row so it reads as a modifier applying to every mode. Hidden when
  `mode === 'keyword'`, matching the API contract.
- When checked, a caption below it: *"Searching HRC r1.1 mapping — coordinates are hg19 (GRCh37)."*
- When checked, the chromosome mode's `Start` / `End` `TextField` labels become **"Start (hg19)"** /
  **"End (hg19)"**. In HRC mode the inputs are interpreted against `pos_hg19`, so collecting them
  under an unqualified label would be wrong.

No results-table or column-config change — see "the annotation tree on that endpoint" above.

---

## Layer 2 — TOPMed retargeting

- **`src/lib/environment.ts`**
  - `annotationApiV2` default → `https://api-v2-dev.topmed.annoq.org`.
  - `dataset` default → `annoq-annotations-tm-20260828`.
- **`src/lib/config.ts`** — `GENOME_BUILD` → `'GRCh38/hg38'`, and rewrite the comment above it. It
  currently reads that the hardcoded value is a known limitation *because* it is wrong when pointed
  at TOPMed; after this change the polarity is inverted and the comment must say so, or it actively
  misleads.
- **`README.md`** — the `VITE_ANNOQ_API_V2` examples.

Three notes for whoever executes this:

- **`environment.dataset` is declared but consumed nowhere in v2.** Grep confirms it appears only in
  its own definition. Porting the value is a config-only change with no runtime effect; do not spend
  time looking for what it drives.
- **The dev endpoint is deliberate and temporary.** Only `api-v2-dev.topmed.annoq.org` carries
  `search_hrc` today; the deployed `api-v2.topmed.annoq.org` runs the issue-19 line and would make
  the checkbox return a GraphQL error. At cutover this becomes a one-line flip to
  `https://api-v2.topmed.annoq.org`. `VITE_ANNOQ_API_V2` still overrides at run time either way.
- **`environment.ucscUrl` already uses `db=hg38`** and is correct for TOPMed. Leave it. (It is not
  adjusted for HRC mode either — the UCSC link is built from the row's `chr`/`pos`, which remain
  hg38 fields regardless of the filter.)

---

## Layer 3 — content and branding

### `src/pages/StaticPages.tsx`

| Line(s) | Change |
|---|---|
| 37–39 | `~39 million` → `> 700 million`; HRC link → TOPMed Freeze 8 |
| 44 | `600+` → `800+` supported annotation types |
| 50–56 | The "AnnoQ now supports TOPMed" band — see below |
| 107 | `iconHref="https://api-v2.annoq.org/docs"` → the derived `API_DOCS_URL` |
| 146, 156 | Partners/collaborators HRC references |
| 228–235 | The About paragraph: TOPMed Freeze 8, PEREGRINE, and the three access routes |

Two of these deserve explanation.

**Line 107 becomes `API_DOCS_URL`, not a hardcoded TOPMed URL.** `config.ts` already derives
`API_DOCS_URL` from `API_BASE` precisely so the site never advertises an API it is not querying —
that was issue #20's resolution. Swapping one hardcoded host for another would reintroduce the
problem this branch makes acute.

**The "AnnoQ now supports TOPMed" band (lines 50–56) must be reworded, not just edited.** It
currently announces TOPMed as a beta living *elsewhere* and links out to `https://topmed.annoq.org/`.
On the cutover branch that link is self-referential and the framing is inverted: this site *is*
TOPMed, with HRC as a filter. This has no counterpart in the annoq-site diff — annoq-site never had
the band — so it is new copy, not a port.

### Other content

- **`src/data/staticContent.ts`** — the v1.3 "New API release" entry's API link and annoq-py link.
- **`public/assets/docs/`** — `services/api.md`, `services/index.md`, `tutorials/annoq-py.md`,
  `tutorials/r-package.md`, `tutorials/ui-query.md`, `index.md`. Four kinds of edit: HRC → TOPMed
  Freeze 8 prose; `api-v2.annoq.org` → the TOPMed API; `rs_dbSNP151` → `rs_dbSNP` in every code
  sample; and absolute `https://annoq.org/...` links → site-relative (`/search`, `/detail`), which
  is what annoq-site did and is correct for a site that may be served from more than one host.
- **`src/App.tsx` + `src/styles.css`** — a "TopMed Beta Release" button linking to `/version`, and
  the amber (`#fff3cd`) app bar that marks the beta.
- **`public/assets/images/annoq_workflow.png`** — refreshed from annoq-site. Only the `.png` is
  referenced in v2 (`StaticPages.tsx:238`); the unused `annoq_workflow.svg` can be left alone.

---

## Testing

Vitest, via `npm run test`.

- **`src/lib/queryBuilder.test.ts`** — `search_hrc: true` appears for each of the five non-keyword
  modes; is absent for keyword; is absent when the flag is off (guarding the byte-identical-default
  property); appears on the counts, stats and download queries; and appears on `gene_info`.
- **`src/features/search/QueryDrawer.test.tsx`** — the checkbox renders and is hidden in keyword
  mode; the hg19 hint and the "(hg19)" Start/End labels appear only when checked; the submitted
  request carries the flag. **The existing assertion at line 103 expects `GRCh37/hg19` and must be
  updated** to `GRCh38/hg38`.
- **`src/features/search/SearchWorkspace.test.tsx`** — `submitSearch` propagates the flag.
- **`src/pages/StaticPages.test.tsx`** — the TOPMed copy assertions.

Then `npm run build` (`tsc -b && vite build`), and a manual check with `npm run dev` against the dev
endpoint: toggle the box, confirm a chromosome search returns only HRC-mapped records in hg19
coordinates, and that unchecking restores full-dataset hg38 results.

---

## Sequencing

**Codegen runs first.** `npm run build` is `tsc -b && vite build` and typechecks against
`src/generated/graphql.ts`; until that file carries `search_hrc`, nothing downstream compiles.

1. **Regenerate types.** Temporarily point `graphql_codegen.ts` at
   `https://api-v2-dev.topmed.annoq.org/graphql`, run `npm run graphql_codegen`, then **revert
   `graphql_codegen.ts`** so it goes back to deriving the URL from `environment.annotationApiV2`.
   The reverted file plus the retargeted `environment.ts` (step 2) reach the same endpoint anyway.
   The annoq-site branch is a cautionary case here: its `graphql_codegen.ts` is still committed
   pointing at `localhost:8001`.
2. **Layer 2** — environment and config. Do this before layer 1 so the app is actually talking to a
   TOPMed instance while the feature is built.
3. **Layer 1** — `types.ts` → `searchState.tsx` → `queryBuilder.ts` → `SearchWorkspace.tsx` →
   `QueryDrawer.tsx`, then its tests.
4. **Layer 3** — content, docs markdown, branding.
5. **Verify** — `npm run test`, `npm run build`, manual toggle check.
6. **Repo docs** — update this repo's `docs/` (`search-query-ui.md`, `backend-api-and-graphql.md`,
   `project-overview.md`) to describe the checkbox and the `search_hrc` contract, then run
   annoq-proj's `/annoq-doc-sync` so the cross-repo docs do not drift.

---

## Constraints and non-goals

- **No git operations.** Per explicit instruction, nothing is committed, staged, or pushed. All
  changes are left in the working tree for review via `git diff`. This includes this document.
- **Nothing is pushed to GitHub**, and no PR is opened.
- **`main` is not touched.** The work is confined to `annoq-site-78-add-hrc-mapping-info`.
- **The dev API default is a branch-local choice**, not a proposal for `main`. Merging this to `main`
  as-is would repoint annoq.org at a dev TOPMed instance; the cutover flip to
  `api-v2.topmed.annoq.org` is a prerequisite of any such merge.
- **No api-v2, data-builder or database changes.** Those sides of #78 are already implemented on
  their own `annoq-site-78-add-hrc-mapping-info` branches.
