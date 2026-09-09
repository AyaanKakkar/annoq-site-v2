# Issue #78 HRC Mapping Port (annoq-site → annoq-site-v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port all three layers of annoq-site#78 — the "Search HRC data" filter, TOPMed retargeting, and the TOPMed content/branding — into annoq-site-v2 on branch `annoq-site-78-add-hrc-mapping-info`.

**Architecture:** The HRC flag is modelled as `searchHRC: boolean` on `SearchState`/`QueryRequest`, a sibling of the existing `filters` field, because it is a cross-mode query modifier rather than a per-mode input. All five query shapes (count, snps, aggs, stats, download) pick it up from a single edit to `buildArgs()` in `src/lib/queryBuilder.ts`, which they all funnel through; `gene_info` is threaded separately. The UI is a checkbox in `QueryDrawer` that also relabels the chromosome position inputs as hg19.

**Tech Stack:** React 19 + TypeScript, Vite 7, MUI 9, Vitest 3, GraphQL Code Generator 7. Node 20+.

## Global Constraints

- **NO GIT OPERATIONS AT ALL.** Do not run `git add`, `git commit`, `git stash`, `git checkout`, `git restore`, or `git push`. Every change is left in the working tree for the user to review with `git diff`. This includes this plan and the spec. Where a normal plan would say "commit", this plan says "checkpoint" — run the verification and stop.
- **Nothing is pushed to GitHub and no PR is opened.**
- Work only on the current branch `annoq-site-78-add-hrc-mapping-info`. Do not touch `main`.
- The api-v2 argument is spelled **`search_hrc`** verbatim. api-v2 runs Strawberry with `auto_camel_case=False` — never camelCase it.
- `search_hrc` must **never** be sent on the four `*_by_keyword` operations; api-v2 rejects it there.
- `search_hrc` is **omitted entirely when false**, never sent as `search_hrc: false`.
- The genome build string is exactly `GRCh38/hg38`.
- The HRC hint copy is exactly: `Searching HRC r1.1 mapping — coordinates are hg19 (GRCh37).` (em dash, U+2014).
- The checkbox label is exactly: `Search HRC data`.
- The dev API base is exactly `https://api-v2-dev.topmed.annoq.org` (no trailing slash).
- The dataset string is exactly `annoq-annotations-tm-20260828`.
- **Two items from the annoq-site diff are deliberately NOT ported** — do not "fix" their absence:
  1. annoq-site's `initialSelectedIds` `[2,3,4,5,6]` → `[2,3,4,5,756]` and its `rs_dbSNP151` → `rs_dbSNP`
     rename. v2's `findRsidField` (`src/lib/annotations.ts:98`) already resolves the RSID field **by name**
     per dataset, and `defaultSelectionForStore` returns `chr, pos, ref, alt, <rsidField>`. Already correct
     on both stacks and covered by `SearchWorkspace.test.tsx`. (The `rs_dbSNP151` occurrences inside
     `public/assets/docs/` are a separate matter and *are* updated, in Task 6.)
  2. annoq-site's `selectItemsById` fix in `annotation.service.ts`. It repaired an `ids.toString().includes(...)`
     substring bug; v2's `AnnotationSelectionProvider` selects by name, so the bug does not exist here.
- Run all commands from the repo root `/home/muruganu/projects/temp/top_med/annoq-site-v2`.
- `npm run test` runs the whole Vitest suite; `npx vitest run <path>` runs one file.

---

### Task 1: Regenerate the GraphQL types against the TOPMed dev api-v2

Nothing else in this plan compiles until `src/generated/graphql.ts` knows about `search_hrc`: `npm run build` is `tsc -b && vite build`, and `src/lib/queryBuilder.ts` types its operation names against the generated `Query` type.

`graphql_codegen.ts` normally derives its URL from `environment.annotationApiV2`. We point it at the dev endpoint temporarily and then put it back, because Task 2 has not retargeted `environment.ts` yet. The annoq-site branch is the cautionary case: its `graphql_codegen.ts` is still committed pointing at `localhost:8001`.

**Files:**
- Modify (temporarily, then revert): `graphql_codegen.ts`
- Regenerate: `src/generated/graphql.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `src/generated/graphql.ts` containing a `search_hrc?: InputMaybe<Scalars['Boolean']['input']>` member on each of the 21 `QueryGet_SnPs_By_*Args` / `QueryGet_Aggs_By_*Args` / `QueryCount_SnPs_By_*Args` / `QueryDownload_SnPs_By_*Args` / `QueryGene_InfoArgs` types. Every later task depends on this.

- [ ] **Step 1: Confirm the dev endpoint actually carries the argument before regenerating**

```bash
curl -s -m 30 -X POST https://api-v2-dev.topmed.annoq.org/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ __type(name: \"Query\") { fields { name args { name } } } }"}' \
| python3 -c "
import json,sys
fs=json.load(sys.stdin)['data']['__type']['fields']
hit=[f['name'] for f in fs if 'search_hrc' in [a['name'] for a in f['args']]]
print('operations with search_hrc:', len(hit))
print('keyword ops with search_hrc:', [n for n in hit if 'keyword' in n])
"
```

Expected output:
```
operations with search_hrc: 21
keyword ops with search_hrc: []
```

If the count is not 21, STOP and report — the endpoint is not serving the #78 branch and every later task would be built on the wrong contract.

- [ ] **Step 2: Point the codegen config at the dev endpoint**

Replace the whole of `graphql_codegen.ts` with:

```typescript
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: 'https://api-v2-dev.topmed.annoq.org/graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript']
    }
  }
};

export default config;
```

- [ ] **Step 3: Regenerate**

Run: `npm run graphql_codegen`
Expected: the run completes and reports `src/generated/graphql.ts` written. It fails rather than falling back to a cached schema, so any error here means the endpoint was unreachable.

- [ ] **Step 4: Verify the generated file carries the argument**

```bash
grep -c "search_hrc" src/generated/graphql.ts
grep -n "search_hrc" src/generated/graphql.ts | grep -i keyword
```

Expected: the first command prints `21`. The second prints nothing — no keyword args type gained the field.

- [ ] **Step 5: Revert the codegen config**

Restore `graphql_codegen.ts` to its original derived form. Type it back out in full rather than using git:

```typescript
import type { CodegenConfig } from '@graphql-codegen/cli';
import { environment } from './src/lib/environment';

const config: CodegenConfig = {
  overwrite: true,
  schema: `${environment.annotationApiV2}/graphql`,
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript']
    }
  }
};

export default config;
```

- [ ] **Step 6: Verify the revert and that nothing local-only remains**

```bash
grep -n "localhost\|api-v2-dev" graphql_codegen.ts
```

Expected: no output. If anything prints, the config still names a specific host and must be fixed.

- [ ] **Step 7: Checkpoint**

Run: `npm run test`
Expected: the full suite still passes. Adding an optional argument to generated input types changes no runtime behaviour, so a failure here means something other than codegen broke.

**DO NOT COMMIT.** Report the two grep results and the test summary.

---

### Task 2: Retarget the environment to TOPMed and flip the genome build

The HRC filter is meaningless against an HRC-only dataset, since `Mapped_in_HRC` is a TOPMed field. This task points the app at the TOPMed dev api-v2 and corrects the genome-build label, which is user-visible and currently asserted by a test.

Only `api-v2-dev.topmed.annoq.org` carries `search_hrc` today; the deployed `api-v2.topmed.annoq.org` runs the issue-19 line and would make the checkbox return a GraphQL error. At cutover this becomes a one-line flip.

**Files:**
- Modify: `src/lib/environment.ts:2-4`
- Modify: `src/lib/config.ts:39-47`
- Modify: `src/features/search/QueryDrawer.test.tsx:103`
- Modify: `README.md:75-107`

**Interfaces:**
- Consumes: nothing from Task 1 at the type level.
- Produces: `environment.annotationApiV2 === 'https://api-v2-dev.topmed.annoq.org'`; `GENOME_BUILD === 'GRCh38/hg38'` exported from `src/lib/config.ts`; `API_DOCS_URL === 'https://api-v2-dev.topmed.annoq.org/docs'` (derived, unchanged code). Tasks 4 and 5 rely on both constants.

- [ ] **Step 1: Write the failing test**

In `src/features/search/QueryDrawer.test.tsx`, replace line 103 so the block reads:

```tsx
// v1 issue #88 put this in the Input Query heading, right after "(Selected: …)".
describe('QueryDrawer genome build', () => {
  it('states the genome build the dataset is based on', () => {
    renderDrawer();
    expect(screen.getByText('AnnoQ is based on GRCh38/hg38')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/features/search/QueryDrawer.test.tsx -t "states the genome build"`
Expected: FAIL — `Unable to find an element with the text: AnnoQ is based on GRCh38/hg38`.

- [ ] **Step 3: Flip the genome build constant**

In `src/lib/config.ts`, replace the `GENOME_BUILD` block (currently lines 39-47) with:

```typescript
/**
 * v1 issue #88. Hardcoded, as v1 was.
 *
 * This branch serves TOPMed (Freeze 8), which is GRCh38/hg38 — so the value is
 * now correct for TOPMed and wrong for HRC, the inverse of what it was before
 * the issue #78 port. The "Search HRC data" option does not change it: the HRC
 * r1.1 panel is a *mapping* of these variants, and the drawer says so with its
 * own hg19 hint rather than by rewriting this label.
 *
 * Isolated here so retargeting stays a one-line change.
 * See docs/superpowers/specs/2026-09-08-issue-78-hrc-mapping-port-design.md.
 */
export const GENOME_BUILD = 'GRCh38/hg38';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/search/QueryDrawer.test.tsx -t "states the genome build"`
Expected: PASS.

- [ ] **Step 5: Retarget the environment defaults**

In `src/lib/environment.ts`, replace lines 2-4 with:

```typescript
  // TOPMed cutover (annoq-site#78). Only the *dev* TOPMed api-v2 carries the
  // `search_hrc` argument today; api-v2.topmed.annoq.org still runs the
  // issue-19 line, where the "Search HRC data" checkbox would error. Flip this
  // to https://api-v2.topmed.annoq.org at cutover, once the api-v2 #78 branch
  // is deployed there. VITE_ANNOQ_API_V2 overrides it at run time either way.
  dataset: import.meta.env.VITE_ANNOQ_DATASET ?? 'annoq-annotations-tm-20260828',
  production: import.meta.env.PROD,
  annotationApiV2: import.meta.env.VITE_ANNOQ_API_V2 ?? import.meta.env.VITE_ANNOV_API_BASE ?? 'https://api-v2-dev.topmed.annoq.org',
```

Note: `dataset` is declared here but consumed nowhere in the app — verify with `grep -rn "environment.dataset\|\.dataset" src/ | grep -v test`. It is config only; do not go looking for what it drives.

- [ ] **Step 6: Update the README examples**

In `README.md`, in the block at lines 75-81, change the two values so it reads:

```typescript
export const environment = {
  dataset: 'annoq-annotations-tm-20260828',
  annotationApiV2: 'https://api-v2-dev.topmed.annoq.org',
  // other environment variables...
};
```

Then change the two `VITE_ANNOQ_API_V2=https://api-v2.topmed.annoq.org` example lines (around lines 87 and 105) to `VITE_ANNOQ_API_V2=https://api-v2.annoq.org`, so the documented override still demonstrates pointing at a *different* stack than the new default. Immediately after the first of those two code fences, add:

```markdown
This branch defaults to the **dev** TOPMed api-v2 because it is the only instance carrying the
`search_hrc` argument behind the "Search HRC data" option. Flip the default to
`https://api-v2.topmed.annoq.org` at TOPMed cutover.
```

- [ ] **Step 7: Checkpoint**

Run: `npm run test`
Expected: the full suite passes.

Run: `grep -rn "api-v2.annoq.org" src/lib/`
Expected: no output — no HRC production URL remains in the config layer.

**DO NOT COMMIT.** Report both results.

---

### Task 3: Thread `searchHRC` through state and the query builder

This is the whole query-side change. `buildPageQuery`, `buildCountsQuery`, `buildStatsQuery` and `buildDownloadQuery` all call `buildArgs()`, so a single edit there covers count / snps / aggs / stats / download. `gene_info` has its own builder and is threaded separately. No UI yet — this task is fully testable through `queryBuilder.test.ts`.

`searchHRC` goes on `QueryRequest`/`SearchState` beside `filters`, not into `QueryFormValues`. `values` holds the per-mode string inputs and only one mode's values are ever rendered; this flag applies across every mode, exactly like `filters`.

**Files:**
- Modify: `src/types.ts:58-63` (the `QueryRequest` type)
- Modify: `src/features/search/searchState.tsx:5-35,44-53,62-79`
- Modify: `src/lib/queryBuilder.ts:74-95,119-121,186-204`
- Modify: `src/features/search/SearchWorkspace.tsx:93,260-274`
- Test: `src/lib/queryBuilder.test.ts`

**Interfaces:**
- Consumes: `src/generated/graphql.ts` from Task 1.
- Produces:
  - `QueryRequest` gains `searchHRC: boolean` (required).
  - `SearchState` gains `searchHRC: boolean`, initial `false`.
  - New reducer action `{ type: 'setSearchHRC'; searchHRC: boolean }`.
  - `buildRequest(mode, values, selectedAnnotations, filters = [], searchHRC = false): QueryRequest`.
  - `buildGeneInfoQuery(gene: string, searchHRC = false): string`.
  - `submitSearch(mode, values, selectedAnnotationNames, filters, searchHRC, dispatch)` — note `searchHRC` is the **fifth** parameter, before `dispatch`.
  - Task 4 consumes `setSearchHRC`, `state.searchHRC` and the new `submitSearch` signature.

- [ ] **Step 1: Write the failing tests**

Append this block to `src/lib/queryBuilder.test.ts`, and add the four new builders to the import on line 3 so it reads:

```typescript
import {
  buildCountsQuery,
  buildDownloadQuery,
  buildGeneInfoQuery,
  buildPageQuery,
  buildRequest,
  buildStatsQuery
} from './queryBuilder';
```

```typescript
// annoq-site#78. api-v2 takes `search_hrc` verbatim (Strawberry runs with
// auto_camel_case=False) on the chromosome / RsID / RsIDs / IDs / gene_product
// families and on gene_info, and rejects it on every *_by_keyword operation.
describe('HRC subset filter (issue #78)', () => {
  const values = {
    chrom: '18',
    start: '1',
    end: '10',
    geneProduct: 'ZMYND11',
    rsID: 'rs1',
    rsIDList: 'rs1\nrs2',
    vcf: 'chr1\t10\t.\tA\tG',
    keyword: 'Signaling by GPCR'
  };

  const modes = ['chromosome', 'geneProduct', 'rsID', 'rsIDList', 'vcf'] as const;

  it.each(modes)('sends search_hrc: true for %s when the flag is set', (mode) => {
    const request = buildRequest(mode, values, ['custom_name'], [], true);
    expect(buildPageQuery(request, 1, store)).toContain('search_hrc: true');
  });

  // Omitted rather than sent as `search_hrc: false`: api-v2's own default is
  // off, so omitting keeps a default search's query string byte-identical to
  // what it was before this flag existed.
  it.each(modes)('omits search_hrc entirely for %s when the flag is unset', (mode) => {
    const request = buildRequest(mode, values, ['custom_name'], [], false);
    expect(buildPageQuery(request, 1, store)).not.toContain('search_hrc');
  });

  it('never sends search_hrc for keyword mode, even when the flag is set', () => {
    const request = buildRequest('keyword', values, ['custom_name'], [], true);
    expect(buildPageQuery(request, 1, store)).not.toContain('search_hrc');
    expect(buildCountsQuery(request, store)).not.toContain('search_hrc');
    expect(buildDownloadQuery(request, store)).not.toContain('search_hrc');
  });

  it('carries the flag onto the counts, stats and download queries', () => {
    const request = buildRequest('chromosome', values, ['custom_name'], [], true);
    expect(buildCountsQuery(request, store)).toContain('search_hrc: true');
    expect(buildDownloadQuery(request, store)).toContain('search_hrc: true');
    const page = { request, page: 1, pageSize: 50, total: 0, rows: [], columns: [], aggs: {} };
    expect(buildStatsQuery(request, 'pos', page, store)).toContain('search_hrc: true');
  });

  it('carries the flag onto the gene_info lookup', () => {
    expect(buildGeneInfoQuery('ZMYND11', true)).toContain('search_hrc: true');
    expect(buildGeneInfoQuery('ZMYND11', false)).not.toContain('search_hrc');
    expect(buildGeneInfoQuery('ZMYND11')).not.toContain('search_hrc');
  });

  it('defaults to off so existing callers are unaffected', () => {
    expect(buildRequest('chromosome', values, ['custom_name'], []).searchHRC).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/lib/queryBuilder.test.ts`
Expected: FAIL. The `search_hrc: true` assertions fail because nothing emits it; the `buildRequest(..., true)` calls also raise a TypeScript arity error in the editor, which is expected until Step 4.

- [ ] **Step 3: Add the field to `QueryRequest`**

In `src/types.ts`, replace the `QueryRequest` type with:

```typescript
export type QueryRequest = {
  mode: QueryMode;
  values: QueryFormValues;
  fields: string[];
  filters: string[];
  /**
   * api-v2's `search_hrc` (annoq-site#78): restrict results to the HRC r1.1
   * mapped subset, which also flips the coordinate basis to hg19.
   *
   * Held here beside `filters`, not in `values`, because it is a cross-mode
   * query modifier. `values` is the per-mode input — only one mode's values are
   * ever rendered or read — whereas this applies to every mode except keyword,
   * which api-v2 rejects it on.
   */
  searchHRC: boolean;
};
```

- [ ] **Step 4: Thread it through the query builder**

In `src/lib/queryBuilder.ts`:

(a) Replace `buildRequest` with:

```typescript
export function buildRequest(
  mode: QueryMode,
  values: QueryRequest['values'],
  selectedAnnotations: string[],
  filters: string[] = [],
  searchHRC = false
): QueryRequest {
  return {
    mode,
    values,
    fields: unique(selectedAnnotations),
    filters,
    searchHRC
  };
}
```

(b) Replace `buildGeneInfoQuery` with:

```typescript
export function buildGeneInfoQuery(gene: string, searchHRC = false): string {
  // In HRC mode api-v2 resolves the gene's region in hg19, so the flag has to
  // reach this lookup too — otherwise the region handed to the SNP query is
  // hg38 while the SNP query matches against pos_hg19.
  const hrc = searchHRC ? ', search_hrc: true' : '';
  return `query AnnoQGeneInfo { geneInfo: ${GENE_INFO}(gene: ${gqlString(gene)}${hrc}) { contig end start gene_id } }`;
}
```

(c) Replace `buildArgs` with:

```typescript
function buildArgs(request: QueryRequest): Record<string, unknown> {
  // Spread into every non-keyword mode: api-v2 rejects `search_hrc` on the
  // *_by_keyword operations. Omitted when false rather than sent as `false`
  // because api-v2 already defaults to off, so omitting leaves a default
  // search's query string byte-identical to before the flag existed.
  const hrc = request.searchHRC && request.mode !== 'keyword' ? { search_hrc: true } : {};
  switch (request.mode) {
    case 'chromosome':
      return {
        chr: request.values.chrom.trim().toLowerCase(),
        start: Number.parseInt(request.values.start, 10),
        end: Number.parseInt(request.values.end, 10),
        ...hrc
      };
    case 'geneProduct':
      return { gene: request.values.geneProduct.trim(), ...hrc };
    case 'rsID':
      return { rsID: request.values.rsID.trim(), ...hrc };
    case 'rsIDList':
      return { rsIDs: parseRsidList(request.values.rsIDList), ...hrc };
    case 'vcf':
      return { ids: parseVcfIds(request.values.vcf), ...hrc };
    case 'keyword':
      return { keyword: request.values.keyword.trim() };
  }
}
```

`formatValue` needs no change: `true` falls through to its `String(value)` branch.

- [ ] **Step 5: Run the query builder tests to verify they pass**

Run: `npx vitest run src/lib/queryBuilder.test.ts`
Expected: PASS, all tests in the file including the pre-existing ones.

- [ ] **Step 6: Add the flag to search state**

In `src/features/search/searchState.tsx`, make four edits.

(a) Add to the `SearchState` type, after `filters: string[];`:

```typescript
  searchHRC: boolean;
```

(b) Add to the `Action` union, after the `setFilters` member:

```typescript
  | { type: 'setSearchHRC'; searchHRC: boolean }
```

(c) Add to `initialSearchState`, after `filters: [],`:

```typescript
  searchHRC: false,
```

(d) Add a reducer case after the `setFilters` case, and extend the `submit` case so the flag tracks the submitted request the way `filters` already does:

```typescript
    case 'setSearchHRC':
      return { ...state, searchHRC: action.searchHRC };
    case 'submit':
      return {
        ...state,
        submitted: action.request,
        requestId: state.requestId + 1,
        filters: action.request.filters,
        searchHRC: action.request.searchHRC,
        page: 1,
        result: undefined,
        selectedRow: undefined,
        stats: undefined,
        error: undefined,
        loading: true,
        panel: 'table',
        sidePanel: null
      };
```

- [ ] **Step 7: Thread the flag through `submitSearch` and the gene lookup**

In `src/features/search/SearchWorkspace.tsx`:

(a) Replace `submitSearch` (currently lines 260-274) with:

```typescript
export function submitSearch(
  mode: ReturnType<typeof useSearchState>['state']['mode'],
  values: ReturnType<typeof useSearchState>['state']['values'],
  selectedAnnotationNames: string[],
  filters: string[],
  searchHRC: boolean,
  dispatch: ReturnType<typeof useSearchState>['dispatch']
) {
  // Tracked here rather than in the component (v1 put it in
  // annotation.component.submit) because this is the one funnel every search
  // passes through. v1's `if (source.length > 0)` guard has no equivalent:
  // chr and pos are locked, so an empty submission is unreachable (issue #4).
  trackEvent('search_submit', { search_type: queryModeLabel(mode) });
  const request = buildRequest(mode, values, selectedAnnotationNames, filters, searchHRC);
  dispatch({ type: 'submit', request });
}
```

(b) Change line 93 from `buildGeneInfoQuery(request.values.geneProduct),` to:

```typescript
            buildGeneInfoQuery(request.values.geneProduct, request.searchHRC),
```

`FilterPanel.setFilters` needs no change — it builds its request with `{ ...state.submitted, filters: fields }`, so `searchHRC` is carried over by the spread.

- [ ] **Step 8: Checkpoint**

Run: `npm run test`
Expected: PASS. `QueryDrawer.test.tsx` still passes because `submitSearch`'s only caller is `QueryDrawer.tsx`, which Task 4 updates — until then TypeScript flags the arity, but Vitest transpiles without typechecking so the suite runs. This is expected and is resolved in Task 4.

Run: `npx tsc -b --noEmit 2>&1 | head -20`
Expected: exactly one error, at `src/features/search/QueryDrawer.tsx:98`, about the argument count of `submitSearch`. Any other error must be fixed before moving on.

**DO NOT COMMIT.** Report the test summary and the tsc output.

---

### Task 4: Add the "Search HRC data" checkbox to the query drawer

**Files:**
- Modify: `src/features/search/QueryDrawer.tsx:1-30,40-60,96-100,130-145`
- Modify: `src/styles.css` (append near the existing `.query-type-row` rule at line 368)
- Test: `src/features/search/QueryDrawer.test.tsx`

**Interfaces:**
- Consumes: `setSearchHRC` action and `state.searchHRC` from Task 3; the six-parameter `submitSearch(mode, values, selectedAnnotationNames, filters, searchHRC, dispatch)` from Task 3.
- Produces: no exports. Resolves the `tsc` error left by Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/search/QueryDrawer.test.tsx`:

```tsx
// annoq-site#78. The checkbox is a cross-mode modifier, so it sits under the
// Query Type row rather than inside any one mode's fields — except keyword,
// which api-v2 rejects the argument on.
describe('QueryDrawer HRC option', () => {
  it('offers the HRC subset checkbox, unchecked by default', () => {
    renderDrawer();
    const checkbox = screen.getByRole('checkbox', { name: 'Search HRC data' });
    expect(checkbox).not.toBeChecked();
  });

  it('hides the hg19 hint until the box is checked', () => {
    renderDrawer();
    expect(screen.queryByText(/coordinates are hg19/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Search HRC data' }));
    expect(screen.getByText(/coordinates are hg19/)).toBeInTheDocument();
  });

  // In HRC mode api-v2 matches start/end against pos_hg19, so collecting them
  // under an unqualified label would be asking for the wrong coordinate space.
  it('relabels the chromosome position inputs as hg19 when checked', () => {
    renderDrawer();
    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('End')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Search HRC data' }));
    expect(screen.getByLabelText('Start (hg19)')).toBeInTheDocument();
    expect(screen.getByLabelText('End (hg19)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/features/search/QueryDrawer.test.tsx -t "HRC option"`
Expected: FAIL — `Unable to find an accessible element with the role "checkbox" and name "Search HRC data"`.

- [ ] **Step 3: Implement the checkbox**

In `src/features/search/QueryDrawer.tsx`:

(a) Add `Checkbox` and `FormControlLabel` to the `@mui/material` import list (keep it alphabetical — they go after `Button` and before `IconButton`, i.e. `Box, Button, Checkbox, Divider, FormControl, FormControlLabel, IconButton, ...`).

(b) After the `const [values, setValues] = useState(state.values);` line, add:

```tsx
  const [searchHRC, setSearchHRC] = useState(state.searchHRC);
```

(c) After the `changeMode` callback, add:

```tsx
  const changeSearchHRC = useCallback((next: boolean) => {
    setSearchHRC(next);
    dispatch({ type: 'setSearchHRC', searchHRC: next });
  }, [dispatch]);
```

(d) Replace the `submit()` body's `submitSearch` call with:

```tsx
    submitSearch(mode, values, annotationSelection.selected, [], searchHRC, dispatch);
```

(e) Immediately after the closing `</Stack>` of the `query-type-row` block and before the `<Stack spacing={1.5} className="query-form-section">` line, insert:

```tsx
      {mode !== 'keyword' && (
        <Box className="query-hrc-row">
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={searchHRC}
                onChange={(event) => changeSearchHRC(event.target.checked)}
              />
            }
            label="Search HRC data"
          />
          {searchHRC && (
            <Typography variant="caption" className="query-hrc-hint">
              Searching HRC r1.1 mapping — coordinates are hg19 (GRCh37).
            </Typography>
          )}
        </Box>
      )}
```

(f) In the `mode === 'chromosome'` block, replace the Start/End `TextField`s with:

```tsx
            <Stack direction="row" spacing={1}>
              <TextField size="small" label={searchHRC ? 'Start (hg19)' : 'Start'} value={values.start} onChange={(e) => updateValues({ start: e.target.value })} />
              <TextField size="small" label={searchHRC ? 'End (hg19)' : 'End'} value={values.end} onChange={(e) => updateValues({ end: e.target.value })} />
            </Stack>
```

- [ ] **Step 4: Add the styles**

Append to `src/styles.css`, immediately after the `.query-type-row` rule (which ends at line 373):

```css
.query-hrc-row {
  padding: 10px 12px;
  border-bottom: 1px solid #d8dee8;
  background: #fbfcfe;
}

.query-hrc-hint {
  display: block;
  color: rgba(0, 0, 0, 0.54);
  font-style: italic;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/search/QueryDrawer.test.tsx`
Expected: PASS, all tests in the file.

- [ ] **Step 6: Verify the whole feature typechecks**

Run: `npx tsc -b --noEmit`
Expected: no output — the Task 3 arity error is resolved and nothing new appeared.

- [ ] **Step 7: Checkpoint**

Run: `npm run test`
Expected: the full suite passes.

**DO NOT COMMIT.** Report the test summary.

---

### Task 5: Retarget the home and About page content to TOPMed

Shipping the feature without this produces a site that describes HRC r1.1 (~39 million variants) while querying TOPMed Freeze 8 (>700 million). The "800+" figure is not a guess: the dev endpoint's `/annotations` returns 839 annotations, 819 of them leaves.

**Files:**
- Modify: `src/pages/StaticPages.tsx:3,37-39,44,50-59,107,114,121,146,156,226-237`
- Modify: `src/data/staticContent.ts:44-46,55-59`
- Test: `src/pages/StaticPages.test.tsx`

**Interfaces:**
- Consumes: `API_DOCS_URL` from `src/lib/config.ts` (existing export; its value changed in Task 2).
- Produces: no exports.

- [ ] **Step 1: Verify the client-library branches exist before linking to them**

```bash
git ls-remote --heads https://github.com/USCbiostats/AnnoQR.git annoq-site-78-add-hrc-mapping-info
git ls-remote --heads https://github.com/USCbiostats/annoq-py.git annoq-site-78-add-hrc-mapping-info
```

Expected: these branches exist **locally only** until the user pushes, so `git ls-remote` returns
nothing. Verify locally instead: `git -C ../annoq-py branch --list annoq-site-78-add-hrc-mapping-info`
and the same for `../AnnoQR`. If the user has not branched yet (this plan performs no git
operations), the links are forward references — confirm the intent with them rather than reverting
to the stale issue-19 branch.

- [ ] **Step 2: Write the failing tests**

Replace the whole of `src/pages/StaticPages.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { API_DOCS_URL } from '../lib/config';
import { HomePage } from './StaticPages';

// HomePage does not call useAnnotations, but StaticPages imports it for the
// version table, so the module still has to resolve without a query client.
vi.mock('../features/annotations/useAnnotations', () => ({
  useAnnotations: () => ({ data: undefined, isLoading: false, error: null })
}));

describe('HomePage web browser access section', () => {
  it('shows the query UI screenshot alongside the numbered steps', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByAltText('AnnoQ query interface')).toHaveAttribute(
      'src',
      '/assets/images/ui-query.png'
    );
  });
});

describe('programmatic access icons (issue #19)', () => {
  it('shows a brand logo per card, each linking to its own project', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    // The API card is asserted against the derived API_DOCS_URL, not a literal:
    // issue #20 made the docs link follow the API the site actually queries, so
    // pinning a host here would re-break at the TOPMed cutover.
    const expected = [
      ['Swagger', '/assets/images/swagger.svg', API_DOCS_URL],
      ['Python', '/assets/images/python.svg', 'https://github.com/USCbiostats/annoq-py/tree/annoq-site-78-add-hrc-mapping-info'],
      ['R', '/assets/images/r-package.svg', 'https://github.com/USCbiostats/AnnoQR/tree/annoq-site-78-add-hrc-mapping-info']
    ];

    for (const [alt, src, href] of expected) {
      const logo = screen.getByAltText(alt);
      expect(logo).toHaveAttribute('src', src);
      // The icon is the link, not just decoration inside one.
      const link = logo.closest('a');
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('keeps the View Details buttons pointing at the internal docs', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    const routes = screen.getAllByRole('link', { name: 'View Details' }).map((link) => link.getAttribute('href'));
    expect(routes).toEqual(['/docs/services', '/docs/tutorials/annoq-py', '/docs/tutorials/r-package']);
  });
});

// annoq-site#78: the site serves TOPMed Freeze 8, so the headline figures and
// the dataset attribution have to say so.
describe('HomePage dataset figures (issue #78)', () => {
  it('reports the TOPMed variant count, not the HRC one', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('> 700 million')).toBeInTheDocument();
    expect(screen.queryByText('~39 million')).not.toBeInTheDocument();
  });

  it('reports the TOPMed annotation-type count', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('800+')).toBeInTheDocument();
    expect(screen.queryByText('600+')).not.toBeInTheDocument();
  });

  it('attributes the variants to TOPMed rather than the HRC', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(
      screen.getByText(/Trans-Omics for Precision Medicine \(TOPMed\) data Freeze 8/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/pre-annotated variants from the Haplotype Reference Consortium/)
    ).not.toBeInTheDocument();
  });

  // The old band advertised TOPMed as a beta living at topmed.annoq.org. On the
  // cutover branch that link points back at this same site, so the band now
  // describes HRC as an option here instead of TOPMed as somewhere else.
  it('does not send visitors off-site to the TOPMed beta', () => {
    const { container } = render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(container.querySelector('a[href="https://topmed.annoq.org/"]')).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npx vitest run src/pages/StaticPages.test.tsx`
Expected: FAIL — `> 700 million`, `800+` and the TOPMed attribution are not found; the Swagger href is still `https://api-v2.annoq.org/docs`.

- [ ] **Step 4: Update the home page**

In `src/pages/StaticPages.tsx`:

(a) Add after the `react-router-dom` import on line 3:

```tsx
import { API_DOCS_URL } from '../lib/config';
```

(b) Replace the first stat card's contents (lines 37-39) with:

```tsx
              <Typography variant="h4">&gt; 700 million</Typography>
              <Typography variant="caption" className="stat-hint">Currently only human variants are supported</Typography>
              <Typography>pre-annotated variants from the <Link href="https://legacy.bravo.sph.umich.edu/freeze8/hg38/" target="_blank">Trans-Omics for Precision Medicine (TOPMed) data Freeze 8</Link></Typography>
```

(c) Replace line 44 with:

```tsx
              <Typography variant="h4">800+</Typography>
```

(d) Replace the **first** `band` block — lines 50-59, the one headed "AnnoQ now supports TOPMed". There are three `Box className="band"` blocks in this file (lines 50, 98 and 142); only the first is touched.

```tsx
      <Box className="band">
        <Container>
          <Typography variant="h4" gutterBottom>AnnoQ now serves TOPMed</Typography>
          <Typography>
            AnnoQ version 2.0-beta.1 provides over 700 million pre-annotated variants from the Trans-Omics for Precision Medicine
            program with sequence features by Whole Genome Sequence Annotator and functions from PANTHER, Gene Ontology,
            Reactome and PEREGRINE. Variants mapped to the Haplotype Reference Consortium r1.1 panel are still available: tick{' '}
            <strong>Search HRC data</strong> on the <Link component={RouterLink} to="/search">search page</Link> to restrict a
            query to that subset, which is reported in hg19 coordinates.
          </Typography>
        </Container>
      </Box>
```

(e) Replace the three `iconHref` values on the programmatic-access cards — lines **107**, **114** and **121** respectively — with:

```tsx
              iconHref={API_DOCS_URL}
```
```tsx
              iconHref="https://github.com/USCbiostats/annoq-py/tree/annoq-site-78-add-hrc-mapping-info"
```
```tsx
              iconHref="https://github.com/USCbiostats/AnnoQR/tree/annoq-site-78-add-hrc-mapping-info"
```

(f) Replace the partners paragraph at line 146 with:

```tsx
            We could not do it without our partners and collaborators. The variants data set was from the Trans-Omics for
            Precision Medicine (TOPMed) program, and was pre-annotated with sequence features by WGSA and functions by PANTHER
            and Gene Ontology. We are very grateful for the reliable data and tools they provide. Last, this work is not possible
            without the support from the members at the{' '}
            <Link href="https://p01.uscbiostatistics.org/" target="_blank">USC IMAGE Project</Link>. Funding of this project is provided by NIH.
```

(g) Replace the HRC logo at line 156 with both logos — the HRC entry stays because the data still carries the HRC r1.1 mapping the checkbox filters on:

```tsx
            <Logo href="https://topmed.nhlbi.nih.gov/" label="TOPMed" />
            <Logo href="http://www.haplotype-reference-consortium.org" label="HRC" />
```

- [ ] **Step 5: Update the About page**

In `src/pages/StaticPages.tsx`, replace the opening `<Typography>` and `<ol>` of `AboutPage` (lines 226-237) with:

```tsx
    <Typography>
      The Annotation Query (AnnoQ) system is an integrated functional annotation platform for large-scale genetic variant
      annotation. The system is a large collection of over 700 million pre-annotated variants from the{' '}
      <Link href="https://legacy.bravo.sph.umich.edu/freeze8/hg38/" target="_blank">Trans-Omics for Precision Medicine (TOPMed) data Freeze 8</Link>{' '}
      with sequence features by <Link href="https://sites.google.com/site/jpopgen/wgsa" target="_blank">WGSA</Link>, functions by{' '}
      <Link href="https://pantherdb.org" target="_blank">PANTHER</Link>,{' '}
      <Link href="https://geneontology.org/" target="_blank">Gene Ontology</Link>,{' '}
      <Link href="https://reactome.org/" target="_blank">Reactome</Link>, and gene enhancers from{' '}
      <Link href="https://www.peregrineproj.org/" target="_blank">PEREGRINE</Link>. Currently only human variants are supported.
      Variants mapped to the Haplotype Reference Consortium r1.1 panel can be queried as a subset from the search page. The data
      can be accessed in one of the following ways:
    </Typography>
    <ol>
      <li><Link component={RouterLink} to="/search">Browser</Link>.</li>
      <li><Link href={API_DOCS_URL} target="_blank">Swagger API</Link> data access using command line scripts.</li>
      <li>Software libraries <Link href="https://github.com/USCbiostats/AnnoQR/tree/annoq-site-78-add-hrc-mapping-info" target="_blank">AnnoQR</Link> in R and <Link href="https://github.com/USCbiostats/annoq-py/tree/annoq-site-78-add-hrc-mapping-info" target="_blank">annoq-py</Link> in Python.</li>
    </ol>
```

- [ ] **Step 6: Update the release notes data**

In `src/data/staticContent.ts`:

(a) In the `TopMed Freeze 8 release` entry, replace the `items` array so the link is not self-referential:

```typescript
    description: [{ heading: 'New Data Release', items: ['<a href="https://topmed.nhlbi.nih.gov/" target="_blank">TopMed</a> is a larger and more diverse dataset and also includes more annotation attributes.'] }]
```

(b) In the `New API release` (version 1.3) entry, replace the first two `items` strings:

```typescript
        'A new <a href="https://api-v2.topmed.annoq.org/docs" target="_blank">API</a> has been released for the AnnoQ website. Refer to <a href="/docs/services">AnnoQ Services</a> for detailed information.',
        'Two libraries <a href="https://github.com/USCbiostats/AnnoQR/tree/annoq-site-78-add-hrc-mapping-info" target="_blank">AnnoQR</a> and <a href="https://github.com/USCbiostats/annoq-py/tree/annoq-site-78-add-hrc-mapping-info" target="_blank">annoq-py</a> that utilize the API have also been released. Tutorials for the <a href="/docs/tutorials/r-package">R package</a> and <a href="/docs/tutorials/annoq-py">python package</a> are also available.',
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/pages/StaticPages.test.tsx`
Expected: PASS, all tests in the file.

- [ ] **Step 8: Checkpoint**

Run: `npm run test`
Expected: the full suite passes.

Run: `grep -rn "39 million\|600+\|api-v2.annoq.org" src/pages/ src/data/`
Expected: no output.

**DO NOT COMMIT.** Report both results.

---

### Task 6: Retarget the in-app documentation markdown

These files are served as static assets and rendered by `DocsPage`, so they cannot read `API_DOCS_URL`. They use the literal **production** TOPMed API URL (`https://api-v2.topmed.annoq.org/docs`), matching what annoq-site shipped: this is the cutover target, and hardcoding the dev host into user-facing prose would be worse than a brief mismatch with the app's temporary default.

**Files:**
- Modify: `public/assets/docs/index.md:3`
- Modify: `public/assets/docs/docs/services/index.md:4,8,12,15,16,18`
- Modify: `public/assets/docs/docs/services/api.md:6,10,16,34,49,50`
- Modify: `public/assets/docs/docs/tutorials/annoq-py.md`
- Modify: `public/assets/docs/docs/tutorials/r-package.md`
- Modify: `public/assets/docs/docs/tutorials/ui-query.md:3`
- Replace: `public/assets/images/annoq_workflow.png`

**Interfaces:**
- Consumes: nothing. Produces: nothing. Content only.

- [ ] **Step 1: Apply the mechanical replacements**

These are exact, repo-wide within the docs tree. Run them as one script:

```bash
cd /home/muruganu/projects/temp/top_med/annoq-site-v2
DOCS=public/assets/docs
# The API host. 3 in services/api.md, 3 in services/index.md.
grep -rl 'api-v2\.annoq\.org' $DOCS | xargs sed -i 's|api-v2\.annoq\.org|api-v2.topmed.annoq.org|g'
# The RSID field name: TOPMed carries rs_dbSNP, HRC carried rs_dbSNP151.
# 10 in r-package.md, 10 in annoq-py.md.
grep -rl 'rs_dbSNP151' $DOCS | xargs sed -i 's|rs_dbSNP151|rs_dbSNP|g'
# Client-library repos -> the TOPMed branches.
grep -rl 'USCbiostats/AnnoQR' $DOCS | xargs sed -i 's|https://github.com/USCbiostats/AnnoQR)|https://github.com/USCbiostats/AnnoQR/tree/annoq-site-78-add-hrc-mapping-info)|g'
grep -rl 'USCbiostats/annoq-py' $DOCS | xargs sed -i 's|https://github.com/USCbiostats/annoq-py)|https://github.com/USCbiostats/annoq-py/tree/annoq-site-78-add-hrc-mapping-info)|g'
# Absolute site links -> site-relative, so the docs work on whichever host serves them.
grep -rl 'https://annoq\.org' $DOCS | xargs sed -i 's|\](https://annoq\.org/search)|](/search)|g; s|\](https://annoq\.org/detail)|](/detail)|g; s|\](https://annoq\.org)|](/)|g'
```

Then the two install lines, which the patterns above deliberately do not match:

In `public/assets/docs/docs/tutorials/annoq-py.md` line 12:
```bash
pip install git+https://github.com/USCbiostats/annoq-py.git@annoq-site-78-add-hrc-mapping-info
```

In `public/assets/docs/docs/tutorials/r-package.md` line 13:
```r
devtools::install_github("USCbiostats/AnnoQR", ref = "annoq-site-78-add-hrc-mapping-info")
```

- [ ] **Step 2: Verify the mechanical replacements landed and left nothing behind**

```bash
grep -rn 'api-v2\.annoq\.org\|rs_dbSNP151\|https://annoq\.org' public/assets/docs/
grep -rn 'USCbiostats/AnnoQR)\|USCbiostats/annoq-py)' public/assets/docs/
```

Expected: no output from either command.

- [ ] **Step 3: Rewrite the three HRC prose passages**

These carry dataset claims and cannot be sed'd.

(a) `public/assets/docs/index.md`, replace line 3 entirely with:

```markdown
AnnoQ is a platform that integrates a datastore of pre-annotated SNPs, APIs and packages for accessing the SNPs programmatically and a website for viewing the SNP data. The backend of the system is a large collection of pre-annotated variants from [TopMed](https://topmed.nhlbi.nih.gov/): a program of the National Heart, Lung and Blood Institute (NHLBI), a part of the National Institutes of Health.  The data from TopMed is from version [Freeze 8](https://legacy.bravo.sph.umich.edu/freeze8/hg38/), which has more than 700 million SNPs with sequence features by [WGSA](https://sites.google.com/site/jpopgen/wgsa) and functions by [PANTHER](https://pantherdb.org), [Gene Ontology](https://geneontology.org/), [Reactome](https://reactome.org/) and [PEREGRINE](https://www.peregrineproj.org/) enhancer mappings. Variants mapped to the [Haplotype Reference Consortium](http://www.haplotype-reference-consortium.org/) r1.1 panel can be queried as a subset using the **Search HRC data** option, which reports hg19 coordinates. The annotations have also been [categorized](/detail) to allow users easy access to specific subsets of data. The data can be accessed via [API](/docs/services/api).
```

(b) `public/assets/docs/docs/services/api.md`, replace line 16 entirely with:

```markdown
The API provides access to AnnoQ's rich annotations for Human SNPs from release version [Freeze 8](https://legacy.bravo.sph.umich.edu/freeze8/hg38/) of [TopMed](https://topmed.nhlbi.nih.gov/), a program of the National Heart, Lung and Blood Institute (NHLBI), a part of the National Institutes of Health.  The end-points can be utilized independently or as part of large workflows to analyze and make coorelations on large data sets. A SNP (single nucleotide polymorphism) by definition is a genomic variant at a single base position in the DNA.  Each SNP in the system can be uniquely identified by the chromosome, its position, the reference nucleotide and the alternate nucleotide or its RSID (Reference SNP cluster ID).  Note, SNP's are not defined for all positions of the chromosome, but, a given chromosome and position, can have more than one SNP. Indels are not supported.
```

(c) `public/assets/docs/docs/services/api.md`, line 34 — Step 1 already made the two links relative; also fix the `seaarch` typo carried over from annoq-site, so the line begins:

```markdown
The list of attributes can be constructed by downloading the configuration from the [search page](/search). To download, select
```

- [ ] **Step 4: Document the HRC option in the API page**

Append to `public/assets/docs/docs/services/api.md`, immediately before the `## Software packages for programmatic access` heading:

```markdown
## Restricting a search to the HRC subset

Every SNP search, count and download end-point accepts an optional **`search_hrc`** parameter. With
`?search_hrc=true` the results are restricted to variants mapped to the Haplotype Reference Consortium
r1.1 panel (`Mapped_in_HRC=Y`), and the coordinate basis becomes **hg19**: chromosome start/end are
matched against `pos_hg19`, gene regions resolve to hg19, and VCF-style ids are matched against
`HRC_chr_pos_ref_alt`. RSID search is unaffected. The response shape does not change — to see the hg19
values, request the `Mapped_in_HRC`, `HRC_chr_pos`, `HRC_chr_pos_ref_alt`, `chr_hg19`, `pos_hg19`,
`ref_hg19` and `alt_hg19` attributes, which live under the **HG19 Info** category. The parameter is not
accepted by the keyword end-points.
```

- [ ] **Step 5: Fix the UI tutorial's broken template link**

`public/assets/docs/docs/tutorials/ui-query.md` line 3 still contains an unrendered Jekyll placeholder (`{{site.annoq_search_url}}`). Replace the line with:

```markdown
The Interactive Query UI can be accessed via browser from AnnoQ's [search](/search) page
```

- [ ] **Step 6: Refresh the workflow diagram**

```bash
cp /home/muruganu/projects/temp/top_med/annoq-site/src/assets/images/annoq_workflow.png \
   /home/muruganu/projects/temp/top_med/annoq-site-v2/public/assets/images/annoq_workflow.png
ls -l public/assets/images/annoq_workflow.png
```

Expected: the file is ~411991 bytes (the updated version), not ~382824. Only the `.png` is referenced (`StaticPages.tsx`); leave the unused `annoq_workflow.svg` alone.

- [ ] **Step 7: Checkpoint**

Run: `npm run test`
Expected: the full suite passes (`DocsPage.test.tsx` renders markdown, so a malformed file would surface here).

Run: `grep -rn "Haplotype Reference Consortium" public/assets/docs/`
Expected: two lines only — the HRC-subset mentions added in Steps 3(a) and 4. No line should describe HRC as the source dataset.

**DO NOT COMMIT.** Report both results.

---

### Task 7: Mark the site as the TOPMed beta

annoq-site signals the beta with an amber toolbar and a label linking to the version page. Port the same signal so the two sites read consistently during the cutover.

**Files:**
- Modify: `src/App.tsx:60-70`
- Modify: `src/styles.css:57-60` and append
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: nothing. Produces: no exports.

- [ ] **Step 1: Write the failing test**

Append to `src/App.test.tsx`:

First widen the existing import on line 1, which currently pulls in only `render`:

```tsx
import { render, screen } from '@testing-library/react';
```

Then append, reusing the file's existing `renderAt(path)` helper rather than adding a second one:

```tsx
// annoq-site#78: the site serves the TOPMed beta during the cutover and says
// so in the toolbar, matching the banner annoq-site carries.
describe('TopMed beta label', () => {
  it('links the beta label to the version page', () => {
    renderAt('/');
    const label = screen.getByRole('link', { name: 'TopMed Beta Release' });
    expect(label).toHaveAttribute('href', '/version');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/App.test.tsx -t "TopMed beta"`
Expected: FAIL — `Unable to find an accessible element with the role "link" and name "TopMed Beta Release"`.

- [ ] **Step 3: Add the label**

In `src/App.tsx`, immediately after the `</Stack>` closing the `launch-buttons` stack and before `<Box sx={{ flex: 1 }} />`, insert:

```tsx
            <Button component={RouterLink} to="/version" className="beta-label">TopMed Beta Release</Button>
```

- [ ] **Step 4: Add the styles**

In `src/styles.css`, replace the `.main-appbar` rule at lines 57-60 with:

```css
.main-appbar {
  border-bottom: 1px solid #d5deea;
  /* Amber while the site serves the TOPMed beta (annoq-site#78). Revert to
     rgba(255, 255, 255, 0.98) at cutover, together with the beta label. */
  background: #fff3cd !important;
}

.beta-label {
  white-space: nowrap;
  color: #183153;
  font-weight: 800;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS, all tests in the file.

- [ ] **Step 6: Checkpoint**

Run: `npm run test`
Expected: the full suite passes.

**DO NOT COMMIT.** Report the result.

---

### Task 8: Update the repo documentation and verify the whole port

**Files:**
- Modify: `docs/search-query-ui.md`
- Modify: `docs/backend-api-and-graphql.md`
- Modify: `docs/project-overview.md`

**Interfaces:**
- Consumes: everything above. Produces: nothing.

- [ ] **Step 1: Find every stale statement in the repo docs**

```bash
grep -rn "GRCh37\|hg19\|HRC\|api-v2\.annoq\.org\|annoq-annotations-v5\|39 million\|600+" docs/*.md
```

Read each hit. Anything that states the *dataset* or the *genome build* as a fact about this branch is now wrong and must be corrected to TOPMed Freeze 8 / GRCh38 hg38. Anything that describes HRC as a queryable *subset* is correct and should stay. Do not edit `docs/superpowers/` — those are dated design records, not living documentation.

- [ ] **Step 2: Document the search_hrc contract**

Add to `docs/backend-api-and-graphql.md`, as a new section:

```markdown
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
```

- [ ] **Step 3: Document the UI affordance**

Add to `docs/search-query-ui.md`, in whichever section describes the query drawer's controls:

```markdown
### Search HRC data

A checkbox under the Query Type row, hidden in keyword mode (api-v2 rejects the argument there).
When ticked, the query is restricted to the HRC r1.1 mapped subset and the chromosome Start/End
inputs are relabelled "(hg19)", because api-v2 matches them against `pos_hg19` in that mode. The
genome-build caption still reads GRCh38/hg38: the dataset is TOPMed Freeze 8, and HRC r1.1 is a
mapping of it rather than a different build.

The HRC and hg19 columns (`Mapped_in_HRC`, `HRC_chr_pos`, `HRC_chr_pos_ref_alt`, `chr_hg19`,
`pos_hg19`, `ref_hg19`, `alt_hg19`) are ordinary tree leaves under "HG19 Info" — users tick them
like any other column. Nothing is auto-added to the selection.
```

- [ ] **Step 4: Run the full verification**

```bash
npm run test
npm run build
```

Expected: the whole Vitest suite passes, and the build completes (`tsc -b` clean, then `vite build`). If `tsc` fails on `src/generated/graphql.ts`, Task 1 did not take.

- [ ] **Step 5: Smoke-test the feature against the live dev API**

```bash
npm run dev
```

Then in a browser at `http://localhost:5173/search`, confirm all six:

1. The toolbar is amber and shows "TopMed Beta Release".
2. The drawer caption reads "AnnoQ is based on GRCh38/hg38".
3. With the box **unchecked**, a chromosome search (chr 18, 1–500000) returns results.
4. Ticking **Search HRC data** shows the hg19 hint and relabels Start/End as "(hg19)".
5. Select `Mapped_in_HRC` and `pos_hg19` from the **HG19 Info** category, search with the box ticked, and confirm every row has `Mapped_in_HRC = Y` and a populated `pos_hg19`.
6. Untick the box and re-search: the result count returns to the full-dataset figure.

If step 5 returns zero rows, check the browser network tab for `search_hrc: true` in the request body before assuming the data is wrong.

- [ ] **Step 6: Review the complete diff**

```bash
git status
git diff --stat
```

Confirm nothing is staged and nothing has been committed — `git status` should show only modified/untracked files.

- [ ] **Step 7: Cross-repo doc sync**

Report to the user that annoq-proj's `/annoq-doc-sync` skill should be run now, since this branch changes shared-contract facts (the stage-4 HRC/TOPMed split and the `search_hrc` argument) that annoq-proj's `docs/repositories.md` and `docs/architecture.md` describe. Do not run it against annoq-proj without being asked — that repo is tracked inside a larger parent git repo.

**DO NOT COMMIT.** Report the build output, the smoke-test results, and `git diff --stat`.

---

## Deferred to cutover (not this plan)

These are one-line changes that must happen when the api-v2 #78 branch is deployed to production TOPMed. Listed so they are not lost:

1. `src/lib/environment.ts` — `annotationApiV2` default from `https://api-v2-dev.topmed.annoq.org` to `https://api-v2.topmed.annoq.org`, then re-run `npm run graphql_codegen`.
2. `src/styles.css` — revert `.main-appbar` to `rgba(255, 255, 255, 0.98)` and drop `.beta-label` when the beta ends.
3. `src/App.tsx` — remove the "TopMed Beta Release" button at the same time.
4. `annoq-py` / `AnnoQR` — once the library branches merge to `main`, revert the tutorial and About
   links from `.../tree/annoq-site-78-add-hrc-mapping-info` to the plain repo URLs, in
   `public/assets/docs/docs/services/index.md`, `.../services/api.md`, `.../tutorials/annoq-py.md`,
   `.../tutorials/r-package.md`, `src/pages/StaticPages.tsx` and `src/data/staticContent.ts`.
5. SNPWay — when [Annoq_Overrepr_Workflow#9](https://github.com/USCbiostats/Annoq_Overrepr_Workflow/issues/9)
   ships, update the "pending" row in annoq-proj's fan-out table and drop the "HRC support in SNPWay
   is tracked separately" caveat from both library tutorials.

Merging this branch to `main` as-is would repoint annoq.org at a dev TOPMed instance. Item 1 is a prerequisite of any such merge.
