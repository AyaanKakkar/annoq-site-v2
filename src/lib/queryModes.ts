import type { QueryMode } from '../types';
import { ENABLE_KEYWORD_SEARCH } from './config';

const ALL_QUERY_MODES: Array<{ value: QueryMode; label: string }> = [
  { value: 'chromosome', label: 'Chromosome' },
  { value: 'vcf', label: 'VCF File' },
  { value: 'geneProduct', label: 'Gene Product' },
  { value: 'rsID', label: 'rsID' },
  { value: 'rsIDList', label: 'rsID List' },
  { value: 'keyword', label: 'Keyword Search' }
];

export const QUERY_MODES = ALL_QUERY_MODES.filter(
  (item) => ENABLE_KEYWORD_SEARCH || item.value !== 'keyword'
);

/**
 * The display label, never the QueryMode value. v1 sent this human string as
 * GA's `search_type`; v2 reports to the same property, so the vocabularies
 * have to match. Looks in the unfiltered list so a disabled mode still labels.
 */
export function queryModeLabel(mode: QueryMode): string {
  return ALL_QUERY_MODES.find((item) => item.value === mode)?.label ?? mode;
}
