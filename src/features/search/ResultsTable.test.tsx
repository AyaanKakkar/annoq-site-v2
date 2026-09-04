import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAnnotationStore } from '../../lib/annotations';
import { API_BASE, DOWNLOAD_ROW_LIMIT } from '../../lib/config';
import { BusyProvider } from '../busy/busyState';
import { initialSearchState, SearchProvider, useSearchState } from './searchState';
import { ViewAllProvider } from './ViewAllDialog';
import type { Annotation, QueryRequest, ResultPage } from '../../types';

const store = buildAnnotationStore([
  { id: '1', name: 'Basic Info', leaf: false },
  { id: '2', parent_id: '1', name: 'chr', label: 'Chromosome', leaf: true },
  { id: '3', parent_id: '1', name: 'pos', label: 'Position', leaf: true }
] as Annotation[]);

vi.mock('../annotations/useAnnotations', () => ({
  useAnnotations: () => ({ data: store })
}));

const request: QueryRequest = {
  mode: 'chromosome',
  values: initialSearchState.values,
  fields: ['chr', 'pos'],
  filters: []
};

const result: ResultPage = {
  request,
  page: 1,
  pageSize: 20,
  total: 2,
  rows: [{ chr: '18', pos: 100 }, { chr: '18', pos: 200 }],
  columns: ['chr', 'pos'],
  aggs: {}
};

// The table only renders once a page has landed, so drive the reducer through
// the same submit -> pageSuccess sequence the workspace uses.
function SeedResult({ total }: { total?: number } = {}) {
  const { dispatch } = useSearchState();
  useEffect(() => {
    dispatch({ type: 'submit', request });
    dispatch({ type: 'pageSuccess', requestId: 1, result: total === undefined ? result : { ...result, total } });
  }, [dispatch, total]);
  return null;
}

async function renderTable(total?: number) {
  const { ResultsTable } = await import('./ResultsTable');
  render(
    <BusyProvider>
      <SearchProvider>
        <ViewAllProvider>
          <SeedResult total={total} />
          <ResultsTable />
        </ViewAllProvider>
      </SearchProvider>
    </BusyProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('results table keyboard scrolling', () => {
  it('exposes the scroll container as a focusable, named region', async () => {
    const { ResultsTable } = await import('./ResultsTable');
    render(
      <BusyProvider>
        <SearchProvider>
          <ViewAllProvider>
            <SeedResult />
            <ResultsTable />
          </ViewAllProvider>
        </SearchProvider>
      </BusyProvider>
    );

    const region = screen.getByRole('region', { name: 'Search results table' });
    expect(region).toHaveClass('simple-results-table-wrap');
    // Chrome and Safari will not focus a scrollable div without this, which is
    // why issue #3 left the mouse as the only way through the results.
    expect(region).toHaveAttribute('tabindex', '0');
  });
});

describe('download row limit (issue #20)', () => {
  it('always offers a link to the API docs beside the download button', async () => {
    await renderTable();

    const link = screen.getByRole('link', { name: /large downloads/i });
    expect(link).toHaveAttribute('href', `${API_BASE}/docs`);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('still allows a download at exactly the limit', async () => {
    await renderTable(DOWNLOAD_ROW_LIMIT);

    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
  });

  it('disables the download button one row over the limit', async () => {
    await renderTable(DOWNLOAD_ROW_LIMIT + 1);

    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
  });
});
