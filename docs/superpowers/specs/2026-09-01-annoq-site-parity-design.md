# Design for #11: Incorporate updates from annoq-site master

Issue: [USCbiostats/annoq-site-v2#11](https://github.com/USCbiostats/annoq-site-v2/issues/11) —
"When ready to release, ensure all fixes and updates from
[USCbiostats/annoq-site](https://github.com/USCbiostats/annoq-site) are incorporated."

The issue body is empty, so this document establishes what the work is, then does it.

## The timeline finding that defines the scope

The obvious reading of #11 is "cherry-pick whatever landed in v1 after the fork." That reading is
wrong, and the commit dates say why:

| Repo | First commit | Last commit |
| --- | --- | --- |
| `annoq-site` (v1, Angular 13) | — | 2026-04-29 (`fbac493`, issue #88) |
| `annoq-site-v2` (React 19) | 2026-05-01 (`7dd0f4a`, "basic site") | 2026-09-01 (`9c3ddf3`) |

v1's last commit lands two days *before* v2's first, and v1 has not moved since. Nothing has drifted
in. So there is no set of "recent v1 changes" to port, and #11 can only mean one thing:
**a full feature-parity audit of v2 against the whole of v1 master**, closed with evidence.

That is what this document is. It is a release gate, not a feature.

## Audit method

v1 master was cloned and read directly (`git clone --depth 200`), then compared against the v2
working tree area by area: routes, page content, the search workflow, the annotation system, static
assets, and analytics. Where v1 carried an issue number, the originating commit was diffed to
confirm exactly what that issue added.

Two limits on this method, stated plainly:

- It is a **static read of both codebases**. It proves that equivalent code exists; it does not
  prove runtime behaviour matches on the live API.
- v1's `metadata/annotation_tree.csv` is backend seed data, not site behaviour. The
  `enhancer_linked_assay` fix (`af5c291`) lives there and is out of scope for the site repo.

## Audit result: v2 is at parity except in three places

Verified present and equivalent in v2:

| Area | v1 | v2 |
| --- | --- | --- |
| Routes (11) | `pages.module.ts` | `App.tsx` — identical set, including the three `/docs` forms |
| Docs system | `docs.component.ts` | `DocsPage.tsx` — same section list, same `resolveAssetPath`, same frontmatter stripping |
| Docs content (8 files) | `src/assets/docs/**` | `public/assets/docs/**` — byte-equivalent |
| Release/news table | `release.component.ts` | `data/staticContent.ts` — same 7 entries incl. TopMed `2.0-beta.1` |
| Version page | `version.component.html` | `StaticPages.tsx` `VersionContent` |
| About / Contact / Cookie Policy | three components | `StaticPages.tsx` |
| Home page | `home.component.html` | `StaticPages.tsx` `HomePage` — incl. TOPMed beta band and browser table |
| Footer / toolbar / busy bar | `footer`, `toolbar` components | `Footer.tsx`, `App.tsx`, `BusyBar.tsx` |
| Annotation tree + search filter | `annotation-tree.component` | `AnnotationTree.tsx` (virtualized, with query filter) |
| Query types (5) | `snp.service.ts` `inputType` | `QueryDrawer.tsx` `allModes` |
| Sample rsID / VCF, file upload | `annotation.component.ts` | `QueryDrawer.tsx` |
| Config import/export | `annotation.service.ts` | `lib/files.ts` |
| URL deep links (`query_type`/`chr`/`start`/`end`/`gp`) | `search.component.ts` | `QueryDrawer.tsx:73-84` |
| Filters, detail panel, summary, stats | four components | `FilterPanel`, `DetailPanel`, `SummaryPanel`, `StatsPanel` |
| GA `page_view` on navigation | `app.component.ts` (issue #59) | `App.tsx:41` |

Three gaps remain. They are the whole of the implementation work.

### Gap 1 — GA custom events (v1 issue #59, commit `0f67ad1`)

v1 issue #59 added five things: `page_view` on navigation, plus four interaction events. v2 ported
the first and none of the rest. Missing: `search_submit`, `export_config`, `upload_config`,
`clear_selection`.

**Why this is release-blocking rather than cosmetic.** v2 reports to `G-ZRDY68GK00` — the same GA
property as v1 (`index.html` line 5 in both repos). At the v1→v2 cutover the property keeps
receiving `page_view` but silently stops receiving every interaction event, so any funnel or
engagement report spanning the cutover breaks without an error anywhere.

The same shared-property fact constrains the payloads: **event names and parameter vocabularies must
match v1 exactly**, or the series fragment into two incomparable halves. Specifically, v1 sends
`search_type` as the human label (`'Chromosome'`, `'VCF File'`, `'rsID List'`), never the internal
id. v2's `QueryMode` values are `'chromosome'`, `'vcf'`, `'rsIDList'`, so the label must be looked
up rather than passed through.

### Gap 2 — Genome build label (v1 issue #88, commit `b0b38ae`)

v1's newest commit added `AnnoQ is based on GRCh37/hg19` to the Input Query heading, styled
`.annoq-genome-version` (italic, `rgba(0,0,0,0.54)`, 8px left margin). v2 has no equivalent.

### Gap 3 — Missing `ui-query.png` on the home page (cosmetic)

v1's "Web Browser access" section is two rows: copy + `doctor-laptop.png`, then `ui-query.png` +
the five numbered steps. v2 (`StaticPages.tsx:63-91`) merged them into one row and dropped the
screenshot. The asset is already present at `public/assets/images/ui-query.png` (99 KB) and is
referenced nowhere.

## Design

### Analytics module

`src/lib/analytics.ts` becomes the single guarded path to `gtag`:

```ts
declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  window.gtag?.('event', name, params);
}
```

`App.tsx` moves its `declare global` (line 20) and its `page_view` call (line 41) onto it.

The optional call is the load-bearing part, not a stylistic flourish: the GA snippet is loaded
`async` and is routinely dropped by ad blockers, so `window.gtag` is genuinely often `undefined`.
An unguarded call would throw inside a click handler and break Submit and Export outright for those
users. v1 was exposed to this — it declared `gtag` as a bare global and called it directly in three
components.

### Event call sites

| Event | Params | v1 origin | v2 site |
| --- | --- | --- | --- |
| `search_submit` | `search_type: <label>` | `annotation.component.ts:141` | `SearchWorkspace.tsx` `submitSearch` |
| `export_config` | `page_path: '/search'` | `annotation.component.ts:119` | `QueryDrawer.tsx:230` |
| `export_config` | `page_path: '/detail'` | `detail.component.ts:95` | `SupportedAnnotationsPage.tsx:71` |
| `upload_config` | `page_path: '/search'` | `annotation.component.ts:124` | `QueryDrawer.tsx:228` |
| `upload_config` | `page_path: '/detail'` | `detail.component.ts:105` | `SupportedAnnotationsPage.tsx:69` |
| `clear_selection` | `page_path: '/search'` | *(new — see below)* | `QueryDrawer.tsx:215` |
| `clear_selection` | `page_path: '/detail'` | `detail.component.ts:100` | `SupportedAnnotationsPage.tsx:68` |

Three decisions, recorded:

1. **`clear_selection` also fires on `/search`.** v1 tracked it only on `/detail`; its `/search`
   Clear Selection button (`annotation.component.html:127`) called the service directly and went
   untracked, which reads as an oversight rather than intent. The `page_path` param keeps v1's
   historical `/detail` series intact and comparable.

2. **`search_submit` fires inside `submitSearch`, not in the component.** v1 put it in
   `annotation.component.submit()`. `submitSearch` (`SearchWorkspace.tsx:258`) is the single funnel
   every search passes through, so placing it there cannot be bypassed. This requires the mode label
   at that point, which drives decision 3.

3. **`allModes` moves out of `QueryDrawer.tsx:29` into `src/lib/queryModes.ts`**, exporting
   `QUERY_MODES` and `queryModeLabel(mode)`. A pure move of ~15 lines; `QueryDrawer` imports it back
   for its `<Select>` and its header. This removes the duplicate value→label mapping that would
   otherwise appear in two files.

v1 guarded the event behind `if (source.length > 0)`, because a search with zero annotations
selected was reachable. It is not reachable in v2 — `chr` and `pos` are locked
(`config.ts:20`, issue #4), which is why `QueryDrawer.submit()` carries no empty-selection guard.
The guard has no v2 equivalent and is deliberately not ported.

### Genome build label

`src/lib/config.ts`:

```ts
export const GENOME_BUILD = 'GRCh37/hg19';
```

Rendered in the `QueryDrawer` header. v1 placed it inline after `(Selected: …)`; v2 gives it its own
line above "Input Query" — see "Deliberate divergences from v1" below.

One `styles.css` rule mirrors `.annoq-genome-version`:

```css
.query-genome-build { color: rgba(0, 0, 0, 0.54); font-style: italic; }
```

**Known limitation, accepted deliberately.** This string is wrong when v2 is pointed at the TOPMed
stack. v1 could hardcode it because v1 only ever served HRC; v2 targets both datasets through
`environment.dataset` / `environment.annotationApiV2`, and TOPMed Freeze 8 is GRCh38/hg38, already
deployed at `topmed.annoq.org`. A dataset-derived label was considered and declined in favour of
matching v1 exactly. The value is isolated in a single named constant so retargeting is a one-line
change. This is recorded here so it is not later rediscovered as a bug.

### Home page rows

Restore v1's two-row structure in `StaticPages.tsx`: copy + `doctor-laptop.png`, then
`ui-query.png` + the five `.step-row` cards, reusing the existing `.responsive-img` class.

## Testing

Baseline before any change: **67 tests across 14 files, all passing.**

- `src/lib/analytics.test.ts` (new) — `trackEvent` forwards name and params to `window.gtag`, and
  no-ops without throwing when `window.gtag` is `undefined`. The second case is the one that
  matters; see the analytics module rationale above.
- `QueryDrawer.test.tsx` — Submit fires `search_submit` with the label `'Chromosome'` (not
  `'chromosome'`); Export and Upload Config fire with `page_path: '/search'`.
- `SupportedAnnotationsPage.test.tsx` (new file — this page has no test today) — Export, Upload and
  Clear fire with `page_path: '/detail'`.

Each stubs `window.gtag` with a `vi.fn()`.

Gate: `npm run test`, then `npm run build` (`tsc -b && vite build`). `npm run graphql_codegen` is
**not** run — nothing here touches the schema or the API URL, so the ordering constraint in the
README does not apply.

## Sequencing

Three independent changes; this order keeps each step independently verifiable.

1. `analytics.ts` + `App.tsx` migration + its test. Nothing else is testable until the module
   exists, and doing it first proves the existing `page_view` path still works before new call
   sites hang off it.
2. `queryModes.ts` extraction, then the seven event call sites. The extraction lands separately so
   that a regression in `QueryDrawer`'s `<Select>` has an unambiguous cause.
3. Genome label, then the home page rows. Independent of 1–2 and of each other.

On release timing: #11 is explicitly a pre-release gate. This should land before the v2 cutover, and
before v2 sends real traffic to `G-ZRDY68GK00` — otherwise the shared property records a window of
v2 page views with no interaction events, which is harder to interpret later than a clean break.

## Deliberate divergences from v1

The audit above establishes parity. These four changes then move v2 *away* from v1 on purpose, on
review of the assembled query drawer. They are listed here so a future reader does not file them as
parity regressions.

### The query drawer header was restructured

v1's heading was one line: `Input Query (Selected: X) AnnoQ is based on GRCh37/hg19`. v2's is two,
bottom-aligned in the header panel:

```text
AnnoQ is based on GRCh37/hg19
Input Query: X
```

v1's `(Selected: X)` became a colon on the heading itself. "Selected" collided with the annotation
*selection* the tree below manages, and the separate label word was redundant once the value sat
directly after the heading.

### The IMAGE Project provider note was removed

v2 rendered v1's left-drawer title ("Variants Annotation Query Provided by IMAGE Project") as a
yellow `.query-provider-note` strip under the heading. Removed, along with its CSS rule. The
attribution still appears on the home page and in the footer.

### The busy bar no longer covers the drawer heading

**Bug.** `.busy-bar` is `position: fixed; top: var(--annoq-appbar-h); left: 0; right: 0` with
`z-index: 1201`; `.query-drawer` starts at the same `top` with MUI's default drawer `z-index: 1200`.
The bar therefore painted over the top of the drawer, hiding "Input Query" for the whole duration of
a search.

Fixed by having `BusyBar` publish its measured height as `--annoq-busy-h` (`0px` while idle), which
`.query-drawer-title` reserves as top padding. This follows the existing `--annoq-appbar-h` pattern
and deliberately does *not* move the drawer: shifting it on every busy toggle would relayout the
results table, which is the exact cost the bar's fixed positioning was designed to avoid (issue #12).

### Header text is bottom-aligned

`.query-drawer-title` is `align-items: flex-end`, so the heading sits against the bottom of the
panel and the reserved busy-bar padding opens above it rather than pushing it down.

## Considered, not changed

**Download uses `window.open` after an `await`** (`ResultsTable.tsx:116`). The URL is resolved by a
GraphQL round trip inside `busy.run(...)`, so the click's transient user activation may have expired
by the time the tab is opened, and a popup blocker can then discard it silently. v1 avoided the
shape entirely by resolving to a `Download-Ready` dialog containing a real anchor.

Left as is, by decision: `busy.run('Preparing download…')` drives the BusyBar for the duration, so
the user has a visual cue that the work is happening and completes. It is also a v2 implementation
detail rather than anything v1 master changed, so it falls outside what #11 asks for.

**Not ported from v1, by design:** splash screen, quick panel, `ngx-translate` i18n scaffolding,
perfect-scrollbar, the material colour picker, and the `publication` component (declared in v1 but
never routed; its content lives in v2's home and about pages). Keyword search remains disabled in
both (`ENABLE_KEYWORD_SEARCH = false`, `config.ts:21`; commented out in v1's `snp.service.ts`).

## Out of scope

- `metadata/annotation_tree.csv` (`af5c291`, `enhancer_linked_assay`) — backend seed data.
- `scripts/update_site_nginx.sh` — v1's nginx deploy script. v2's deployment story is separate
  from #11.
- Runtime verification against the live API — this audit is a static comparison, and says so.
