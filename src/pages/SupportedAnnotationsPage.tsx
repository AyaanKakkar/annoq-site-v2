import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography
} from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { AnnotationTree } from '../features/annotations/AnnotationTree';
import { useAnnotationSelection } from '../features/annotations/AnnotationSelectionProvider';
import { useAnnotations } from '../features/annotations/useAnnotations';
import { flattenTree } from '../lib/annotations';
import { trackEvent } from '../lib/analytics';
import { downloadText, parseConfig } from '../lib/files';

export function SupportedAnnotationsPage() {
  const annotations = useAnnotations();
  const { selected, setSelected } = useAnnotationSelection();
  const [error, setError] = useState('');
  const [tab, setTab] = useState('annotations');
  const input = useRef<HTMLInputElement>(null);
  const store = annotations.data;

  // Tree order, not `store.annotations` order: /annotations lists every category
  // node before any leaf, so the raw array put unrelated rows next to each other.
  // Walking the tree groups each row under its category and matches both the
  // Annotations tab beside it and annoq-site's /version page.
  const versionRows = useMemo(
    () => (store ? flattenTree(store.tree).filter((annotation) => annotation.version && annotation.name) : []),
    [store]
  );

  async function uploadConfig(file?: File) {
    // On file change, matching v1's (change) binding — a cancelled file dialog
    // was never counted.
    trackEvent('upload_config', { page_path: '/detail' });
    try {
      setError('');
      if (!file || !store) return;
      const source = parseConfig(await file.text()).filter((name) => store.byName[name]?.leaf);
      setSelected(source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid config file');
    }
  }

  return (
    <Container className="simple-page">
      <Typography variant="h3" gutterBottom>Supported Annotations</Typography>
      <Typography className="supported-intro" gutterBottom>
        Currently only human variants are supported.
      </Typography>
      {annotations.isLoading && <CircularProgress />}
      {annotations.error && <Alert severity="error">Unable to load annotation metadata.</Alert>}
      {error && <Alert severity="warning">{error}</Alert>}
      {store && (
        <Paper className="supported-shell">
          <Box className="supported-tabs-wrap">
            <Tabs value={tab} onChange={(_, value) => setTab(value)} className="supported-tabs">
              <Tab value="annotations" label="Annotations" />
              <Tab value="versions" label="Data Versions" />
            </Tabs>
          </Box>
          {tab === 'annotations' ? (
          <>
          <Stack direction="row" spacing={1} className="supported-actions">
            <Button variant="outlined" onClick={() => {
              trackEvent('clear_selection', { page_path: '/detail' });
              setSelected([]);
            }}>Clear Selection</Button>
            <Button variant="outlined" onClick={() => input.current?.click()}>Upload Config</Button>
            <input ref={input} hidden type="file" onChange={(event) => void uploadConfig(event.target.files?.[0])} />
            <Button variant="contained" onClick={() => {
              trackEvent('export_config', { page_path: '/detail' });
              downloadText('config.txt', JSON.stringify({ _source: selected }));
            }}>Export Config</Button>
          </Stack>
          <Box className="supported-tree">
            <AnnotationTree store={store} selected={selected} onSelectedChange={setSelected} showDescriptions />
          </Box>
          </>
          ) : (
            <Box className="supported-version-table">
              <Typography variant="subtitle2" sx={{ p: 1 }}>
                Built using <a href="https://sites.google.com/site/jpopgen/wgsa" target="_blank" rel="noreferrer">WGSA</a> version 095
              </Typography>
              <Table className="annoq-table">
                <TableHead>
                  <TableRow>
                    <TableCell>SNP Detail/Annotation Tool</TableCell>
                    <TableCell>Version</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versionRows.map((annotation) => (
                    <TableRow key={annotation.name}>
                      <TableCell>{annotation.label || annotation.name}</TableCell>
                      <TableCell>{annotation.version}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
}
