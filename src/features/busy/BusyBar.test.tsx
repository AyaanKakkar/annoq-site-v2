import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

// The bar is fixed at the same `top` as the query drawer and paints above it,
// so anything that must stay clear of it needs its height. Idle must report 0px
// or the drawer header would keep padding for a bar that is not there.
describe('BusyBar height publication', () => {
  const readVar = () => document.documentElement.style.getPropertyValue('--annoq-busy-h');

  it('publishes its measured height while busy and zero once idle', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue({ height: 30 } as DOMRect);
    setup();
    expect(readVar()).toBe('0px');

    let end!: () => void;
    act(() => {
      end = controls.begin('Searching annotations…');
    });
    expect(readVar()).toBe('30px');

    act(() => end());
    expect(readVar()).toBe('0px');
    rect.mockRestore();
  });
});
