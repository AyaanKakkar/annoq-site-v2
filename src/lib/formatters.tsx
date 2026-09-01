import { Box, Button, Link, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import pantherTerms from '../data/panther_terms.json';
import { labelFor } from './annotations';
import type { AnnotationStore } from '../types';
import { ColumnValueType } from '../types';
import { GENES_DISPLAYED_SIZE, TERMS_DISPLAYED_SIZE, UCSC_URL } from './config';

type PantherTerm = { id?: string; label?: string };
const terms = pantherTerms as Record<string, PantherTerm>;

/**
 * `render` is a thunk, not a node: building the full list eagerly for every cell
 * of a 555-column table is what made "View all" look broken (issue #12).
 */
export type ViewAllHandler = (title: string, render: () => ReactNode, count: number) => void;

export type FormattedCell = {
  node: ReactNode;
  overflow?: ReactNode;
  plain: string;
};

export function formatCell(
  field: string,
  value: unknown,
  row: Record<string, unknown>,
  store: AnnotationStore,
  onViewAll?: ViewAllHandler
): FormattedCell {
  if (value === undefined || value === null || value === '') {
    return { node: <span className="muted">-</span>, plain: '' };
  }

  if (field === 'pos') {
    const chr = String(row.chr ?? '').replace(/^chr/i, '');
    const pos = String(value);
    return {
      plain: pos,
      node: (
        <Link href={`${UCSC_URL}${chr}:${pos}-${pos}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          {pos}
        </Link>
      )
    };
  }

  const detail = store.byName[field];
  const stringValue = String(value);
  if (detail?.value_type === ColumnValueType.TERM) {
    const items = stringValue.split(';').filter(Boolean).map((id) => ({ id, ...(terms[id] ?? { label: id }) }));
    return listCell(
      labelFor(field, store),
      items.map((item) => (
        <span key={item.id}>
          {item.label}{' '}
          <Link href={`${detail.root_url ?? ''}${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer">
            {item.id}
          </Link>
        </span>
      )),
      items.map((item) => `${item.label} ${item.id}`).join('; '),
      TERMS_DISPLAYED_SIZE,
      onViewAll
    );
  }

  if (detail?.value_type === ColumnValueType.PANTHER_LONG_GENE_ID) {
    const root = store.byName.enhancer_linked_genes?.root_url ?? detail.root_url ?? '';
    const items = stringValue.split(';').filter(Boolean);
    return listCell(
      labelFor(field, store),
      items.map((item) => (
        <Link key={item} href={`${root}${encodeURIComponent(item)}`} target="_blank" rel="noreferrer">
          {item}
        </Link>
      )),
      items.join('; '),
      GENES_DISPLAYED_SIZE,
      onViewAll
    );
  }

  if (stringValue.includes('|')) {
    const items = stringValue.split('|').filter(Boolean);
    return listCell(labelFor(field, store), items, items.join('; '), TERMS_DISPLAYED_SIZE, onViewAll);
  }

  return { node: stringValue, plain: stringValue };
}

function listCell(
  title: string,
  items: ReactNode[],
  plain: string,
  limit: number,
  onViewAll?: ViewAllHandler
): FormattedCell {
  const visible = items.slice(0, limit);
  // Built on demand. Eagerly constructing this for every cell cost a full render
  // of every list in the table, opened or not.
  const buildFullList = () => (
    <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
      {items.map((item, index) => (
        <Typography component="li" variant="caption" key={index}>
          {item}
        </Typography>
      ))}
    </Stack>
  );
  return {
    plain,
    node: (
      <Box>
        <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
          {visible.map((item, index) => (
            <Typography component="li" variant="caption" key={index}>
              {item}
            </Typography>
          ))}
        </Stack>
        {items.length > limit && (
          <Button size="small" variant="text" onClick={(event) => {
            event.stopPropagation();
            onViewAll?.(title, buildFullList, items.length);
          }}>
            View all {items.length}
          </Button>
        )}
      </Box>
    )
  };
}
