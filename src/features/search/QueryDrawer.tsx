import FileUploadIcon from '@mui/icons-material/FileUpload';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Annotation, AnnotationStore, QueryMode } from '../../types';
import { AnnotationTree } from '../annotations/AnnotationTree';
import { AnnotationDetailDialog } from '../annotations/AnnotationDetailDialog';
import { useSearchState } from './searchState';
import { useAnnotationSelection } from '../annotations/AnnotationSelectionProvider';
import { SAMPLE_RSID_LIST, SAMPLE_VCF } from '../../data/samples';
import { downloadText, parseConfig } from '../../lib/files';
import { trackEvent } from '../../lib/analytics';
import { ENABLE_KEYWORD_SEARCH, GENOME_BUILD } from '../../lib/config';
import { QUERY_MODES, queryModeLabel } from '../../lib/queryModes';
import { submitSearch } from './SearchWorkspace';

export function QueryDrawer({
  store,
  onSubmitted,
  onClose
}: {
  store: AnnotationStore;
  onSubmitted: () => void;
  onClose: () => void;
}) {
  const { state, dispatch } = useSearchState();
  const annotationSelection = useAnnotationSelection();
  const [mode, setMode] = useState(state.mode);
  const [values, setValues] = useState(state.values);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | undefined>();
  const [configError, setConfigError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const setSelectedAnnotations = useCallback((names: string[]) => annotationSelection.setSelected(names), [annotationSelection]);

  const changeMode = useCallback((nextMode: QueryMode) => {
    setMode(nextMode);
    dispatch({ type: 'setMode', mode: nextMode });
  }, [dispatch]);

  const updateValues = useCallback((nextValues: Partial<typeof values>) => {
    setValues((previous) => ({ ...previous, ...nextValues }));
    dispatch({ type: 'setValues', values: nextValues });
  }, [dispatch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryType = params.get('query_type');
    const nextMode = queryType === 'chr' ? 'chromosome' : queryType === 'gp' ? 'geneProduct' : undefined;
    if (nextMode) changeMode(nextMode);
    const preloadValues = {
      chrom: params.get('chr') || state.values.chrom,
      start: params.get('start') || state.values.start,
      end: params.get('end') || state.values.end,
      geneProduct: params.get('gp') || state.values.geneProduct
    };
    updateValues(preloadValues);
    // URL preload should only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeMode, updateValues]);

  async function readTextFile(file?: File): Promise<string> {
    if (!file) return '';
    return file.text();
  }

  async function onConfigChange(file?: File) {
    // Fired on file change, not on the button that opens the picker: v1 bound
    // trackUploadConfig to the input's (change) event, so a cancelled file
    // dialog was never counted.
    trackEvent('upload_config', { page_path: '/search' });
    setConfigError('');
    try {
      const source = parseConfig(await readTextFile(file));
      annotationSelection.setSelected(source.filter((name) => store.byName[name]?.leaf));
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Invalid config file');
    }
  }

  function submit() {
    // No empty-selection guard: chr and pos are always selected (issue #4), so
    // a search can never be sent with no fields. "Clear Selection" leaves those
    // two and returns a plain list of variant positions.
    submitSearch(mode, values, annotationSelection.selected, [], dispatch);
    onSubmitted();
  }

  const warning = configError;

  return (
    <Box className="drawer-body">
      <Stack className="drawer-header query-drawer-title" direction="row" sx={{ alignItems: 'flex-end' }}>
        <Box>
          <Typography variant="caption" className="query-genome-build">AnnoQ is based on {GENOME_BUILD}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
            <Typography variant="subtitle2">Input Query:</Typography>
            <Typography variant="caption" className="muted">{queryModeLabel(mode)}</Typography>
          </Stack>
        </Box>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} aria-label="Close query form">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Stack className="query-type-row" direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle2">Query Type</Typography>
        <FormControl size="small" sx={{ minWidth: 230 }}>
          <InputLabel>Query Type</InputLabel>
          <Select
            label="Query Type"
            value={mode}
            onChange={(event) => changeMode(event.target.value as QueryMode)}
          >
            {QUERY_MODES.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Stack spacing={1.5} className="query-form-section">
        {mode === 'chromosome' && (
          <>
            <TextField size="small" label="Chromosome" value={values.chrom} onChange={(e) => updateValues({ chrom: e.target.value })} />
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="Start" value={values.start} onChange={(e) => updateValues({ start: e.target.value })} />
              <TextField size="small" label="End" value={values.end} onChange={(e) => updateValues({ end: e.target.value })} />
            </Stack>
          </>
        )}
        {mode === 'geneProduct' && (
          <TextField size="small" label="Gene Product" value={values.geneProduct} onChange={(e) => updateValues({ geneProduct: e.target.value })} />
        )}
        {mode === 'rsID' && (
          <TextField size="small" label="rsID" value={values.rsID} onChange={(e) => updateValues({ rsID: e.target.value })} />
        )}
        {mode === 'keyword' && ENABLE_KEYWORD_SEARCH && (
          <TextField size="small" label="Keyword" value={values.keyword} onChange={(e) => updateValues({ keyword: e.target.value })} />
        )}
        {mode === 'rsIDList' && (
          <>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => updateValues({ rsIDList: SAMPLE_RSID_LIST })}>Sample rsID List</Button>
              <Button size="small" component="label" startIcon={<FileUploadIcon />}>
                Populate
                <input hidden type="file" onChange={async (event) => {
                  const text = await readTextFile(event.target.files?.[0]);
                  updateValues({ rsIDList: text });
                }} />
              </Button>
              <Button size="small" onClick={() => updateValues({ rsIDList: '' })}>Clear</Button>
            </Stack>
            <TextField
              multiline
              minRows={6}
              maxRows={6}
              label="Enter IDs"
              value={values.rsIDList}
              onChange={(e) => updateValues({ rsIDList: e.target.value })}
              className="fixed-textarea"
            />
          </>
        )}
        {mode === 'vcf' && (
          <>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => updateValues({ vcf: SAMPLE_VCF })}>Sample VCF File</Button>
              <Button size="small" component="label" startIcon={<FileUploadIcon />}>
                Populate
                <input hidden type="file" onChange={async (event) => {
                  const text = await readTextFile(event.target.files?.[0]);
                  updateValues({ vcf: text });
                }} />
              </Button>
              <Button size="small" onClick={() => updateValues({ vcf: '' })}>Clear</Button>
            </Stack>
            <TextField
              multiline
              minRows={6}
              maxRows={6}
              label="Enter VCF rows"
              value={values.vcf}
              onChange={(e) => updateValues({ vcf: e.target.value })}
              className="fixed-textarea"
            />
          </>
        )}
      </Stack>

      <Divider />
      <Stack className="drawer-header" direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle2">Select Annotations</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => {
          trackEvent('clear_selection', { page_path: '/search' });
          annotationSelection.setSelected([]);
        }}>Clear Selection</Button>
      </Stack>
      <Box className="annotation-tree-wrap">
        <AnnotationTree
          store={store}
          selected={annotationSelection.selected}
          onSelectedChange={setSelectedAnnotations}
          onInfo={setActiveAnnotation}
          showRootNode
        />
      </Box>
      {warning && <Alert severity="warning" sx={{ m: 1 }}>{warning}</Alert>}
      <Stack className="drawer-footer" direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={() => fileRef.current?.click()}>Upload Config</Button>
        <input ref={fileRef} hidden type="file" onChange={(event) => void onConfigChange(event.target.files?.[0])} />
        <Button size="small" variant="outlined" startIcon={<SaveAltIcon />} onClick={() => {
          trackEvent('export_config', { page_path: '/search' });
          downloadText('config.txt', JSON.stringify({ _source: annotationSelection.selected }));
        }}>Export</Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="contained" onClick={submit}>Submit</Button>
      </Stack>
      <AnnotationDetailDialog annotation={activeAnnotation} onClose={() => setActiveAnnotation(undefined)} />
    </Box>
  );
}
