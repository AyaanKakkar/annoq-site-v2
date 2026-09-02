import { describe, expect, it } from 'vitest';
import { QUERY_MODES, queryModeLabel } from './queryModes';

// These exact strings are what v1 sent to GA as `search_type`. v2 reports to
// the same property, so changing them splits the series at the cutover.
describe('queryModeLabel', () => {
  it('returns the v1 label for every mode', () => {
    expect(queryModeLabel('chromosome')).toBe('Chromosome');
    expect(queryModeLabel('vcf')).toBe('VCF File');
    expect(queryModeLabel('geneProduct')).toBe('Gene Product');
    expect(queryModeLabel('rsID')).toBe('rsID');
    expect(queryModeLabel('rsIDList')).toBe('rsID List');
  });
});

describe('QUERY_MODES', () => {
  it('offers the five enabled modes and hides keyword search', () => {
    expect(QUERY_MODES.map((mode) => mode.value)).toEqual([
      'chromosome',
      'vcf',
      'geneProduct',
      'rsID',
      'rsIDList'
    ]);
  });
});
