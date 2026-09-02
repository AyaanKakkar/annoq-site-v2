import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './StaticPages';

// HomePage does not call useAnnotations, but StaticPages imports it for the
// version table, so the module still has to resolve without a query client.
vi.mock('../features/annotations/useAnnotations', () => ({
  useAnnotations: () => ({ data: undefined, isLoading: false, error: null })
}));

describe('HomePage web browser access section', () => {
  it('shows the query UI screenshot alongside the numbered steps', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByAltText('AnnoQ query interface')).toHaveAttribute(
      'src',
      '/assets/images/ui-query.png'
    );
  });
});
