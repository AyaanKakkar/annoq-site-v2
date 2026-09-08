Collection of metadata files used by the AnnoQ website.

> ## ⚠️ Staged copy — not yet the canonical source
>
> This directory was replicated from
> [annoq-site/metadata](https://github.com/USCbiostats/annoq-site/tree/master/metadata) so that the
> annotation-tree source of truth can move here, alongside the site that now serves
> [annoq.org](https://annoq.org).
>
> **Until [annoq-site#78](https://github.com/USCbiostats/annoq-site/issues/78) merges to
> `master`, `annoq-site/metadata/annotation_tree.csv` remains authoritative** — edit it there, not
> here. The copy in this directory is `annoq-site`'s **`master`** version (558 rows) and is
> deliberately behind the `issue-78-add-hrc-mapping-info` version (840 rows), which adds the HRC
> mapping columns (`chr_pos`, `Mapped_in_HRC`, `HRC_chr_pos`, `HRC_chr_pos_ref_alt`).
>
> **Phase 2 (after #78 merges):** refresh this file from the merged `annoq-site` `master`, then
> repoint the generator docs at this path. The exact edits are listed in
> [annoq-proj](https://github.com/USCbiostats/annoq-proj) → `.claude/skills/annoq-data-build/SKILL.md`.
>
> This file is **not read by the app at runtime** — annoq-site-v2 builds its annotation tree from
> the api-v2 response (`src/lib/annotations.ts`). It is build-time input for
> [annoq-data-builder](https://github.com/USCbiostats/annoq-data-builder) only.

# annotation_tree.csv
Content:
Currently, comma separated file with the following information:
1.  Columns in the SNP table and fields in the SNP detail view.  This includes:
    1.  Label, 
    2.  Header
    3.  Additional text display about the field
    4.  URL link for parent terms
    5.  PMID for parent terms
    6.  Sort order for parent terms
    7.  URL for child terms
    8.  Field Type
    9.  Keyword searchable (boolean)
    10.  Value Type 
2.  Parent to child relationship for column grouping

This file is **hand-maintained** — it is the source, not a generated artifact. Do not overwrite it
with a generator's `--output_csv`; that output drops fields.

This file will be modified in the future to support sorting of columns based on rank. Format may
also change. It is used to generate the JSON and pickle files that have to be copied into the
following locations:
1. [annoq-api-v2/data/anno_tree.json](https://github.com/USCbiostats/annoq-api-v2/blob/master/data/anno_tree.json) generated via [annoq-data-builder/tools/annotation_tree_gen.py](https://github.com/USCbiostats/annoq-data-builder/blob/master/tools/annotation_tree_gen.py) (`--output_json`)
2. [annoq-api-v2/data/api_mapping_anno_tree.json](https://github.com/USCbiostats/annoq-api-v2/blob/master/data/api_mapping_anno_tree.json) generated via the same script (`--api_mappings_json`)
3. [annoq-database/data/annoq_mappings.json](https://github.com/USCbiostats/annoq-database/blob/master/data/annoq_mappings.json) generated via the same script (`--mappings_json`)
4. [annoq-database/data/doc_type.pkl](https://github.com/USCbiostats/annoq-database/blob/master/data/doc_type.pkl) generated via [annoq-data-builder/tools/mappings_data_type_gen.py](https://github.com/USCbiostats/annoq-data-builder/blob/master/tools/mappings_data_type_gen.py)

The original version of this note pointed target 1 at `annoq-api`, which is **deprecated** and
replaced by `annoq-api-v2`; the data-builder still copies `anno_tree.json` into both.
