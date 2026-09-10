import type { Annotation, AnnotationNode, AnnotationStore } from '../types';

export function buildAnnotationStore(annotations: Annotation[]): AnnotationStore {
  const normalized = annotations.map((annotation) => ({
    ...annotation,
    label: annotation.label || annotation.name
  }));
  const byName = Object.fromEntries(normalized.map((annotation) => [annotation.name, annotation]));
  const byApiField = Object.fromEntries(
    normalized.map((annotation) => [annotation.api_field || annotation.name, annotation])
  );
  const tree = buildAnnotationTree(normalized);
  const leafNamesByName: Record<string, string[]> = {};
  const indexLeafNames = (node: AnnotationNode) => {
    leafNamesByName[node.name] = collectLeafNames(node);
    node.children.forEach(indexLeafNames);
  };
  tree.forEach(indexLeafNames);
  return {
    annotations: normalized,
    tree,
    byName,
    byApiField,
    leafNamesByName,
    rsidField: findRsidField(normalized)
  };
}

export function buildAnnotationTree(annotations: Annotation[]): AnnotationNode[] {
  const nodes = new Map<string, AnnotationNode>();
  annotations.forEach((annotation) => {
    nodes.set(annotation.id, { ...annotation, children: [] });
  });

  const roots: AnnotationNode[] = [];
  nodes.forEach((node) => {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/**
 * Depth-first pre-order walk of the tree. The Angular site derived its /version
 * table from the flattened tree (MatTreeFlattener over the same parent_id nesting),
 * so anything that wants that ordering has to walk the tree rather than the flat
 * annotation list, which arrives from the API in a different order.
 */
export function flattenAnnotationTree(nodes: AnnotationNode[]): AnnotationNode[] {
  return nodes.flatMap((node) => [node, ...flattenAnnotationTree(node.children)]);
}

export function collectDescendantNames(node: AnnotationNode): string[] {
  return [node.name, ...node.children.flatMap(collectDescendantNames)];
}

export function collectLeafNames(node: AnnotationNode): string[] {
  if (node.leaf || node.children.length === 0) {
    return [node.name];
  }
  return node.children.flatMap(collectLeafNames);
}

export function findNodeByName(nodes: AnnotationNode[], name: string): AnnotationNode | undefined {
  for (const node of nodes) {
    if (node.name === name) return node;
    const child = findNodeByName(node.children, name);
    if (child) return child;
  }
  return undefined;
}

export function apiFieldFor(name: string, store: AnnotationStore): string {
  return store.byName[name]?.api_field || name;
}

export function nameForApiField(apiField: string, store: AnnotationStore): string {
  return store.byApiField[apiField]?.name || apiField;
}

export function labelFor(name: string, store: AnnotationStore): string {
  return (store.byName[name]?.label || name).replace(/_/g, ' ');
}

/**
 * The annotations checked when the search window is first opened (issue #9):
 * the VCF fields and the RSID field — every leaf under "Basic Info" on both
 * stacks.
 *
 * This is the *initial* checkbox state and nothing more. The user may untick
 * `ref`, `alt` or the RSID field, and doing so now removes the column from
 * results and downloads. Only `LOCKED_ANNOTATION_NAMES` is mandatory. Keeping a
 * second "base columns" helper alongside this one is what let those two ideas be
 * confused for each other in issue #4, so there is deliberately only one export.
 *
 * Deliberately name-based rather than id-based. The RSID field is a different
 * annotation on each stack — `rs_dbSNP151` (id 6) on HRC, `rs_dbSNP` (id 756)
 * on TOPMed — so any hardcoded id list is correct on at most one of them.
 */
export function defaultSelectionForStore(store: AnnotationStore): string[] {
  return ['chr', 'pos', 'ref', 'alt', store.rsidField].filter((name) => store.byName[name]?.leaf);
}

/**
 * Drop selected names the active dataset does not carry as queryable leaves.
 *
 * The selection is persisted in localStorage and restored verbatim, so it
 * outlives the dataset it was made against. Point the build at the other stack
 * -- or remove a column from `annotation_tree.csv`, which is what happened to
 * `rs_dbSNP151` -- and every search sends a field the schema no longer has.
 * api-v2 rejects the *whole* document ("Cannot query field 'rs_dbSNP151' on
 * type 'Snp'"), which `MaskErrors` turns into a bare "Unexpected error.", and
 * no action inside the UI clears it: search stays broken until localStorage is
 * wiped by hand.
 *
 * Branch nodes are dropped too -- only leaves are queryable fields.
 */
export function pruneSelectionForStore(selected: string[], store: AnnotationStore): string[] {
  return selected.filter((name) => store.byName[name]?.leaf);
}

function findRsidField(annotations: Annotation[]): string {
  const exactNames = ['rs_dbSNP151', 'rs_dbSNP'];
  for (const name of exactNames) {
    if (annotations.some((annotation) => annotation.name === name || annotation.api_field === name)) {
      return name;
    }
  }

  const candidate = annotations.find((annotation) => {
    const name = annotation.name.toLowerCase();
    const apiField = annotation.api_field?.toLowerCase() ?? '';
    return annotation.leaf && (name === 'rsid' || name.includes('rs_dbsnp') || apiField.includes('rs_dbsnp'));
  });

  return candidate?.name ?? 'rs_dbSNP151';
}
