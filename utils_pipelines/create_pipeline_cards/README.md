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
3. Curates the list down to only the pipelines that are actual nodes of the orchestrator
   webapp's deployed `pipeline_map.json` (which webapp: see `config.WEBAPP_SLUG` below).
   Pipelines with no resolvable id, or not present in the map, are excluded and logged; map
   nodes with no matching pipeline are logged too (they'll render greyed-out in the
   orchestrator).
4. Fetches each kept pipeline's current parameters and formats them to the shape the orchestrator
   webapp expects (parameter `type` values are mapped from OpenHEXA's connection types, e.g.
   `dhis2` → `DHIS2Connection`).
5. Archives any previously generated file into a `historical/` subfolder (timestamped), then
   writes the new `pipeline_cards.json` to the pipeline's output directory in the workspace's
   file storage.

The output matches the contract in `schemas/pipeline_cards.schema.json`. **It is consumed in place:**
both orchestrator UI variants fetch it straight out of the workspace's file storage at page load, so
running this pipeline is all that's needed to update a workspace's configuration — nothing to copy,
commit, or redeploy. See the repo root `CLAUDE.md` / `README.md` for the full picture.

## Parameters

**None.** The pipeline takes no parameters — just run it. Everything it needs it derives from the
workspace it runs in (`workspace.slug`) plus the constants in `config.py`.

It used to take a `webapp_name` parameter (the display name of the webapp to curate against, with
an "if empty, skip curation" fallback). That was removed on 2026-08-04: the display name had to be
translated into a slug by listing and paging through every webapp in the workspace, and the names
are inconsistent across workspaces while the slugs are not. The slug is now a constant:

```python
# config.py
WEBAPP_SLUG = "snt-pipelines-orchestrator-cockpit"
```

- This is the webapp whose **deployed** `pipeline_map.json` is the curation authority. Cockpit is
  the lead variant, so it is the one kept up to date.
- ⚠️ **That webapp must exist in the workspace, or the run fails** with `Failed to read
  pipeline_map.json from webapp '…'`. There is no longer an uncurated fallback — a run either
  curates against a real deployed map or stops. This is deliberate: silently emitting every
  pipeline in the workspace is worse than a clear failure.
- To curate against a different webapp (e.g. a workspace where only Flowchart —
  `snt-pipelines-orchestrator` — is deployed), edit `WEBAPP_SLUG` and redeploy the pipeline.

## Output

Written to `<workspace files>/utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json`
(see `config.OUTPUT_DIR` / `config.WEBAPP_CARDS_PATH`). The previous file, if any, is moved to a
`historical/` subfolder first (e.g. `pipeline_cards_20260803_101500.json`) so nothing is
overwritten silently.

**This path is a contract with the webapp.** Both variants hardcode it as `CARDS_OBJECT_KEY` in
`app/<variant>/app.js` and read the file via `prepareObjectDownload` → `fetch(signedUrl)` (needing
the webapp's `FILES_READ` scope). Changing `OUTPUT_DIR` or `WEBAPP_CARDS_PATH` therefore means
changing `CARDS_OBJECT_KEY` in **both** variants and redeploying them — otherwise every orchestrator
in every workspace stops booting.

Nothing needs to be downloaded, committed, or redeployed after a run: the app reads the new file on
its next page load. The pipeline does not push to the repo or touch the webapp bundle.

**One catalog serves both variants.** Curation is against the deployed map, and both variants'
`pipeline_map.json` files declare the same node ids — so a single generated file is valid for
Flowchart and Cockpit alike, and `config.WEBAPP_SLUG` only decides *which* deployed map is used as
the authority. (If the two maps ever diverge in node ids, that stops being true, and the choice of
slug starts to matter.)

## Files

- `pipeline.py` — the pipeline itself (`create_pipeline_cards`).
- `config.py` — GraphQL queries, the parameter type map, output paths, and other constants.
  `WEBAPP_SLUG` is the one you are most likely to need to change (see _Parameters_).
- `.gitignore` — ignores the local OpenHEXA SDK scaffolding (`workspace/`, `workspace.yaml`,
  `.vscode/`, `__pycache__/`) created when running/debugging the pipeline locally.

## Caveats

- Pipeline **ids** are derived by regex-matching `@pipeline("...")` in the deployed
  `pipeline.py` source. A pipeline with no deployed version, no `pipeline.py` in its file
  listing (e.g. notebook-based pipelines), or a missing/malformed decorator will have `id: null`
  and be excluded by curation.
- The run **fails** if the webapp named by `config.WEBAPP_SLUG` isn't deployed in the workspace,
  since its map is the curation authority. As of 2026-08-04 that means the Cockpit app must be
  deployed there first — it is present in `snt-app-dev` and `snt-testing`, but **not yet in
  `cmr-snt-process`**, which is still on Flowchart only.
- Duplicate `@pipeline` ids across workspace pipelines are logged as warnings but not resolved
  automatically — deprecated duplicates should be cleaned up in the workspace.
- `config.EXPECTED_NUM_PIPELINES` (currently `18`) is only used to log a warning if the curated
  count doesn't match — it does not fail the run.
