# Project Overview

## Purpose

`annoq-site-v2` is the React replacement for the old Angular AnnoQ website. The old site lived in `../annoq-site` and used Angular 13. This version is a fresh React 19 + TypeScript app built with Vite.

The app is both an informational website and a query tool for variant annotation data.

## Main User Areas

The site has four broad areas:

- Static public pages:
  Home, About, Release/News, Contact, Cookie Policy, Version.

- Markdown documentation:
  A docs section with left navigation and markdown rendering.

- Supported annotations:
  A backend-driven annotation browser with selectable annotation fields, config import/export, and data version information.

- Search/query UI:
  A form-driven query workflow with annotation selection, backend GraphQL requests, paginated table results, filters, summary, stats, detail panels, and downloads.

## Technology Stack

- React 19
- TypeScript
- Vite
- React Router
- Material UI
- TanStack Query
- Recharts
- React Markdown
- remark-gfm
- rehype-raw
- Vitest

TanStack Table and TanStack Virtual are installed but the current results table uses a simple custom table because the simpler implementation performs smoothly with the backend-paginated result size and avoids earlier freezing issues.

## Backend

By default the app talks to:

```text
https://api-v2-dev.topmed.annoq.org
```

Backend endpoints used by this app:

- REST annotations endpoint: `/annotations`
- GraphQL endpoint: `/graphql`
- Generated download files: `/download<backend-returned-path>`

Configuration is centralized in `src/lib/environment.ts` and `src/lib/config.ts`.

## Design Goal

The visual direction is intentionally close to the original Angular Material site:

- White top bar.
- Dark navy primary color.
- Gold/yellow accent, but used sparingly.
- Compact forms.
- Dense result table.
- Professional biomedical/research-tool tone.

The goal is not pixel-perfect parity. The goal is familiar AnnoQ behavior with a more maintainable React implementation.

