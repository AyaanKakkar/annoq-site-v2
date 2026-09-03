declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * The single guarded path to GA. Optional-call, not decoration: the gtag
 * snippet loads `async` and ad blockers drop it, so `window.gtag` is often
 * undefined and an unguarded call would throw inside a click handler.
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  window.gtag?.('event', name, params);
}
