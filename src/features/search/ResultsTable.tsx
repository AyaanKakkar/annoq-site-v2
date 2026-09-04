import BarChartIcon from '@mui/icons-material/BarChart';
import DownloadIcon from '@mui/icons-material/Download';
import FilterListIcon from '@mui/icons-material/FilterList';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Link,
  Pagination,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import { memo, useEffect, useMemo, useState, useTransition } from 'react';
import { graphqlRequest } from '../../lib/api';
import { labelFor } from '../../lib/annotations';
import { API_BASE, API_DOCS_URL, DOWNLOAD_ROW_LIMIT, PAGE_SIZE } from '../../lib/config';
import { formatCell } from '../../lib/formatters';
import { buildDownloadQuery } from '../../lib/queryBuilder';
import { useBusy, useBusyWhile } from '../busy/busyState';
import { useAnnotations } from '../annotations/useAnnotations';
import type { AnnotationStore } from '../../types';
import { useSearchState } from './searchState';
import { useViewAll } from './ViewAllDialog';

const COLUMN_WIDTH = 210;
const PIN_STORAGE_KEY = 'annoq:columnPins';
const MAX_STORED_PIN_SETS = 20;
const DEFAULT_PINNED_BY_MODE = {
  chromosome: ['chr', 'pos'],
  vcf: ['chr', 'pos'],
  geneProduct: ['chr', 'pos'],
  rsID: ['rsid'],
  rsIDList: ['rsid'],
  keyword: ['chr', 'pos']
} as const;

export function ResultsTable() {
  const { state, dispatch } = useSearchState();
  const store = useAnnotations().data;
  const [pinnedFields, setPinnedFields] = useState<string[]>([]);
  const [pinSignature, setPinSignature] = useState('');
  const busy = useBusy();
  const [rowPending, startRowTransition] = useTransition();
  const [pinPending, startPinTransition] = useTransition();
  useBusyWhile(rowPending, 'Opening row details…');
  useBusyWhile(pinPending, 'Repositioning columns…');
  const result = state.result;

  useEffect(() => {
    if (!result || !store) return;
    const signature = columnSignature(result.columns);
    if (signature === pinSignature) return;
    setPinSignature(signature);
    const saved = loadSavedPins(signature, result.columns);
    if (saved) {
      setPinnedFields(saved);
      return;
    }
    const defaultCandidates = DEFAULT_PINNED_BY_MODE[result.request.mode].map((field) => field === 'rsid' ? store.rsidField : field);
    const defaults = defaultCandidates.filter((field) => result.columns.includes(field));
    setPinnedFields(defaults);
  }, [pinSignature, result, store]);

  const columnMeta = useMemo(() => {
    if (!result || !store) return [];
    return result.columns.map((field) => ({
      field,
      label: labelFor(field, store),
      count: result.aggs[field]?.doc_count
    }));
  }, [result, store]);

  const orderedColumns = useMemo(() => {
    const pinned = pinnedFields.filter((field) => columnMeta.some((column) => column.field === field));
    return [
      ...pinned,
      ...columnMeta.map((column) => column.field).filter((field) => !pinned.includes(field))
    ];
  }, [columnMeta, pinnedFields]);

  const columnByField = useMemo(
    () => new Map(columnMeta.map((column) => [column.field, column])),
    [columnMeta]
  );

  const pinnedOffsets = useMemo(
    () => new Map(pinnedFields.map((field, index) => [field, index * COLUMN_WIDTH])),
    [pinnedFields]
  );

  function setFilters(filters: string[]) {
    if (!state.submitted) return;
    dispatch({ type: 'setFilters', filters });
    dispatch({ type: 'submit', request: { ...state.submitted, filters } });
  }

  function addFilter(field: string) {
    if (!state.submitted || state.filters.includes(field)) return;
    setFilters([...state.filters, field]);
  }

  function removeFilter(field: string) {
    setFilters(state.filters.filter((filter) => filter !== field));
  }

  function togglePinned(field: string) {
    // Computed outside the updater so the savePins side effect cannot run twice
    // when React replays the transition.
    const next = pinnedFields.includes(field)
      ? pinnedFields.filter((pinned) => pinned !== field)
      : [...pinnedFields, field];
    if (pinSignature) savePins(pinSignature, next);
    startPinTransition(() => setPinnedFields(next));
  }

  async function download() {
    if (!state.submitted || !store) return;
    await busy.run('Preparing download…', async () => {
      const data = await graphqlRequest<{ url?: string }>(buildDownloadQuery(state.submitted!, store));
      if (data.url) {
        const url = data.url.startsWith('http') ? data.url : `${API_BASE}/download${data.url}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  }

  if (!result || !store) {
    return <Box className="empty-state">{state.loading ? 'Loading results...' : 'No Results'}</Box>;
  }

  const downloadTooLarge = result.total > DOWNLOAD_ROW_LIMIT;
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const rowStart = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const rowEnd = Math.min(result.page * PAGE_SIZE, result.total);

  return (
    <Box className="results-view">
      <Stack direction="row" sx={{ alignItems: 'center' }} className="results-header">
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle2">Results: <strong>{result.total.toLocaleString()}</strong></Typography>
            <Typography variant="caption" color="text.secondary">Showing {rowStart}-{rowEnd}</Typography>
            {pinnedFields.length > 0 && <span className="result-pill">Pinned {pinnedFields.length}</span>}
          </Stack>
          {result.gene && (
            <Typography variant="caption" color="text.secondary" noWrap>
              Gene Id: {result.gene.gene_id} · Contig: {result.gene.contig} · Start: {result.gene.start} · End: {result.gene.end}
            </Typography>
          )}
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Tooltip
          title={
            <>
              {downloadTooLarge
                ? `This result set is too large to download (over ${DOWNLOAD_ROW_LIMIT.toLocaleString()} rows).`
                : `Downloads are limited to ${DOWNLOAD_ROW_LIMIT.toLocaleString()} rows.`}
              {' Use the '}
              <Link href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" color="inherit">AnnoQ API</Link>
              {downloadTooLarge ? ' instead.' : ' for larger result sets.'}
            </>
          }
        >
          {/*
            An anchor, not a plain icon: the tooltip is the only place the limit
            is explained, and a hover-only target leaves it unreachable by
            keyboard. Hanging it off the Download button instead would not work
            at all -- MUI disabled buttons swallow the pointer events a tooltip
            listens for, so the message would vanish exactly when it is needed.
          */}
          <IconButton
            size="small"
            className="table-icon-button"
            component="a"
            href={API_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Use the AnnoQ API for large downloads"
          >
            <InfoOutlinedIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          variant="contained"
          startIcon={<DownloadIcon />}
          disabled={downloadTooLarge}
          onClick={() => void download()}
        >
          Download
        </Button>
      </Stack>
      {state.filters.length > 0 && (
        <Stack direction="row" spacing={0.75} className="active-filter-bar">
          <Typography variant="caption" className="active-filter-label">Filters</Typography>
          {state.filters.map((field) => (
            <Chip
              key={field}
              size="small"
              label={labelFor(field, store)}
              onDelete={() => removeFilter(field)}
            />
          ))}
          <Button size="small" onClick={() => setFilters([])}>Clear all</Button>
        </Stack>
      )}

      <Box
        className="simple-results-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Search results table"
      >
        <table className="simple-results-table">
          <thead>
            <tr>
              {orderedColumns.map((field) => {
                const column = columnByField.get(field);
                if (!column) return null;
                const pinnedLeft = pinnedOffsets.get(column.field);
                const isPinned = pinnedLeft !== undefined;
                return (
                <th
                  key={column.field}
                  className={isPinned ? 'pinned-column' : undefined}
                  style={isPinned ? { left: pinnedLeft } : undefined}
                >
                  <Box className="table-head-cell">
                    <Typography variant="caption" className="column-title">{column.label}</Typography>
                    <Stack direction="row" className="column-actions" spacing={0.25}>
                      <Tooltip title={isPinned ? 'Unpin column' : 'Pin column'}>
                        <IconButton size="small" className="table-icon-button" onClick={() => togglePinned(column.field)}>
                          {isPinned ? <PushPinIcon fontSize="inherit" /> : <PushPinOutlinedIcon fontSize="inherit" />}
                        </IconButton>
                      </Tooltip>
                      <Button size="small" variant="text" className="column-count" onClick={() => addFilter(column.field)}>
                        {column.count ?? '-'}
                      </Button>
                      <Tooltip title="Filter rows where this annotation has a value">
                        <IconButton size="small" className="table-icon-button" onClick={() => addFilter(column.field)}><FilterListIcon fontSize="inherit" /></IconButton>
                      </Tooltip>
                      <Tooltip title={`Stats for ${column.label}`}>
                        <IconButton size="small" className="table-icon-button" onClick={() => {
                          dispatch({ type: 'setStatsField', field: column.field });
                          dispatch({ type: 'setSidePanel', sidePanel: 'stats' });
                        }}><BarChartIcon fontSize="inherit" /></IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, rowIndex) => (
              <tr key={rowIndex} onClick={() => startRowTransition(() => dispatch({ type: 'selectRow', row }))}>
                {orderedColumns.map((field) => {
                  const pinnedLeft = pinnedOffsets.get(field);
                  const isPinned = pinnedLeft !== undefined;
                  return (
                  <td
                    key={field}
                    className={isPinned ? 'pinned-column' : undefined}
                    style={isPinned ? { left: pinnedLeft } : undefined}
                  >
                    <ResultCell field={field} value={row[field]} row={row} store={store} />
                  </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Stack sx={{ alignItems: 'center' }} className="pager">
        <Pagination
          color="primary"
          count={totalPages}
          page={result.page}
          onChange={(_, page) => dispatch({ type: 'setPage', page })}
          size="small"
        />
      </Stack>
    </Box>
  );
}

/**
 * Memoized so a table-level state change — pinning, filtering, selecting a row —
 * reformats only the cells whose own props changed. `row` identity is stable
 * because rows come straight from `state.result`, and the view-all opener comes
 * from context rather than an inline prop, which is what lets the comparison
 * succeed at all.
 */
const ResultCell = memo(function ResultCell({
  field,
  value,
  row,
  store
}: {
  field: string;
  value: unknown;
  row: Record<string, unknown>;
  store: AnnotationStore;
}) {
  const openViewAll = useViewAll();
  return <>{formatCell(field, value, row, store, openViewAll).node}</>;
});

type StoredPinSet = {
  key: string;
  pins: string[];
  updatedAt: number;
};

function columnSignature(columns: string[]): string {
  const source = columns.join('|');
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash) ^ source.charCodeAt(index);
  }
  return `${columns.length}:${(hash >>> 0).toString(36)}`;
}

function loadPinSets(): StoredPinSet[] {
  try {
    const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => (
      entry &&
      typeof entry.key === 'string' &&
      Array.isArray(entry.pins) &&
      entry.pins.every((item: unknown) => typeof item === 'string') &&
      typeof entry.updatedAt === 'number'
    ));
  } catch {
    return [];
  }
}

function loadSavedPins(signature: string, columns: string[]): string[] | undefined {
  const saved = loadPinSets().find((entry) => entry.key === signature);
  if (!saved) return undefined;
  const pins = saved.pins.filter((field) => columns.includes(field));
  savePins(signature, pins);
  return pins;
}

function savePinSets(entries: StoredPinSet[]): void {
  try {
    window.localStorage.setItem(
      PIN_STORAGE_KEY,
      JSON.stringify(
        [...entries]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_STORED_PIN_SETS)
      )
    );
  } catch {
    // Ignore storage failures; pinning still works for the current mounted table.
  }
}

function savePins(signature: string, pins: string[]): void {
  const entries = loadPinSets().filter((entry) => entry.key !== signature);
  savePinSets([{ key: signature, pins, updatedAt: Date.now() }, ...entries]);
}
