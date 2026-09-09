import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { API_DOCS_URL } from '../lib/config';
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

    // The API card is asserted against the derived API_DOCS_URL, not a literal:
    // issue #20 made the docs link follow the API the site actually queries, so
    // pinning a host here would re-break at the TOPMed cutover.
    const expected = [
      ['Swagger', '/assets/images/swagger.svg', API_DOCS_URL],
      ['Python', '/assets/images/python.svg', 'https://github.com/USCbiostats/annoq-py/tree/annoq-site-78-add-hrc-mapping-info'],
      ['R', '/assets/images/r-package.svg', 'https://github.com/USCbiostats/AnnoQR/tree/annoq-site-78-add-hrc-mapping-info']
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

// annoq-site#78: the site serves TOPMed Freeze 8, so the headline figures and
// the dataset attribution have to say so.
describe('HomePage dataset figures (issue #78)', () => {
  it('reports the TOPMed variant count, not the HRC one', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('> 700 million')).toBeInTheDocument();
    expect(screen.queryByText('~39 million')).not.toBeInTheDocument();
  });

  it('reports the TOPMed annotation-type count', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('800+')).toBeInTheDocument();
    expect(screen.queryByText('600+')).not.toBeInTheDocument();
  });

  it('attributes the variants to TOPMed rather than the HRC', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(
      screen.getByRole('link', { name: 'Trans-Omics for Precision Medicine (TOPMed)' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/pre-annotated variants from the Haplotype Reference Consortium/)
    ).not.toBeInTheDocument();
  });

  // The old band advertised TOPMed as a beta living at topmed.annoq.org. On the
  // cutover branch that link points back at this same site, so the band now
  // describes HRC as an option here instead of TOPMed as somewhere else.
  it('does not send visitors off-site to the TOPMed beta', () => {
    const { container } = render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(container.querySelector('a[href="https://topmed.annoq.org/"]')).toBeNull();
  });
});

// The programme and the dataset release are two different destinations. As one
// anchor spanning both names, hovering lit the whole phrase, so there was no way
// to tell them apart -- and no way to reach topmed.nhlbi.nih.gov at all.
describe('TOPMed attribution links', () => {
  it('links the programme and the data release separately', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    const programme = screen.getByRole('link', { name: 'Trans-Omics for Precision Medicine (TOPMed)' });
    expect(programme).toHaveAttribute('href', 'https://topmed.nhlbi.nih.gov/');

    const release = screen.getByRole('link', { name: 'Freeze 8' });
    expect(release).toHaveAttribute('href', 'https://legacy.bravo.sph.umich.edu/freeze8/hg38/');

    // Two distinct anchors, so :hover applies to only one at a time.
    expect(programme).not.toBe(release);
    expect(programme.contains(release)).toBe(false);
    expect(release.contains(programme)).toBe(false);
    // The word between them must not be part of either link.
    expect(programme.textContent).not.toMatch(/Freeze 8/);
    expect(release.textContent).not.toMatch(/Trans-Omics/);
  });
});
