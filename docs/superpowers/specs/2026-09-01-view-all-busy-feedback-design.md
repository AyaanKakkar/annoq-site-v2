# "View All" Freeze And Global Busy Feedback — Design

Resolves [#12](https://github.com/USCbiostats/annoq-site-v2/issues/12): *"'View ALL' button does not
bring up detail panel when clicked"*

Branch: `issue-12-view-all-button`
Date: 2026-09-01
Status: implemented. **Not yet verified in a browser** — no browser or Playwright is
available in this environment (see "Verification" below).

Reported repro: search screen → default chromosome range with all annotations enabled → submit →
scroll to a Gene Ontology column → click the **VIEW ALL n** button in a cell → no panel appears.

## What is actually wrong

Two distinct defects produce the same symptom. Both are real; either one alone reproduces the report.

### Defect 1 — the table's "View all" works, but freezes the page for seconds

The button in the results table **is** wired: `ResultsTable.tsx:222` passes an `onViewAll` callback
into `formatCell`, and it opens a MUI `Dialog`. The dialog does appear. It just takes long enough
that the user concludes nothing happened.

Measured by rendering `ResultsTable` at 60 columns × 50 rows (3,000 cells) and clicking one
"View all", with `formatCell` wrapped in a counter:

| Metric | Measured |
| --- | --- |
| `formatCell` calls caused by **one** click | 3,000 — every cell in the table |
| Main thread blocked by that click | 6.0 s (jsdom) |
| Dialog eventually opened | yes |

At the shape the issue describes — all annotations enabled, so ~555 columns × `PAGE_SIZE` 50 rows =
**27,750 cells** — the same render could not be measured at all: jsdom exhausted a 4 GB Node heap
before finishing. That is roughly 9× the load that already blocked for 6 s.

jsdom is slower than a real browser, so the absolute seconds are not the claim. The **amplification
factor** is: one click re-renders every cell in the table.

Three compounding causes:

1. **`ResultsTable.tsx:43`** — the dialog's `useState` lives in the table component, so `setDialog`
   re-renders all 27,750 cells.
2. **`formatters.tsx:93`** — `listCell` eagerly builds the *complete* term-list `ReactNode` for
   **every** cell on **every** render, including the ~554 lists per row that nobody opens:

   ```tsx
   const visible = items.slice(0, limit);
   const content = (                       // built for every cell, every render
     <Stack component="ul" …>
       {items.map(…)}                      // ALL items, not just `visible`
     </Stack>
   );
   ```

3. **No cell memoization** — nothing interrupts the cascade, so any table-level state change
   (dialog, pin toggle, filter chip) pays the full 27,750-cell cost.

### Defect 2 — "View all" in the detail drawer is dead, unconditionally

`DetailPanel.tsx:17` calls `formatCell` with only four arguments:

```tsx
{formatCell(field, selectedRow[field], selectedRow, store).node}
```

`onViewAll` is optional (`formatters.tsx:22`), so it arrives as `undefined` and the button's handler
is `onViewAll?.(field, content)` — a no-op. There is no dialog, no delay, and no error: nothing
happens at all, ever.

A user who clicks a row (which opens the right-hand detail drawer) and then clicks "View all" inside
that drawer hits this. It matches the issue title — *does not bring up detail panel* — with none of
Defect 1's ambiguity.

## Scope

Both halves ship together, because they are coupled: **a synchronous 6 s render cannot paint a
spinner.** Adding a busy indicator without deferring the heavy work means React sets the flag and
blocks in the same frame — the indicator never reaches the screen. Feedback without the performance
work is decoration over a freeze.

Out of scope, deliberately: virtualizing the table with `@tanstack/react-virtual` (already a
dependency). It would cut the initial render too, but it rewrites the table body and the sticky
pinned-column positioning that issues #3 and #4 carefully tuned. Worth its own issue, with the
measurements above attached.

## Architecture

### 1. Busy registry — `src/features/busy/busyState.tsx`

`BusyProvider` + `useBusy()`. Holds a `Map<id, label>` of in-flight operations.

| API | Behavior |
| --- | --- |
| `begin(label): () => void` | Registers an operation, returns its end function. Safe to call twice. |
| `run(label, fn)` | Wraps a promise; clears the entry on resolve **and** on throw. |
| `isBusy` | `map.size > 0` |
| `label` | The most recently started label |

Concurrent operations nest rather than clobber: two overlapping `begin` calls require two ends
before the bar disappears.

A `useBusyWhile(active: boolean, label: string)` hook covers the common case of mirroring existing
boolean state (`state.loading`, `isPending`) into the registry.

### 2. The indicator — `src/features/busy/BusyBar.tsx`

Indeterminate MUI `LinearProgress`, plus a 16px `CircularProgress` and a caption naming the
operation. `role="status"` and `aria-live="polite"` so screen readers announce it.

```
┌──────────────────────────────────────────────┐
│ AnnoQ  [Launch Query UI] [UI Tutorial]  News │
├──────────────────────────────────────────────┤
│▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ ← indeterminate
│ ⟳  Opening 1,204 GO terms…                   │
├──────────────────────────────────────────────┤
│  Query Form │ Table │ Summary │ Stats        │
```

Follows the same pattern as https://snpway.annoq.org/ (`Annoq_Overrepr_Workflow`,
`frontend/src/pages/Home.tsx`), which shows a fixed `LinearProgress` plus a status line while a
workflow runs — adapted to sit under the AnnoQ menu rather than over it.

### 3. Placement, and the trap to avoid

```css
.busy-bar {
  position: fixed;
  top: var(--annoq-appbar-h);
  left: 0;
  right: 0;
  z-index: 1201;            /* theme.zIndex.drawer + 1 */
}
```

Three deliberate choices:

- **Reuses `--annoq-appbar-h`**, the custom property `useAppBarHeight` (`App.tsx:101`) already
  publishes via `ResizeObserver` for issue #3's drawer offsets. No second source of truth for where
  the menu ends.
- **Sibling of the `AppBar`, not a child.** As a child it would grow the measured AppBar height,
  which feeds the very variable it positions against — a feedback loop — and would move the drawers.
- **Overlays rather than displaces.** Inserting it into the layout would force a relayout of 27,750
  table cells every time it appears, which is the opposite of the goal.

`drawer + 1` keeps it above the query and detail drawers (1200) and below dialogs (1300).

### 4. De-amplifying the click

**Lazy list content.** Change the callback contract in `formatters.tsx` to pass a thunk:

```ts
onViewAll?: (title: string, render: () => ReactNode) => void
```

The `const content = (…)` block moves inside that arrow, so no full list is constructed until
someone opens one. This removes most of the per-cell render cost on its own.

**Dialog state out of the table.** New `ViewAllProvider` (`src/features/search/ViewAllDialog.tsx`)
holds the state and renders the `Dialog`, exposing only a stable setter through context:

```tsx
function ViewAllProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const open = useMemo(() => (title, render) => setDialog({ title, render }), []);
  return <Ctx.Provider value={open}>{children}<Dialog …/></Ctx.Provider>;
}
```

Two properties make this work: `children` is the same element object across the provider's
re-render, so React bails out of the table subtree; and the context value never changes identity, so
consumers don't re-render either. Opening the dialog goes from O(27,750) to O(1).

**Memoized cell.** Extract `ResultCell` under `React.memo`, keyed on `(field, value, row, store)`.
This only works *because* the setter now comes from stable context instead of the inline arrow at
`ResultsTable.tsx:222` — the two changes depend on each other. Pin toggles and filter changes get
cheaper as a side effect.

**Transitions.** Wrap the click-driven heavy renders in `startTransition` and feed `isPending` into
the registry. This is what makes the bar paintable: the transition lets the browser paint before the
render commits. Applies to View all, row → detail panel (which formats all ~555 fields), and pin
toggle.

### 5. Reporting sites

| Site | Trigger | Label |
| --- | --- | --- |
| `SearchWorkspace` | existing `state.loading`, no results yet | `Searching annotations…` |
| `SearchWorkspace` | existing `state.loading`, results present | `Loading page N…` |
| `ResultsTable` | View all `isPending` | `Opening N <label>…` |
| `ResultsTable` | row → detail `isPending` | `Opening row details…` |
| `ResultsTable` | pin toggle `isPending` | `Repositioning columns…` |
| `ResultsTable` | `download()` (`ResultsTable.tsx:113`) | `Preparing download…` |
| `StatsPanel` | stats fetch | `Loading stats…` |

`download()` today awaits a GraphQL round trip with no feedback of any kind.

The existing `.loading-overlay` (`SearchWorkspace.tsx:217`, `styles.css:400`) **stays** and is driven
from the same registry, so the two indicators cannot disagree. It also blocks interaction with stale
results, which the top bar alone would not do. A search shows overlay + bar; a View all shows only
the bar, because the table remains usable.

`DetailPanel` takes the setter from context and passes it to `formatCell` — one line, and Defect 2
is fixed.

### 6. Dialog title

`formatters.tsx:118` passes the raw `field` name as the dialog title. Since the call site is being
changed anyway, it passes `labelFor(field, store)` instead, matching the column header.

## Files

| File | Change |
| --- | --- |
| `src/features/busy/busyState.tsx` | new — registry, provider, `useBusy`, `useBusyWhile` |
| `src/features/busy/BusyBar.tsx` | new — the indicator |
| `src/features/search/ViewAllDialog.tsx` | new — provider + dialog + `useViewAll` |
| `src/App.tsx` | wrap in `BusyProvider`; render `BusyBar` as AppBar sibling |
| `src/styles.css` | `.busy-bar` rules |
| `src/lib/formatters.tsx` | thunk contract; lazy `content`; `labelFor` title |
| `src/features/search/ResultsTable.tsx` | consume provider; `ResultCell` memo; transitions; busy on download |
| `src/features/search/DetailPanel.tsx` | pass `onViewAll` from context |
| `src/features/search/SearchWorkspace.tsx` | mount `ViewAllProvider`; report `state.loading` |
| `src/features/search/StatsPanel.tsx` | report stats loading |

No dependencies added. No API, GraphQL, or codegen changes. The pinned-column CSS from issues #3 and
#4 is not touched.

## Sequencing

| Phase | Work | Revertable alone |
| --- | --- | --- |
| 1 | Busy registry + BusyBar + CSS | yes |
| 2 | Lazy thunk, `ViewAllProvider`, memoized cell | yes |
| 3 | Wire reporting sites, including the `DetailPanel` fix | yes |
| 4 | `npm run test`, `npm run build`, deploy to dev | — |

Phase 2 is the one that resolves the reported symptom; phase 1 alone would show a bar during a
freeze it cannot interrupt.

## Testing

Tests are written before the implementation in each phase.

**Regression guard — asserts the invariant, not the clock.** Clicking "View all" must re-run
`formatCell` a small constant number of times, not once per cell. Deterministic, fast, and immune to
CI load, unlike a wall-clock threshold. It fails loudly if table-wide state is ever reintroduced.

Also:

- `busyState`: nested `begin`/end pairs; label precedence; `run()` clears its entry when `fn` throws.
- `BusyBar`: renders nothing when idle; shows the label and `role="status"` when busy.
- `ResultsTable`: the dialog opens and its title is the field's **label**, not the raw field name.
- `DetailPanel`: its "View all" opens the dialog — **this test fails on `main`.**
- `SearchWorkspace`: the bar appears while `state.loading` and disappears on `pageSuccess`.

## Verification

`npm run test` and `npm run build` must pass.

What automated tests here **cannot** cover: real-browser wall-clock time, and whether the bar looks
right. No browser automation is available in this environment. After deploy to
https://dev.annoq.org, these need human eyes:

1. Chromosome 18 default range, **all** annotations enabled, submit.
2. Scroll to a Gene Ontology column, click **VIEW ALL n** — bar appears under the menu, dialog opens
   promptly, dialog title is the column label.
3. Click a row to open the detail drawer, click **VIEW ALL n** there — dialog opens (this is
   Defect 2; it does nothing today).
4. Click **Download** — bar appears during the round trip.
5. Pin/unpin a column and change pages — bar appears, no layout jump in the table.
