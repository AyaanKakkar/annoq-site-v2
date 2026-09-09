# Testing And Development

## Install

```bash
npm install
```

## Development Server

```bash
npm run dev
```

Default Vite output is usually:

```text
http://localhost:5173/
```

## Build

```bash
npm run build
```

This runs TypeScript build first, then Vite build.

Current known warning:

```text
Some chunks are larger than 500 kB after minification
```

This is a warning, not a build failure. The large data/import surface and chart/UI libraries contribute to bundle size.

## Refresh Backend Schema Types

```bash
npm run graphql_codegen
```

Regenerates `src/generated/graphql.ts` from the live schema and is safe to run any time. The
file is committed, so review `git diff src/generated/graphql.ts` afterwards. Details and
overrides are in [Backend API And GraphQL](./backend-api-and-graphql.md).

## Tests

Run all tests:

```bash
npm test
```

Run one test file:

```bash
npm test -- src/lib/queryBuilder.test.ts
```

Current test files:

- `src/lib/files.test.ts`
- `src/lib/annotations.test.ts`
- `src/lib/queryBuilder.test.ts`
- `src/features/search/QueryDrawer.test.tsx`

Component tests render with `@testing-library/react` (jsdom environment, `src/test/setup.ts`).
The annotation tree is virtualized and jsdom reports zero-height elements, so a component test
that needs a selection should drive `useAnnotationSelection().setSelected` from a small helper
component rather than clicking tree rows.

## What Is Covered

Current tests cover:

- Config parsing and file helpers.
- Annotation tree/store helpers.
- Query builder behavior.
- Query drawer empty-selection warning lifecycle.

## What Should Be Added Next

Useful future tests:

- Query form validation for all query modes.
- Search reducer state transitions.
- Stats field selection behavior.
- Download query payload shape.
- Results table filter and pin behavior.
- Docs path resolution.
- Supported annotations config import/export flow.

## Environment Variables

Vite environment variables must be prefixed with `VITE_`.

See:

```text
src/lib/environment.ts
```

Common local override example:

```bash
VITE_ANNOQ_API_V2=https://api-v2.annoq.org npm run dev   # point back at the HRC stack
```

## Pre-Commit Sanity Check

Before handing changes back:

```bash
npm run build
npm test
```
