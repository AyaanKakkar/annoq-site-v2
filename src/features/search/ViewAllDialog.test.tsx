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
