# AnnoQ v1 Parity (issue #11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three feature-parity gaps between `annoq-site` (v1, Angular) master and `annoq-site-v2`, so issue #11 can be closed with evidence before the v2 release.

**Architecture:** Add one guarded analytics wrapper (`src/lib/analytics.ts`) that every `gtag` call in the app routes through, extract the query-mode value→label table into `src/lib/queryModes.ts` so both the drawer UI and the analytics payload read from one source, then wire seven GA event call sites, one genome-build label, and one home-page image row. No new dependencies, no API or schema changes.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, MUI 9, Vitest 3 + @testing-library/react, GA4 via `gtag`.

**Spec:** `docs/superpowers/specs/2026-09-01-annoq-site-parity-design.md`

## Global Constraints

- **Do not check anything into version control.** No `git add`, `git commit`, `git push`, `git stash`, or branch changes. Every task ends with a verification step instead of a commit. This overrides the usual "commit frequently" rule.
- **Node.js >= 20.0.0.**
- **v2 reports to the same GA property as v1: `G-ZRDY68GK00`** (`index.html` line 5 in both repos). Event names and parameter vocabularies must match v1 verbatim, or reports fragment at the cutover.
- **`search_type` carries the human label** — `'Chromosome'`, `'VCF File'`, `'Gene Product'`, `'rsID'`, `'rsID List'` — never the internal `QueryMode` value.
- **`GENOME_BUILD` is the literal string `'GRCh37/hg19'`.** A dataset-derived value was considered and declined; see the spec's "Known limitation".
- **Do not run `npm run graphql_codegen`.** Nothing here touches the schema or the API URL.
- Baseline before starting: `npm run test` → **67 tests, 14 files, all passing.** Every task must leave the suite green.

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `src/lib/analytics.ts` | Create | Sole guarded entry point to `window.gtag`; owns the `Window.gtag` global declaration |
| `src/lib/analytics.test.ts` | Create | Proves forwarding works and that a missing `gtag` cannot throw |
| `src/lib/queryModes.ts` | Create | Single source of truth for query-mode values, labels, and keyword filtering |
| `src/lib/queryModes.test.ts` | Create | Locks the v1 label strings |
| `src/App.tsx` | Modify | Move `page_view` onto `trackEvent`; drop its local `declare global` |
| `src/features/search/SearchWorkspace.tsx` | Modify | Fire `search_submit` inside `submitSearch` |
| `src/features/search/QueryDrawer.tsx` | Modify | Consume `queryModes`; fire the three `/search` events; render the genome build |
| `src/features/search/QueryDrawer.test.tsx` | Modify | Cover the `/search` events and the genome label |
| `src/pages/SupportedAnnotationsPage.tsx` | Modify | Fire the three `/detail` events |
| `src/pages/SupportedAnnotationsPage.test.tsx` | Create | First test for this page |
| `src/pages/StaticPages.tsx` | Modify | Restore v1's two-row "Web Browser access" layout |
| `src/pages/StaticPages.test.tsx` | Create | Guard against re-collapsing the rows |
| `src/lib/config.ts` | Modify | Add `GENOME_BUILD` |
| `src/styles.css` | Modify | Add `.query-genome-build` |

---

### Task 1: Analytics module

**Files:**
- Create: `src/lib/analytics.ts`
- Create: `src/lib/analytics.test.ts`
- Modify: `src/App.tsx:17-22` (the `declare global` block) and `src/App.tsx:40-45` (the `page_view` effect)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `trackEvent(name: string, params?: Record<string, unknown>): void`, exported from `src/lib/analytics.ts`. Also owns the ambient `Window.gtag?: (...args: unknown[]) => void` declaration for the whole app — no other file may re-declare it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/analytics.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from './analytics';

afterEach(() => {
  delete window.gtag;
});

describe('trackEvent', () => {
  it('forwards the event name and params to gtag', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent('export_config', { page_path: '/search' });
    expect(gtag).toHaveBeenCalledWith('event', 'export_config', { page_path: '/search' });
  });

  it('sends an empty params object when none is given', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent('clear_selection');
    expect(gtag).toHaveBeenCalledWith('event', 'clear_selection', {});
  });

  // The GA snippet is loaded `async` and is routinely dropped by ad blockers,
  // so window.gtag really is often undefined. An unguarded call would throw
  // inside a click handler and break Submit and Export outright.
  it('does not throw when the analytics script never loaded', () => {
    expect(window.gtag).toBeUndefined();
    expect(() => trackEvent('search_submit', { search_type: 'Chromosome' })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/analytics.test.ts`
Expected: FAIL — `Failed to resolve import "./analytics"`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/analytics.ts`:

```ts
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * The single guarded path to GA. Optional-call, not decoration: the gtag
 * snippet loads `async` and ad blockers drop it, so `window.gtag` is often
 * undefined and an unguarded call would throw inside a click handler.
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  window.gtag?.('event', name, params);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/analytics.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Migrate `App.tsx` onto the module**

In `src/App.tsx`, delete this block (lines 17-22):

```tsx
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
```

Add to the imports:

```tsx
import { trackEvent } from './lib/analytics';
```

Replace the body of the `page_view` effect (lines 40-45):

```tsx
  useEffect(() => {
    trackEvent('page_view', {
      page_path: location.pathname + location.search,
      send_to: environment.googleAnalyticsId
    });
  }, [location.pathname, location.search]);
```

Leave the existing `import { environment } from './lib/environment';` in place — `send_to` still needs it.

- [ ] **Step 6: Verify the whole suite and the typecheck**

Run: `npm run test`
Expected: PASS — 70 tests, 15 files (67 baseline + 3 new).

Run: `npm run build`
Expected: exit 0. If `tsc` reports `Property 'gtag' does not exist on type 'Window'`, the `declare global` in `analytics.ts` is not being picked up — confirm the file has at least one `export` (it does), which is what makes it a module and the declaration ambient.

**Do not commit.**

---

### Task 2: Query mode table extraction

**Files:**
- Create: `src/lib/queryModes.ts`
- Create: `src/lib/queryModes.test.ts`
- Modify: `src/features/search/QueryDrawer.tsx:29-38` (delete `allModes` and `modes`), plus its two use sites at lines 114 and 137

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `QUERY_MODES: Array<{ value: QueryMode; label: string }>` (keyword filtered out while `ENABLE_KEYWORD_SEARCH` is false) and `queryModeLabel(mode: QueryMode): string`, both from `src/lib/queryModes.ts`. Task 3 calls `queryModeLabel`.

This task is a pure move plus a lookup helper. It lands on its own so that a regression in the drawer's `<Select>` has an unambiguous cause.

- [ ] **Step 1: Write the failing test**

Create `src/lib/queryModes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QUERY_MODES, queryModeLabel } from './queryModes';

// These exact strings are what v1 sent to GA as `search_type`. v2 reports to
// the same property, so changing them splits the series at the cutover.
describe('queryModeLabel', () => {
  it('returns the v1 label for every mode', () => {
    expect(queryModeLabel('chromosome')).toBe('Chromosome');
    expect(queryModeLabel('vcf')).toBe('VCF File');
    expect(queryModeLabel('geneProduct')).toBe('Gene Product');
    expect(queryModeLabel('rsID')).toBe('rsID');
    expect(queryModeLabel('rsIDList')).toBe('rsID List');
  });
});

describe('QUERY_MODES', () => {
  it('offers the five enabled modes and hides keyword search', () => {
    expect(QUERY_MODES.map((mode) => mode.value)).toEqual([
      'chromosome',
      'vcf',
      'geneProduct',
      'rsID',
      'rsIDList'
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/queryModes.test.ts`
Expected: FAIL — `Failed to resolve import "./queryModes"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/queryModes.ts`:

```ts
import type { QueryMode } from '../types';
import { ENABLE_KEYWORD_SEARCH } from './config';

const ALL_QUERY_MODES: Array<{ value: QueryMode; label: string }> = [
  { value: 'chromosome', label: 'Chromosome' },
  { value: 'vcf', label: 'VCF File' },
  { value: 'geneProduct', label: 'Gene Product' },
  { value: 'rsID', label: 'rsID' },
  { value: 'rsIDList', label: 'rsID List' },
  { value: 'keyword', label: 'Keyword Search' }
];

export const QUERY_MODES = ALL_QUERY_MODES.filter(
  (item) => ENABLE_KEYWORD_SEARCH || item.value !== 'keyword'
);

/**
 * The display label, never the QueryMode value. v1 sent this human string as
 * GA's `search_type`; v2 reports to the same property, so the vocabularies
 * have to match. Looks in the unfiltered list so a disabled mode still labels.
 */
export function queryModeLabel(mode: QueryMode): string {
  return ALL_QUERY_MODES.find((item) => item.value === mode)?.label ?? mode;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/queryModes.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Point `QueryDrawer` at the new module**

In `src/features/search/QueryDrawer.tsx`, delete lines 29-38 entirely:

```tsx
const allModes: Array<{ value: QueryMode; label: string }> = [ /* ...six entries... */ ];

const modes = allModes.filter((item) => ENABLE_KEYWORD_SEARCH || item.value !== 'keyword');
```

Add to the imports:

```tsx
import { QUERY_MODES, queryModeLabel } from '../../lib/queryModes';
```

At line 114, replace the label lookup:

```tsx
          <Typography variant="caption" className="muted">Selected: {queryModeLabel(mode)}</Typography>
```

At line 137, replace the `<Select>` options source (note the inner variable is renamed to `option`, because `mode` is already the component's state variable and shadowing it here is what makes this line hard to read):

```tsx
            {QUERY_MODES.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
```

Now fix the imports left dangling by the deletion: `ENABLE_KEYWORD_SEARCH` is still used at line 158 (`{mode === 'keyword' && ENABLE_KEYWORD_SEARCH && ...}`), so **keep** its import from `../../lib/config`. `QueryMode` is still used in the `changeMode` signature, so **keep** the `types` import too.

- [ ] **Step 6: Verify**

Run: `npm run test`
Expected: PASS — 72 tests, 16 files. The two existing `QueryDrawer submit` tests must still pass; they exercise the `<Select>` indirectly by rendering the drawer.

Run: `npm run build`
Expected: exit 0, with no "declared but never used" errors for `ENABLE_KEYWORD_SEARCH` or `QueryMode`.

**Do not commit.**

---

### Task 3: The four `/search` GA events

**Files:**
- Modify: `src/features/search/SearchWorkspace.tsx:258-269` (`submitSearch`)
- Modify: `src/features/search/QueryDrawer.tsx` — `onConfigChange` (line 88), Clear Selection (line 215), Upload Config (line 228), Export (line 230)
- Modify: `src/features/search/QueryDrawer.test.tsx`

**Interfaces:**
- Consumes: `trackEvent` (Task 1), `queryModeLabel` (Task 2).
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

In `src/features/search/QueryDrawer.test.tsx`, add `afterEach` to the vitest import, stub `URL.createObjectURL` (the Export button calls `downloadText`, which uses it, and jsdom does not implement it), and append this describe block:

```tsx
// Export/Upload/Clear/Submit were tracked in v1 (issue #59) and must keep
// firing with the same names and params — v2 reports to the same GA property.
describe('QueryDrawer analytics', () => {
  const gtag = vi.fn();

  beforeEach(() => {
    gtag.mockClear();
    window.gtag = gtag;
    URL.createObjectURL = vi.fn(() => 'blob:stub');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('fires search_submit with the v1 label, not the mode value', () => {
    const { submit } = renderDrawer();
    submit();
    expect(gtag).toHaveBeenCalledWith('event', 'search_submit', { search_type: 'Chromosome' });
  });

  it('fires export_config for the search page', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(gtag).toHaveBeenCalledWith('event', 'export_config', { page_path: '/search' });
  });

  it('fires clear_selection for the search page', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(gtag).toHaveBeenCalledWith('event', 'clear_selection', { page_path: '/search' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/search/QueryDrawer.test.tsx`
Expected: FAIL — 3 failures, each `expected "spy" to be called with arguments`, because `gtag` was never called.

- [ ] **Step 3: Fire `search_submit` from the single funnel**

In `src/features/search/SearchWorkspace.tsx`, add to the imports:

```tsx
import { trackEvent } from '../../lib/analytics';
import { queryModeLabel } from '../../lib/queryModes';
```

Replace `submitSearch` (line 258):

```tsx
export function submitSearch(
  mode: ReturnType<typeof useSearchState>['state']['mode'],
  values: ReturnType<typeof useSearchState>['state']['values'],
  selectedAnnotationNames: string[],
  filters: string[],
  dispatch: ReturnType<typeof useSearchState>['dispatch']
) {
  // Tracked here rather than in the component (v1 put it in
  // annotation.component.submit) because this is the one funnel every search
  // passes through. v1's `if (source.length > 0)` guard has no equivalent:
  // chr and pos are locked, so an empty submission is unreachable (issue #4).
  trackEvent('search_submit', { search_type: queryModeLabel(mode) });
  const request = buildRequest(mode, values, selectedAnnotationNames, filters);
  dispatch({ type: 'submit', request });
}
```

- [ ] **Step 4: Fire the three config events in `QueryDrawer`**

In `src/features/search/QueryDrawer.tsx`, add to the imports:

```tsx
import { trackEvent } from '../../lib/analytics';
```

`upload_config` goes inside `onConfigChange`, **not** on the button that opens the picker — v1 bound `trackUploadConfig` to the input's `(change)` event, so a cancelled file dialog was never counted. Replace `onConfigChange` (line 88):

```tsx
  async function onConfigChange(file?: File) {
    trackEvent('upload_config', { page_path: '/search' });
    setConfigError('');
    try {
      const source = parseConfig(await readTextFile(file));
      annotationSelection.setSelected(source.filter((name) => store.byName[name]?.leaf));
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Invalid config file');
    }
  }
```

Replace the Clear Selection button (line 215):

```tsx
        <Button size="small" onClick={() => {
          trackEvent('clear_selection', { page_path: '/search' });
          annotationSelection.setSelected([]);
        }}>Clear Selection</Button>
```

Replace the Export button (line 230):

```tsx
        <Button size="small" variant="outlined" startIcon={<SaveAltIcon />} onClick={() => {
          trackEvent('export_config', { page_path: '/search' });
          downloadText('config.txt', JSON.stringify({ _source: annotationSelection.selected }));
        }}>Export</Button>
```

Leave the Upload Config button at line 228 untouched — it only opens the picker.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/search/QueryDrawer.test.tsx`
Expected: PASS — 5 tests (2 existing + 3 new).

- [ ] **Step 6: Verify the whole suite**

Run: `npm run test`
Expected: PASS — 75 tests, 16 files.

Run: `npm run build`
Expected: exit 0.

**Do not commit.**

---

### Task 4: The three `/detail` GA events

**Files:**
- Modify: `src/pages/SupportedAnnotationsPage.tsx` — `uploadConfig` (line 37), Clear Selection (line 68), Export Config (line 71)
- Create: `src/pages/SupportedAnnotationsPage.test.tsx`

**Interfaces:**
- Consumes: `trackEvent` (Task 1).
- Produces: no new exports.

This page has no test today, so the harness has to be built from scratch. It renders `useAnnotations`, which is a TanStack Query hook, so the test mocks the hook module rather than standing up a `QueryClientProvider`.

- [ ] **Step 1: Write the failing test**

Create `src/pages/SupportedAnnotationsPage.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAnnotationStore } from '../lib/annotations';
import type { Annotation } from '../types';
import { AnnotationSelectionProvider } from '../features/annotations/AnnotationSelectionProvider';
import { SupportedAnnotationsPage } from './SupportedAnnotationsPage';

const store = buildAnnotationStore([
  { id: '1', name: 'Basic Info', leaf: false },
  { id: '2', parent_id: '1', name: 'chr', leaf: true },
  { id: '3', parent_id: '1', name: 'pos', leaf: true }
] as Annotation[]);

// Mock the hook rather than standing up a QueryClientProvider: the page only
// needs the resolved store, and no network call is under test here.
vi.mock('../features/annotations/useAnnotations', () => ({
  useAnnotations: () => ({ data: store, isLoading: false, error: null })
}));

const gtag = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  gtag.mockClear();
  window.gtag = gtag;
  URL.createObjectURL = vi.fn(() => 'blob:stub');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  delete window.gtag;
});

function renderPage() {
  render(
    <AnnotationSelectionProvider>
      <SupportedAnnotationsPage />
    </AnnotationSelectionProvider>
  );
}

// v1 tracked these three on /detail (issue #59, detail.component.ts).
describe('SupportedAnnotationsPage analytics', () => {
  it('fires export_config for the detail page', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Export Config' }));
    expect(gtag).toHaveBeenCalledWith('event', 'export_config', { page_path: '/detail' });
  });

  it('fires clear_selection for the detail page', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(gtag).toHaveBeenCalledWith('event', 'clear_selection', { page_path: '/detail' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/SupportedAnnotationsPage.test.tsx`
Expected: FAIL — 2 failures, `expected "spy" to be called with arguments`.

- [ ] **Step 3: Write the implementation**

In `src/pages/SupportedAnnotationsPage.tsx`, add to the imports:

```tsx
import { trackEvent } from '../lib/analytics';
```

Replace `uploadConfig` (line 37) — the event fires on file change, matching v1's `(change)` binding:

```tsx
  async function uploadConfig(file?: File) {
    trackEvent('upload_config', { page_path: '/detail' });
    try {
      setError('');
      if (!file || !store) return;
      const source = parseConfig(await file.text()).filter((name) => store.byName[name]?.leaf);
      setSelected(source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid config file');
    }
  }
```

Replace the Clear Selection button (line 68):

```tsx
            <Button variant="outlined" onClick={() => {
              trackEvent('clear_selection', { page_path: '/detail' });
              setSelected([]);
            }}>Clear Selection</Button>
```

Replace the Export Config button (line 71):

```tsx
            <Button variant="contained" onClick={() => {
              trackEvent('export_config', { page_path: '/detail' });
              downloadText('config.txt', JSON.stringify({ _source: selected }));
            }}>Export Config</Button>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/pages/SupportedAnnotationsPage.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Verify the whole suite**

Run: `npm run test`
Expected: PASS — 77 tests, 17 files.

Run: `npm run build`
Expected: exit 0.

**Do not commit.**

---

### Task 5: Genome build label (v1 issue #88)

**Files:**
- Modify: `src/lib/config.ts` (append)
- Modify: `src/features/search/QueryDrawer.tsx:113-114` (the header `Box`)
- Modify: `src/styles.css` (after the `.muted` rule at line 396)
- Modify: `src/features/search/QueryDrawer.test.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1-4.
- Produces: `GENOME_BUILD: string` from `src/lib/config.ts`.

- [ ] **Step 1: Write the failing test**

Append to `src/features/search/QueryDrawer.test.tsx`:

```tsx
// v1 issue #88 put this in the Input Query heading, right after "(Selected: …)".
describe('QueryDrawer genome build', () => {
  it('states the genome build the dataset is based on', () => {
    renderDrawer();
    expect(screen.getByText('AnnoQ is based on GRCh37/hg19')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/search/QueryDrawer.test.tsx`
Expected: FAIL — `Unable to find an element with the text: AnnoQ is based on GRCh37/hg19`.

- [ ] **Step 3: Add the constant**

Append to `src/lib/config.ts`:

```ts
/**
 * v1 issue #88. Hardcoded, as v1 was: v1 only ever served HRC.
 *
 * Known limitation, accepted deliberately — this is wrong when v2 is pointed
 * at the TOPMed stack (VITE_ANNOQ_API_V2=https://api-v2.topmed.annoq.org),
 * which is GRCh38/hg38. Isolated here so retargeting is a one-line change.
 * See docs/superpowers/specs/2026-09-01-annoq-site-parity-design.md.
 */
export const GENOME_BUILD = 'GRCh37/hg19';
```

- [ ] **Step 4: Render it in the drawer header**

In `src/features/search/QueryDrawer.tsx`, extend the existing `ENABLE_KEYWORD_SEARCH` import from `../../lib/config` to also bring in `GENOME_BUILD`:

```tsx
import { ENABLE_KEYWORD_SEARCH, GENOME_BUILD } from '../../lib/config';
```

Add a third line inside the header `Box`, immediately after line 114 — this is where v1 put it, inside `.annoq-section-heading` after `(Selected: …)`, and **not** in the yellow `.query-provider-note` strip below, which renders a different v1 element:

```tsx
        <Box>
          <Typography variant="subtitle2">Input Query</Typography>
          <Typography variant="caption" className="muted">Selected: {queryModeLabel(mode)}</Typography>
          <Typography variant="caption" className="query-genome-build">AnnoQ is based on {GENOME_BUILD}</Typography>
        </Box>
```

- [ ] **Step 5: Add the style rule**

In `src/styles.css`, after the `.muted` rule, add — mirroring v1's `.annoq-genome-version`:

```css
.query-genome-build {
  margin-left: 8px;
  color: rgba(0, 0, 0, 0.54);
  font-style: italic;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/features/search/QueryDrawer.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 7: Verify the whole suite**

Run: `npm run test`
Expected: PASS — 78 tests, 17 files.

Run: `npm run build`
Expected: exit 0.

**Do not commit.**

---

### Task 6: Home page `ui-query.png` row

**Files:**
- Modify: `src/pages/StaticPages.tsx:62-92` (the "Web Browser access" `Container`)
- Create: `src/pages/StaticPages.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: no new exports.

v1 had two rows here; v2 merged them and lost the screenshot. The asset already exists at `public/assets/images/ui-query.png` and is referenced nowhere.

- [ ] **Step 1: Write the failing test**

Create `src/pages/StaticPages.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/StaticPages.test.tsx`
Expected: FAIL — `Unable to find an element with the alt text: AnnoQ query interface`.

- [ ] **Step 3: Restore v1's two-row layout**

In `src/pages/StaticPages.tsx`, replace the whole "Web Browser access" `Container` (lines 62-92) with two `Grid container` rows — copy + laptop, then screenshot + steps, matching v1's `annoq-easyuse` and `annoq-ui` rows in that order:

```tsx
      <Container className="content-section">
        <Typography variant="h4" align="center" gutterBottom>Web Browser access</Typography>
        <Grid container spacing={3} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="h5">Easy To Use Interactive Query to support researchers</Typography>
            <Typography>Web interface with categories to focus on annotations of interest for biomedical objectives.</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <img src="/assets/images/doctor-laptop.png" className="responsive-img" alt="" />
          </Grid>
        </Grid>
        <Grid container spacing={3} sx={{ alignItems: 'center', mt: 1 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <img src="/assets/images/ui-query.png" className="responsive-img" alt="AnnoQ query interface" />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={1.1}>
              {[
                ['Select annotations', 'Organized in tree structure'],
                ['Choose Query Type', '5 types of supported queries'],
                ['Submit query', ''],
                ['View Results', 'Displayed in table and summary page'],
                ['Download Results', 'A generated file is ready to download']
              ].map(([step, detail], index) => (
                <Paper key={step} className="step-row">
                  <span className="step-number">{index + 1}</span>
                  <Box>
                    <Typography className="step-title">{step}</Typography>
                    {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <Button component={RouterLink} to="/docs/tutorials/ui-query" variant="outlined">More Info</Button>
                </Paper>
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Container>
```

The step data, `.step-row` markup, and "More Info" buttons are unchanged — only the surrounding grid structure moved.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/pages/StaticPages.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 5: Verify the whole suite**

Run: `npm run test`
Expected: PASS — 79 tests, 18 files.

Run: `npm run build`
Expected: exit 0.

**Do not commit.**

---

### Task 7: Final release gate

**Files:** none modified.

- [ ] **Step 1: Full suite**

Run: `npm run test`
Expected: PASS — 79 tests across 18 files, 0 failures.

- [ ] **Step 2: Full typecheck and bundle**

Run: `npm run build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 3: Manual smoke check of the two visual changes**

Run: `npm run dev`

- Open `/search`, open the query drawer: the header reads `Input Query` / `Selected: Chromosome` / *AnnoQ is based on GRCh37/hg19* in italic grey.
- Open `/`: the "Web Browser access" section has two rows, the second showing `ui-query.png` to the left of the five numbered steps.

- [ ] **Step 4: Confirm the working tree is uncommitted**

Run: `git status --short`
Expected: modified/untracked files listed, and `git log --oneline -1` still shows `9c3ddf3`. Nothing has been staged or committed.

- [ ] **Step 5: Verify the GA events in the browser**

With `npm run dev` running, open DevTools → Network, filter `google-analytics.com/g/collect`, then:

| Action | Expect `en=` |
| --- | --- |
| Navigate between pages | `page_view` |
| `/search` → Submit | `search_submit` with `ep.search_type=Chromosome` |
| `/search` → Export | `export_config` with `ep.page_path=/search` |
| `/search` → Clear Selection | `clear_selection` with `ep.page_path=/search` |
| `/search` → Upload Config, pick a file | `upload_config` with `ep.page_path=/search` |
| `/detail` → Export Config | `export_config` with `ep.page_path=/detail` |
| `/detail` → Clear Selection | `clear_selection` with `ep.page_path=/detail` |
| `/detail` → Upload Config, pick a file | `upload_config` with `ep.page_path=/detail` |

If no `collect` requests appear at all, an ad blocker is dropping the gtag snippet. That is the exact condition Task 1's third test covers — the app must keep working, with the events simply not sent. Confirm Submit and Export still function, then re-check in a clean profile.

**Do not commit.**
