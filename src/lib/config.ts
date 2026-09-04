import { environment } from './environment';

export const API_BASE = environment.annotationApiV2;
export const GRAPHQL_URL = `${API_BASE}/graphql`;
/**
 * Derived, not the literal `https://api-v2.annoq.org/docs` named in issue #20:
 * `API_BASE` is configurable (`VITE_ANNOQ_API_V2`, e.g. the TOPMed stack), and
 * a hardcoded link would document an API the user is not querying.
 */
export const API_DOCS_URL = `${API_BASE}/docs`;
export const PAGE_SIZE = environment.snpResultsSize;
/**
 * Annotations the user cannot deselect (issue #4). They identify the variant,
 * and `formatCell` builds the UCSC link on every `pos` cell out of the row's
 * `chr`, so losing either degrades the results table silently.
 *
 * Distinct from the *default* selection, which is every "Basic Info" field and
 * is merely the initial checkbox state — see `defaultSelectionForStore` in
 * `src/lib/annotations.ts`. Conflating the two is what made unticking `alt` do
 * nothing.
 *
 * Names, never ids: ids differ between the HRC and TOPMed datasets and are
 * renumbered by re-indexing (issues #7 and #9). `chr` and `pos` are stable on
 * both stacks.
 */
export const LOCKED_ANNOTATION_NAMES = ['chr', 'pos'];
/**
 * Issue #20. Result sets larger than this are not downloadable from the site --
 * the download endpoint has to materialise the whole set as one file. The
 * results header points those users at the API instead. Strictly over: a result
 * set of exactly this many rows still downloads.
 */
export const DOWNLOAD_ROW_LIMIT = 1_000_000;
export const ENABLE_KEYWORD_SEARCH = false;
export const TERMS_DISPLAYED_SIZE = environment.termsDisplayedSize;
export const GENES_DISPLAYED_SIZE = environment.genesDisplayedSize;
export const UCSC_URL = environment.ucscUrl;

/**
 * v1 issue #88. Hardcoded, as v1 was: v1 only ever served HRC.
 *
 * Known limitation, accepted deliberately — this is wrong when v2 is pointed
 * at the TOPMed stack (VITE_ANNOQ_API_V2=https://api-v2.topmed.annoq.org),
 * which is GRCh38/hg38. Isolated here so retargeting is a one-line change.
 * See docs/superpowers/specs/2026-09-01-annoq-site-parity-design.md.
 */
export const GENOME_BUILD = 'GRCh37/hg19';
