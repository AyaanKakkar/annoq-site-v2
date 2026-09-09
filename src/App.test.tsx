import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

// The shell layout is what is under test here, so stand the search workspace
// down rather than dragging annotation fetching into the render.
vi.mock('./features/search/SearchWorkspace', () => ({
  SearchWorkspace: () => <div className="search-shell" />
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe('app shell viewport lock', () => {
  it('locks the shell to the viewport on the search route', () => {
    const { container } = renderAt('/search');
    expect(container.querySelector('.app-shell--locked')).toBeInTheDocument();
  });

  it('leaves other routes free to scroll the page', () => {
    const { container } = renderAt('/about');
    expect(container.querySelector('.app-shell')).toBeInTheDocument();
    expect(container.querySelector('.app-shell--locked')).not.toBeInTheDocument();
  });
});

// annoq-site#78: the site serves the TOPMed beta during the cutover and says
// so in the toolbar, matching the banner annoq-site carries.
describe('TopMed beta label', () => {
  it('links the beta label to the version page', () => {
    renderAt('/');
    const label = screen.getByRole('link', { name: 'TopMed Beta Release' });
    expect(label).toHaveAttribute('href', '/version');
  });
});
