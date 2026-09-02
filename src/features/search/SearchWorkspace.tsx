import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import BarChartIcon from '@mui/icons-material/BarChart';
import ListIcon from '@mui/icons-material/List';
import TableChartIcon from '@mui/icons-material/TableChart';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { graphqlRequest } from '../../lib/api';
import {
  buildGeneInfoQuery,
  buildCountsQuery,
  buildPageQuery,
  buildRequest,
  buildStatsQuery,
  normalizePageResponse,
  normalizeStatsResponse
} from '../../lib/queryBuilder';
import { defaultSelectionForStore } from '../../lib/annotations';
import { trackEvent } from '../../lib/analytics';
import { LOCKED_ANNOTATION_NAMES } from '../../lib/config';
import { queryModeLabel } from '../../lib/queryModes';
import { useAnnotationSelection } from '../annotations/AnnotationSelectionProvider';
import { useAnnotations } from '../annotations/useAnnotations';
import { useBusyWhile } from '../busy/busyState';
import { useSearchState } from './searchState';
import type { SearchState } from './searchState';
import { QueryDrawer } from './QueryDrawer';
import { ResultsTable } from './ResultsTable';
import { SummaryPanel } from './SummaryPanel';
import { StatsPanel } from './StatsPanel';
import { DetailPanel } from './DetailPanel';
import { FilterPanel } from './FilterPanel';
import type { ResultPage } from '../../types';

export function SearchWorkspace() {
  const annotationsQuery = useAnnotations();
  const annotationSelection = useAnnotationSelection();
  const { state, dispatch } = useSearchState();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [annotationDrawerOpen, setAnnotationDrawerOpen] = useState(!isMobile);
  const pageAbort = useRef<AbortController | null>(null);
  const statsAbort = useRef<AbortController | null>(null);
  const defaultsInitialized = useRef(false);

  const store = annotationsQuery.data;

  useBusyWhile(state.loading, searchBusyLabel(state));

  useEffect(() => {
    // "No prior selection" cannot mean "empty" any more: chr and pos are always
    // present (issue #4). Seed whenever nothing beyond them has been chosen, or
    // the issue #9 defaults would silently stop appearing.
    const hasUserSelection = annotationSelection.selected.some((name) => !LOCKED_ANNOTATION_NAMES.includes(name));
    if (!store || defaultsInitialized.current || hasUserSelection) return;
    defaultsInitialized.current = true;
    const defaults = defaultSelectionForStore(store);
    if (defaults.length === 0) return;
    annotationSelection.setSelected(defaults);
  }, [annotationSelection, store]);

  useEffect(() => {
    if (!store || !state.submitted) return;
    const annotationStore = store;
    const requestId = state.requestId;
    const request = state.submitted;
    const page = state.page;
    pageAbort.current?.abort();
    const controller = new AbortController();
    pageAbort.current = controller;

    async function load() {
      try {
        let gene: ResultPage['gene'];
        if (request.mode === 'geneProduct') {
          const geneData = await graphqlRequest<{ geneInfo?: ResultPage['gene'] }>(
            buildGeneInfoQuery(request.values.geneProduct),
            controller.signal
          );
          gene = geneData.geneInfo;
          if (!gene) throw new Error('Gene product was not found');
        }
        const query = buildPageQuery(request, page, annotationStore);
        const data = await graphqlRequest<{ count: number; snps?: { snps?: Record<string, unknown>[] }; aggs?: ResultPage['aggs'] }>(
          query,
          controller.signal
        );
        dispatch({ type: 'pageSuccess', requestId, result: normalizePageResponse(request, page, data, annotationStore, gene) });
        void graphqlRequest<{ aggs?: ResultPage['aggs'] }>(buildCountsQuery(request, annotationStore), controller.signal)
          .then((aggData) => {
            dispatch({
              type: 'pageAggsSuccess',
              requestId,
              aggs: normalizePageResponse(request, page, { count: data.count, snps: { snps: [] }, aggs: aggData.aggs }, annotationStore, gene).aggs
            });
          })
          .catch((error) => {
            if (!controller.signal.aborted) console.warn(error);
          });
      } catch (error) {
        if (controller.signal.aborted) return;
        dispatch({ type: 'pageError', requestId, error: error instanceof Error ? error.message : 'Search failed' });
      }
    }

    void load();
    return () => controller.abort();
  }, [dispatch, state.page, state.requestId, state.submitted, store]);

  useEffect(() => {
    const statsField = state.statsField ?? state.result?.columns[0];
    if (!store || !state.submitted || !state.result || !statsField) return;
    const annotationStore = store;
    const activeStatsField = statsField;
    statsAbort.current?.abort();
    const controller = new AbortController();
    statsAbort.current = controller;

    async function loadStats() {
      try {
        const data = await graphqlRequest<{ aggs?: ResultPage['aggs'] }>(
          buildStatsQuery(state.submitted!, activeStatsField, state.result!, annotationStore),
          controller.signal
        );
        dispatch({ type: 'statsSuccess', stats: normalizeStatsResponse(activeStatsField, data, annotationStore) });
      } catch (error) {
        if (!controller.signal.aborted) console.warn(error);
      }
    }

    void loadStats();
    return () => controller.abort();
  }, [dispatch, state.result, state.statsField, state.submitted, store]);

  const sideTitle = {
    detail: 'Variant Details',
    summary: 'Summary',
    stats: 'Results Details & Stats',
    filters: 'Filter By'
  }[state.sidePanel ?? 'detail'];

  const body = useMemo(() => {
    if (state.panel === 'summary') return <SummaryPanel />;
    if (state.panel === 'stats') return <StatsPanel />;
    return <ResultsTable />;
  }, [state.panel]);

  if (annotationsQuery.isLoading) {
    return <Centered><CircularProgress /></Centered>;
  }

  if (annotationsQuery.error || !store) {
    return <Alert severity="error">Unable to load annotation metadata.</Alert>;
  }

  return (
    <Box className="search-shell">
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={annotationDrawerOpen}
        onClose={() => setAnnotationDrawerOpen(false)}
        slotProps={{ paper: { className: 'query-drawer' } }}
      >
        <QueryDrawer
          store={store}
          onClose={() => setAnnotationDrawerOpen(false)}
          onSubmitted={() => {
            if (isMobile) setAnnotationDrawerOpen(false);
          }}
        />
      </Drawer>

      <Box className="search-main" sx={{ ml: !isMobile && annotationDrawerOpen ? '420px' : 0 }}>
        <Toolbar className="search-tools" variant="dense">
          {!annotationDrawerOpen && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<TuneIcon />}
              onClick={() => setAnnotationDrawerOpen(true)}
              className="query-form-open-button"
            >
              Query Form
            </Button>
          )}
          <Tabs
            value={state.panel}
            onChange={(_, panel) => dispatch({ type: 'setPanel', panel })}
            aria-label="Result views"
          >
            <Tab icon={<TableChartIcon />} iconPosition="start" label="Table" value="table" />
            <Tab icon={<ListIcon />} iconPosition="start" label="Summary" value="summary" />
            <Tab icon={<BarChartIcon />} iconPosition="start" label="Stats" value="stats" />
          </Tabs>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Filters">
            <IconButton disabled={!state.result} onClick={() => dispatch({ type: 'setSidePanel', sidePanel: 'filters' })}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>

        {state.error && <Alert severity="warning" sx={{ m: 1 }}>{state.error}</Alert>}
        <Box className="result-area">
          {body}
          {state.loading && (
            <Box className="loading-overlay">
              <CircularProgress />
            </Box>
          )}
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={Boolean(state.sidePanel)}
        onClose={() => dispatch({ type: 'setSidePanel', sidePanel: null })}
        slotProps={{ paper: { className: 'side-drawer' } }}
      >
        <Stack direction="row" sx={{ alignItems: 'center' }} className="drawer-header">
          <Typography variant="subtitle2">{sideTitle}</Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => dispatch({ type: 'setSidePanel', sidePanel: null })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        {state.sidePanel === 'detail' && <DetailPanel />}
        {state.sidePanel === 'summary' && <SummaryPanel compact />}
        {state.sidePanel === 'stats' && <StatsPanel compact />}
        {state.sidePanel === 'filters' && <FilterPanel />}
      </Drawer>
    </Box>
  );
}

/**
 * A submit clears the previous result (`searchState.tsx`, case 'submit'), so a
 * result being present is exactly what separates paging from a fresh query.
 */
export function searchBusyLabel(state: SearchState): string {
  return state.result ? `Loading page ${state.page}…` : 'Searching annotations…';
}

export function submitSearch(
  mode: ReturnType<typeof useSearchState>['state']['mode'],
  values: ReturnType<typeof useSearchState>['state']['values'],
  selectedAnnotationNames: string[],
  filters: string[],
  dispatch: ReturnType<typeof useSearchState>['dispatch']
) {
  // Tracked here rather than in the component (v1 put it in
  // annotation.component.submit) because this is the one funnel every search
  // passes through. v1's `if (source.length > 0)` guard has no equivalent:
  // chr and pos are locked, so an empty submission is unreachable (issue #4).
  trackEvent('search_submit', { search_type: queryModeLabel(mode) });
  const request = buildRequest(mode, values, selectedAnnotationNames, filters);
  dispatch({ type: 'submit', request });
}

function Centered({ children }: { children: React.ReactNode }) {
  return <Box sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}>{children}</Box>;
}
