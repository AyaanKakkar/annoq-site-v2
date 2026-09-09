import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { VersionPage } from './StaticPages';

// The Angular site built this table from the flattened annotation tree, so rows
// appeared in tree order. The port read the flat /annotations list instead, and
// that list does not arrive in tree order -- which silently reshuffled the page.
//
// The fixture reproduces the shape that makes the two orders disagree: a second
// top-level tool arrives before the first tool's children, so response order
// interleaves the groups while tree order keeps each parent with its children.
vi.mock('../features/annotations/useAnnotations', async () => {
  const { buildAnnotationStore } = await vi.importActual<typeof import('../lib/annotations')>(
    '../lib/annotations'
  );
  const store = buildAnnotationStore([
    { id: '1', name: 'ANNOVAR', leaf: false, version: 'v1' },
    { id: '2', name: 'VEP', leaf: false, version: 'v2' },
    { id: '3', name: 'ANNOVAR gene', parent_id: '1', leaf: true, version: 'v1a' },
    { id: '4', name: 'VEP consequence', parent_id: '2', leaf: true, version: 'v2a' },
    { id: '5', name: 'no version here', parent_id: '1', leaf: true }
  ]);
  return {
    useAnnotations: () => ({ data: store, isLoading: false, error: null })
  };
});

function renderedToolNames() {
  return screen
    .getAllByRole('row')
    .slice(1) // drop the header row
    .map((row) => row.querySelectorAll('td')[0]?.textContent);
}

describe('VersionPage row ordering', () => {
  it('lists tools in annotation-tree order, not API response order', () => {
    render(<MemoryRouter><VersionPage /></MemoryRouter>);

    // Tree order keeps each parent immediately followed by its own children.
    expect(renderedToolNames()).toEqual(['ANNOVAR', 'ANNOVAR gene', 'VEP', 'VEP consequence']);

    // Response order would have put both parents first -- guard against a
    // regression back to reading the flat list.
    expect(renderedToolNames()).not.toEqual([
      'ANNOVAR',
      'VEP',
      'ANNOVAR gene',
      'VEP consequence'
    ]);
  });

  it('omits annotations that carry no version', () => {
    render(<MemoryRouter><VersionPage /></MemoryRouter>);
    expect(screen.queryByText('no version here')).toBeNull();
  });
});
