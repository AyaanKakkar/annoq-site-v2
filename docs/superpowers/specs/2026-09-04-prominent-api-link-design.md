# Make the API service prominent

Issue: [#19](https://github.com/USCbiostats/annoq-site-v2/issues/19)

## Problem

The API is the entry point for every programmatic use of AnnoQ, but on
`/docs/services` it is one inline link inside a paragraph, and on
`/docs/services/api` it is a sentence. On the landing page the three
"Additional Programmatic Access" cards were worse than anonymous: API and
Python shared the same `CodeIcon`, and R got `ArticleIcon`. Nothing was
clickable but the buttons.

## Docs pages

Both `/docs/services` and `/docs/services/api` open with the same
`.docs-callout` card: the Swagger logo, a title, one sentence, and a
button-styled "Open the API documentation" link. Written as raw HTML at the top
of the markdown files, so the content stays in the docs files.

The URL is hardcoded as `https://api-v2.annoq.org/docs`, matching the
surrounding markdown. These files are static assets fetched at runtime; they
never see `API_BASE`, so the derived `API_DOCS_URL` used by the results header
(issue #20) is not reachable here.

On `api.md` the existing sentence about the Swagger documentation stays below
the callout. It carries context the callout does not, and that is worth more
than avoiding the repetition.

### Renderer change this required

`DocsPage`'s markdown component overrides discarded attributes: the `a`
override rebuilt the link as `<Link href>` and dropped `className`, `target`,
and `rel`; `img` and `p` dropped `className`. A raw HTML callout could
therefore be neither styled nor opened in a new tab.

`a`, `p`, and `img` now forward `className`; `a` also forwards `target` and
`rel`. No defaults change, so ordinary markdown links and images behave exactly
as before. On `img` an explicit class **replaces** `docs-media` rather than
joining it -- the 56px callout logo must not inherit that rule's centred,
full-width block layout.

## Landing page cards

`Feature` takes an optional `iconHref`. When present the icon becomes an
external link opening in a new tab, styled by a new `.feature-icon-logo`
modifier: the same circular silhouette as `.feature-icon` and `.step-number`,
but a light tile instead of the navy fill, since brand logos need their own
colours.

The icon points at the project itself rather than repeating the card's button:

| Card | Icon | Icon links to | Button (unchanged) |
| --- | --- | --- | --- |
| API Data Access | `swagger.svg` | `api-v2.annoq.org/docs` | `/docs/services` |
| Python library | `python.svg` | `github.com/USCbiostats/annoq-py` | `/docs/tutorials/annoq-py` |
| R Package | `r-package.svg` | `github.com/USCbiostats/AnnoQR` | `/docs/tutorials/r-package` |

`ArticleIcon` and `CodeIcon` are no longer imported.

## New assets

`swagger.svg` was supplied. `python.svg` and `r-package.svg` are authored here
as brand-recognisable marks on a 32x32 viewBox, matching how `swagger.svg` is a
real logo rather than a house glyph:

- `python.svg` -- the two interlocking hooks in `#3776AB` / `#FFD43B`, built as
  two complementary paths that tile the square without overlapping.
- `r-package.svg` -- the grey ring (one path, two ellipse subpaths, `evenodd`
  for the hole) with a blue `R` over it.

## Testing

`src/pages/DocsPage.test.tsx` (new) stubs `fetch` with markdown containing the
callout and asserts the action link keeps `href`/`target`/`rel`/`className`,
the logo gets `docs-callout-logo` and *not* `docs-media`, plain markdown images
still get `docs-media`, and plain markdown links are not forced into a new tab.

`src/pages/StaticPages.test.tsx` gains a check that each card's logo has the
right `src` and is itself the external link, and that the buttons still resolve
to the internal docs routes.
