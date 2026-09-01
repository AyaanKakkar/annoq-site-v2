import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { createContext, useContext, useMemo, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import type { ViewAllHandler } from '../../lib/formatters';
import { useBusyWhile } from '../busy/busyState';

type DialogContentState = { title: string; render: () => ReactNode };

/**
 * The opener's identity never changes, so consuming it cannot re-render a cell.
 * The dialog's state lives here instead of in ResultsTable, and `children` is
 * passed straight through: when this component re-renders for its own state,
 * `children` is the same element object, so React bails out of the whole table
 * subtree. That is what turns opening the dialog from O(27,750 cells) into O(1)
 * — issue #12.
 */
const ViewAllContext = createContext<ViewAllHandler | null>(null);

export function ViewAllProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogContentState | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The transition is what makes the progress bar reachable: without it React
  // would commit a multi-second render in the same frame as the click and the
  // bar would never paint.
  useBusyWhile(pending, label ?? 'Working…');

  const openViewAll = useMemo<ViewAllHandler>(
    () => (title, render, count) => {
      setLabel(`Opening ${count.toLocaleString()} ${title}…`);
      startTransition(() => setDialog({ title, render }));
    },
    []
  );

  return (
    <ViewAllContext.Provider value={openViewAll}>
      {children}
      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog?.title}</DialogTitle>
        <DialogContent>{dialog?.render()}</DialogContent>
      </Dialog>
    </ViewAllContext.Provider>
  );
}

export function useViewAll(): ViewAllHandler {
  const openViewAll = useContext(ViewAllContext);
  if (!openViewAll) throw new Error('useViewAll must be used inside ViewAllProvider');
  return openViewAll;
}
