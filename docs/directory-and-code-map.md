# Directory And Code Map

This file maps the repository by folder and explains what each area owns.

## Top-Level Files

```text
annoq-site-v2/
  docs/
  metadata/
  public/
  src/
  index.html
  package.json
  graphql_codegen.ts
  vite.config.ts
  vitest.config.ts
  tsconfig*.json
```

`graphql_codegen.ts` configures `npm run graphql_codegen`, which regenerates
`src/generated/graphql.ts` from the live backend schema.

## `metadata/`

`annotation_tree.csv` — the hand-maintained source of truth for the AnnoQ annotation tree, plus its
`README.md`. **Not used by the app at runtime**: the tree the UI renders is built from the api-v2
response in `src/lib/annotations.ts`. This directory is build-time input for
[annoq-data-builder](https://github.com/USCbiostats/annoq-data-builder), which generates
`anno_tree.json`, `api_mapping_anno_tree.json`, `annoq_mappings.json` and `doc_type.pkl` from it.

Replicated from `annoq-site/metadata` and **not yet canonical** — see
[`metadata/README.md`](../metadata/README.md) for the migration status.

## `docs/`

Developer-facing repository documentation. These files are not rendered by the app. They explain how the codebase works.

## `public/`

Static assets served directly by Vite.

Important paths:

- `public/assets/docs/`
  Markdown files rendered by `src/pages/DocsPage.tsx`.

- `public/assets/images/`
  Images used by the landing page, docs, and static content.

- `public/assets/icons/`
  Legacy icon/font assets copied from the old site.

Files in `public/` are referenced from the browser with root-relative paths such as:

```text
/assets/images/doctor-laptop.png
```

## `src/`

Application source code.

```text
src/
  App.tsx
  main.tsx
  styles.css
  theme.ts
  types.ts
  components/
  data/
  features/
  generated/
  lib/
  pages/
  test/
```

`src/generated/` holds committed codegen output. Do not hand-edit it.

## `src/main.tsx`

App bootstrap. It mounts React and wraps the app with:

- `ThemeProvider`
- `CssBaseline`
- `QueryClientProvider`
- `BrowserRouter`

## `src/App.tsx`

Top-level app shell:

- Defines main routes.
- Renders top navigation.
- Handles mobile nav drawer.
- Installs Google Analytics page-view tracking.
- Wraps routes with `AnnotationSelectionProvider`.
- Wraps `/search` with `SearchProvider`.
- Hides the footer on `/search`.

## `src/theme.ts`

Material UI theme:

- Primary navy: `#183153`
- Secondary gold: `#ebc336`
- Background: `#f6f8fb`
- Button typography defaults.
- Toolbar background defaults.

Most detailed layout/styling is in `src/styles.css`.

## `src/styles.css`

Global styling for:

- Top bar.
- Landing page sections.
- Cards and buttons.
- Search layout and drawers.
- Results table.
- Filter chips.
- Docs page.
- Supported annotations page.
- Footer.
- Mobile layout rules.

This project currently uses global class names rather than CSS modules.

## `src/types.ts`

Shared TypeScript domain types:

- `Annotation`
- `AnnotationNode`
- `AnnotationStore`
- `QueryMode`
- `QueryFormValues`
- `QueryRequest`
- `ResultPage`
- `StatsResult`
- panel and side-panel string unions.

When adding new query modes or result data shapes, update this file first.

## `src/components/`

Shared generic components.

Current file:

- `Footer.tsx`
  Site footer for non-search pages.

## `src/data/`

Static app data.

- `staticContent.ts`
  Release/news data and browser compatibility rows.

- `samples.ts`
  Sample rsID list and VCF content used by the query form.

- `panther_terms.json`
  Large local lookup map used by cell formatting for term IDs.

## `src/pages/`

Route-level pages.

- `StaticPages.tsx`
  Home, About, News/Release, Contact, Cookie Policy, Version.

- `DocsPage.tsx`
  Markdown docs renderer and docs navigation.

- `SupportedAnnotationsPage.tsx`
  Supported annotations browser and data versions tab.

## `src/features/annotations/`

Annotation metadata and annotation selection UI.

- `useAnnotations.ts`
  TanStack Query hook that fetches `/annotations`.

- `AnnotationSelectionProvider.tsx`
  Shared selected-annotations context backed by `localStorage`.

- `AnnotationTree.tsx`
  Searchable, selectable annotation tree.

- `AnnotationDetailDialog.tsx`
  Table-style details dialog for one annotation field.

## `src/features/search/`

The main query UI.

- `SearchWorkspace.tsx`
  Search page layout, drawers, result loading effects, stats loading effects.

- `searchState.tsx`
  Reducer/context for query UI state.

- `QueryDrawer.tsx`
  Left drawer containing query inputs and annotation selection.

- `ResultsTable.tsx`
  Results table, pagination, download, filters, column pinning, row selection.

- `SummaryPanel.tsx`
  Search summary, position range, per-column with-values counts.

- `StatsPanel.tsx`
  Recharts visualizations for availability, top values, and position histogram.

- `FilterPanel.tsx`
  Side drawer UI for filters.

- `DetailPanel.tsx`
  Side drawer UI for selected row details.

## `src/lib/`

Reusable logic and backend helpers.

- `api.ts`
  REST and GraphQL request functions.

- `environment.ts`
  Vite environment variable reading and defaults.

- `config.ts`
  Runtime constants derived from environment.

- `annotations.ts`
  Builds the normalized annotation store and tree.

- `queryBuilder.ts`
  Maps query modes to GraphQL query strings and normalizes responses.

- `files.ts`
  VCF parsing, rsID list parsing, config parsing, text download helper.

- `formatters.tsx`
  Result-cell formatting, links, term display, gene display, overflow dialogs.

- `*.test.ts`
  Unit tests for important helpers.

## `src/test/`

Vitest setup.

- `setup.ts`
  Test environment setup, currently imports Testing Library jest-dom matchers.
