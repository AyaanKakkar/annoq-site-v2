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
