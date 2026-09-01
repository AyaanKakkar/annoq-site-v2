import { Box, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';
import { useBusyStatus } from './busyState';

/**
 * The one place the app says "I am working on something". Rendered as a sibling of
 * the AppBar and positioned over the content with `position: fixed`, never inserted
 * into the layout: inserting it would grow the measured AppBar height it positions
 * itself against, and would relayout every cell of the results table each time it
 * appeared.
 */
export function BusyBar() {
  const { busy, label } = useBusyStatus();
  if (!busy) return null;
  return (
    <Box className="busy-bar" role="status" aria-live="polite">
      <LinearProgress />
      <Stack direction="row" spacing={1} className="busy-bar-message">
        <CircularProgress size={16} thickness={5} />
        <Typography variant="caption">{label}</Typography>
      </Stack>
    </Box>
  );
}
