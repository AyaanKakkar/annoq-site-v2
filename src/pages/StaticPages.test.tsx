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

describe('programmatic access icons (issue #19)', () => {
  it('shows a brand logo per card, each linking to its own project', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    const expected = [
      ['Swagger', '/assets/images/swagger.svg', 'https://api-v2.annoq.org/docs'],
      ['Python', '/assets/images/python.svg', 'https://github.com/USCbiostats/annoq-py'],
      ['R', '/assets/images/r-package.svg', 'https://github.com/USCbiostats/AnnoQR']
    ];

    for (const [alt, src, href] of expected) {
      const logo = screen.getByAltText(alt);
      expect(logo).toHaveAttribute('src', src);
      // The icon is the link, not just decoration inside one.
      const link = logo.closest('a');
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('keeps the View Details buttons pointing at the internal docs', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    const routes = screen.getAllByRole('link', { name: 'View Details' }).map((link) => link.getAttribute('href'));
    expect(routes).toEqual(['/docs/services', '/docs/tutorials/annoq-py', '/docs/tutorials/r-package']);
  });
});
