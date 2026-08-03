# create_pipeline_cards

An OpenHEXA pipeline that generates a workspace's `pipeline_cards.json` for the SNT Pipelines
Orchestrator, straight from live data — no manual GitHub scraping needed.

This is a **utility pipeline that supports the orchestrator webapp**, not one of the ~18 SNT
process pipelines the orchestrator lets users run (those live in the separate
[`snt_development`](https://github.com/BLSQ/snt_development) repo). It belongs in
`utils_pipelines/` alongside any future pipelines that support the webapp itself.

## What it does

For the workspace it runs in, it:

1. Lists every pipeline currently deployed in the workspace (`hexa_client.pipelines`).
2. For each one, resolves its current version and reads its deployed `pipeline.py` source to
   extract the `@pipeline("...")` id — the stable Python function name used as the node `id` in
   `app/<variant>/pipeline_map.json`.
3. Optionally curates the list down to only the pipelines that are actual nodes of a given
   webapp's deployed `pipeline_map.json` (see `webapp_name` parameter below). Pipelines with no
   resolvable id, or not present in the map, are excluded and logged; map nodes with no matching
   pipeline are logged too (they'll render greyed-out in the orchestrator).
4. Fetches each kept pipeline's current parameters and formats them to the shape the orchestrator
   webapp expects (parameter `type` values are mapped from OpenHEXA's connection types, e.g.
   `dhis2` → `DHIS2Connection`).
5. Archives any previously generated file into a `historical/` subfolder (timestamped), then
   writes the new `pipeline_cards.json` to the pipeline's output directory in the workspace's
   file storage.

The output matches the contract in `schemas/pipeline_cards.schema.json` and is meant to be
copied into `workspaces/<ws>/<variant>/pipeline_cards.json` in this repo (see the repo root
`CLAUDE.md` / `README.md` for the full deploy workflow).

## Parameters

| Parameter    | Key          | Type | Required | Default                             |
| ------------ | ------------ | ---- | -------- | ------------------------------------ |
| Name of the webapp to deploy the pipeline cards to | `webapp_name` | `str` | No | `SNT Pipelines Orchestrator - Cockpit` |

- If `webapp_name` is given, the pipeline reads that webapp's deployed `pipeline_map.json` and
  curates the pipeline list down to its nodes (logging exclusions and unavailable nodes).
- If left empty, no webapp is looked up: **all** pipelines currently deployed in the workspace
  are included, uncurated.
- The JSON file is always written locally regardless of whether a webapp was resolved — this
  parameter only controls curation, not whether output is produced.

## Output

Written to `<workspace files>/utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json`
(see `config.OUTPUT_DIR` / `config.WEBAPP_CARDS_PATH`). The previous file, if any, is moved to a
`historical/` subfolder first (e.g. `pipeline_cards_20260803_101500.json`) so nothing is
overwritten silently.

The generated file still needs to be **downloaded and committed** to this repo at
`workspaces/<ws>/<variant>/pipeline_cards.json` — this pipeline only produces the file inside the
OpenHEXA workspace's file storage, it does not push to the repo or deploy the webapp itself.

## Files

- `pipeline.py` — the pipeline itself (`create_pipeline_cards`).
- `config.py` — GraphQL queries, the parameter type map, output paths, and other constants.
- `.gitignore` — ignores the local OpenHEXA SDK scaffolding (`workspace/`, `workspace.yaml`,
  `.vscode/`, `__pycache__/`) created when running/debugging the pipeline locally.

## Caveats

- Pipeline **ids** are derived by regex-matching `@pipeline("...")` in the deployed
  `pipeline.py` source. A pipeline with no deployed version, no `pipeline.py` in its file
  listing (e.g. notebook-based pipelines), or a missing/malformed decorator will have `id: null`
  and be excluded whenever curation runs against a map.
- Duplicate `@pipeline` ids across workspace pipelines are logged as warnings but not resolved
  automatically — deprecated duplicates should be cleaned up in the workspace.
- `config.EXPECTED_NUM_PIPELINES` (currently `18`) is only used to log a warning if the curated
  count doesn't match — it does not fail the run.
