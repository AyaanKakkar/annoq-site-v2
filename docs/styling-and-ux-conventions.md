# Styling And UX Conventions

## Main Visual Identity

The app keeps the original AnnoQ professional Material-style feel.

Core colors:

- Navy primary: `#183153`
- Gold accent: `#ebc336`
- Page background: `#f6f8fb`
- Table header pale blue: around `#d9e1ee`

Theme file:

```text
src/theme.ts
```

Most concrete styling:

```text
src/styles.css
```

## General Rules

- Keep UI compact and information-dense.
- Prefer clear controls over decorative elements.
- Keep links visibly blue and distinguishable from body text.
- Keep forms readable and not cramped.
- Keep result tables dense but scannable.
- Avoid one-color monotony; use navy, white, pale blue, and gold with restraint.

## Top Bar

Owned by:

```text
src/App.tsx
```

Styled by:

```css
.main-appbar
.main-toolbar
.brand
.launch-buttons
.main-nav-link
```

The top bar contains:

- Brand link.
- Launch Query UI button.
- UI Tutorial button.
- Main navigation links.
- Mobile menu drawer.

## Landing Page

Owned by:

```text
src/pages/StaticPages.tsx
```

Important styles:

```css
.free-banner
.hero
.hero-inner
.hero-actions
.stat-card
.feature-card
.step-row
.logo-card
```

The landing page should preserve original content while looking cleaner and more modern.

## Search Layout

Important classes:

```css
.search-shell
.query-drawer
.side-drawer
.search-main
.search-tools
.drawer-body
.drawer-header
.drawer-footer
```

Search page height is based on the sticky top bar height.

The left drawer holds query controls and annotations. The right drawer holds secondary result views.

## Result Table

Important classes:

```css
.results-view
.results-header
.simple-results-table-wrap
.simple-results-table
.table-head-cell
.column-title
.column-actions
.table-icon-button
.pager
```

Pinned columns use:

```css
.pinned-column
```

Active filters use:

```css
.active-filter-bar
.active-filter-label
.filter-chip-list
```

## Docs Page

Important classes:

```css
.docs-shell
.docs-nav
.docs-content
.docs-media
.docs-iframe
```

Images and iframes must stay constrained to the markdown content area.

## Supported Annotations

Important classes:

```css
.supported-shell
.supported-tabs-wrap
.supported-actions
.supported-tree
.supported-version-table
```

## Responsive Behavior

The current mobile breakpoint is in `src/styles.css`:

```css
@media (max-width: 900px) { ... }
```

On mobile:

- Hero content stacks.
- Query drawer becomes narrower.
- Docs navigation stacks above content.


## Progress Feedback

Any operation that can take more than about a quarter second reports itself to the
busy registry, and one bar under the main menu shows it:

```text
src/features/busy/busyState.tsx    registry: useBusy, useBusyWhile
src/features/busy/BusyBar.tsx      the bar itself
```

- Mirror existing boolean state with `useBusyWhile(active, label)`; wrap promises with
  `busy.run(label, fn)`.
- Label what is happening ("Loading page 3…"), not that something is.
- **Client-side work must be wrapped in `startTransition`** before it is reported. A
  synchronous multi-second render commits in the same frame as the click, so the bar
  never paints — that was issue #12.
- The bar overlays the content and is offset by `var(--annoq-appbar-h)`. It must never
  take layout space: pushing the page down relayouts every cell of the results table.
