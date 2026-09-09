# Issue #78 Consumer Propagation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `search_hrc` support from api-v2 to the Python and R client libraries, and record the api-v2 → consumer dependency in the platform docs, so the HRC subset filter is reachable from every consumer except SNPWay (which its own issue #9 covers).

**Architecture:** Both libraries have the same shape — a module-level `BASE_URL`, six api-v2 functions that build a `params` dict and send it as a query string (on GET, and on the POST download path too), one annotation-metadata function, and two SNPWay wrappers that do not touch api-v2. A single private helper per library applies the flag, so the six functions each gain one parameter and one line.

**Tech Stack:** Python 3.7+ (`requests`, pytest + `responses`), R 3.5+ (`httr`, `jsonlite`, testthat >= 3.2.0, roxygen2 7.3.3), Markdown.

## Global Constraints

- **NO GIT OPERATIONS AT ALL**, in any repo, including the two fresh clones. No branching, staging, committing, or pushing. Changes are left in each working tree for review with `git diff`. The clones sit on `main`; that is intentional — the user branches when they commit.
- **Intended branch name when the user does commit:** `annoq-site-78-add-hrc-mapping-info` in both `annoq-py` and `AnnoQR` (non-owning-repo convention, since annoq-site owns issue #78). Commit messages: `For #USCbiostats/annoq-site/issues/78`.
- **Do NOT clone or modify `Annoq_Overrepr_Workflow`.** Its HRC support is [issue #9](https://github.com/USCbiostats/Annoq_Overrepr_Workflow/issues/9). Only *references* to SNPWay in other repos' docs are updated.
- **Do NOT change either library's default base URL.** It stays `https://api-v2.annoq.org`. Making it *overridable* is in scope; changing the default is not.
- **Do NOT add `search_hrc` to the annotation-metadata functions** (`get_snp_attributes` / `snpAttributesQuery`) — `GET /snpAttributes` rejects it — **or to the SNPWay wrappers** (`get_snpway_gene_mappings`, `run_snpway_overrepresentation_workflow`, `snpwayGeneMappingsQuery`, `snpwayOverrepresentationWorkflowQuery`), which call `snpway.annoq.org`, not api-v2.
- The parameter is spelled **`search_hrc`** on the wire and sent as the **string `"true"`**.
- It is **omitted entirely when false** — never sent as `search_hrc=false`.
- **No test may make a live network call.** All HTTP is mocked. The one live call in this plan is a manual smoke check in Task 9.
- Repo roots: `annoq-py` → `/home/muruganu/projects/temp/top_med/annoq-py`; `AnnoQR` → `/home/muruganu/projects/temp/top_med/AnnoQR`; `annoq-site-v2` → `/home/muruganu/projects/temp/top_med/annoq-site-v2`; `annoq-proj` → `/home/muruganu/projects/temp/top_med/annoq-proj`.
- Both libraries send `params` as a **query string on both paths** — `requests.post(url, params=params)` and `httr::POST(url, query = params)` — so one assertion style works for the paginated and the download path alike.

---

### Task 1: Make annoq-py's base URL configurable, and add a test suite

Prerequisite, not a nicety: `BASE_URL` is hardcoded on `main`, so there is currently **no way to point the library at `api-v2-dev.topmed.annoq.org`** — the only instance carrying `search_hrc`. Without this the feature cannot be exercised at all. The override exists on the stale issue-19 branch and is being brought forward; the default is unchanged.

**Files:**
- Modify: `annoq-py/annoq/api.py:14-16`
- Modify: `annoq-py/pyproject.toml` (the `dev` optional-dependency group)
- Create: `annoq-py/tests/test_base_url.py`
- Create: `annoq-py/pytest.ini`

**Interfaces:**
- Consumes: nothing.
- Produces: `BASE_URL` resolved from `ANNOQ_BASE_URL`, default `https://api-v2.annoq.org`. A runnable `pytest` suite that Tasks 2 builds on.

- [ ] **Step 1: Write the failing test**

Create `annoq-py/tests/test_base_url.py`:

```python
"""The base URL must be overridable: only api-v2-dev.topmed.annoq.org carries
search_hrc, so a hardcoded default makes the HRC filter untestable."""

import importlib
import os

import annoq.api


def test_base_url_defaults_to_production(monkeypatch):
    monkeypatch.delenv("ANNOQ_BASE_URL", raising=False)
    reloaded = importlib.reload(annoq.api)
    assert reloaded.BASE_URL == "https://api-v2.annoq.org"


def test_base_url_honours_the_environment(monkeypatch):
    monkeypatch.setenv("ANNOQ_BASE_URL", "https://api-v2-dev.topmed.annoq.org")
    reloaded = importlib.reload(annoq.api)
    assert reloaded.BASE_URL == "https://api-v2-dev.topmed.annoq.org"
    # Leave the module as the rest of the suite expects to find it.
    monkeypatch.delenv("ANNOQ_BASE_URL", raising=False)
    importlib.reload(annoq.api)


def test_environment_override_is_not_the_snpway_url(monkeypatch):
    # Guard against wiring the AnnoQ override into the SNPWay default, which is
    # a separate service and a separate variable (ANNOQ_SNPWAY_BASE_URL).
    monkeypatch.setenv("ANNOQ_BASE_URL", "https://example.invalid")
    reloaded = importlib.reload(annoq.api)
    assert reloaded.DEFAULT_SNPWAY_BASE_URL == "http://snpway.annoq.org"
    monkeypatch.delenv("ANNOQ_BASE_URL", raising=False)
    importlib.reload(annoq.api)
```

Create `annoq-py/pytest.ini`:

```ini
[pytest]
testpaths = tests
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd /home/muruganu/projects/temp/top_med/annoq-py && python -m pytest -q`
Expected: FAIL — `test_base_url_honours_the_environment` asserts the dev URL but gets `https://api-v2.annoq.org`, because the constant ignores the environment. (If pytest itself is missing, install the dev extras from Step 3 first, then re-run to observe the failure.)

- [ ] **Step 3: Add the test dependencies**

In `annoq-py/pyproject.toml`, replace the `dev` extras line:

```toml
[project.optional-dependencies]
dev = ["ruff>=0.10.0", "pytest>=7.0.0", "responses>=0.23.0"]
```

Then: `cd /home/muruganu/projects/temp/top_med/annoq-py && python -m pip install -q -e ".[dev]"`

- [ ] **Step 4: Make the base URL configurable**

In `annoq-py/annoq/api.py`, replace lines 14-16 with:

```python
# Base URL for the Annoq API.
#
# Configurable via ANNOQ_BASE_URL so the library can be pointed at a non-production
# api-v2 instance -- notably api-v2-dev.topmed.annoq.org, the only instance carrying
# the search_hrc argument until the TOPMed cutover. The default is unchanged.
BASE_URL = os.environ.get("ANNOQ_BASE_URL", "https://api-v2.annoq.org")

# SNPWay is a separate service with its own override (ANNOQ_SNPWAY_BASE_URL);
# it is not api-v2 and does not take search_hrc.
DEFAULT_SNPWAY_BASE_URL = "http://snpway.annoq.org"
```

`os` is already imported at the top of the file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /home/muruganu/projects/temp/top_med/annoq-py && python -m pytest -q`
Expected: PASS, 3 tests.

- [ ] **Step 6: Checkpoint**

Run: `cd /home/muruganu/projects/temp/top_med/annoq-py && git diff --stat && git status --short`
Expected: `annoq/api.py` and `pyproject.toml` modified; `tests/` and `pytest.ini` untracked. Nothing staged, nothing committed.

**DO NOT COMMIT.**

---

### Task 2: Add `search_hrc` to annoq-py's six api-v2 functions

**Files:**
- Modify: `annoq-py/annoq/api.py` — `get_snps_by_chr`, `get_snps_by_rsid_list`, `get_snps_by_gene_product`, `count_snps_by_chr`, `count_snps_by_rsid_list`, `count_snps_by_gene_product`
- Create: `annoq-py/tests/test_search_hrc.py`

**Interfaces:**
- Consumes: the pytest suite and `responses` from Task 1.
- Produces: `search_hrc: bool = False` as the **last** keyword parameter of each of the six functions, and a private `_apply_search_hrc(params, search_hrc) -> None`.

- [ ] **Step 1: Write the failing tests**

Create `annoq-py/tests/test_search_hrc.py`:

```python
"""annoq-site#78. api-v2 accepts search_hrc on the nine SNP search/count/download
endpoints and rejects it on /snpAttributes. It is omitted when false rather than
sent as "false", so existing calls stay byte-identical on the wire."""

import pytest
import responses

from annoq import api

BASE = "https://api-v2.annoq.org"

# (callable, kwargs, method, search url, download url)
SEARCHES = [
    (api.get_snps_by_chr, {"chromosome_identifier": "18", "start_position": 1, "end_position": 100},
     f"{BASE}/snp/chr", f"{BASE}/snp/chr/download"),
    (api.get_snps_by_rsid_list, {"rsid_list": ["rs1", "rs2"]},
     f"{BASE}/snp/rsidList", f"{BASE}/snp/rsidList/download"),
    (api.get_snps_by_gene_product, {"gene": "ZMYND11"},
     f"{BASE}/snp/gene_product", f"{BASE}/snp/gene_product/download"),
]

COUNTS = [
    (api.count_snps_by_chr, {"chromosome_identifier": "18", "start_position": 1, "end_position": 100},
     f"{BASE}/count/chr"),
    (api.count_snps_by_rsid_list, {"rsid_list": ["rs1", "rs2"]}, f"{BASE}/count/rsidList"),
    (api.count_snps_by_gene_product, {"gene": "ZMYND11"}, f"{BASE}/count/gene_product"),
]


@pytest.mark.parametrize("fn,kwargs,url,_download", SEARCHES)
@responses.activate
def test_search_sends_search_hrc_when_set(fn, kwargs, url, _download):
    responses.add(responses.GET, url, json={"details": []}, status=200)
    fn(search_hrc=True, **kwargs)
    assert responses.calls[0].request.params["search_hrc"] == "true"


@pytest.mark.parametrize("fn,kwargs,url,_download", SEARCHES)
@responses.activate
def test_search_omits_search_hrc_by_default(fn, kwargs, url, _download):
    responses.add(responses.GET, url, json={"details": []}, status=200)
    fn(**kwargs)
    assert "search_hrc" not in responses.calls[0].request.params


# The fetch_all path switches to POST /<mode>/download. Both paths build from the
# same params dict, but a filter that silently stops applying to large result sets
# is exactly the bug worth a test.
@pytest.mark.parametrize("fn,kwargs,_url,download", SEARCHES)
@responses.activate
def test_download_path_carries_search_hrc(fn, kwargs, _url, download):
    responses.add(responses.POST, download, body="", status=200)
    fn(fetch_all=True, search_hrc=True, **kwargs)
    assert responses.calls[0].request.params["search_hrc"] == "true"


@pytest.mark.parametrize("fn,kwargs,_url,download", SEARCHES)
@responses.activate
def test_download_path_omits_search_hrc_by_default(fn, kwargs, _url, download):
    responses.add(responses.POST, download, body="", status=200)
    fn(fetch_all=True, **kwargs)
    assert "search_hrc" not in responses.calls[0].request.params


@pytest.mark.parametrize("fn,kwargs,url", COUNTS)
@responses.activate
def test_count_sends_search_hrc_when_set(fn, kwargs, url):
    responses.add(responses.GET, url, json={"details": 0}, status=200)
    fn(search_hrc=True, **kwargs)
    assert responses.calls[0].request.params["search_hrc"] == "true"


@pytest.mark.parametrize("fn,kwargs,url", COUNTS)
@responses.activate
def test_count_omits_search_hrc_by_default(fn, kwargs, url):
    responses.add(responses.GET, url, json={"details": 0}, status=200)
    fn(**kwargs)
    assert "search_hrc" not in responses.calls[0].request.params


# /snpAttributes does not accept the parameter -- the annotation tree is a property
# of the index, not of a result set.
def test_attributes_function_does_not_accept_search_hrc():
    with pytest.raises(TypeError):
        api.get_snp_attributes(search_hrc=True)


# The SNPWay wrappers call snpway.annoq.org, not api-v2. HRC support there is
# Annoq_Overrepr_Workflow#9, not this change.
@pytest.mark.parametrize("name", ["get_snpway_gene_mappings", "run_snpway_overrepresentation_workflow"])
def test_snpway_wrappers_do_not_accept_search_hrc(name):
    import inspect
    assert "search_hrc" not in inspect.signature(getattr(api, name)).parameters
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd /home/muruganu/projects/temp/top_med/annoq-py && python -m pytest tests/test_search_hrc.py -q`
Expected: FAIL — `TypeError: ... got an unexpected keyword argument 'search_hrc'` on the twelve "when set" cases. The "omits by default" and the two exclusion tests should already PASS, which is the point: they pin behaviour that must not change.

- [ ] **Step 3: Add the helper**

In `annoq-py/annoq/api.py`, insert immediately after `_process_fields_param` and before `_download_all_snps`:

```python
def _apply_search_hrc(params: Dict[str, str], search_hrc: bool) -> None:
    """
    Add api-v2's search_hrc flag to a request when it is set (annoq-site#78).

    Omitted rather than sent as "false": api-v2 already defaults it off, so
    omitting keeps every existing call byte-identical on the wire.

    When set, results are restricted to variants mapped to the HRC r1.1 panel
    (Mapped_in_HRC=Y) and the coordinate basis becomes hg19 -- chromosome
    positions are matched against pos_hg19 and gene regions resolve to hg19.
    The response shape is unchanged, so request the hg19 columns explicitly via
    `fields` (Mapped_in_HRC, HRC_chr_pos, HRC_chr_pos_ref_alt, chr_hg19,
    pos_hg19, ref_hg19, alt_hg19) to see them.
    """
    if search_hrc:
        params["search_hrc"] = "true"
```

- [ ] **Step 4: Thread it through the six functions**

For **each** of `get_snps_by_chr`, `get_snps_by_rsid_list`, `get_snps_by_gene_product`:

(a) Add as the **last** parameter in the signature, after `fetch_all: bool = False,`:

```python
    search_hrc: bool = False,
```

(b) Add to the docstring `Args:` block, after the `fetch_all:` line:

```
        search_hrc: Restrict results to variants mapped to the HRC r1.1 panel, in hg19 coordinates (default: False)
```

(c) Add this line **after** the `filter_fields` block and **before** the `if fetch_all:` branch, so both the paginated and the download path pick it up:

```python
    _apply_search_hrc(params, search_hrc)
```

For **each** of `count_snps_by_chr`, `count_snps_by_rsid_list`, `count_snps_by_gene_product`:

(a) Add as the **last** parameter in the signature, after `filter_fields: Optional[List[str]] = None,`:

```python
    search_hrc: bool = False,
```

(b) Add to the docstring `Args:` block, after the `filter_fields:` line:

```
        search_hrc: Restrict the count to variants mapped to the HRC r1.1 panel, in hg19 coordinates (default: False)
```

(c) Add this line after the `filter_fields` block and before `response = requests.get(url, params=params)`:

```python
    _apply_search_hrc(params, search_hrc)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /home/muruganu/projects/temp/top_med/annoq-py && python -m pytest -q`
Expected: PASS, all tests across both files.

- [ ] **Step 6: Verify the exclusions really are excluded**

```bash
cd /home/muruganu/projects/temp/top_med/annoq-py
grep -n "search_hrc" annoq/api.py | grep -c "" 
awk '/^def get_snp_attributes/,/^def /' annoq/api.py | grep -c search_hrc
awk '/^def get_snpway_gene_mappings/,/^def run_snpway/' annoq/api.py | grep -c search_hrc
```

Expected: the first prints a non-zero count; the second and third both print `0`.

- [ ] **Step 7: Lint**

Run: `cd /home/muruganu/projects/temp/top_med/annoq-py && python -m ruff check annoq/ tests/`
Expected: no errors (ruff is already the repo's configured dev linter).

- [ ] **Step 8: Checkpoint**

Run: `cd /home/muruganu/projects/temp/top_med/annoq-py && git diff --stat`
Expected: only `annoq/api.py` and `pyproject.toml` modified.

**DO NOT COMMIT.**

---

### Task 3: Update annoq-py's README

**Files:**
- Modify: `annoq-py/README.md`

**Interfaces:** Consumes Task 2's parameter. Produces nothing.

- [ ] **Step 1: Update the field examples to the TOPMed RSID field**

```bash
cd /home/muruganu/projects/temp/top_med/annoq-py
sed -i 's|rs_dbSNP151|rs_dbSNP|g' README.md
grep -c rs_dbSNP151 README.md
```

Expected: the grep prints `0`. TOPMed's RSID annotation is `rs_dbSNP`; `rs_dbSNP151` was the HRC-era name and returns nothing against the TOPMed index.

- [ ] **Step 2: Document the parameter**

Add a section to `annoq-py/README.md`, immediately before whatever section documents the SNPWay workflow functions (or at the end of the query documentation if there is none):

~~~markdown
## Restricting a search to the HRC subset

The three search functions and the three count functions accept an optional `search_hrc`
argument. When `True`, results are restricted to variants mapped to the Haplotype Reference
Consortium r1.1 panel (`Mapped_in_HRC=Y`), and **the coordinate basis becomes hg19** — chromosome
`start_position`/`end_position` are matched against `pos_hg19`, and gene regions resolve to hg19.

```python
snps = annoq.get_snps_by_chr(
    chromosome_identifier="18",
    start_position=10000,
    end_position=20000,
    search_hrc=True,
    fields=["chr", "pos", "Mapped_in_HRC", "chr_hg19", "pos_hg19"],
)
```

The response shape does not change — the flag only changes which variants match. To *see* the hg19
values, request them explicitly in `fields`: `Mapped_in_HRC`, `HRC_chr_pos`, `HRC_chr_pos_ref_alt`,
`chr_hg19`, `pos_hg19`, `ref_hg19`, `alt_hg19`.

Not accepted by `get_snp_attributes()` (the annotation tree is a property of the index, not of a
result set), nor by the SNPWay workflow functions, which call the SNPWay service rather than
api-v2 — HRC support there is tracked in
[Annoq_Overrepr_Workflow#9](https://github.com/USCbiostats/Annoq_Overrepr_Workflow/issues/9).

### Pointing the client at another api-v2 instance

The base URL defaults to `https://api-v2.annoq.org` and can be overridden with the
`ANNOQ_BASE_URL` environment variable. Until the TOPMed cutover, `search_hrc` is only available on
the development instance:

```bash
export ANNOQ_BASE_URL=https://api-v2-dev.topmed.annoq.org
```
~~~

- [ ] **Step 3: Checkpoint**

Run: `cd /home/muruganu/projects/temp/top_med/annoq-py && grep -n "search_hrc\|ANNOQ_BASE_URL" README.md | head`
Expected: the new section's lines appear.

**DO NOT COMMIT.**

---

### Task 4: Make AnnoQR's base URL configurable, and add a test suite

Same prerequisite as Task 1, plus AnnoQR additionally needs the `annoq_api_url()` getter/setter that exists on the stale issue-19 branch — R users cannot set an environment variable mid-session as easily as exporting a shell variable, and the package reads `BASE_URL` once at load.

**Files:**
- Modify: `AnnoQR/R/annoqr.R:14-16`
- Modify: `AnnoQR/DESCRIPTION` (add `Suggests`: testthat only — not httptest2, which targets httr2)
- Modify: `AnnoQR/NAMESPACE`
- Create: `AnnoQR/tests/testthat.R`
- Create: `AnnoQR/tests/testthat/test-base-url.R`

**Interfaces:**
- Consumes: nothing.
- Produces: `BASE_URL` resolved from `ANNOQR_BASE_URL` (default `https://api-v2.annoq.org`), and an exported `annoq_api_url(url = NULL)` getter/setter. A runnable testthat suite Task 5 builds on.

- [ ] **Step 1: Write the failing test**

Create `AnnoQR/tests/testthat.R`:

```r
library(testthat)
library(AnnoQR)

test_check("AnnoQR")
```

Create `AnnoQR/tests/testthat/test-base-url.R`:

```r
# The base URL must be overridable: only api-v2-dev.topmed.annoq.org carries
# search_hrc, so a hardcoded default makes the HRC filter untestable.

test_that("the base URL defaults to production", {
  expect_equal(annoq_api_url(), "https://api-v2.annoq.org")
})

test_that("annoq_api_url sets the URL for the session", {
  original <- annoq_api_url()
  on.exit(annoq_api_url(original), add = TRUE)

  annoq_api_url("https://api-v2-dev.topmed.annoq.org")
  expect_equal(annoq_api_url(), "https://api-v2-dev.topmed.annoq.org")
})

test_that("setting the AnnoQ URL does not disturb the SNPWay default", {
  original <- annoq_api_url()
  on.exit(annoq_api_url(original), add = TRUE)

  annoq_api_url("https://example.invalid")
  expect_equal(AnnoQR:::SNPWAY_BASE_URL_DEFAULT, "http://snpway.annoq.org")
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && Rscript -e 'devtools::test()'`
Expected: FAIL — `could not find function "annoq_api_url"`.

If `devtools`/`testthat` are not installed, install them first:
`Rscript -e 'install.packages(c("devtools","testthat"), repos="https://cloud.r-project.org")'`

`testthat >= 3.2.0` is required: the tests mock `httr::GET`/`httr::POST` with
`with_mocked_bindings(.package = "httr")`, which older versions do not support. Note the HTTP
mocking package `httptest2` is **not** used — it targets `httr2`, whereas AnnoQR imports `httr`.
If R itself is unavailable in this environment, STOP and report — Tasks 4-6 cannot be verified here and should be handed to the user rather than written blind.

- [ ] **Step 3: Declare the test dependencies**

In `AnnoQR/DESCRIPTION`, add after the `Imports:` block:

```
Suggests:
    testthat (>= 3.2.0)
Config/testthat/edition: 3
```

- [ ] **Step 4: Make the base URL configurable and add the accessor**

In `AnnoQR/R/annoqr.R`, replace lines 14-16 with:

```r
# Base URL for the Annoq API (configurable via the ANNOQR_BASE_URL env var).
#
# Overridable so the package can be pointed at a non-production api-v2 instance --
# notably api-v2-dev.topmed.annoq.org, the only instance carrying the search_hrc
# argument until the TOPMed cutover. The default is unchanged.
BASE_URL <- Sys.getenv("ANNOQR_BASE_URL", "https://api-v2.annoq.org")

# SNPWay is a separate service, not api-v2, and does not take search_hrc.
SNPWAY_BASE_URL_DEFAULT <- "http://snpway.annoq.org"


#' Get or set the AnnoQ API base URL
#'
#' @param url Optional new base URL string. If \code{NULL} (the default),
#'   returns the current URL. If provided, sets the URL for the current session.
#' @return The current (or newly set) base URL, invisibly when setting.
#' @details
#' The base URL is resolved in this order:
#' \enumerate{
#'   \item Value set via \code{annoq_api_url(url)} in the current session
#'   \item The \code{ANNOQR_BASE_URL} environment variable
#'   \item The default: \code{"https://api-v2.annoq.org"}
#' }
#'
#' To set the environment variable persistently, add a line to your
#' \code{.Renviron} file (e.g. via \code{usethis::edit_r_environ()}):
#' \preformatted{ANNOQR_BASE_URL=https://api-v2-dev.topmed.annoq.org}
#'
#' @examples
#' # Check current URL
#' annoq_api_url()
#'
#' # Temporarily point at the TOPMed development instance, the only one
#' # currently serving the search_hrc option
#' annoq_api_url("https://api-v2-dev.topmed.annoq.org")
#'
#' # Reset to environment/default
#' annoq_api_url(Sys.getenv("ANNOQR_BASE_URL", "https://api-v2.annoq.org"))
#'
#' @export
annoq_api_url <- function(url = NULL) {
  if (!is.null(url)) {
    assignInMyNamespace("BASE_URL", url)
    return(invisible(url))
  }
  BASE_URL
}
```

- [ ] **Step 5: Regenerate the documentation and namespace**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && Rscript -e 'roxygen2::roxygenise()'`
Expected: `man/annoq_api_url.Rd` is written and `NAMESPACE` gains `export(annoq_api_url)`.

Verify: `grep -n "annoq_api_url" NAMESPACE && ls man/annoq_api_url.Rd`
Expected: both present.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && Rscript -e 'devtools::test()'`
Expected: PASS, 3 tests.

- [ ] **Step 7: Checkpoint**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && git diff --stat && git status --short`
Expected: `R/annoqr.R`, `DESCRIPTION`, `NAMESPACE` modified; `tests/` and `man/annoq_api_url.Rd` untracked. Nothing staged or committed.

**DO NOT COMMIT.**

---

### Task 5: Add `search_hrc` to AnnoQR's six api-v2 functions

**Files:**
- Modify: `AnnoQR/R/annoqr.R` — `regionQuery`, `rsidsQuery`, `geneQuery`, `countRegionQuery`, `countRsidsQuery`, `countGeneQuery`
- Create: `AnnoQR/tests/testthat/test-search-hrc.R`

**Interfaces:**
- Consumes: the testthat suite from Task 4.
- Produces: `search_hrc = FALSE` as the **last** argument of each of the six functions, and a private `.apply_search_hrc(params, search_hrc)` that **returns** the modified list (R has no reference semantics for lists — unlike the Python helper, which mutates in place).

- [ ] **Step 1: Write the failing tests**

Create `AnnoQR/tests/testthat/test-search-hrc.R`:

```r
# annoq-site#78. api-v2 accepts search_hrc on the nine SNP search/count/download
# endpoints and rejects it on /snpAttributes. It is omitted when FALSE rather
# than sent as "false", so existing calls stay byte-identical on the wire.

# Capture the query list httr would send, without any network access.
capture_query <- function(expr) {
  captured <- NULL
  mock_get <- function(url, query = NULL, ...) {
    captured <<- query
    structure(list(status_code = 200L), class = "response")
  }
  mock_post <- mock_get

  testthat::with_mocked_bindings(
    GET = mock_get,
    POST = mock_post,
    .package = "httr",
    try(force(expr), silent = TRUE)
  )
  captured
}

searches <- list(
  list(fn = function(...) regionQuery("18", 1, 100, ...)),
  list(fn = function(...) rsidsQuery(c("rs1", "rs2"), ...)),
  list(fn = function(...) geneQuery("ZMYND11", ...))
)

counts <- list(
  list(fn = function(...) countRegionQuery("18", 1, 100, ...)),
  list(fn = function(...) countRsidsQuery(c("rs1", "rs2"), ...)),
  list(fn = function(...) countGeneQuery("ZMYND11", ...))
)

test_that("searches send search_hrc when set", {
  for (case in searches) {
    query <- capture_query(case$fn(search_hrc = TRUE))
    expect_equal(query[["search_hrc"]], "true")
  }
})

test_that("searches omit search_hrc by default", {
  for (case in searches) {
    query <- capture_query(case$fn())
    expect_null(query[["search_hrc"]])
  }
})

# The fetch_all path switches to POST /<mode>/download. Both paths build from the
# same params list, but a filter that silently stops applying to large result sets
# is exactly the bug worth a test.
test_that("the download path carries search_hrc", {
  for (case in searches) {
    query <- capture_query(case$fn(fetch_all = TRUE, search_hrc = TRUE))
    expect_equal(query[["search_hrc"]], "true")
  }
})

test_that("the download path omits search_hrc by default", {
  for (case in searches) {
    query <- capture_query(case$fn(fetch_all = TRUE))
    expect_null(query[["search_hrc"]])
  }
})

test_that("counts send search_hrc when set", {
  for (case in counts) {
    query <- capture_query(case$fn(search_hrc = TRUE))
    expect_equal(query[["search_hrc"]], "true")
  }
})

test_that("counts omit search_hrc by default", {
  for (case in counts) {
    query <- capture_query(case$fn())
    expect_null(query[["search_hrc"]])
  }
})

# /snpAttributes does not accept the parameter, and the SNPWay wrappers call
# snpway.annoq.org rather than api-v2 -- HRC support there is
# Annoq_Overrepr_Workflow#9, not this change.
test_that("excluded functions do not gain the argument", {
  excluded <- c(
    "snpAttributesQuery",
    "snpwayGeneMappingsQuery",
    "snpwayOverrepresentationWorkflowQuery"
  )
  for (name in excluded) {
    expect_false("search_hrc" %in% names(formals(get(name, asNamespace("AnnoQR")))))
  }
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && Rscript -e 'devtools::test()'`
Expected: FAIL — the "when set" expectations get `NULL`, because `search_hrc = TRUE` is swallowed by `...` and never reaches the query. The "omit by default" and "excluded functions" tests should already PASS.

- [ ] **Step 3: Add the helper**

In `AnnoQR/R/annoqr.R`, insert immediately after `.process_fields_param` and before `.download_all_snps`:

```r
# Add api-v2's search_hrc flag to a request when it is set (annoq-site#78).
#
# Omitted rather than sent as "false": api-v2 already defaults it off, so
# omitting keeps every existing call byte-identical on the wire.
#
# When set, results are restricted to variants mapped to the HRC r1.1 panel
# (Mapped_in_HRC=Y) and the coordinate basis becomes hg19 -- chromosome
# positions are matched against pos_hg19 and gene regions resolve to hg19. The
# response shape is unchanged, so request the hg19 columns explicitly via
# `fields` to see them.
#
# Returns the modified list: R lists are copied, not mutated in place.
.apply_search_hrc <- function(params, search_hrc) {
  if (isTRUE(search_hrc)) {
    params[["search_hrc"]] <- "true"
  }
  params
}
```

- [ ] **Step 4: Thread it through the six functions**

For **each** of `regionQuery`, `rsidsQuery`, `geneQuery`:

(a) Add as the **last** argument in the signature, after `fetch_all = FALSE`:

```r
                        search_hrc = FALSE) {
```

(Match each function's own indentation — the arguments are aligned to the opening parenthesis, so the leading whitespace differs per function.)

(b) Add this line **after** the `filter_fields` block and **before** the `if (fetch_all) {` branch:

```r
  params <- .apply_search_hrc(params, search_hrc)
```

For **each** of `countRegionQuery`, `countRsidsQuery`, `countGeneQuery`:

(a) Add `search_hrc = FALSE` as the last argument after `filter_fields = NULL`.

(b) Add the same line after the `filter_fields` block and before the `httr::GET(...)` call:

```r
  params <- .apply_search_hrc(params, search_hrc)
```

(c) For each of the six, add a roxygen `@param` line to its documentation block:

```r
#' @param search_hrc Restrict results to variants mapped to the HRC r1.1 panel,
#'   in hg19 coordinates. Defaults to \code{FALSE}.
```

- [ ] **Step 5: Regenerate the man pages**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && Rscript -e 'roxygen2::roxygenise()'`
Expected: the six affected `man/*.Rd` files are rewritten with the new argument. They are **build artifacts** — never hand-edit them.

Verify: `grep -l "search_hrc" man/*.Rd | wc -l`
Expected: `6`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && Rscript -e 'devtools::test()'`
Expected: PASS, all tests across both files.

- [ ] **Step 7: Check the package still builds cleanly**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && Rscript -e 'devtools::check(document = FALSE, args = c("--no-manual","--no-build-vignettes"))' 2>&1 | tail -20`
Expected: 0 errors. Warnings and notes that predate this change are acceptable — compare against what `main` produces if any look suspicious.

- [ ] **Step 8: Checkpoint**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && git diff --stat`
Expected: `R/annoqr.R`, `DESCRIPTION`, `NAMESPACE` and six `man/*.Rd` files modified.

**DO NOT COMMIT.**

---

### Task 6: Update AnnoQR's README

**Files:**
- Modify: `AnnoQR/README.md`

**Interfaces:** Consumes Task 5's argument. Produces nothing.

- [ ] **Step 1: Update the field examples**

```bash
cd /home/muruganu/projects/temp/top_med/AnnoQR
sed -i 's|rs_dbSNP151|rs_dbSNP|g' README.md
grep -c rs_dbSNP151 README.md
```

Expected: the grep prints `0`.

- [ ] **Step 2: Document the argument**

Add to `AnnoQR/README.md`, immediately before the SNPWay workflow section (or at the end of the query documentation if there is none):

~~~markdown
## Restricting a search to the HRC subset

`regionQuery()`, `rsidsQuery()`, `geneQuery()` and the three `count*Query()` functions accept an
optional `search_hrc` argument. When `TRUE`, results are restricted to variants mapped to the
Haplotype Reference Consortium r1.1 panel (`Mapped_in_HRC=Y`), and **the coordinate basis becomes
hg19** — `start_position`/`end_position` are matched against `pos_hg19`, and gene regions resolve
to hg19.

```r
snps <- regionQuery(
  chromosome_identifier = "18",
  start_position = 10000,
  end_position = 20000,
  search_hrc = TRUE,
  fields = c("chr", "pos", "Mapped_in_HRC", "chr_hg19", "pos_hg19")
)
```

The response shape does not change — the flag only changes which variants match. To *see* the hg19
values, request them explicitly in `fields`: `Mapped_in_HRC`, `HRC_chr_pos`, `HRC_chr_pos_ref_alt`,
`chr_hg19`, `pos_hg19`, `ref_hg19`, `alt_hg19`.

Not accepted by `snpAttributesQuery()` (the annotation tree is a property of the index, not of a
result set), nor by the SNPWay workflow functions, which call the SNPWay service rather than
api-v2 — HRC support there is tracked in
[Annoq_Overrepr_Workflow#9](https://github.com/USCbiostats/Annoq_Overrepr_Workflow/issues/9).

### Pointing the package at another api-v2 instance

The base URL defaults to `https://api-v2.annoq.org`. Override it with the `ANNOQR_BASE_URL`
environment variable, or for the current session with `annoq_api_url()`. Until the TOPMed cutover,
`search_hrc` is only available on the development instance:

```r
annoq_api_url("https://api-v2-dev.topmed.annoq.org")
```
~~~

- [ ] **Step 3: Checkpoint**

Run: `cd /home/muruganu/projects/temp/top_med/AnnoQR && grep -n "search_hrc\|ANNOQR_BASE_URL" README.md | head`
Expected: the new section's lines appear.

**DO NOT COMMIT.**

---

### Task 7: Document `search_hrc` in the annoq-site-v2 library tutorials

The companion plan's Task 6 adds an HRC section to `services/api.md`. These two tutorial pages describe the libraries and need the same treatment.

**Files:**
- Modify: `annoq-site-v2/public/assets/docs/docs/tutorials/annoq-py.md`
- Modify: `annoq-site-v2/public/assets/docs/docs/tutorials/r-package.md`

**Interfaces:** Consumes Tasks 2 and 5. Produces nothing.

- [ ] **Step 1: Confirm the companion plan's Task 6 has already run**

```bash
cd /home/muruganu/projects/temp/top_med/annoq-site-v2
grep -c "rs_dbSNP151" public/assets/docs/docs/tutorials/annoq-py.md public/assets/docs/docs/tutorials/r-package.md
```

Expected: `0` for both. If either is non-zero, the companion plan's Task 6 has not run — run it first, or these two files will end up half-migrated.

- [ ] **Step 2: Add the section to the Python tutorial**

Append to `public/assets/docs/docs/tutorials/annoq-py.md`, immediately before its `## Contributing` section:

~~~markdown
## Restricting a search to the HRC subset

`get_snps_by_chr`, `get_snps_by_rsid_list`, `get_snps_by_gene_product` and the three
`count_snps_by_*` functions accept an optional `search_hrc` argument. When `True`, results are
restricted to variants mapped to the Haplotype Reference Consortium r1.1 panel
(`Mapped_in_HRC=Y`), and the coordinate basis becomes **hg19**: `start_position`/`end_position` are
matched against `pos_hg19`, and gene regions resolve to hg19.

```python
snps = annoq.get_snps_by_chr(
    chromosome_identifier="18",
    start_position=10000,
    end_position=20000,
    search_hrc=True,
    fields=["chr", "pos", "Mapped_in_HRC", "chr_hg19", "pos_hg19"]
)
```

The response shape is unchanged, so request the hg19 columns explicitly to see them:
`Mapped_in_HRC`, `HRC_chr_pos`, `HRC_chr_pos_ref_alt`, `chr_hg19`, `pos_hg19`, `ref_hg19`,
`alt_hg19`. They live under the **HG19 Info** category in the annotation tree.

`get_snp_attributes()` does not accept it, and neither do the SNPWay workflow functions — those
call the SNPWay service rather than the AnnoQ API. HRC support in SNPWay is tracked separately.

The base URL can be pointed at another api-v2 instance with the `ANNOQ_BASE_URL` environment
variable.
~~~

- [ ] **Step 3: Add the section to the R tutorial**

Append to `public/assets/docs/docs/tutorials/r-package.md`, immediately before its `## Contributing` section:

~~~markdown
## Restricting a search to the HRC subset

`regionQuery()`, `rsidsQuery()`, `geneQuery()` and the three `count*Query()` functions accept an
optional `search_hrc` argument. When `TRUE`, results are restricted to variants mapped to the
Haplotype Reference Consortium r1.1 panel (`Mapped_in_HRC=Y`), and the coordinate basis becomes
**hg19**: `start_position`/`end_position` are matched against `pos_hg19`, and gene regions resolve
to hg19.

```r
snps <- regionQuery(
  chromosome_identifier = "18",
  start_position = 10000,
  end_position = 20000,
  search_hrc = TRUE,
  fields = c("chr", "pos", "Mapped_in_HRC", "chr_hg19", "pos_hg19")
)
```

The response shape is unchanged, so request the hg19 columns explicitly to see them:
`Mapped_in_HRC`, `HRC_chr_pos`, `HRC_chr_pos_ref_alt`, `chr_hg19`, `pos_hg19`, `ref_hg19`,
`alt_hg19`. They live under the **HG19 Info** category in the annotation tree.

`snpAttributesQuery()` does not accept it, and neither do the SNPWay workflow functions — those
call the SNPWay service rather than the AnnoQ API. HRC support in SNPWay is tracked separately.

The base URL can be pointed at another api-v2 instance with `annoq_api_url()` or the
`ANNOQR_BASE_URL` environment variable.
~~~

- [ ] **Step 4: Checkpoint**

Run: `npm run test`
Expected: PASS — `DocsPage.test.tsx` renders these files, so malformed markdown surfaces here.

**DO NOT COMMIT.**

---

### Task 8: Record the api-v2 → consumer dependency in annoq-proj

This is the task that stops the omission recurring. annoq-proj already *lists* the consumers; what it lacks is any instruction that an api-v2 contract change has to reach them.

**Files:**
- Modify: `annoq-proj/docs/architecture.md` (the shared-contracts section, the consumers section, and the "Where a change lives" table)
- Modify: `annoq-proj/docs/repositories.md` (the annoq-py and AnnoQR entries)

**Interfaces:** Consumes everything above. Produces nothing.

> `annoq-proj` is tracked inside a larger parent git repo (the home directory). Per its CLAUDE.md, do not stage or commit there — which the global no-git constraint already covers.

- [ ] **Step 1: Add the propagation checklist to architecture.md**

In `annoq-proj/docs/architecture.md`, immediately after the paragraph ending "See [repositories.md](repositories.md) for each consumer." (the end of the "The API and its consumers" section), insert:

```markdown
### Propagating an api-v2 contract change

api-v2 is a **fan-out point**: a new argument, a renamed field, or a changed limit is not done when
the API ships it. Every consumer that should expose it needs its own change, in its own repo, on its
own branch. Work through this list explicitly and record what was skipped and why.

| Consumer | Repo | Who changes it |
|----------|------|----------------|
| Web UI (HRC) | annoq-site-v2 | site branch |
| Web UI (TOPMed) | annoq-site | site branch |
| Python client | annoq-py | library branch off `main` |
| R client | AnnoQR | library branch off `main` |
| SNPWay | Annoq_Overrepr_Workflow | its own issue |

**Worked example — `search_hrc` (annoq-site#78).** Restricts a query to the HRC r1.1 mapped subset
(`Mapped_in_HRC=Y`) and flips the coordinate basis to hg19. Accepted by the chromosome / RsID /
RsIDs / IDs / gene_product families and `gene_info`; rejected by the `*_by_keyword` family and by
`annotations` / `/snpAttributes`.

| Consumer | Status |
|----------|--------|
| annoq-site | shipped (`issue-78-add-hrc-mapping-info`) |
| annoq-site-v2 | shipped (`annoq-site-78-add-hrc-mapping-info`) |
| annoq-py | shipped (`annoq-site-78-add-hrc-mapping-info`, off `main`) |
| AnnoQR | shipped (`annoq-site-78-add-hrc-mapping-info`, off `main`) |
| SNPWay | **pending** — [Annoq_Overrepr_Workflow#9](https://github.com/USCbiostats/Annoq_Overrepr_Workflow/issues/9) covers its front and back end |

Note the client libraries branch off **`main`**, not off the `annoq-site-19-update-for-topmed`
line: those branches were last touched 2026-03-02 and predate the SNPWay workflow functions added
to `main` on 2026-04-27, so building on them would ship libraries missing a quarter of their API.
```

- [ ] **Step 2: Add `search_hrc` to the shared contracts section**

In the "The shared contracts" section of `annoq-proj/docs/architecture.md`, add a bullet:

```markdown
- **`search_hrc`** — an optional api-v2 argument (GraphQL and REST) that restricts results to the
  HRC r1.1 mapped subset and interprets/returns hg19 coordinates. Spelled verbatim, never
  camelCased: api-v2 runs Strawberry with `auto_camel_case=False`. Because it is part of the API's
  public surface, it is subject to the consumer fan-out above.
```

- [ ] **Step 3: Close the "Where a change lives" gap**

In `annoq-proj/docs/architecture.md`, add two rows to the "Where a change lives" table, after the "Change to search/filter behavior" row:

```markdown
| New API argument / field / limit that users should be able to use | 3 (api-v2) **then every consumer** — see [Propagating an api-v2 contract change](#propagating-an-api-v2-contract-change) |
| Feature works in the web UI but not from R/Python | consumer propagation was skipped — check the fan-out table |
```

The second row is the symptom this whole exercise came from: the table previously stopped at stage 4, so nothing pointed at the clients.

- [ ] **Step 4: Correct the client entries in repositories.md**

In `annoq-proj/docs/repositories.md`:

(a) In the **annoq-py** section's "Gotchas" paragraph, add:

```markdown
The base URL defaults to `https://api-v2.annoq.org` and is overridable with the `ANNOQ_BASE_URL`
environment variable. Supports api-v2's `search_hrc` on its six search/count functions; **not** on
`get_snp_attributes` (the endpoint rejects it) nor on the SNPWay wrappers, which call
snpway.annoq.org rather than api-v2.
```

(b) In the **AnnoQR** section, replace the sentence stating the base URL "defaults to
`https://enrichment-dev.annoq.org` (a dev api-v2 deployment)" — that is **wrong for `main`** — with:

```markdown
The base URL defaults to `https://api-v2.annoq.org`, overridable with the `ANNOQR_BASE_URL`
environment variable or per-session with `annoq_api_url()`. Supports api-v2's `search_hrc` on its
six search/count functions; **not** on `snpAttributesQuery` nor on the SNPWay wrappers.
```

(c) In the **Annoq_Overrepr_Workflow / SNPWay** section's "Gotchas", add:

```markdown
Does not yet support api-v2's `search_hrc` (the HRC r1.1 subset filter) — tracked in
[issue #9](https://github.com/USCbiostats/Annoq_Overrepr_Workflow/issues/9), which covers both its
frontend and backend.
```

- [ ] **Step 5: Verify the stale claim is gone**

```bash
cd /home/muruganu/projects/temp/top_med/annoq-proj
grep -rn "enrichment-dev" docs/
grep -c "search_hrc" docs/architecture.md docs/repositories.md
```

Expected: the first prints nothing; the second shows non-zero counts for both files.

- [ ] **Step 6: Checkpoint**

Run: `cd /home/muruganu/projects/temp/top_med/annoq-proj && git status --short docs/`
Expected: the two docs files show as modified. Nothing staged or committed.

**DO NOT COMMIT.**

---

### Task 9: Amend the companion plan, and verify end to end

**Files:**
- Modify: `annoq-site-v2/docs/superpowers/plans/2026-09-08-issue-78-hrc-mapping-port.md` (its "Deferred to cutover" section)

**Interfaces:** Consumes everything above.

- [ ] **Step 1: Fix the branch links the companion plan points at**

The companion plan's Tasks 5 and 6 link to `annoq-site-19-update-for-topmed` in both libraries. The work now lives on `annoq-site-78-add-hrc-mapping-info` off `main`. Update every occurrence in that plan:

```bash
cd /home/muruganu/projects/temp/top_med/annoq-site-v2
sed -i 's|annoq-site-19-update-for-topmed|annoq-site-78-add-hrc-mapping-info|g' \
  docs/superpowers/plans/2026-09-08-issue-78-hrc-mapping-port.md
grep -c "annoq-site-19-update-for-topmed" docs/superpowers/plans/2026-09-08-issue-78-hrc-mapping-port.md
```

Expected: the grep prints `0`.

Note this also changes that plan's Task 5 Step 1, which verifies the branches exist with
`git ls-remote`. Those branches will **not** exist remotely until the user pushes, so that step's
expectation must change too — edit it to read:

```markdown
Expected: these branches exist **locally only** until the user pushes, so `git ls-remote` returns
nothing. Verify locally instead: `git -C ../annoq-py branch --list annoq-site-78-add-hrc-mapping-info`
and the same for `../AnnoQR`. If the user has not branched yet (this plan performs no git
operations), the links are forward references — confirm the intent with them rather than reverting
to the stale issue-19 branch.
```

- [ ] **Step 2: Add the consumer items to the deferred list**

Append to that plan's "Deferred to cutover (not this plan)" numbered list:

```markdown
4. `annoq-py` / `AnnoQR` — once the library branches merge to `main`, revert the tutorial and About
   links from `.../tree/annoq-site-78-add-hrc-mapping-info` to the plain repo URLs, in
   `public/assets/docs/docs/services/index.md`, `.../services/api.md`, `.../tutorials/annoq-py.md`,
   `.../tutorials/r-package.md`, `src/pages/StaticPages.tsx` and `src/data/staticContent.ts`.
5. SNPWay — when [Annoq_Overrepr_Workflow#9](https://github.com/USCbiostats/Annoq_Overrepr_Workflow/issues/9)
   ships, update the "pending" row in annoq-proj's fan-out table and drop the "HRC support in SNPWay
   is tracked separately" caveat from both library tutorials.
```

- [ ] **Step 3: Run every suite**

```bash
cd /home/muruganu/projects/temp/top_med/annoq-py && python -m pytest -q
cd /home/muruganu/projects/temp/top_med/AnnoQR && Rscript -e 'devtools::test()'
cd /home/muruganu/projects/temp/top_med/annoq-site-v2 && npm run test
```

Expected: all three pass.

- [ ] **Step 4: Smoke-test the wire format against the live dev API**

This is the one live call in the plan. It confirms the libraries and api-v2 agree on the parameter name and value.

```bash
cd /home/muruganu/projects/temp/top_med/annoq-py
ANNOQ_BASE_URL=https://api-v2-dev.topmed.annoq.org python -c "
from annoq import api
rows = api.get_snps_by_chr('18', 10000, 200000, search_hrc=True,
                           fields=['chr','pos','Mapped_in_HRC','pos_hg19'],
                           pagination_size=5)
print('rows:', len(rows))
for r in rows:
    print(r)
assert rows, 'HRC-restricted search returned nothing'
assert all(r.get('Mapped_in_HRC') == 'Y' for r in rows), 'a row is not HRC-mapped'
print('OK: every row is HRC-mapped and carries hg19 coordinates')
"
```

Expected: up to 5 rows, every one with `Mapped_in_HRC` = `Y` and a populated `pos_hg19`, then the OK line.

If it returns zero rows, widen the range before concluding anything is broken — the HRC subset is
sparse in places. If `Mapped_in_HRC` is anything but `Y`, the parameter is not reaching the API:
check the request with `-v` before changing code.

- [ ] **Step 5: Review the complete cross-repo diff**

```bash
for r in annoq-py AnnoQR annoq-site-v2; do
  echo "===== $r ====="
  git -C /home/muruganu/projects/temp/top_med/$r status --short
done
echo "===== annoq-proj (docs only) ====="
git -C /home/muruganu/projects/temp/top_med/annoq-proj status --short docs/
```

Confirm nothing is staged and nothing has been committed in any repo, and that
`Annoq_Overrepr_Workflow` does not appear anywhere — it should never have been cloned.

- [ ] **Step 6: Report what still needs the user**

Summarise for the user:
- The four repos with uncommitted changes, and the branch name to use in each when they commit.
- That `Annoq_Overrepr_Workflow#9` still owns SNPWay's HRC support.
- That annoq-proj's `/annoq-doc-sync` should now be run, since this changed shared-contract docs.
- That the library branches are local-only, so the annoq-site-v2 doc links pointing at them are
  forward references until pushed.

**DO NOT COMMIT.**
