import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type BusyControls = {
  /** Registers an operation and returns its end function. Calling it twice is a no-op. */
  begin: (label: string) => () => void;
  /** Registers an operation for the lifetime of a promise, clearing it on resolve and on throw. */
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
};

export type BusyStatus = {
  busy: boolean;
  label: string | null;
};

/**
 * Split deliberately. Reporters consume only BusyControlsContext, whose value never
 * changes identity, so starting an operation cannot re-render them. Only BusyBar
 * consumes BusyStatusContext. Merging these would make every busy tick re-render the
 * results table — 27,750 cells at full annotation width — which is the freeze this
 * whole change exists to remove.
 */
const BusyControlsContext = createContext<BusyControls | null>(null);
const BusyStatusContext = createContext<BusyStatus>({ busy: false, label: null });

export function BusyProvider({ children }: { children: ReactNode }) {
  // Insertion order is the label priority: the most recently started operation wins.
  const [entries, setEntries] = useState<ReadonlyArray<[number, string]>>([]);
  const nextId = useRef(0);

  const controls = useMemo<BusyControls>(() => {
    const begin = (label: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setEntries((current) => [...current, [id, label] as [number, string]]);
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        setEntries((current) => current.filter(([entryId]) => entryId !== id));
      };
    };

    return {
      begin,
      run: async <T,>(label: string, fn: () => Promise<T>) => {
        const end = begin(label);
        try {
          return await fn();
        } finally {
          end();
        }
      }
    };
  }, []);

  const status = useMemo<BusyStatus>(
    () => ({ busy: entries.length > 0, label: entries.length > 0 ? entries[entries.length - 1][1] : null }),
    [entries]
  );

  return (
    <BusyControlsContext.Provider value={controls}>
      <BusyStatusContext.Provider value={status}>{children}</BusyStatusContext.Provider>
    </BusyControlsContext.Provider>
  );
}

export function useBusy(): BusyControls {
  const controls = useContext(BusyControlsContext);
  if (!controls) throw new Error('useBusy must be used inside BusyProvider');
  return controls;
}

export function useBusyStatus(): BusyStatus {
  return useContext(BusyStatusContext);
}

/** Mirrors an existing boolean (state.loading, isPending) into the registry. */
export function useBusyWhile(active: boolean, label: string): void {
  const { begin } = useBusy();
  // Held in a ref so a changing label cannot re-register the operation and
  // restart the bar mid-flight.
  const labelRef = useRef(label);
  labelRef.current = label;
  const start = useCallback(() => begin(labelRef.current), [begin]);

  useEffect(() => {
    if (!active) return;
    return start();
  }, [active, start]);
}
