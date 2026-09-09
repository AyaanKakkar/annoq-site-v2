# Propagating annoq-site#78 to the api-v2 consumers — design

**Date:** 2026-09-08
**Owning issue:** [USCbiostats/annoq-site#78](https://github.com/USCbiostats/annoq-site/issues/78)
**Companion spec:** [`2026-09-08-issue-78-hrc-mapping-port-design.md`](2026-09-08-issue-78-hrc-mapping-port-design.md) (the annoq-site-v2 site port)
**Repos touched:** `annoq-py`, `AnnoQR`, `annoq-site-v2` (docs only), `annoq-proj` (docs only)
**Explicitly NOT touched:** `Annoq_Overrepr_Workflow` (SNPWay)

> This spec lives in annoq-site-v2 alongside its companion for convenience, but the work it
> describes is cross-repo. Nothing here is an annoq-site-v2 code change.

---

## Why

`search_hrc` is not a site feature — it is an **api-v2 contract change**. api-v2 is the platform's
public boundary, and four things consume it: the two web UIs, two client libraries, and SNPWay.
The companion spec covers the UI. This one covers the rest, so that a user who can restrict a
search to the HRC subset in the browser can do the same from R and Python.

It also fixes a documentation gap that let this happen quietly: annoq-proj's architecture doc lists
the consumers, but its **"Where a change lives" table stops at stage 4** and never says that an
api-v2 contract change fans out to clients. That omission is why consumer propagation is being
retrofitted rather than planned.

---

## Scope decisions (agreed 2026-09-08)

| Decision | Choice | Reason |
|---|---|---|
| Client base branch | **`main`** in each library | The `annoq-site-19-update-for-topmed` branches are stale — last touched 2026-03-02 versus main's 2026-04-29 — and predate the SNPWay workflow functions. Branching there would ship libraries missing a quarter of their API. |
| Working copies | Cloned as siblings | `annoq-py` and `AnnoQR` are now checked out at `/home/muruganu/projects/temp/top_med/`. SNPWay is deliberately not cloned. |
| Default base URL | **Unchanged** (`https://api-v2.annoq.org`) | Not retargeted to TOPMed: the host itself serves TOPMed after cutover, so retargeting is churn. But see the correction below — it must become *overridable*. |
| SNPWay code | **Out of scope** | Handled by [Annoq_Overrepr_Workflow#9](https://github.com/USCbiostats/Annoq_Overrepr_Workflow/issues/9), which covers its front and back end. Documentation elsewhere that mentions SNPWay is still updated here. |
| Tests | New suites introduced | Neither library currently has one. |

### Correction to the working assumption

The scope discussion assumed both libraries already accept an environment override for the base URL.
**They do not on `main`.** `annoq-py/annoq/api.py` has `BASE_URL = "https://api-v2.annoq.org"` and
`AnnoQR/R/annoqr.R` has `BASE_URL <- "https://api-v2.annoq.org"` — both hardcoded. The
`ANNOQ_BASE_URL` / `ANNOQR_BASE_URL` overrides and AnnoQR's `annoq_api_url()` helper exist **only on
the stale issue-19 branches**, and are exactly the kind of improvement lost by branching off main.

This changes the work: with no override there is **no way to point either library at
`api-v2-dev.topmed.annoq.org`**, which is the only instance carrying `search_hrc` — so the feature
could not be exercised at all. Making the base URL configurable is therefore a prerequisite of this
work, not an optional extra. The *default* still does not change, which is what was actually decided.

---

## The api-v2 REST contract (verified, not assumed)

Introspected from `https://api-v2-dev.topmed.annoq.org/openapi.json` on 2026-09-08. Nine endpoints
accept `search_hrc`; one does not:

| Endpoint | `search_hrc` |
|---|---|
| `GET /snp/chr`, `GET /snp/rsidList`, `GET /snp/gene_product` | yes |
| `GET /count/chr`, `GET /count/rsidList`, `GET /count/gene_product` | yes |
| `POST /snp/chr/download`, `POST /snp/rsidList/download`, `POST /snp/gene_product/download` | yes |
| `GET /snpAttributes` | **no** |

`/snpAttributes` mirrors the GraphQL `annotations` exclusion: the annotation tree is a property of
the index, not of a result set, so subsetting it is meaningless.

Semantics are identical to the GraphQL argument: it adds `Mapped_in_HRC == "Y"` and flips the
coordinate basis to hg19 (chromosome positions match `pos_hg19`, gene regions resolve to hg19). The
response shape is unchanged, so hg19 values must be requested explicitly via `fields` — they live
under the "HG19 Info" category as `Mapped_in_HRC`, `HRC_chr_pos`, `HRC_chr_pos_ref_alt`, `chr_hg19`,
`pos_hg19`, `ref_hg19`, `alt_hg19`.

---

## Which functions get the parameter

Both libraries have the same three-way split. This is the single most important scoping fact here:

| Group | annoq-py | AnnoQR | `search_hrc`? |
|---|---|---|---|
| api-v2 SNP search + count | `get_snps_by_chr`, `get_snps_by_rsid_list`, `get_snps_by_gene_product`, `count_snps_by_chr`, `count_snps_by_rsid_list`, `count_snps_by_gene_product` | `regionQuery`, `rsidsQuery`, `geneQuery`, `countRegionQuery`, `countRsidsQuery`, `countGeneQuery` | **Yes** — 6 per library |
| Annotation metadata | `get_snp_attributes` | `snpAttributesQuery` | **No** — endpoint rejects it |
| SNPWay workflows | `get_snpway_gene_mappings`, `run_snpway_overrepresentation_workflow` | `snpwayGeneMappingsQuery`, `snpwayOverrepresentationWorkflowQuery` | **No** — these call `snpway.annoq.org`, not api-v2 |

The SNPWay wrappers are the reason the exclusion has to be deliberate rather than incidental: they
are *in* the client libraries but do not talk to api-v2 at all, so `search_hrc` has nowhere to go
until Annoq_Overrepr_Workflow#9 adds it to SNPWay itself.

### The `fetch_all` subtlety

The three search functions have two call paths each. With `fetch_all=True` (`fetch_all = TRUE`) they
switch from `GET /snp/<mode>` to `POST /snp/<mode>/download`. Both paths build from the **same**
`params` dict, so adding the flag to that dict before the `fetch_all` branch covers both — but a
test must cover both, because getting this wrong yields a filter that silently stops applying to
exactly the large result sets users most want it for.

---

## Behaviour

`search_hrc` defaults to off and is **omitted from the request when false**, never sent as
`search_hrc=false`. This matches the site port and keeps every existing call byte-identical on the
wire, so the change cannot alter current behaviour. When true it is sent as the string `"true"`.

---

## Per-repo work

### annoq-py

- Make `BASE_URL` resolve from `ANNOQ_BASE_URL`, defaulting to `https://api-v2.annoq.org`.
- Add `search_hrc: bool = False` to the six api-v2 functions; set `params["search_hrc"] = "true"`
  only when true, before the `fetch_all` branch.
- Introduce pytest with `responses` for HTTP mocking (it patches `requests`, which this library uses), in the `dev` optional-dependency group
  alongside the existing `ruff`. **No test may make a live network call.**
- README: document the parameter and the hg19 flip; replace `rs_dbSNP151` with `rs_dbSNP` in field
  examples; state that the SNPWay functions do not accept it.

### AnnoQR

- Make `BASE_URL` resolve from `ANNOQR_BASE_URL` and port the `annoq_api_url()` getter/setter from
  the issue-19 branch, with its roxygen block and `@export`.
- Add `search_hrc = FALSE` to the six api-v2 functions, same omit-when-false rule.
- Introduce testthat (>= 3.2.0) in `Suggests`, using its own `with_mocked_bindings` to intercept
  `httr::GET`/`httr::POST`. Not `httptest2` — that targets `httr2`, and AnnoQR imports `httr`.
- Regenerate `man/*.Rd` from roxygen. The man pages are **build artifacts** — they are updated by
  regenerating, not by hand-editing, and `NAMESPACE` needs `annoq_api_url` exported.
- README: same content changes as annoq-py.

### annoq-site-v2 (documentation only)

`public/assets/docs/docs/tutorials/annoq-py.md` and `.../r-package.md` gain a "Restricting a search
to the HRC subset" section mirroring the one the companion plan adds to `services/api.md`, including
the note that the SNPWay functions are excluded pending Annoq_Overrepr_Workflow#9.

**Amendment to the companion plan:** its Tasks 5 and 6 link to the `annoq-site-19-update-for-topmed`
branches of both libraries. Since the work now branches off `main`, those links must point at
`annoq-site-78-add-hrc-mapping-info` instead, reverting to plain repo URLs once merged. This is
recorded in that plan's "Deferred to cutover" section.

### annoq-proj (documentation only)

- `docs/architecture.md`
  - Add `search_hrc` to the shared-contracts section.
  - Add a **"Propagating an api-v2 contract change"** checklist naming all four consumers, with the
    current status of this one: shipped in annoq-site + annoq-site-v2 + annoq-py + AnnoQR, pending in
    SNPWay under Annoq_Overrepr_Workflow#9.
  - Extend the **"Where a change lives"** table with a row for API-contract changes that fan out to
    consumers. This is the gap that made the omission possible.
- `docs/repositories.md` — one factual correction and one addition:
  - It states AnnoQR defaults to `enrichment-dev.annoq.org`. On `main` the default is
    `https://api-v2.annoq.org`.
  - Neither library's base-URL environment variable is documented; both should be.

---

## Testing

Each library gets tests asserting, for all six functions:

1. `search_hrc=true` appears in the request when the flag is set.
2. No `search_hrc` key appears at all when it is not.
3. Both the paginated and the `fetch_all`/download path carry it.
4. The annotation-metadata function does not accept or send it.

All HTTP is mocked. A single manual smoke call against `api-v2-dev.topmed.annoq.org` confirms the
wire format end to end, and is a verification step rather than a test.

---

## Constraints and non-goals

- **No git operations.** No branches, commits, or pushes — in any repo, including the two fresh
  clones. Changes are left in each working tree for review. The intended branch name when the user
  does commit is `annoq-site-78-add-hrc-mapping-info` in both libraries (non-owning-repo convention),
  with commit messages `For #USCbiostats/annoq-site/issues/78`.
- **No SNPWay code changes**, and the repo is not cloned.
- **No default endpoint retargeting** in either library.
- **No release or version bump** of either library.
- The libraries' SNPWay wrapper functions are untouched.
