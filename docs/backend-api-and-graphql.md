# Backend API And GraphQL

## Configuration

Environment defaults are in:

```text
src/lib/environment.ts
```

Config constants are in:

```text
src/lib/config.ts
```

Default backend:

```text
https://api-v2-dev.topmed.annoq.org
```

This branch (annoq-site#78) targets the **dev** TOPMed api-v2 — the only instance carrying the
`search_hrc` argument until the TOPMed cutover, when it becomes `https://api-v2.topmed.annoq.org`.

Relevant environment variables:

| Variable | Purpose |
| --- | --- |
| `VITE_ANNOQ_API_V2` | Preferred backend base URL. |
| `VITE_ANNOV_API_BASE` | Backward-compatible backend base URL. |
| `VITE_ANNOQ_DATASET` | Dataset name. |
| `VITE_ANNOQ_SNP_RESULTS_SIZE` | Result page size. |
| `VITE_ANNOQ_TERMS_DISPLAYED_SIZE` | Number of term-list values shown before overflow. |
| `VITE_ANNOQ_GENES_DISPLAYED_SIZE` | Number of gene-list values shown before overflow. |
| `VITE_ANNOQ_AMIGO_TERM_URL` | AmiGO term link base. |
| `VITE_ANNOQ_PUBMED_URL` | PubMed link base. |
| `VITE_ANNOQ_UCSC_URL` | UCSC browser link base. |
| `VITE_ANNOQ_GA_ID` | Google Analytics measurement id. |

## Schema Types (GraphQL Codegen)

Generated TypeScript types for the backend schema live in:

```text
src/generated/graphql.ts
```

This file is committed. Regenerate it whenever the backend schema changes:

```bash
npm run graphql_codegen
```

Config:

```text
graphql_codegen.ts
```

The config imports `environment.annotationApiV2` from `src/lib/environment.ts` and appends
`/graphql`, so the schema URL always follows the same setting the app uses. Under codegen,
`import.meta.env` maps to `process.env`, so a one-off override works:

```bash
VITE_ANNOQ_API_V2=https://api-v2.topmed.annoq.org npm run graphql_codegen
```

Note that `.env.local` files are **not** read during codegen. Only Vite loads those; the
codegen process sees the real shell environment and otherwise falls back to the default in
`src/lib/environment.ts`.

### How These Types Are Used

No runtime code imports them yet. Queries are built as strings in `src/lib/queryBuilder.ts`,
and response shapes are hand-written in `src/types.ts` because result columns are dynamic.
The generated file serves two purposes:

- **Schema diff.** Regenerate, then `git diff src/generated/graphql.ts` to see exactly what
  the backend added, renamed, or removed.
- **Reference.** `Query` lists every available function; `Query<Name>Args` types give the
  exact argument names to use in `QUERY_FUNCTIONS` and `buildArgs`.

Watch for name collisions when importing: both `src/types.ts` and `src/generated/graphql.ts`
export an `AggregationItem`. They are not identical — the generated one has
`doc_count: number` required and `missing?: DocCount`.

Annotation *fields* are not covered by codegen. Those come from the REST `/annotations`
endpoint at runtime, so a new annotation column needs no regeneration.

## API Helpers

File:

```text
src/lib/api.ts
```

Functions:

- `fetchAnnotations(signal?)`
- `graphqlRequest<TData>(query, signal?)`

`graphqlRequest` sends:

```http
POST {API_BASE}/graphql
content-type: application/json
```

Body:

```json
{ "query": "..." }
```

It throws on:

- Non-OK HTTP status.
- GraphQL errors.
- Missing `data`.

## Query Mode Function Map

The GraphQL function names are mapped in:

```text
src/lib/queryBuilder.ts
```

| Mode | Count | Page/SNPs | Aggs | Download |
| --- | --- | --- | --- | --- |
| `chromosome` | `count_SNPs_by_chromosome` | `get_SNPs_by_chromosome` | `get_aggs_by_chromosome` | `download_SNPs_by_chromosome` |
| `geneProduct` | `count_SNPs_by_gene_product` | `get_SNPs_by_gene_product` | `get_aggs_by_gene_product` | `download_SNPs_by_gene_product` |
| `rsID` | `count_SNPs_by_RsID` | `get_SNPs_by_RsID` | `get_aggs_by_RsID` | `download_SNPs_by_RsID` |
| `rsIDList` | `count_SNPs_by_RsIDs` | `get_SNPs_by_RsIDs` | `get_aggs_by_RsIDs` | `download_SNPs_by_RsIDs` |
| `vcf` | `count_SNPs_by_IDs` | `get_SNPs_by_IDs` | `get_aggs_by_IDs` | `download_SNPs_by_IDs` |

## Request Building

`buildRequest` combines:

- Base columns: `chr`, `pos`, `ref`, `alt`, plus the rsID field discovered from backend annotations.
- User-selected annotations
- Active filters

Then `buildPageQuery`, `buildCountsQuery`, `buildStatsQuery`, and `buildDownloadQuery` produce GraphQL strings.

## Base Columns

Configured in:

```text
src/lib/config.ts
src/lib/annotations.ts
```

`LOCKED_ANNOTATION_NAMES` contains `chr` and `pos`. Those two are always included in result fields:
`AnnotationSelectionProvider` folds them into every selection, so `buildRequest` requests exactly the
selection and adds nothing of its own.

`defaultSelectionForStore` additionally ticks `ref`, `alt` and the dataset's rsID field on first open,
but those are ordinary annotations — unticking one removes it from the query. The rsID column is not
hardcoded because different datasets expose different rsID field names; `buildAnnotationStore`
detects it and stores it as `store.rsidField`.

## Field Mapping

The user selects frontend annotation names. The backend may require `api_field`.

Before sending GraphQL:

```ts
apiFieldFor(field, store)
```

After receiving GraphQL:

```ts
nameForApiField(apiField, store)
```

Both helpers live in:

```text
src/lib/annotations.ts
```

## Pagination

Page queries include:

```graphql
page_args: { from_: N, size: PAGE_SIZE }
```

`PAGE_SIZE` defaults to 50.

The table only renders the current server page.

## Aggregates

Aggregate queries power:

- Column “with values” counts.
- Position range.
- Summary page.
- Stats panel.
- Filters.

For most fields the app requests:

- `doc_count`
- `missing`
- `frequency`

For `pos`, the app requests:

- `doc_count`
- `min`
- `max`
- `histogram`

## Downloads

The download query must send `fields` as a GraphQL array:

```graphql
fields: ["chr", "pos", "ref", "alt", "<detected rsID field>"]
```

Not as a quoted string:

```graphql
fields: "[\"chr\", \"pos\"]"
```

The frontend opens:

```text
{API_BASE}/download{pathFromBackend}
```

This matches the old Angular behavior.

## The `search_hrc` argument (annoq-site#78)

api-v2 runs Strawberry with `auto_camel_case=False`, so the argument is spelled `search_hrc`
verbatim in GraphQL documents — never camelCased. It is a standalone top-level argument, **not** a
member of `filter_args` or `page_args`.

Accepted by 21 operations: `get_SNPs_by_*`, `get_aggs_by_*`, `count_SNPs_by_*` and
`download_SNPs_by_*` for each of `chromosome`, `RsID`, `RsIDs`, `IDs` and `gene_product`, plus
`gene_info`. Rejected by the four `*_by_keyword` operations and by `annotations`.

When true it adds the subset filter `Mapped_in_HRC == "Y"` and flips the coordinate basis to hg19:
chromosome `start`/`end` match `pos_hg19`/`chr_hg19`, gene regions resolve to hg19, and VCF-id search
matches `HRC_chr_pos_ref_alt`. RSID search continues to match `rs_dbSNP`. **The response shape does
not change** — the flag only changes which documents match, so the hg19 columns must be selected
explicitly from the "HG19 Info" tree category.

In this codebase the flag lives on `QueryRequest.searchHRC` and is emitted from a single place,
`buildArgs()` in `src/lib/queryBuilder.ts`, which the page, counts, stats and download builders all
funnel through. It is omitted when false rather than sent as `search_hrc: false`.
