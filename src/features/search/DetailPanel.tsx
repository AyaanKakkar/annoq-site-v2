import { Box, Divider, Stack, Typography } from '@mui/material';
import { labelFor } from '../../lib/annotations';
import { formatCell } from '../../lib/formatters';
import { useAnnotations } from '../annotations/useAnnotations';
import { useSearchState } from './searchState';
import { useViewAll } from './ViewAllDialog';

export function DetailPanel() {
  const { state } = useSearchState();
  const store = useAnnotations().data;
  const openViewAll = useViewAll();
  const selectedRow = state.selectedRow;
  if (!selectedRow || !state.result || !store) return <Box className="empty-state">Select a row</Box>;
  return (
    <Stack className="panel" divider={<Divider />}>
      {state.result.columns.map((field) => (
        <Box key={field} sx={{ p: 1 }}>
          <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>{labelFor(field, store)}</Typography>
          <Box sx={{ mt: 0.5 }}>{formatCell(field, selectedRow[field], selectedRow, store, openViewAll).node}</Box>
        </Box>
      ))}
    </Stack>
  );
}
