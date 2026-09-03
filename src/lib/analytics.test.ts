import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from './analytics';

afterEach(() => {
  delete window.gtag;
});

describe('trackEvent', () => {
  it('forwards the event name and params to gtag', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent('export_config', { page_path: '/search' });
    expect(gtag).toHaveBeenCalledWith('event', 'export_config', { page_path: '/search' });
  });

  it('sends an empty params object when none is given', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent('clear_selection');
    expect(gtag).toHaveBeenCalledWith('event', 'clear_selection', {});
  });

  // The GA snippet is loaded `async` and is routinely dropped by ad blockers,
  // so window.gtag really is often undefined. An unguarded call would throw
  // inside a click handler and break Submit and Export outright.
  it('does not throw when the analytics script never loaded', () => {
    expect(window.gtag).toBeUndefined();
    expect(() => trackEvent('search_submit', { search_type: 'Chromosome' })).not.toThrow();
  });
});
