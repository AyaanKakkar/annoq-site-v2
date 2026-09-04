# Static Content And Docs Pages

## Static React Pages

Static pages are implemented in:

```text
src/pages/StaticPages.tsx
```

This file contains:

- Landing page.
- About page.
- Release/news page.
- Contact page.
- Cookie policy page.
- Version page.

Supporting static data:

```text
src/data/staticContent.ts
```

## Landing Page

Component:

```text
HomePage
```

Major sections:

- Release banner.
- Hero with video.
- Variant/annotation stat cards.
- TOPMed section.
- Web Browser Access workflow.
- Additional Programmatic Access. Each card's icon is a brand logo
  (`swagger.svg`, `python.svg`, `r-package.svg`) linking out to that project;
  the card's button still goes to the internal docs route (issue #19).
- Publication.
- Trusted resources.
- Browser compatibility table.

Images are loaded from:

```text
public/assets/images/
```

## Release/News Page

Component:

```text
NewsPage
```

Data source:

```text
src/data/staticContent.ts
```

Release descriptions can include trusted HTML links. They are rendered with `dangerouslySetInnerHTML`, so only put known, local, curated content in this data file.

## Version Page

Component:

```text
VersionPage
```

It loads annotation metadata through `useAnnotations`, filters annotations with a `version`, and renders the data version table.

## Markdown Docs

Component:

```text
src/pages/DocsPage.tsx
```

Markdown files:

```text
public/assets/docs/
```

Docs navigation is currently hardcoded in `DocsPage.tsx` as `sections`.

## Docs Path Resolution

`DocsPage` maps browser routes to markdown files.

Examples:

| Browser Route | Markdown File |
| --- | --- |
| `/docs` | `/assets/docs/index.md` |
| `/docs/services` | `/assets/docs/docs/services/index.md` |
| `/docs/services/api` | `/assets/docs/docs/services/api.md` |
| `/docs/tutorials/ui-query` | `/assets/docs/docs/tutorials/ui-query.md` |

## Markdown Rendering

Libraries:

- `react-markdown`
- `remark-gfm`
- `rehype-raw`

Custom renderers:

- Links: internal docs links navigate client-side when possible.
- Images: constrained with `.docs-media`.
- Iframes: rendered and constrained with `.docs-iframe`.
- Headings/paragraphs: converted to MUI typography.

`a`, `p`, and `img` forward `className` from the source; `a` also forwards
`target` and `rel`. That is what lets a raw HTML block in a `.md` file be
styled and opened in a new tab -- without it the renderer silently drops those
attributes. On `img` an explicit class *replaces* `docs-media` rather than
joining it, so a small inline logo does not inherit the centred full-width
figure layout.

### API callout

`/docs/services` and `/docs/services/api` open with a `.docs-callout` block
(raw HTML in the markdown, styles in `src/styles.css`) carrying the Swagger
logo and a button-styled link to `https://api-v2.annoq.org/docs`. Hardcoded,
not derived from `API_BASE`: these files are static assets served outside the
app's config. Issue #19.

## Adding A Docs Page

1. Add the markdown file under `public/assets/docs/docs/...`.
2. Add a nav entry in `sections` inside `src/pages/DocsPage.tsx`.
3. Verify the route resolves to the intended markdown path.

