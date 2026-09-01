import { render, screen, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BusyBar } from './BusyBar';
import { BusyProvider, useBusy } from './busyState';

let controls: ReturnType<typeof useBusy>;
function Capture() {
  controls = useBusy();
  return null;
}

function setup() {
  render(
    <BusyProvider>
      <Capture />
      <BusyBar />
    </BusyProvider>
  );
}

describe('BusyBar', () => {
  it('renders nothing while idle', () => {
    setup();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('announces the running operation politely', () => {
    setup();
    act(() => {
      controls.begin('Opening 1,204 GO biological process…');
    });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Opening 1,204 GO biological process…');
    expect(status).toHaveClass('busy-bar');
  });

  it('shows a progress bar for users who cannot read the label', () => {
    setup();
    act(() => {
      controls.begin('Searching annotations…');
    });
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
  });

  it('disappears when the operation ends', () => {
    setup();
    let end!: () => void;
    act(() => {
      end = controls.begin('Searching annotations…');
    });
    act(() => end());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
