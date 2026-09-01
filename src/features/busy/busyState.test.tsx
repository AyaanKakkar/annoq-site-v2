import { render, screen, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BusyProvider, useBusy, useBusyStatus, useBusyWhile } from './busyState';

function Status() {
  const { busy, label } = useBusyStatus();
  return <div data-testid="status">{busy ? `busy:${label}` : 'idle'}</div>;
}

let controls: ReturnType<typeof useBusy>;
function Capture() {
  controls = useBusy();
  return null;
}

function setup() {
  render(
    <BusyProvider>
      <Capture />
      <Status />
    </BusyProvider>
  );
  return screen.getByTestId('status');
}

describe('busy registry', () => {
  it('starts idle', () => {
    expect(setup()).toHaveTextContent('idle');
  });

  it('reports the label of a started operation', () => {
    const status = setup();
    act(() => {
      controls.begin('Searching annotations…');
    });
    expect(status).toHaveTextContent('busy:Searching annotations…');
  });

  it('shows the most recently started label', () => {
    const status = setup();
    act(() => {
      controls.begin('first');
      controls.begin('second');
    });
    expect(status).toHaveTextContent('busy:second');
  });

  it('stays busy until every operation has ended', () => {
    const status = setup();
    let endFirst!: () => void;
    let endSecond!: () => void;
    act(() => {
      endFirst = controls.begin('first');
      endSecond = controls.begin('second');
    });
    act(() => endFirst());
    expect(status).toHaveTextContent('busy:second');
    act(() => endSecond());
    expect(status).toHaveTextContent('idle');
  });

  it('ignores a repeated end call', () => {
    const status = setup();
    let end!: () => void;
    act(() => {
      end = controls.begin('only');
    });
    act(() => {
      end();
      end();
    });
    expect(status).toHaveTextContent('idle');
  });

  it('clears the entry when run() resolves', async () => {
    const status = setup();
    await act(async () => {
      await controls.run('downloading', async () => 'ok');
    });
    expect(status).toHaveTextContent('idle');
  });

  it('clears the entry when run() throws, and rethrows', async () => {
    const status = setup();
    await act(async () => {
      await expect(
        controls.run('downloading', async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
    });
    expect(status).toHaveTextContent('idle');
  });
});

describe('useBusyWhile', () => {
  function Reporter({ active }: { active: boolean }) {
    useBusyWhile(active, 'loading page 2…');
    return null;
  }

  it('registers while active and clears when it goes false', () => {
    const { rerender } = render(
      <BusyProvider>
        <Reporter active={false} />
        <Status />
      </BusyProvider>
    );
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('idle');

    rerender(
      <BusyProvider>
        <Reporter active={true} />
        <Status />
      </BusyProvider>
    );
    expect(status).toHaveTextContent('busy:loading page 2…');

    rerender(
      <BusyProvider>
        <Reporter active={false} />
        <Status />
      </BusyProvider>
    );
    expect(status).toHaveTextContent('idle');
  });
});
