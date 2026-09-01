# "View All" Freeze And Global Busy Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "View all" open instantly and give every slow operation a visible progress bar under the main menu, resolving [#12](https://github.com/USCbiostats/annoq-site-v2/issues/12).

**Architecture:** A busy registry (React context) collects in-flight operations and drives one `LinearProgress` pinned under the AppBar. Separately, the results table stops re-rendering all 27,750 of its cells when a dialog opens: the dialog's state moves into a provider that exposes only a stable setter, the full term list is built lazily via a thunk, and cells are memoized. Heavy click-driven renders are wrapped in `startTransition` so React can paint the bar before committing them.

**Tech Stack:** React 19, TypeScript, MUI 9, Vite, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-01-view-all-busy-feedback-design.md`

## Global Constraints

- Branch: `issue-12-view-all-button`. Do not merge to `main` as part of this plan.
- **No new dependencies.** Everything used here is already in `package.json`.
- **No API, GraphQL, or codegen changes.** Do not run `npm run graphql_codegen`.
- **Do not touch the pinned-column CSS** (`.pinned-column`, `.query-drawer`, `.side-drawer`, `.search-shell`, `.result-area`) — issues #3 and #4 tuned it and `src/styles.test.ts` guards it.
- **Never hardcode an AppBar offset in CSS.** Use `var(--annoq-appbar-h)`; the fallback already exists at `src/styles.css:3`.
- Ellipsis in user-facing labels is the single character `…`, not three dots.
- Run tests with `npx vitest run <path>`; the full suite is `npm run test`; the typecheck+bundle gate is `npm run build`.
- `TERMS_DISPLAYED_SIZE` is **8** under test (`environment.ts` uses `PROD ? 5 : 8`), so any "View all" fixture needs **more than 8** items.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/features/busy/busyState.tsx` | *new* — busy registry: `BusyProvider`, `useBusy`, `useBusyStatus`, `useBusyWhile` |
| `src/features/busy/busyState.test.tsx` | *new* — registry unit tests |
| `src/features/busy/BusyBar.tsx` | *new* — the indicator, reads `useBusyStatus` only |
| `src/features/busy/BusyBar.test.tsx` | *new* — indicator tests |
| `src/features/search/ViewAllDialog.tsx` | *new* — `ViewAllProvider`, `useViewAll`, the dialog, its transition and busy label |
| `src/features/search/ViewAllDialog.test.tsx` | *new* — dialog behavior + the re-render regression guard |
| `src/lib/formatters.tsx` | thunk contract for `onViewAll`; lazy list content; label as dialog title |
| `src/lib/formatters.test.tsx` | *new* — contract tests |
| `src/App.tsx` | mount `BusyProvider`, `BusyBar`, `ViewAllProvider` |
| `src/styles.css` | `.busy-bar` rules |
| `src/styles.test.ts` | assert `.busy-bar` uses the measured offset |
| `src/features/search/ResultsTable.tsx` | consume `useViewAll`; memoized `ResultCell`; transitions; busy on download |
| `src/features/search/DetailPanel.tsx` | pass `onViewAll` — fixes the dead button |
| `src/features/search/SearchWorkspace.tsx` | report `state.loading` into the registry |
| `src/features/search/StatsPanel.tsx` | report stats loading into the registry |

**Two context-splitting rules that the whole design depends on. Violating either reintroduces the freeze:**

1. **Providers hold their state internally and pass `children` through untouched.** When only the provider's own state changes, `children` is the same element object, so React bails out of that subtree. If you instead put the state in `App` and pass it down, every busy tick re-renders the 27,750-cell table.
2. **Two contexts per provider: a *stable setter* context and a *changing state* context.** Reporters consume only the setter (never re-render). Only `BusyBar` consumes the state. Context consumers still re-render inside a bailed-out subtree, which is exactly what makes this work.

---

### Task 1: Busy registry

**Files:**
- Create: `src/features/busy/busyState.tsx`
- Test: `src/features/busy/busyState.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  type BusyControls = {
    begin: (label: string) => () => void;
    run: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  };
  function BusyProvider(props: { children: ReactNode }): JSX.Element;
  function useBusy(): BusyControls;                  // stable identity, never re-renders consumers
  function useBusyStatus(): { busy: boolean; label: string | null };  // BusyBar only
  function useBusyWhile(active: boolean, label: string): void;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/busy/busyState.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BusyProvider, useBusy, useBusyStatus, useBusyWhile } from './busyState';

function Status() {
  const { busy, label } = useBusyStatus();
  return <div data-testid="status">{busy ? `busy:${label}` : 'idle'}</div>;
}

let controls: ReturnType<typeof useBusy>;
function Capture() {
  controls = useBusy();
  return null;
}

function setup() {
  render(
    <BusyProvider>
      <Capture />
      <Status />
    </BusyProvider>
  );
  return screen.getByTestId('status');
}

describe('busy registry', () => {
  it('starts idle', () => {
    expect(setup()).toHaveTextContent('idle');
  });

  it('reports the label of a started operation', () => {
    const status = setup();
    act(() => {
      controls.begin('Searching annotations…');
    });
    expect(status).toHaveTextContent('busy:Searching annotations…');
  });

  it('shows the most recently started label', () => {
    const status = setup();
    act(() => {
      controls.begin('first');
      controls.begin('second');
    });
    expect(status).toHaveTextContent('busy:second');
  });

  it('stays busy until every operation has ended', () => {
    const status = setup();
    let endFirst!: () => void;
    let endSecond!: () => void;
    act(() => {
      endFirst = controls.begin('first');
      endSecond = controls.begin('second');
    });
    act(() => endFirst());
    expect(status).toHaveTextContent('busy:second');
    act(() => endSecond());
    expect(status).toHaveTextContent('idle');
  });

  it('ignores a repeated end call', () => {
    const status = setup();
    let end!: () => void;
    act(() => {
      end = controls.begin('only');
    });
    act(() => {
      end();
      end();
    });
    expect(status).toHaveTextContent('idle');
  });

  it('clears the entry when run() resolves', async () => {
    const status = setup();
    await act(async () => {
      await controls.run('downloading', async () => 'ok');
    });
    expect(status).toHaveTextContent('idle');
  });

  it('clears the entry when run() throws, and rethrows', async () => {
    const status = setup();
    await act(async () => {
      await expect(
        controls.run('downloading', async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
    });
    expect(status).toHaveTextContent('idle');
  });
});

describe('useBusyWhile', () => {
  function Reporter({ active }: { active: boolean }) {
    useBusyWhile(active, 'loading page 2…');
    return null;
  }

  it('registers while active and clears when it goes false', () => {
    const { rerender } = render(
      <BusyProvider>
        <Reporter active={false} />
        <Status />
      </BusyProvider>
    );
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('idle');

    rerender(
      <BusyProvider>
        <Reporter active={true} />
        <Status />
      </BusyProvider>
    );
    expect(status).toHaveTextContent('busy:loading page 2…');

    rerender(
      <BusyProvider>
        <Reporter active={false} />
        <Status />
      </BusyProvider>
    );
    expect(status).toHaveTextContent('idle');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/busy/busyState.test.tsx`
Expected: FAIL — `Failed to resolve import "./busyState"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/busy/busyState.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type BusyControls = {
  /** Registers an operation and returns its end function. Calling it twice is a no-op. */
  begin: (label: string) => () => void;
  /** Registers an operation for the lifetime of a promise, clearing it on resolve and on throw. */
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
};

export type BusyStatus = {
  busy: boolean;
  label: string | null;
};

/**
 * Split deliberately. Reporters consume only BusyControlsContext, whose value never
 * changes identity, so starting an operation cannot re-render them. Only BusyBar
 * consumes BusyStatusContext. Merging these would make every busy tick re-render the
 * results table — 27,750 cells at full annotation width — which is the freeze this
 * whole change exists to remove.
 */
const BusyControlsContext = createContext<BusyControls | null>(null);
const BusyStatusContext = createContext<BusyStatus>({ busy: false, label: null });

export function BusyProvider({ children }: { children: ReactNode }) {
  // Insertion order is the label priority: the most recently started operation wins.
  const [entries, setEntries] = useState<ReadonlyArray<[number, string]>>([]);
  const nextId = useRef(0);

  const controls = useMemo<BusyControls>(() => {
    const begin = (label: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setEntries((current) => [...current, [id, label] as [number, string]]);
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        setEntries((current) => current.filter(([entryId]) => entryId !== id));
      };
    };

    return {
      begin,
      run: async <T,>(label: string, fn: () => Promise<T>) => {
        const end = begin(label);
        try {
          return await fn();
        } finally {
          end();
        }
      }
    };
  }, []);

  const status = useMemo<BusyStatus>(
    () => ({ busy: entries.length > 0, label: entries.length > 0 ? entries[entries.length - 1][1] : null }),
    [entries]
  );

  return (
    <BusyControlsContext.Provider value={controls}>
      <BusyStatusContext.Provider value={status}>{children}</BusyStatusContext.Provider>
    </BusyControlsContext.Provider>
  );
}

export function useBusy(): BusyControls {
  const controls = useContext(BusyControlsContext);
  if (!controls) throw new Error('useBusy must be used inside BusyProvider');
  return controls;
}

export function useBusyStatus(): BusyStatus {
  return useContext(BusyStatusContext);
}

/** Mirrors an existing boolean (state.loading, isPending) into the registry. */
export function useBusyWhile(active: boolean, label: string): void {
  const { begin } = useBusy();
  // Held in a ref so a changing label cannot re-register the operation and
  // restart the bar mid-flight.
  const labelRef = useRef(label);
  labelRef.current = label;
  const start = useCallback(() => begin(labelRef.current), [begin]);

  useEffect(() => {
    if (!active) return;
    return start();
  }, [active, start]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/busy/busyState.test.tsx`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/busy/busyState.tsx src/features/busy/busyState.test.tsx
git commit -m "For #12: add busy registry for global progress feedback"
```

---

### Task 2: The indicator, mounted under the main menu

**Files:**
- Create: `src/features/busy/BusyBar.tsx`
- Create: `src/features/busy/BusyBar.test.tsx`
- Modify: `src/App.tsx` (wrap in `BusyProvider`, render `BusyBar` after the `AppBar`)
- Modify: `src/styles.css` (add `.busy-bar` rules)
- Modify: `src/styles.test.ts` (add a guard)

**Interfaces:**
- Consumes: `useBusyStatus`, `BusyProvider` from Task 1.
- Produces: `function BusyBar(): JSX.Element | null`.

- [ ] **Step 1: Write the failing test**

Create `src/features/busy/BusyBar.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BusyBar } from './BusyBar';
import { BusyProvider, useBusy } from './busyState';

let controls: ReturnType<typeof useBusy>;
function Capture() {
  controls = useBusy();
  return null;
}

function setup() {
  render(
    <BusyProvider>
      <Capture />
      <BusyBar />
    </BusyProvider>
  );
}

describe('BusyBar', () => {
  it('renders nothing while idle', () => {
    setup();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('announces the running operation politely', () => {
    setup();
    act(() => {
      controls.begin('Opening 1,204 GO biological process…');
    });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Opening 1,204 GO biological process…');
    expect(status).toHaveClass('busy-bar');
  });

  it('shows a progress bar for users who cannot read the label', () => {
    setup();
    act(() => {
      controls.begin('Searching annotations…');
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('disappears when the operation ends', () => {
    setup();
    let end!: () => void;
    act(() => {
      end = controls.begin('Searching annotations…');
    });
    act(() => end());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/busy/BusyBar.test.tsx`
Expected: FAIL — `Failed to resolve import "./BusyBar"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/busy/BusyBar.tsx`:

```tsx
import { Box, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';
import { useBusyStatus } from './busyState';

/**
 * The one place the app says "I am working on something". Rendered as a sibling of
 * the AppBar and positioned over the content with `position: fixed`, never inserted
 * into the layout: inserting it would grow the measured AppBar height it positions
 * itself against, and would relayout every cell of the results table each time it
 * appeared.
 */
export function BusyBar() {
  const { busy, label } = useBusyStatus();
  if (!busy) return null;
  return (
    <Box className="busy-bar" role="status" aria-live="polite">
      <LinearProgress />
      <Stack direction="row" spacing={1} className="busy-bar-message">
        <CircularProgress size={16} thickness={5} />
        <Typography variant="caption">{label}</Typography>
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/busy/BusyBar.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the failing CSS guard**

Add to the end of `src/styles.test.ts`:

```ts
// The bar sits under the menu without displacing anything: fixed, offset by the
// measured AppBar height, above the drawers (1200) and below dialogs (1300).
describe('busy bar is pinned under the measured AppBar', () => {
  it('uses the measured offset rather than a literal', () => {
    const rule = declarationsFor('.busy-bar');
    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toContain('top: var(--annoq-appbar-h)');
    expect(rule).not.toMatch(/top:[^;]*60px/);
  });

  it('layers above the drawers and below dialogs', () => {
    const rule = declarationsFor('.busy-bar');
    const zIndex = /z-index:\s*(\d+)/.exec(rule)?.[1];
    expect(Number(zIndex)).toBeGreaterThan(1200);
    expect(Number(zIndex)).toBeLessThan(1300);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/styles.test.ts`
Expected: FAIL — `expected a rule for .busy-bar`.

- [ ] **Step 7: Add the CSS**

Append to `src/styles.css`:

```css
/*
 * Issue #12. Overlays the top of the content instead of taking layout space:
 * pushing the content down would relayout every cell of the results table
 * (27,750 of them with all annotations enabled) each time the bar appeared.
 * The offset is the AppBar height published by useAppBarHeight, never a literal.
 */
.busy-bar {
  position: fixed;
  top: var(--annoq-appbar-h);
  left: 0;
  right: 0;
  z-index: 1201;
  background: #fff;
  border-bottom: 1px solid #d9e1ee;
  box-shadow: 0 1px 4px rgba(24, 49, 83, 0.12);
}

.busy-bar-message {
  align-items: center;
  padding: 4px 12px;
  color: #183153;
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run src/styles.test.ts`
Expected: PASS — all describes, including the two new ones.

- [ ] **Step 9: Mount it in the app**

In `src/App.tsx`, add the imports next to the existing feature imports:

```tsx
import { BusyProvider } from './features/busy/busyState';
import { BusyBar } from './features/busy/BusyBar';
```

Then wrap the shell's contents. Replace the opening of the returned JSX:

```tsx
  return (
    <Box className={isSearch ? 'app-shell app-shell--locked' : 'app-shell'}>
      <AppBar ref={appBarRef} position="sticky" color="inherit" elevation={0} className="main-appbar">
```

with:

```tsx
  return (
    <Box className={isSearch ? 'app-shell app-shell--locked' : 'app-shell'}>
      <BusyProvider>
      <AppBar ref={appBarRef} position="sticky" color="inherit" elevation={0} className="main-appbar">
```

Add `<BusyBar />` immediately after the closing `</AppBar>` tag, so it is the AppBar's **sibling** and not its child:

```tsx
      </AppBar>
      <BusyBar />
      <Drawer open={open} onClose={() => setOpen(false)}>
```

and close the provider immediately before the closing `</Box>`:

```tsx
      {!isSearch && <Footer />}
      </BusyProvider>
    </Box>
  );
```

> `BusyBar` must not go inside `<AppBar>`: `useAppBarHeight` (`src/App.tsx:101`) measures that element and publishes `--annoq-appbar-h`, which is the very value the bar positions against — a feedback loop.

- [ ] **Step 10: Run the full suite**

Run: `npm run test`
Expected: PASS — all files, including the pre-existing `App.test.tsx`.

- [ ] **Step 11: Commit**

```bash
git add src/features/busy/BusyBar.tsx src/features/busy/BusyBar.test.tsx src/App.tsx src/styles.css src/styles.test.ts
git commit -m "For #12: show a progress bar under the main menu while work is in flight"
```

---

### Task 3: Lazy "View all" content in the cell formatter

**Files:**
- Modify: `src/lib/formatters.tsx`
- Create: `src/lib/formatters.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export type ViewAllHandler = (title: string, render: () => ReactNode, count: number) => void;
  export function formatCell(
    field: string,
    value: unknown,
    row: Record<string, unknown>,
    store: AnnotationStore,
    onViewAll?: ViewAllHandler
  ): FormattedCell;
  ```
  The type lives here, in `lib/`, so `features/` can import it without `lib/` depending on `features/`.

**Why:** `listCell` currently builds the complete list `ReactNode` for every cell on every render (`src/lib/formatters.tsx:93`) — ~554 lists per row that nobody opens. The thunk defers that until the dialog actually renders.

- [ ] **Step 1: Write the failing test**

Create `src/lib/formatters.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildAnnotationStore } from './annotations';
import { formatCell } from './formatters';
import { ColumnValueType } from '../types';
import type { Annotation } from '../types';

// TERMS_DISPLAYED_SIZE is 8 under test, so 12 items overflow the cell.
const ITEM_COUNT = 12;

const store = buildAnnotationStore([
  { id: '1', name: 'Gene Ontology', leaf: false },
  {
    id: '2',
    parent_id: '1',
    name: 'go_bp',
    label: 'GO biological process',
    leaf: true,
    value_type: ColumnValueType.TERM,
    root_url: 'http://amigo/'
  }
] as Annotation[]);

const value = Array.from({ length: ITEM_COUNT }, (_, i) => `GO:${String(i).padStart(7, '0')}`).join(';');

describe('formatCell view-all contract', () => {
  it('renders only the visible slice in the cell', () => {
    const cell = formatCell('go_bp', value, { go_bp: value }, store);
    render(<div>{cell.node}</div>);
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });

  it('passes the annotation label as the title, not the raw field name', () => {
    const onViewAll = vi.fn();
    const cell = formatCell('go_bp', value, { go_bp: value }, store, onViewAll);
    render(<div>{cell.node}</div>);
    fireEvent.click(screen.getByRole('button', { name: /View all/ }));
    expect(onViewAll).toHaveBeenCalledTimes(1);
    expect(onViewAll.mock.calls[0][0]).toBe('GO biological process');
  });

  it('passes the item count so the caller can name what it is opening', () => {
    const onViewAll = vi.fn();
    const cell = formatCell('go_bp', value, { go_bp: value }, store, onViewAll);
    render(<div>{cell.node}</div>);
    fireEvent.click(screen.getByRole('button', { name: /View all/ }));
    expect(onViewAll.mock.calls[0][2]).toBe(ITEM_COUNT);
  });

  it('passes a thunk that builds the complete list only when called', () => {
    const onViewAll = vi.fn();
    const cell = formatCell('go_bp', value, { go_bp: value }, store, onViewAll);
    render(<div>{cell.node}</div>);
    fireEvent.click(screen.getByRole('button', { name: /View all/ }));

    const build = onViewAll.mock.calls[0][1];
    expect(typeof build).toBe('function');

    render(<div data-testid="full">{build()}</div>);
    expect(screen.getByTestId('full').querySelectorAll('li')).toHaveLength(ITEM_COUNT);
  });

  it('does not render a view-all button when nothing overflows', () => {
    const short = 'GO:0000001;GO:0000002';
    const cell = formatCell('go_bp', short, { go_bp: short }, store);
    render(<div>{cell.node}</div>);
    expect(screen.queryByRole('button', { name: /View all/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/formatters.test.tsx`
Expected: FAIL — the title assertion gets `'go_bp'`, and `typeof build` is `'object'` (a ReactNode), not `'function'`.

- [ ] **Step 3: Change the formatter**

In `src/lib/formatters.tsx`, add the `labelFor` import at the top:

```tsx
import { labelFor } from './annotations';
```

Export the handler type next to `FormattedCell`:

```tsx
/**
 * `render` is a thunk, not a node: building the full list eagerly for every cell
 * of a 555-column table is what made "View all" look broken (issue #12).
 */
export type ViewAllHandler = (title: string, render: () => ReactNode, count: number) => void;
```

Change `formatCell`'s parameter type from `onViewAll?: (title: string, content: ReactNode) => void` to:

```tsx
  onViewAll?: ViewAllHandler
```

Each of the three `listCell(...)` calls currently passes `field` first. Pass the display label instead — replace `field,` with `labelFor(field, store),` in all three calls. For the plain-`|` branch, that call becomes:

```tsx
  if (stringValue.includes('|')) {
    const items = stringValue.split('|').filter(Boolean);
    return listCell(labelFor(field, store), items, items.join('; '), TERMS_DISPLAYED_SIZE, onViewAll);
  }
```

Then replace the whole `listCell` function with:

```tsx
function listCell(
  title: string,
  items: ReactNode[],
  plain: string,
  limit: number,
  onViewAll?: ViewAllHandler
): FormattedCell {
  const visible = items.slice(0, limit);
  // Built on demand. Eagerly constructing this for every cell cost a full render
  // of every list in the table, opened or not.
  const buildFullList = () => (
    <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
      {items.map((item, index) => (
        <Typography component="li" variant="caption" key={index}>
          {item}
        </Typography>
      ))}
    </Stack>
  );
  return {
    plain,
    node: (
      <Box>
        <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
          {visible.map((item, index) => (
            <Typography component="li" variant="caption" key={index}>
              {item}
            </Typography>
          ))}
        </Stack>
        {items.length > limit && (
          <Button size="small" variant="text" onClick={(event) => {
            event.stopPropagation();
            onViewAll?.(title, buildFullList, items.length);
          }}>
            View all {items.length}
          </Button>
        )}
      </Box>
    )
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/formatters.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Fix the now-broken call site so the build compiles**

`src/features/search/ResultsTable.tsx:222` still passes a two-argument callback. Change it to match the new type temporarily — Task 4 replaces it entirely:

```tsx
{formatCell(field, row[field], row, store, (title, render) => setDialog({ title, content: render() })).node}
```

- [ ] **Step 6: Verify the typecheck and full suite pass**

Run: `npm run build`
Expected: PASS — `tsc -b` reports no errors and `vite build` writes `dist/`.

Run: `npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/formatters.tsx src/lib/formatters.test.tsx src/features/search/ResultsTable.tsx
git commit -m "For #12: build view-all list lazily and title it with the annotation label"
```

---

### Task 4: Move the dialog out of the table, and fix the dead detail-panel button

**Files:**
- Create: `src/features/search/ViewAllDialog.tsx`
- Create: `src/features/search/ViewAllDialog.test.tsx`
- Modify: `src/App.tsx` (mount `ViewAllProvider`)
- Modify: `src/features/search/ResultsTable.tsx` (drop local dialog state, consume the context)
- Modify: `src/features/search/DetailPanel.tsx` (pass `onViewAll`)

**Interfaces:**
- Consumes: `ViewAllHandler` (Task 3), `useBusyWhile` (Task 1).
- Produces:
  ```ts
  function ViewAllProvider(props: { children: ReactNode }): JSX.Element;
  function useViewAll(): ViewAllHandler;   // stable identity
  ```

**Why:** the dialog's `useState` lives in `ResultsTable` (`src/features/search/ResultsTable.tsx:43`), so opening it re-renders every cell — 3,000 `formatCell` calls and 6.0 s blocked at 60×50 in jsdom; 27,750 cells at full width. Moving the state into a provider whose `children` are passed through untouched makes React bail out of the table subtree entirely.

- [ ] **Step 1: Write the failing test**

Create `src/features/search/ViewAllDialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAnnotationStore } from '../../lib/annotations';
import { ColumnValueType } from '../../types';
import { BusyProvider } from '../busy/busyState';
import { BusyBar } from '../busy/BusyBar';
import { initialSearchState, SearchProvider, useSearchState } from './searchState';
import { ViewAllProvider } from './ViewAllDialog';
import type { Annotation, QueryRequest, ResultPage } from '../../types';

const COLUMN_COUNT = 6;
const ROW_COUNT = 4;
const ITEMS_PER_CELL = 12; // TERMS_DISPLAYED_SIZE is 8 under test

const annotations: Annotation[] = [
  { id: 'root', name: 'Gene Ontology', leaf: false } as Annotation,
  ...Array.from({ length: COLUMN_COUNT }, (_, index) => ({
    id: `a${index}`,
    parent_id: 'root',
    name: `go_field_${index}`,
    label: `GO Field ${index}`,
    leaf: true,
    value_type: ColumnValueType.TERM,
    root_url: 'http://amigo/'
  } as Annotation))
];
const store = buildAnnotationStore(annotations);

vi.mock('../annotations/useAnnotations', () => ({ useAnnotations: () => ({ data: store }) }));

// Counts every formatCell call so the test can assert that opening the dialog does
// not re-render the rest of the table.
const calls = { count: 0 };
vi.mock('../../lib/formatters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/formatters')>();
  return {
    ...actual,
    formatCell: (...args: Parameters<typeof actual.formatCell>) => {
      calls.count += 1;
      return actual.formatCell(...args);
    }
  };
});

const columns = annotations.slice(1).map((annotation) => annotation.name);
const cellValue = Array.from({ length: ITEMS_PER_CELL }, (_, i) => `GO:${String(i).padStart(7, '0')}`).join(';');
const request: QueryRequest = { mode: 'chromosome', values: initialSearchState.values, fields: columns, filters: [] };
const result: ResultPage = {
  request,
  page: 1,
  pageSize: ROW_COUNT,
  total: ROW_COUNT,
  rows: Array.from({ length: ROW_COUNT }, () => Object.fromEntries(columns.map((column) => [column, cellValue]))),
  columns,
  aggs: {}
};

function SeedResult() {
  const { dispatch } = useSearchState();
  useEffect(() => {
    dispatch({ type: 'submit', request });
    dispatch({ type: 'pageSuccess', requestId: 1, result });
  }, [dispatch]);
  return null;
}

async function renderTable() {
  const { ResultsTable } = await import('./ResultsTable');
  render(
    <BusyProvider>
      <BusyBar />
      <SearchProvider>
        <ViewAllProvider>
          <SeedResult />
          <ResultsTable />
        </ViewAllProvider>
      </SearchProvider>
    </BusyProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  calls.count = 0;
});

describe('view all dialog', () => {
  it('opens a dialog titled with the column label', async () => {
    await renderTable();
    fireEvent.click(screen.getAllByRole('button', { name: /View all/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('GO Field 0');
  });

  it('shows every item, not just the visible slice', async () => {
    await renderTable();
    fireEvent.click(screen.getAllByRole('button', { name: /View all/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelectorAll('li')).toHaveLength(ITEMS_PER_CELL);
  });

  // Issue #12. The button was never broken — it re-rendered all 27,750 cells of a
  // full-width table and froze the page for seconds, so the user gave up first.
  // This asserts the invariant rather than a wall-clock threshold, which would
  // flake under CI load and get skipped.
  it('does not re-render the rest of the table when the dialog opens', async () => {
    await renderTable();
    expect(screen.getAllByRole('button', { name: /View all/ })).toHaveLength(COLUMN_COUNT * ROW_COUNT);

    calls.count = 0;
    fireEvent.click(screen.getAllByRole('button', { name: /View all/ })[0]);
    await screen.findByRole('dialog');

    expect(calls.count).toBe(0);
  });

  it('closes on the backdrop', async () => {
    await renderTable();
    fireEvent.click(screen.getAllByRole('button', { name: /View all/ })[0]);
    await screen.findByRole('dialog');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('detail panel view all', () => {
  // Defect 2: DetailPanel called formatCell without onViewAll, so this button was
  // an unconditional no-op — no dialog, no delay, no error. This test fails on main.
  it('opens the dialog from inside the detail drawer', async () => {
    const { DetailPanel } = await import('./DetailPanel');
    function SelectRow() {
      const { dispatch } = useSearchState();
      useEffect(() => {
        dispatch({ type: 'submit', request });
        dispatch({ type: 'pageSuccess', requestId: 1, result });
        dispatch({ type: 'selectRow', row: result.rows[0] });
      }, [dispatch]);
      return null;
    }

    render(
      <BusyProvider>
        <SearchProvider>
          <ViewAllProvider>
            <SelectRow />
            <DetailPanel />
          </ViewAllProvider>
        </SearchProvider>
      </BusyProvider>
    );

    fireEvent.click(screen.getAllByRole('button', { name: /View all/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('GO Field 0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/search/ViewAllDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "./ViewAllDialog"`.

- [ ] **Step 3: Write the provider**

Create `src/features/search/ViewAllDialog.tsx`:

```tsx
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { createContext, useContext, useMemo, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import type { ViewAllHandler } from '../../lib/formatters';
import { useBusyWhile } from '../busy/busyState';

type DialogContentState = { title: string; render: () => ReactNode };

/**
 * The opener's identity never changes, so consuming it cannot re-render a cell.
 * The dialog's state lives here instead of in ResultsTable, and `children` is
 * passed straight through: when this component re-renders for its own state,
 * `children` is the same element object, so React bails out of the whole table
 * subtree. That is what turns opening the dialog from O(27,750 cells) into O(1)
 * — issue #12.
 */
const ViewAllContext = createContext<ViewAllHandler | null>(null);

export function ViewAllProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogContentState | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The transition is what makes the progress bar reachable: without it React
  // would commit a multi-second render in the same frame as the click and the
  // bar would never paint.
  useBusyWhile(pending, label ?? 'Working…');

  const openViewAll = useMemo<ViewAllHandler>(
    () => (title, render, count) => {
      setLabel(`Opening ${count.toLocaleString()} ${title}…`);
      startTransition(() => setDialog({ title, render }));
    },
    []
  );

  return (
    <ViewAllContext.Provider value={openViewAll}>
      {children}
      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog?.title}</DialogTitle>
        <DialogContent>{dialog?.render()}</DialogContent>
      </Dialog>
    </ViewAllContext.Provider>
  );
}

export function useViewAll(): ViewAllHandler {
  const openViewAll = useContext(ViewAllContext);
  if (!openViewAll) throw new Error('useViewAll must be used inside ViewAllProvider');
  return openViewAll;
}
```

- [ ] **Step 4: Point `ResultsTable` at the provider**

In `src/features/search/ResultsTable.tsx`:

Add the import:

```tsx
import { useViewAll } from './ViewAllDialog';
```

Delete the local dialog state (`src/features/search/ResultsTable.tsx:43`):

```tsx
  const [dialog, setDialog] = useState<{ title: string; content: React.ReactNode } | null>(null);
```

and replace it with:

```tsx
  const openViewAll = useViewAll();
```

Replace the cell call (`src/features/search/ResultsTable.tsx:222`) with:

```tsx
{formatCell(field, row[field], row, store, openViewAll).node}
```

Delete the `<Dialog>` block near the end of the returned JSX:

```tsx
      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog?.title}</DialogTitle>
        <DialogContent>{dialog?.content}</DialogContent>
      </Dialog>
```

Then drop `Dialog`, `DialogContent`, and `DialogTitle` from the `@mui/material` import list at the top of the file — `tsc` fails on the unused imports otherwise.

- [ ] **Step 5: Fix the dead button in the detail panel**

In `src/features/search/DetailPanel.tsx`, add the import:

```tsx
import { useViewAll } from './ViewAllDialog';
```

Add the hook alongside the other hooks, **above** the early return so hook order stays stable:

```tsx
export function DetailPanel() {
  const { state } = useSearchState();
  const store = useAnnotations().data;
  const openViewAll = useViewAll();
  const selectedRow = state.selectedRow;
```

and pass it to `formatCell` (`src/features/search/DetailPanel.tsx:17`):

```tsx
<Box sx={{ mt: 0.5 }}>{formatCell(field, selectedRow[field], selectedRow, store, openViewAll).node}</Box>
```

- [ ] **Step 6: Mount the provider in `App.tsx`**

Add the import:

```tsx
import { ViewAllProvider } from './features/search/ViewAllDialog';
```

Wrap `<Routes>` inside the existing `<SearchProvider>`:

```tsx
        <SearchProvider>
          <ViewAllProvider>
            <Routes>
              {/* …unchanged route list… */}
            </Routes>
          </ViewAllProvider>
        </SearchProvider>
```

> Mount it here, not inside `SearchWorkspace`. In `App` its `children` is the `<Routes>` element created by `App`'s render, which stays referentially identical while only the provider's own state changes — that identity is what triggers the bail-out.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/features/search/ViewAllDialog.test.tsx`
Expected: PASS — 5 tests, including `expect(calls.count).toBe(0)`.

> If `calls.count` is non-zero, something is still subscribing the table to the dialog's state. Do **not** loosen the assertion — find the subscription. The usual causes are mounting `ViewAllProvider` inside `SearchWorkspace` instead of `App`, or reading `pending`/`dialog` from a hook called in `ResultsTable`.

- [ ] **Step 8: Run the full suite and the build**

Run: `npm run test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/search/ViewAllDialog.tsx src/features/search/ViewAllDialog.test.tsx src/features/search/ResultsTable.tsx src/features/search/DetailPanel.tsx src/App.tsx
git commit -m "For #12: open View all without re-rendering the table, and fix the dead detail-panel button"
```

---

### Task 5: Memoize the table cell

**Files:**
- Modify: `src/features/search/ResultsTable.tsx`
- Modify: `src/features/search/ViewAllDialog.test.tsx` (add one test)

**Interfaces:**
- Consumes: `useViewAll` (Task 4), `formatCell` (Task 3).
- Produces: nothing consumed by later tasks; `ResultCell` stays module-private.

**Why:** Task 4 stops the *dialog* from re-rendering cells, but any other table-level state change — pin toggle, filter chip, row selection — still re-runs `formatCell` for all 27,750 cells. `React.memo` cuts that to only the cells whose props actually changed. This works **only** because the opener now comes from stable context; an inline arrow prop would defeat the comparison on every render.

- [ ] **Step 1: Write the failing test**

Add to the `view all dialog` describe in `src/features/search/ViewAllDialog.test.tsx`:

```tsx
  it('does not reformat every cell when a column is pinned', async () => {
    await renderTable();
    const cellCount = COLUMN_COUNT * ROW_COUNT;

    calls.count = 0;
    fireEvent.click(screen.getAllByRole('button', { name: 'Pin column' })[2]);
    await vi.waitFor(() => expect(screen.getAllByRole('button', { name: 'Unpin column' }).length).toBeGreaterThan(0));

    // Only the newly pinned column's cells may reformat; the other five columns
    // must be untouched.
    expect(calls.count).toBeLessThan(cellCount);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/search/ViewAllDialog.test.tsx -t 'pinned'`
Expected: FAIL — `calls.count` equals or exceeds `cellCount` (24), because every cell reformats.

- [ ] **Step 3: Extract the memoized cell**

In `src/features/search/ResultsTable.tsx`, add `memo` to the React import:

```tsx
import { memo, useEffect, useMemo, useState } from 'react';
```

Add this component at the bottom of the file, above the `StoredPinSet` type:

```tsx
/**
 * Memoized so a table-level state change — pinning, filtering, selecting a row —
 * reformats only the cells whose own props changed. `row` identity is stable
 * because rows come straight from `state.result`, and the view-all opener comes
 * from context rather than an inline prop, which is what lets the comparison
 * succeed at all.
 */
const ResultCell = memo(function ResultCell({
  field,
  value,
  row,
  store
}: {
  field: string;
  value: unknown;
  row: Record<string, unknown>;
  store: AnnotationStore;
}) {
  const openViewAll = useViewAll();
  return <>{formatCell(field, value, row, store, openViewAll).node}</>;
});
```

Add the type-only import it needs, next to the other imports:

```tsx
import type { AnnotationStore } from '../../types';
```

Replace the cell call in the table body with the component:

```tsx
                    <ResultCell field={field} value={row[field]} row={row} store={store} />
```

`openViewAll` is now used only inside `ResultCell`, so delete the `const openViewAll = useViewAll();` line from `ResultsTable` itself, and drop the now-unused `formatCell` usage from the parent — the `formatCell` import is still needed by `ResultCell` in the same file, so leave the import alone.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/search/ViewAllDialog.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run the full suite and the build**

Run: `npm run test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/search/ResultsTable.tsx src/features/search/ViewAllDialog.test.tsx
git commit -m "For #12: memoize result cells so table state changes stop reformatting everything"
```

---

### Task 6: Report every slow operation into the registry

**Files:**
- Modify: `src/features/search/SearchWorkspace.tsx`
- Modify: `src/features/search/ResultsTable.tsx`
- Modify: `src/features/search/StatsPanel.tsx`
- Modify: `src/features/search/SearchWorkspace.test.tsx`

**Interfaces:**
- Consumes: `useBusy`, `useBusyWhile` (Task 1).
- Produces: `export function searchBusyLabel(state: SearchState): string` from `SearchWorkspace.tsx`.

> `src/features/search/SearchWorkspace.test.tsx` mocks `../../lib/api` and drives the
> whole workspace through the annotations query; it has no `request`/`result` fixtures
> and no way to reach a loading state without the network. So the *decision* — which
> label a given state deserves — is extracted into a pure exported function and tested
> directly. The bar's rendering is already covered by Task 2 and Task 4.

- [ ] **Step 1: Write the failing test**

Add to the end of `src/features/search/SearchWorkspace.test.tsx`:

```tsx
import { initialSearchState, type SearchState } from './searchState';
import { searchBusyLabel } from './SearchWorkspace';

describe('search progress label', () => {
  const loadingFresh: SearchState = { ...initialSearchState, loading: true };

  it('names a fresh search', () => {
    expect(searchBusyLabel(loadingFresh)).toBe('Searching annotations…');
  });

  // A submit clears the previous result, so the presence of one is what
  // distinguishes paging from a new query.
  it('names the page being fetched once results are on screen', () => {
    const paging = {
      ...loadingFresh,
      page: 3,
      result: { columns: [], rows: [], aggs: {}, page: 2, pageSize: 50, total: 100 }
    } as unknown as SearchState;
    expect(searchBusyLabel(paging)).toBe('Loading page 3…');
  });
});
```

Note `import { describe, expect, it, vi } from 'vitest'` is already at the top of this file; add nothing to it.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/search/SearchWorkspace.test.tsx`
Expected: FAIL — `"searchBusyLabel" is not exported by SearchWorkspace.tsx`.

- [ ] **Step 3: Wire `SearchWorkspace`**

In `src/features/search/SearchWorkspace.tsx`, add:

```tsx
import { useBusyWhile } from '../busy/busyState';
```

and add the state type, which the exported function needs in scope:

```tsx
import type { SearchState } from './searchState';
```

Add the pure label function at the bottom of the file, next to the existing exported
`submitSearch`:

```tsx
/**
 * A submit clears the previous result (`searchState.tsx`, case 'submit'), so a
 * result being present is exactly what separates paging from a fresh query.
 */
export function searchBusyLabel(state: SearchState): string {
  return state.result ? `Loading page ${state.page}…` : 'Searching annotations…';
}
```

and call it immediately after `const store = annotationsQuery.data;` — **above** every early return, so hook order never changes:

```tsx
  useBusyWhile(state.loading, searchBusyLabel(state));
```

The existing `.loading-overlay` block at `src/features/search/SearchWorkspace.tsx:217` stays exactly as it is: it also blocks clicks on stale results, which the bar does not.

- [ ] **Step 4: Wire `ResultsTable`**

In `src/features/search/ResultsTable.tsx`, add to the React import: `useTransition`. Add:

```tsx
import { useBusy, useBusyWhile } from '../busy/busyState';
```

Inside `ResultsTable`, next to the other hooks:

```tsx
  const busy = useBusy();
  const [rowPending, startRowTransition] = useTransition();
  const [pinPending, startPinTransition] = useTransition();
  useBusyWhile(rowPending, 'Opening row details…');
  useBusyWhile(pinPending, 'Repositioning columns…');
```

Replace `togglePinned` — computing the next value outside the updater keeps the `savePins` side effect from running twice when React replays a transition:

```tsx
  function togglePinned(field: string) {
    const next = pinnedFields.includes(field)
      ? pinnedFields.filter((pinned) => pinned !== field)
      : [...pinnedFields, field];
    if (pinSignature) savePins(pinSignature, next);
    startPinTransition(() => setPinnedFields(next));
  }
```

Wrap the row click:

```tsx
              <tr key={rowIndex} onClick={() => startRowTransition(() => dispatch({ type: 'selectRow', row }))}>
```

Wrap the download round trip, which today awaits the network with no feedback at all:

```tsx
  async function download() {
    if (!state.submitted || !store) return;
    await busy.run('Preparing download…', async () => {
      const data = await graphqlRequest<{ url?: string }>(buildDownloadQuery(state.submitted!, store));
      if (data.url) {
        const url = data.url.startsWith('http') ? data.url : `${API_BASE}/download${data.url}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  }
```

- [ ] **Step 5: Wire `StatsPanel`**

In `src/features/search/StatsPanel.tsx`, add:

```tsx
import { useBusyWhile } from '../busy/busyState';
```

`StatsPanel` returns early at `if (!state.result || !store)`, so the loading flag must be computed defensively **above** it. Replace the block from `const [tab, setTab] = useState('general');` through `const fieldAgg = ...` with:

```tsx
  const [tab, setTab] = useState('general');

  // Computed above the early return so the hook below always runs.
  const pendingField = state.statsField ?? state.result?.columns[0];
  const statsPending = Boolean(
    state.result && store && pendingField && (!state.stats || state.stats.field !== pendingField)
  );
  useBusyWhile(statsPending, 'Loading stats…');

  if (!state.result || !store) return <Box className="empty-state">No Results</Box>;
  const selectedField = state.statsField ?? state.result.columns[0];
  const fieldAgg = state.stats?.aggs[selectedField];
```

Leave the existing `Loading stats...` inline text alone; it labels the chart area specifically.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/features/search/SearchWorkspace.test.tsx`
Expected: PASS — including the two new tests.

- [ ] **Step 7: Run the full suite and the build**

Run: `npm run test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/search/SearchWorkspace.tsx src/features/search/ResultsTable.tsx src/features/search/StatsPanel.tsx src/features/search/SearchWorkspace.test.tsx
git commit -m "For #12: report searches, paging, row details, pinning, stats and downloads as busy"
```

---

### Task 7: Document and hand off for browser verification

**Files:**
- Modify: `docs/styling-and-ux-conventions.md`
- Modify: `docs/superpowers/specs/2026-09-01-view-all-busy-feedback-design.md` (status line)

- [ ] **Step 1: Document the convention**

Append to `docs/styling-and-ux-conventions.md`:

```markdown
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
```

- [ ] **Step 2: Update the spec status**

In `docs/superpowers/specs/2026-09-01-view-all-busy-feedback-design.md`, change the status line:

```markdown
Status: implemented. **Not yet verified in a browser** — no browser or Playwright is
available in this environment (see "Verification" below).
```

- [ ] **Step 3: Run the whole gate one last time**

Run: `npm run test`
Expected: PASS — every file.

Run: `npm run build`
Expected: PASS — `tsc -b` clean, `vite build` writes `dist/`.

- [ ] **Step 4: Commit and push**

```bash
git add docs/styling-and-ux-conventions.md docs/superpowers/specs/2026-09-01-view-all-busy-feedback-design.md
git commit -m "For #12: document the busy-feedback convention"
git push -u origin issue-12-view-all-button
```

- [ ] **Step 5: Hand the browser checks to a human**

Automated tests here cover the invariant and the behavior. They cannot cover real-browser
wall-clock time or whether the bar looks right — no browser automation exists in this
environment. Report these as the remaining verification, to run against
https://dev.annoq.org after deploy:

1. Chromosome 18 default range, **all** annotations enabled, submit → bar reads "Searching annotations…".
2. Scroll to a Gene Ontology column, click **VIEW ALL n** → dialog opens promptly, titled with the column label.
3. Click a row → detail drawer opens; click **VIEW ALL n** inside it → dialog opens. *(Does nothing at all on `main`.)*
4. Click **Download** → bar reads "Preparing download…" during the round trip.
5. Pin/unpin a column, change pages → bar appears, and the table does not jump when it does.

---

## Rollback

Each task is one commit and reverts cleanly on its own. Task 4 is the one that resolves
the reported symptom; Tasks 1–2 alone would show a bar during a freeze they cannot
interrupt.

## Out Of Scope

Virtualizing the table with `@tanstack/react-virtual` (already a dependency). It would
cut the initial render and scrolling cost too, but it rewrites the table body and the
sticky pinned-column positioning that issues #3 and #4 tuned. Worth its own issue, with
the measurements in the spec attached.
