import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocsPage } from './DocsPage';

// The callout as it appears at the top of the services markdown files. Raw HTML
// in the .md, so it only renders correctly if DocsPage forwards the attributes
// the markdown component overrides used to discard.
const markdown = `# AnnoQ Services

<div class="docs-callout">
  <a class="docs-callout-media" href="https://api-v2.annoq.org/docs" target="_blank" rel="noopener noreferrer"><img class="docs-callout-logo" src="/assets/images/swagger.svg" alt="Swagger" /></a>
  <div class="docs-callout-body">
    <p class="docs-callout-title">AnnoQ REST API</p>
    <a class="docs-callout-action" href="https://api-v2.annoq.org/docs" target="_blank" rel="noopener noreferrer">Open the API documentation</a>
  </div>
</div>

Body text with a plain [markdown link](https://annoq.org) and an ![illustration](/assets/images/api.png).
`;

function renderDocs() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => markdown }));
  return render(<MemoryRouter initialEntries={['/docs/services']}><DocsPage /></MemoryRouter>);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('docs API callout (issue #19)', () => {
  it('keeps the callout action a real external link', async () => {
    renderDocs();

    const action = await screen.findByRole('link', { name: 'Open the API documentation' });
    expect(action).toHaveAttribute('href', 'https://api-v2.annoq.org/docs');
    expect(action).toHaveAttribute('target', '_blank');
    expect(action).toHaveAttribute('rel', 'noopener noreferrer');
    expect(action).toHaveClass('docs-callout-action');
  });

  it('gives the Swagger logo its own class instead of the full-width figure default', async () => {
    renderDocs();

    const logo = await screen.findByAltText('Swagger');
    expect(logo).toHaveAttribute('src', '/assets/images/swagger.svg');
    expect(logo).toHaveClass('docs-callout-logo');
    expect(logo).not.toHaveClass('docs-media');
  });

  it('still lays out ordinary markdown images as centred figures', async () => {
    renderDocs();

    expect(await screen.findByAltText('illustration')).toHaveClass('docs-media');
  });

  it('leaves plain markdown links untouched, with no forced new tab', async () => {
    renderDocs();

    const link = await screen.findByRole('link', { name: 'markdown link' });
    expect(link).toHaveAttribute('href', 'https://annoq.org');
    expect(link).not.toHaveAttribute('target');
  });
});
