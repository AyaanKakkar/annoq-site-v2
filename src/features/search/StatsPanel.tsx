import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Box, FormControl, InputLabel, MenuItem, Select, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import { labelFor } from '../../lib/annotations';
import { useAnnotations } from '../annotations/useAnnotations';
import { useBusyWhile } from '../busy/busyState';
import { useSearchState } from './searchState';

const BAR_COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#17becf', '#bcbd22', '#7f7f7f'];

export function StatsPanel({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useSearchState();
  const store = useAnnotations().data;
  const [tab, setTab] = useState('general');

  // Computed above the early return so the hook below always runs.
  const pendingField = state.statsField ?? state.result?.columns[0];
  const statsPending = Boolean(
    state.result && store && pendingField && (!state.stats || state.stats.field !== pendingField)
  );
  useBusyWhile(statsPending, 'Loading stats…');

  if (!state.result || !store) return <Box className="empty-state">No Results</Box>;
  const selectedField = state.statsField ?? state.result.columns[0];
  const fieldAgg = state.stats?.aggs[selectedField];
  const posAgg = state.stats?.aggs.pos;
  const existsData = fieldAgg
    ? [
        { name: 'Values Exist', value: fieldAgg.doc_count ?? 0 },
        { name: 'Values Missing', value: fieldAgg.missing?.doc_count ?? 0 }
      ]
    : [];
  const frequencyData = (fieldAgg?.frequency ?? [])
    .map((bucket) => ({ name: String(bucket.key), value: bucket.doc_count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 30);
  const histogramData = (posAgg?.histogram ?? []).map((bucket) => ({ name: String(bucket.key), value: bucket.doc_count }));

  return (
    <Stack className={compact ? 'panel compact-panel' : 'panel'} spacing={1.5}>
      <FormControl size="small" fullWidth>
        <InputLabel>Select Annotation</InputLabel>
        <Select
          label="Select Annotation"
          value={selectedField}
          onChange={(event) => dispatch({ type: 'setStatsField', field: event.target.value })}
        >
          {state.result.columns.map((field) => (
            <MenuItem key={field} value={field}>{labelFor(field, store)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label="General" value="general" />
        <Tab label="Other" value="position" />
      </Tabs>
      {!state.stats || state.stats.field !== selectedField ? (
        <Typography variant="body2" className="muted">Loading stats...</Typography>
      ) : tab === 'general' ? (
        <Stack spacing={2}>
          <Typography variant="subtitle2">{labelFor(selectedField, store)} availability</Typography>
          <ChartBox height={220}>
            <PieChart>
              <Pie data={existsData} dataKey="value" nameKey="name" outerRadius={80} label>
                <Cell fill="#2e7d32" />
                <Cell fill="#c62828" />
              </Pie>
              <ChartTooltip />
            </PieChart>
          </ChartBox>
          <Typography variant="subtitle2">Top values</Typography>
          <ChartBox height={360}>
            <BarChart data={frequencyData} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Bar dataKey="value">
                {frequencyData.map((entry, index) => (
                  <Cell key={entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartBox>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Typography variant="subtitle2">Position histogram</Typography>
          <ChartBox height={360}>
            <LineChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <ChartTooltip />
              <Line type="monotone" dataKey="value" stroke="#183153" dot={false} />
            </LineChart>
          </ChartBox>
        </Stack>
      )}
    </Stack>
  );
}

function ChartBox({ height, children }: { height: number; children: React.ReactElement }) {
  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </Box>
  );
}
