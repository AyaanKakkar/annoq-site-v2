# Disable downloads over 1,000,000 rows

Issue: [#20](https://github.com/USCbiostats/annoq-site-v2/issues/20)

## Problem

The Download button in the results header (`ResultsTable.tsx`) asks the API to
materialise the entire result set as a file. For very large result sets that is
a request neither the browser nor the API should be asked to serve; the API is
the right tool for bulk extraction. Nothing in the UI says so.

## Behaviour

**Threshold.** `DOWNLOAD_ROW_LIMIT = 1_000_000`, in `src/lib/config.ts` beside
the other tunables. The button is disabled when `result.total` is *strictly*
over the limit — exactly 1,000,000 rows still downloads.

**Info icon.** An info icon sits immediately in front of the Download button and
is *always* rendered, not only when the button is disabled, so the limit is
discoverable before a user runs the query that trips it.

It is an `IconButton` rendered as an anchor (`component="a"`) pointing at the
API docs, so it is keyboard-focusable and clickable rather than hover-only. A
bare icon inside a `Tooltip` is neither, and a `Tooltip` wrapped around the
*disabled* button would not fire at all — MUI disabled buttons swallow pointer
events. Putting the explanation on a separate, always-enabled control avoids
that entirely.

**Tooltip text** depends on the state:

- under the limit: "Downloads are limited to 1,000,000 rows. Use the AnnoQ API
  for larger result sets."
- over the limit: "This result set is too large to download (over 1,000,000
  rows). Use the AnnoQ API instead."

Both carry the same link in the tooltip body. MUI tooltips are interactive by
default, so the link inside stays reachable while the pointer moves onto it.

**Docs URL.** `API_DOCS_URL = ` `${API_BASE}/docs`, derived rather than
hardcoded. The issue names `https://api-v2.annoq.org/docs`, which is what this
resolves to by default — but `API_BASE` is configurable
(`VITE_ANNOQ_API_V2`, e.g. the TOPMed stack), and a hardcoded link would send
those users to documentation for an API they are not querying.

## Placement

The change stays inline in `ResultsTable.tsx` rather than moving into a
`DownloadButton` component. It is roughly fifteen lines and the `download()`
handler it belongs to already lives there; a file per button would buy nothing.

## Testing

Added to `src/features/search/ResultsTable.test.tsx`, driving the reducer
through the existing `submit` -> `pageSuccess` sequence:

- the info link renders for an ordinary result set and points at `/docs`
- Download is enabled at exactly 1,000,000 rows
- Download is disabled at 1,000,001 rows
