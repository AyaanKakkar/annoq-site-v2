import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// import.meta.url is not a file: URL under the jsdom environment, so resolve
// from the vitest root instead.
const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

// Comments are stripped first so they cannot be absorbed into a selector list.
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]+)\}/g)].map(
  (match) => ({
    selectors: match[1].split(',').map((selector) => selector.trim().replace(/\s+/g, ' ')),
    body: match[2]
  })
);

// Returns the declarations of every rule whose selector list contains this
// exact selector, so grouped rules are queryable by any one of their members.
function declarationsFor(selector: string): string {
  const matching = rules.filter((rule) => rule.selectors.includes(selector));
  expect(matching.length, `expected a rule for ${selector}`).toBeGreaterThan(0);
  return matching.map((rule) => rule.body).join('\n');
}

// Issue #3, first fault: the AppBar is 60px of toolbar plus a 1px border, so
// subtracting a hardcoded 60px made the document 1px taller than the viewport
// and Firefox grew a window scrollbar that hid the table's horizontal one.
describe('search layout has no hardcoded AppBar offset', () => {
  it('sizes the search shell from the flex chain rather than the viewport', () => {
    const rule = declarationsFor('.search-shell');
    expect(rule).not.toMatch(/height:\s*calc\(100vh/);
    expect(rule).toContain('flex: 1');
    expect(rule).toContain('min-height: 0');
  });

  it('offsets the portalled drawers from the measured AppBar height', () => {
    for (const selector of ['.query-drawer', '.side-drawer']) {
      const rule = declarationsFor(selector);
      expect(rule, selector).toContain('top: var(--annoq-appbar-h)');
      expect(rule, selector).toContain('calc(100% - var(--annoq-appbar-h))');
      // The width may legitimately carry a px literal; the offsets may not.
      expect(rule, selector).not.toMatch(/(?:top|height):[^;]*60px/);
    }
  });

  it('keeps a fallback for the frame before the AppBar is measured', () => {
    expect(declarationsFor(':root')).toContain('--annoq-appbar-h: 60px');
  });
});

// Issue #3, second fault: removing the calc() also removed the only definite
// height in the chain. The panels below .result-area were sized by
// `height: 100%`, and Gecko does not treat a flex-resolved height as definite
// for percentage children, so in Firefox they collapsed to their content and
// nothing scrolled at all. Blink resolves the percentages, which is why this
// failure is invisible in Chrome and Edge and needs a guard rather than a
// browser check. Every level must be sized by flex.
describe('search panels are sized by flex, not by percentage height', () => {
  it('makes .result-area a column flex container', () => {
    const rule = declarationsFor('.result-area');
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/flex-direction:\s*column/);
    expect(rule).toMatch(/min-height:\s*0/);
  });

  // Every panel the workspace can render into .result-area. A new panel added
  // without flex sizing reintroduces the Firefox-only collapse.
  it.each(['.results-view', '.panel', '.empty-state'])(
    'gives %s a flex-resolved height inside .result-area',
    (child) => {
      const rule = declarationsFor(`.result-area > ${child}`);
      expect(rule).toMatch(/flex:\s*1/);
      expect(rule).toMatch(/min-height:\s*0/);
    }
  );
});

// The bar sits under the menu without displacing anything: fixed, offset by the
// measured AppBar height, above the drawers (1200) and below dialogs (1300).
describe('busy bar is pinned under the measured AppBar', () => {
  it('uses the measured offset rather than a literal', () => {
    const rule = declarationsFor('.busy-bar');
    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toContain('top: var(--annoq-appbar-h)');
    expect(rule).not.toMatch(/top:[^;]*60px/);
  });

  it('layers above the drawers and below dialogs', () => {
    const rule = declarationsFor('.busy-bar');
    const zIndex = /z-index:\s*(\d+)/.exec(rule)?.[1];
    expect(Number(zIndex)).toBeGreaterThan(1200);
    expect(Number(zIndex)).toBeLessThan(1300);
  });
});
