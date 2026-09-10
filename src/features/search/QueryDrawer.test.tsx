import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAnnotationStore } from '../../lib/annotations';
import type { Annotation } from '../../types';
import { AnnotationSelectionProvider, useAnnotationSelection } from '../annotations/AnnotationSelectionProvider';
import { QueryDrawer } from './QueryDrawer';
import { SearchProvider } from './searchState';

const store = buildAnnotationStore([
  { id: '1', name: 'Basic Info', leaf: false },
  { id: '2', parent_id: '1', name: 'chr', leaf: true },
  { id: '3', parent_id: '1', name: 'pos', leaf: true },
  { id: '6', parent_id: '1', name: 'rs_dbSNP151', label: 'rs ID', leaf: true }
] as Annotation[]);

// The annotation tree is virtualized, so drive the shared selection directly
// instead of clicking rows that jsdom never gives a measurable height.
function SelectionHelper() {
  const { setSelected } = useAnnotationSelection();
  return <button onClick={() => setSelected(['rs_dbSNP151'])}>select an annotation</button>;
}

function renderDrawer() {
  const onSubmitted = vi.fn();
  render(
    <SearchProvider>
      <AnnotationSelectionProvider>
        <SelectionHelper />
        <QueryDrawer store={store} onSubmitted={onSubmitted} onClose={() => undefined} />
      </AnnotationSelectionProvider>
    </SearchProvider>
  );
  return {
    onSubmitted,
    submit: () => fireEvent.click(screen.getByRole('button', { name: 'Submit' })),
    selectAnnotation: () => fireEvent.click(screen.getByRole('button', { name: 'select an annotation' }))
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

// The old "Select at least one annotation from the tree." guard is gone: chr and
// pos are always selected (issue #4), so the state it rejected is unreachable.
// What replaces it is that "Clear Selection" still leaves a submittable query.
describe('QueryDrawer submit', () => {
  it('submits a search when nothing beyond the locked fields is selected', () => {
    const { submit, onSubmitted } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    submit();
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/select at least one annotation/i)).not.toBeInTheDocument();
  });

  it('submits a search after an annotation is selected', () => {
    const { submit, selectAnnotation, onSubmitted } = renderDrawer();
    selectAnnotation();
    submit();
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });
});

// Export/Upload/Clear/Submit were tracked in v1 (issue #59) and must keep
// firing with the same names and params — v2 reports to the same GA property.
describe('QueryDrawer analytics', () => {
  const gtag = vi.fn();

  beforeEach(() => {
    gtag.mockClear();
    window.gtag = gtag;
    URL.createObjectURL = vi.fn(() => 'blob:stub');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('fires search_submit with the v1 label, not the mode value', () => {
    const { submit } = renderDrawer();
    submit();
    expect(gtag).toHaveBeenCalledWith('event', 'search_submit', { search_type: 'Chromosome' });
  });

  it('fires export_config for the search page', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(gtag).toHaveBeenCalledWith('event', 'export_config', { page_path: '/search' });
  });

  it('fires clear_selection for the search page', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(gtag).toHaveBeenCalledWith('event', 'clear_selection', { page_path: '/search' });
  });
});

// v1 issue #88 put this in the Input Query heading, right after "(Selected: …)".
describe('QueryDrawer genome build', () => {
  it('states the genome build the dataset is based on', () => {
    renderDrawer();
    expect(screen.getByText('AnnoQ is based on GRCh38/hg38')).toBeInTheDocument();
  });
});

describe('QueryDrawer header', () => {
  // "Chromosome" also renders inside the Query Type select, so assert on the
  // heading row itself rather than on the bare label text.
  it('names the active query type in the heading', () => {
    renderDrawer();
    const heading = screen.getByText('Input Query:');
    expect(heading.parentElement).toHaveTextContent('Input Query:Chromosome');
    expect(screen.queryByText(/^Selected:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Search:/)).not.toBeInTheDocument();
  });

  it('no longer carries the IMAGE Project provider note', () => {
    renderDrawer();
    expect(
      screen.queryByText(/Variants Annotation Query Provided by IMAGE Project/)
    ).not.toBeInTheDocument();
  });
});

// annoq-site#78. The checkbox is a cross-mode modifier, so it sits under the
// Query Type row rather than inside any one mode's fields -- except keyword,
// which api-v2 rejects the argument on.
describe('QueryDrawer HRC option', () => {
  it('offers the HRC subset checkbox, unchecked by default', () => {
    renderDrawer();
    const checkbox = screen.getByRole('checkbox', { name: 'Search HRC data' });
    expect(checkbox).not.toBeChecked();
  });

  it('hides the HRC hint until the box is checked', () => {
    renderDrawer();
    expect(screen.queryByText(/mapped in HRC r1\.1/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Search HRC data' }));
    expect(screen.getByText(/mapped in HRC r1\.1/)).toBeInTheDocument();
  });

  // In HRC mode api-v2 matches start/end against pos_hg19, so collecting them
  // under an unqualified label would be asking for the wrong coordinate space.
  it('relabels the chromosome position inputs as hg19 when checked', () => {
    renderDrawer();
    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('End')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Search HRC data' }));
    expect(screen.getByLabelText('Start (hg19)')).toBeInTheDocument();
    expect(screen.getByLabelText('End (hg19)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
  });
});

// api-v2 does not reinterpret coordinates for every mode. Per the site -> API
// mapping, chromosome / VCF / gene-product searches move to the hg19 fields
// (chr_hg19, pos_hg19, ...), whereas rsID and rsID-list searches keep matching
// rs_dbSNP.keyword and only gain the Mapped_in_HRC=Y filter. A single blanket
// "coordinates are hg19" line was wrong for two of the five modes.
describe('QueryDrawer HRC hint copy per query mode', () => {
  function chooseMode(label: string) {
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: label }));
  }

  function hintAfterEnablingHRC(modeLabel?: string) {
    renderDrawer();
    if (modeLabel) chooseMode(modeLabel);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Search HRC data' }));
    return document.querySelector('.query-hrc-hint')!.textContent ?? '';
  }

  it('always says results are restricted to the HRC r1.1 subset', () => {
    for (const label of [undefined, 'VCF File', 'Gene Product', 'rsID', 'rsID List']) {
      expect(hintAfterEnablingHRC(label), `mode ${label ?? 'Chromosome'}`).toMatch(/mapped in HRC r1\.1/);
      cleanup();
    }
  });

  it('tells chromosome searches to enter positions as hg19', () => {
    const hint = hintAfterEnablingHRC();
    expect(hint).toMatch(/Start and End/);
    expect(hint).toMatch(/hg19 \(GRCh37\)/);
  });

  it('tells VCF searches their rows are matched on hg19 fields', () => {
    const hint = hintAfterEnablingHRC('VCF File');
    expect(hint).toMatch(/hg19 \(GRCh37\)/);
    expect(hint).toMatch(/ref and alt/);
  });

  it('tells gene-product searches the region resolves in hg19', () => {
    const hint = hintAfterEnablingHRC('Gene Product');
    expect(hint).toMatch(/gene region/);
    expect(hint).toMatch(/hg19 \(GRCh37\)/);
  });

  // rsID searches match rs_dbSNP.keyword in both modes, so claiming the
  // coordinate basis changed would be plainly false.
  it.each(['rsID', 'rsID List'])('does not claim hg19 coordinates for %s searches', (label) => {
    const hint = hintAfterEnablingHRC(label);
    expect(hint).not.toMatch(/hg19/);
    expect(hint).toMatch(/rsIDs are matched as usual/);
  });
});
