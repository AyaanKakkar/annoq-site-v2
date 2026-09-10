import { describe, expect, it } from 'vitest';
import type { Annotation } from '../types';
import {
  apiFieldFor,
  buildAnnotationStore,
  collectLeafNames,
  flattenTree,
  defaultSelectionForStore,
  nameForApiField,
  pruneSelectionForStore
} from './annotations';
import { LOCKED_ANNOTATION_NAMES } from './config';

// The API returns ids as JSON strings on both stacks. Fixtures mirror that
// exactly: numeric-id fixtures would pass against code that cannot work
// against the real payload, which is how issue #9 survived review.
const annotations = [
  { id: '1', name: 'root', leaf: false },
  { id: '3', parent_id: '1', name: 'rs_dbSNP', leaf: true },
  { id: '2', parent_id: '1', name: 'child', api_field: 'CHILD_API', leaf: true }
] as Annotation[];

// "Basic Info" as the HRC (production) payload shapes it.
const hrcAnnotations = [
  { id: '0', name: 'root', label: 'Annotation', leaf: false },
  { id: '1', parent_id: '0', name: 'Basic Info', leaf: false },
  { id: '2', parent_id: '1', name: 'chr', api_field: 'chr', leaf: true },
  { id: '3', parent_id: '1', name: 'pos', api_field: 'pos', leaf: true },
  { id: '4', parent_id: '1', name: 'ref', api_field: 'ref', leaf: true },
  { id: '5', parent_id: '1', name: 'alt', api_field: 'alt', leaf: true },
  { id: '6', parent_id: '1', name: 'rs_dbSNP151', label: 'rs ID', api_field: 'rs_dbSNP151', leaf: true },
  { id: '26', parent_id: '0', name: 'ANNOVAR', leaf: false },
  { id: '27', parent_id: '26', name: 'ANNOVAR_ensembl_Effect', leaf: true }
] as Annotation[];

// TOPMed (beta) carries a different RSID field under a different id, which is
// why the defaults cannot be keyed off annotation ids.
const topmedAnnotations = [
  { id: '0', name: 'root', label: 'Annotation', leaf: false },
  { id: '1', parent_id: '0', name: 'Basic Info', leaf: false },
  { id: '2', parent_id: '1', name: 'chr', api_field: 'chr', leaf: true },
  { id: '3', parent_id: '1', name: 'pos', api_field: 'pos', leaf: true },
  { id: '4', parent_id: '1', name: 'ref', api_field: 'ref', leaf: true },
  { id: '5', parent_id: '1', name: 'alt', api_field: 'alt', leaf: true },
  { id: '756', parent_id: '1', name: 'rs_dbSNP', label: 'rs ID', api_field: 'rs_dbSNP', leaf: true }
] as Annotation[];

describe('annotations', () => {
  it('builds normalized lookup and tree', () => {
    const store = buildAnnotationStore(annotations);
    expect(store.tree[0].children.map((child) => child.name)).toContain('child');
    expect(apiFieldFor('child', store)).toBe('CHILD_API');
    expect(nameForApiField('CHILD_API', store)).toBe('child');
    expect(collectLeafNames(store.tree[0])).toEqual(['rs_dbSNP', 'child']);
    expect(store.leafNamesByName.root).toEqual(['rs_dbSNP', 'child']);
    expect(store.rsidField).toBe('rs_dbSNP');
  });
});

describe('defaultSelectionForStore', () => {
  it('selects the VCF fields and the RSID field on the HRC payload', () => {
    const store = buildAnnotationStore(hrcAnnotations);
    expect(defaultSelectionForStore(store)).toEqual(['chr', 'pos', 'ref', 'alt', 'rs_dbSNP151']);
  });

  it('resolves the RSID field per dataset rather than by id', () => {
    const store = buildAnnotationStore(topmedAnnotations);
    expect(defaultSelectionForStore(store)).toEqual(['chr', 'pos', 'ref', 'alt', 'rs_dbSNP']);
  });

  // A locked name missing from the defaults would open the tree with a box that
  // is disabled but unticked, while the column appeared in results anyway.
  it('includes every annotation the user cannot deselect', () => {
    const store = buildAnnotationStore(hrcAnnotations);
    expect(defaultSelectionForStore(store)).toEqual(expect.arrayContaining(LOCKED_ANNOTATION_NAMES));
  });

  it('omits defaults the store does not actually carry as leaves', () => {
    const store = buildAnnotationStore([
      { id: '0', name: 'root', leaf: false },
      { id: '1', parent_id: '0', name: 'Basic Info', leaf: false },
      { id: '2', parent_id: '1', name: 'chr', api_field: 'chr', leaf: true }
    ] as Annotation[]);
    expect(defaultSelectionForStore(store)).toEqual(['chr']);
  });
});

// A selection is persisted in localStorage and restored verbatim, so it
// outlives the dataset it was made against. `rs_dbSNP151` exists only on HRC;
// sending it to TOPMed's api-v2 fails the whole GraphQL document with
// "Cannot query field 'rs_dbSNP151' on type 'Snp'", which reaches the user as
// a masked "Unexpected error." and cannot be recovered from inside the app.
describe('pruneSelectionForStore', () => {
  it('drops stored names the active dataset does not carry', () => {
    const store = buildAnnotationStore(topmedAnnotations);
    expect(pruneSelectionForStore(['chr', 'pos', 'rs_dbSNP151', 'rs_dbSNP'], store)).toEqual([
      'chr',
      'pos',
      'rs_dbSNP'
    ]);
  });

  it('keeps a selection the dataset fully carries, in order', () => {
    const store = buildAnnotationStore(hrcAnnotations);
    const selection = ['chr', 'pos', 'ANNOVAR_ensembl_Effect', 'rs_dbSNP151'];
    expect(pruneSelectionForStore(selection, store)).toEqual(selection);
  });

  // Branch nodes are not queryable fields; only leaves reach the GraphQL
  // document, so a stored branch name would break the query just as surely.
  it('drops branch nodes, keeping only queryable leaves', () => {
    const store = buildAnnotationStore(hrcAnnotations);
    expect(pruneSelectionForStore(['chr', 'ANNOVAR', 'ANNOVAR_ensembl_Effect'], store)).toEqual([
      'chr',
      'ANNOVAR_ensembl_Effect'
    ]);
  });
});

describe('flattenTree', () => {
  it('returns nodes depth-first, each parent immediately before its own children', () => {
    const store = buildAnnotationStore([
      { id: '0', name: 'root', leaf: false },
      { id: '1', parent_id: '0', name: 'A', leaf: false },
      { id: '2', parent_id: '0', name: 'B', leaf: false },
      { id: '3', parent_id: '1', name: 'a1', leaf: true },
      { id: '4', parent_id: '2', name: 'b1', leaf: true }
    ] as Annotation[]);

    expect(flattenTree(store.tree).map((node) => node.name)).toEqual(['root', 'A', 'a1', 'B', 'b1']);
  });
});
