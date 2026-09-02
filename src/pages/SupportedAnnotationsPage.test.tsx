import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAnnotationStore } from '../lib/annotations';
import type { Annotation } from '../types';
import { AnnotationSelectionProvider } from '../features/annotations/AnnotationSelectionProvider';
import { SupportedAnnotationsPage } from './SupportedAnnotationsPage';

const store = buildAnnotationStore([
  { id: '1', name: 'Basic Info', leaf: false },
  { id: '2', parent_id: '1', name: 'chr', leaf: true },
  { id: '3', parent_id: '1', name: 'pos', leaf: true }
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
