import { Box, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';
import { useLayoutEffect, useRef } from 'react';
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
  const ref = useBusyBarHeight(busy);
  if (!busy) return null;
  return (
    <Box ref={ref} className="busy-bar" role="status" aria-live="polite">
      <LinearProgress />
      <Stack direction="row" spacing={1} className="busy-bar-message">
        <CircularProgress size={16} thickness={5} />
        <Typography variant="caption">{label}</Typography>
      </Stack>
    </Box>
  );
}

/**
 * Publishes the bar's real height as --annoq-busy-h, and 0px while idle.
 *
 * The bar is fixed at the same `top` as the query drawer and paints above it
 * (z-index 1201 against the drawer's 1200), so it covered the drawer's heading
 * whenever a search ran. Consumers reserve this height rather than the drawer
 * being moved, which would relayout the results table on every busy toggle.
 */
function useBusyBarHeight(busy: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const clear = () => document.documentElement.style.setProperty('--annoq-busy-h', '0px');
    const element = ref.current;
    if (!busy || !element) {
      clear();
      return;
    }

    const publish = () => {
      document.documentElement.style.setProperty(
        '--annoq-busy-h',
        `${element.getBoundingClientRect().height}px`
      );
    };

    publish();
    if (typeof ResizeObserver === 'undefined') return clear;
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      clear();
    };
  }, [busy]);

  return ref;
}
