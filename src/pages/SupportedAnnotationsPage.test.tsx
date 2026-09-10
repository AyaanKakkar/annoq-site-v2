import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAnnotationStore } from '../lib/annotations';
import type { Annotation } from '../types';
import { AnnotationSelectionProvider } from '../features/annotations/AnnotationSelectionProvider';
import { SupportedAnnotationsPage } from './SupportedAnnotationsPage';

const store = buildAnnotationStore([
  { id: '0', name: 'root', label: 'Annotation', leaf: false },
  { id: '1', parent_id: '0', name: 'Basic Info', leaf: false },
  { id: '26', parent_id: '0', name: 'ANNOVAR', leaf: false, version: 'annovar-2020' },
  { id: '700', parent_id: '0', name: 'HG19 Info', leaf: false },
  { id: '2', parent_id: '1', name: 'chr', leaf: true, version: 'GRCh38' },
  { id: '3', parent_id: '1', name: 'pos', leaf: true },
  { id: '27', parent_id: '26', name: 'ANNOVAR_gene', leaf: true, version: 'annovar-2020' },
  { id: '1202', parent_id: '700', name: 'HRC_chr_pos', leaf: true, version: 'HRC.r1-1' }
] as Annotation[]);

// Mock the hook rather than standing up a QueryClientProvider: the page only
// needs the resolved store, and no network call is under test here.
vi.mock('../features/annotations/useAnnotations', () => ({
  useAnnotations: () => ({ data: store, isLoading: false, error: null })
}));

const gtag = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  gtag.mockClear();
  window.gtag = gtag;
  URL.createObjectURL = vi.fn(() => 'blob:stub');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  delete window.gtag;
});

function renderPage() {
  render(
    <AnnotationSelectionProvider>
      <SupportedAnnotationsPage />
    </AnnotationSelectionProvider>
  );
}

// v1 tracked these three on /detail (issue #59, detail.component.ts).
describe('SupportedAnnotationsPage analytics', () => {
  it('fires export_config for the detail page', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Export Config' }));
    expect(gtag).toHaveBeenCalledWith('event', 'export_config', { page_path: '/detail' });
  });

  it('fires clear_selection for the detail page', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(gtag).toHaveBeenCalledWith('event', 'clear_selection', { page_path: '/detail' });
  });
});

// The Data Versions tab used to render `store.annotations`, i.e. the raw
// /annotations array order -- which lists every category node before any leaf,
// so a row's neighbours were unrelated to it. annoq-site's /version page walks
// the flattened tree instead, grouping each row under its category. This asserts
// the tree ordering, which also happens to honour the `sort` field the API sets
// on the top-level categories.
describe('SupportedAnnotationsPage data versions ordering', () => {
  function versionTableRows() {
    fireEvent.click(screen.getByRole('tab', { name: 'Data Versions' }));
    return [...document.querySelectorAll('tbody tr')].map(
      (row) => row.querySelector('td')?.textContent ?? ''
    );
  }

  it('lists version rows in annotation-tree order, not raw response order', () => {
    renderPage();
    expect(versionTableRows()).toEqual(['chr', 'ANNOVAR', 'ANNOVAR_gene', 'HRC_chr_pos']);
  });

  it('keeps every row that carries a version', () => {
    renderPage();
    expect(versionTableRows()).toHaveLength(4);
  });
});
