import { describe, expect, it } from 'vitest';
import { buildAnnotationStore } from './annotations';
import {
  buildCountsQuery,
  buildDownloadQuery,
  buildGeneInfoQuery,
  buildPageQuery,
  buildRequest,
  buildStatsQuery
} from './queryBuilder';
import type { Annotation } from '../types';

const store = buildAnnotationStore([
  { id: '1', name: 'root', label: 'Root', leaf: false },
  { id: '3', name: 'rs_dbSNP', label: 'rsID', parent_id: '1', leaf: true },
  { id: '2', name: 'custom_name', api_field: 'CUSTOM_API', label: 'Custom', parent_id: '1', leaf: true }
] as Annotation[]);

const chromosomeValues = {
  chrom: '18',
  start: '1',
  end: '500000',
  geneProduct: '',
  rsID: '',
  rsIDList: '',
  vcf: '',
  keyword: ''
};

describe('query builder', () => {
  it('builds chromosome queries with selected API fields', () => {
    const request = buildRequest(
      'chromosome',
      { chrom: '18', start: '1', end: '500000', geneProduct: '', rsID: '', rsIDList: '', vcf: '', keyword: '' },
      ['custom_name'],
      []
    );
    const query = buildPageQuery(request, 1, store);
    expect(query).toContain('count_SNPs_by_chromosome');
    expect(query).toContain('CUSTOM_API');
    expect(query).toContain('query_type_option: SNPS');
  });

  it('builds each supported query mode', () => {
    const values = {
      chrom: '18',
      start: '1',
      end: '10',
      geneProduct: 'ZMYND11',
      rsID: 'rs1',
      rsIDList: 'rs1\nrs2',
      vcf: 'chr1\t10\t.\tA\tG',
      keyword: 'Signaling by GPCR'
    };
    expect(buildPageQuery(buildRequest('geneProduct', values, ['custom_name'], []), 1, store)).toContain('get_SNPs_by_gene_product');
    expect(buildPageQuery(buildRequest('rsID', values, ['custom_name'], []), 1, store)).toContain('get_SNPs_by_RsID');
    expect(buildPageQuery(buildRequest('rsIDList', values, ['custom_name'], []), 1, store)).toContain('rsIDs: ["rs1","rs2"]');
    expect(buildPageQuery(buildRequest('vcf', values, ['custom_name'], []), 1, store)).toContain('ids: ["1:10A>G"]');
    expect(buildPageQuery(buildRequest('keyword', values, ['custom_name'], []), 1, store)).toContain('keyword: "Signaling by GPCR"');
  });

  // Issue #4: unticking ref/alt/rsID in the tree did nothing, because buildRequest
  // prepended every "base column" to the request regardless of the selection. The
  // requested fields are now exactly the selection; chr/pos are guaranteed to be in
  // it by the AnnotationSelectionProvider invariant, not by this function.
  it('requests exactly the selected annotations', () => {
    const request = buildRequest('chromosome', chromosomeValues, ['chr', 'pos', 'custom_name'], []);
    expect(request.fields).toEqual(['chr', 'pos', 'custom_name']);
  });

  it('omits a deselected annotation from the query it builds', () => {
    const request = buildRequest('chromosome', chromosomeValues, ['chr', 'pos'], []);
    expect(request.fields).not.toContain('rs_dbSNP');
    expect(buildPageQuery(request, 1, store)).not.toContain('rs_dbSNP');
  });

  // The dataset's RSID field is discovered by `defaultSelectionForStore`, which
  // decides what is ticked; `buildRequest` no longer chooses columns at all, so
  // that behaviour is asserted in annotations.test.ts instead.
  it('drops duplicates from the selection', () => {
    const request = buildRequest('chromosome', chromosomeValues, ['chr', 'pos', 'custom_name', 'custom_name'], []);
    expect(request.fields).toEqual(['chr', 'pos', 'custom_name']);
  });
});

// annoq-site#78. api-v2 takes `search_hrc` verbatim (Strawberry runs with
// auto_camel_case=False) on the chromosome / RsID / RsIDs / IDs / gene_product
// families and on gene_info, and rejects it on every *_by_keyword operation.
describe('HRC subset filter (issue #78)', () => {
  const values = {
    chrom: '18',
    start: '1',
    end: '10',
    geneProduct: 'ZMYND11',
    rsID: 'rs1',
    rsIDList: 'rs1\nrs2',
    vcf: 'chr1\t10\t.\tA\tG',
    keyword: 'Signaling by GPCR'
  };

  const modes = ['chromosome', 'geneProduct', 'rsID', 'rsIDList', 'vcf'] as const;

  it.each(modes)('sends search_hrc: true for %s when the flag is set', (mode) => {
    const request = buildRequest(mode, values, ['custom_name'], [], true);
    expect(buildPageQuery(request, 1, store)).toContain('search_hrc: true');
  });

  // Omitted rather than sent as `search_hrc: false`: api-v2's own default is
  // off, so omitting keeps a default search's query string byte-identical to
  // what it was before this flag existed.
  it.each(modes)('omits search_hrc entirely for %s when the flag is unset', (mode) => {
    const request = buildRequest(mode, values, ['custom_name'], [], false);
    expect(buildPageQuery(request, 1, store)).not.toContain('search_hrc');
  });

  it('never sends search_hrc for keyword mode, even when the flag is set', () => {
    const request = buildRequest('keyword', values, ['custom_name'], [], true);
    expect(buildPageQuery(request, 1, store)).not.toContain('search_hrc');
    expect(buildCountsQuery(request, store)).not.toContain('search_hrc');
    expect(buildDownloadQuery(request, store)).not.toContain('search_hrc');
  });

  it('carries the flag onto the counts, stats and download queries', () => {
    const request = buildRequest('chromosome', values, ['custom_name'], [], true);
    expect(buildCountsQuery(request, store)).toContain('search_hrc: true');
    expect(buildDownloadQuery(request, store)).toContain('search_hrc: true');
    const page = { request, page: 1, pageSize: 50, total: 0, rows: [], columns: [], aggs: {} };
    expect(buildStatsQuery(request, 'pos', page, store)).toContain('search_hrc: true');
  });

  it('carries the flag onto the gene_info lookup', () => {
    expect(buildGeneInfoQuery('ZMYND11', true)).toContain('search_hrc: true');
    expect(buildGeneInfoQuery('ZMYND11', false)).not.toContain('search_hrc');
    expect(buildGeneInfoQuery('ZMYND11')).not.toContain('search_hrc');
  });

  it('defaults to off so existing callers are unaffected', () => {
    expect(buildRequest('chromosome', values, ['custom_name'], []).searchHRC).toBe(false);
  });
});
