import { createContext, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { Panel, QueryFormValues, QueryMode, QueryRequest, ResultPage, SidePanel, StatsResult } from '../../types';

export type SearchState = {
  mode: QueryMode;
  values: QueryFormValues;
  filters: string[];
  searchHRC: boolean;
  submitted?: QueryRequest;
  requestId: number;
  page: number;
  result?: ResultPage;
  loading: boolean;
  error?: string;
  selectedRow?: Record<string, unknown>;
  statsField?: string;
  stats?: StatsResult;
  panel: Panel;
  sidePanel: SidePanel;
};

type Action =
  | { type: 'setMode'; mode: QueryMode }
  | { type: 'setValues'; values: Partial<QueryFormValues> }
  | { type: 'setFilters'; filters: string[] }
  | { type: 'setSearchHRC'; searchHRC: boolean }
  | { type: 'submit'; request: QueryRequest }
  | { type: 'setPage'; page: number }
  | { type: 'pageSuccess'; requestId: number; result: ResultPage }
  | { type: 'pageAggsSuccess'; requestId: number; aggs: ResultPage['aggs'] }
  | { type: 'pageError'; requestId: number; error: string }
  | { type: 'selectRow'; row?: Record<string, unknown> }
  | { type: 'setStatsField'; field?: string }
  | { type: 'statsSuccess'; stats: StatsResult }
  | { type: 'setPanel'; panel: Panel }
  | { type: 'setSidePanel'; sidePanel: SidePanel };

const initialValues: QueryFormValues = {
  chrom: '18',
  start: '1',
  end: '500000',
  geneProduct: 'ZMYND11',
  rsID: 'rs559687999',
  rsIDList: '',
  vcf: '',
  keyword: 'Signaling by GPCR'
};

export const initialSearchState: SearchState = {
  mode: 'chromosome',
  values: initialValues,
  filters: [],
  searchHRC: false,
  requestId: 0,
  page: 1,
  loading: false,
  panel: 'table',
  sidePanel: null
};

function reducer(state: SearchState, action: Action): SearchState {
  switch (action.type) {
    case 'setMode':
      return { ...state, mode: action.mode };
    case 'setValues':
      if (Object.entries(action.values).every(([key, value]) => state.values[key as keyof QueryFormValues] === value)) {
        return state;
      }
      return { ...state, values: { ...state.values, ...action.values } };
    case 'setFilters':
      return { ...state, filters: action.filters };
    case 'setSearchHRC':
      return { ...state, searchHRC: action.searchHRC };
    case 'submit':
      return {
        ...state,
        submitted: action.request,
        requestId: state.requestId + 1,
        filters: action.request.filters,
        searchHRC: action.request.searchHRC,
        page: 1,
        result: undefined,
        selectedRow: undefined,
        stats: undefined,
        error: undefined,
        loading: true,
        panel: 'table',
        sidePanel: null
      };
    case 'setPage':
      if (state.page === action.page) return state;
      return { ...state, page: action.page, loading: true, error: undefined };
    case 'pageSuccess':
      if (action.requestId !== state.requestId) return state;
      return { ...state, result: action.result, page: action.result.page, loading: false, error: undefined };
    case 'pageAggsSuccess':
      if (action.requestId !== state.requestId || !state.result) return state;
      return {
        ...state,
        result: {
          ...state.result,
          aggs: action.aggs,
          posMin: action.aggs.pos?.min,
          posMax: action.aggs.pos?.max
        }
      };
    case 'pageError':
      if (action.requestId !== state.requestId) return state;
      return { ...state, loading: false, result: undefined, error: action.error };
    case 'selectRow':
      return { ...state, selectedRow: action.row, sidePanel: action.row ? 'detail' : state.sidePanel };
    case 'setStatsField':
      return { ...state, statsField: action.field };
    case 'statsSuccess':
      return { ...state, stats: action.stats };
    case 'setPanel':
      return { ...state, panel: action.panel };
    case 'setSidePanel':
      return { ...state, sidePanel: action.sidePanel };
  }
}

const SearchContext = createContext<{ state: SearchState; dispatch: React.Dispatch<Action> } | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialSearchState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearchState() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchState must be used inside SearchProvider');
  }
  return context;
}
