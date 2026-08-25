# The pipeline catalog (`pipeline_cards.json`)

> **Read this whenever a question is about which pipelines exist in a workspace, their UUIDs, or
> their parameters** — including "the app greys out something that should be live" and any
> `INVALID_CONFIG`-style run rejection.

## Where it lives — the workspace bucket, not the repo

Since 2026-08-04 the catalog is **not bundled and not kept in the repo**. It lives in the workspace's
own file storage at the fixed key

```
utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json
```

and is written there by the companion **`create_pipeline_cards`** pipeline, whose source is in this
repo under `utils_pipelines/create_pipeline_cards/` (see its own `README.md`).

**Why:** a config change (a new pipeline installed, a parameter renamed) is then just a pipeline run
— no webapp redeploy, no repo commit.

⚠️ **There is no `workspaces/` folder.** It held `workspaces/<ws>/<variant>/pipeline_cards.json` and
was deleted on 2026-08-04. If you find yourself wanting to create it, you are about to reintroduce
the redeploy-per-config-change problem that change removed. Old copies remain in git history.

`schemas/pipeline_cards.schema.json` documents the expected structure — field definitions and type
mapping. Read it when interpreting pipeline data.

## How the app reads it

Identical in both variants (`loadCards()` in each `app/<variant>/app.js`):

1. `prepareObjectDownload(input: {workspaceSlug, objectKey: CARDS_OBJECT_KEY, forceAttachment: false})`
   through the same-origin `/graphql/` proxy → a signed GCS URL. Needs **`FILES_READ`**.
2. `fetch(signedUrl)` → `.json()`. Works because those signed URLs are CORS-open (the same property
   the report embed relies on).

Rules that follow:

- **`CARDS_OBJECT_KEY`** is a hardcoded constant at the top of each variant's `app.js`. It must stay
  in lockstep with `utils_pipelines/create_pipeline_cards/config.py` (`OUTPUT_DIR` +
  `WEBAPP_CARDS_PATH`). Changing the output location means changing three places.
- **One catalog serves both variants.** The generator curates against the webapp's *deployed*
  `pipeline_map.json`, and both variants' maps declare the same node ids (verified 2026-08-04), so
  there is no per-variant catalog. If the two maps ever diverge in node ids, that assumption breaks
  and each variant would need its own generated file.
- **There is no fallback, by design.** If the object is missing the app **fails at boot** with an
  actionable message ("Run the `create_pipeline_cards` pipeline") rather than silently serving a stale
  bundled copy. Cockpit surfaces it in its `boot.failed` panel (i18n keys `boot.cardsMissing` /
  `boot.cardsUnreadable` / `boot.noWorkspace`); flowchart renders a `.map-error` box onto the canvas.

## Every workspace needs the generator deployed and run

⚠️ **The orchestrator will not boot in a workspace without a catalog.** Present in all three
workspaces — `snt-app-dev`, `snt-testing`, `cmr-snt-process` (the last verified live 2026-08-24,
catalog dated 2026-08-04).

**The generator takes no parameters** (just Run), but it curates against the deployed map of the
webapp named by its `config.WEBAPP_SLUG` — currently `snt-pipelines-orchestrator-cockpit`, the lead
variant. **So the Cockpit app must exist in a workspace before the generator can succeed there**: a
Flowchart-only workspace makes it **fail** until Cockpit is deployed too, or `WEBAPP_SLUG` is pointed
at `snt-pipelines-orchestrator` and the generator redeployed. Both variants are now deployed in all
three workspaces, so this ordering constraint only bites when standing up a **new** workspace —
deploy Cockpit first, then run the generator.

## Regenerating is the answer to almost every catalog question

A pipeline was installed, removed, or had a parameter renamed; the app greys out something that
should be live; a run is rejected with `INVALID_CONFIG` or another of the drift-flagged
`PipelineError` codes. In all of those cases the fix is **run `create_pipeline_cards` in that
workspace** (via the OpenHEXA UI, or `run_pipeline` if the user asks) — not to hand-edit anything.
The webapp picks the new catalog up on its next page load; **no redeploy**.

**Do not** patch a parameter by hand to "fix" drift — that desynchronises the bucket file from the
generator and the next run silently reverts it.

## Inspecting a workspace's current catalog

- `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")` — cheap
  existence + `updatedAt` check. Do this before assuming a workspace has a catalog at all; the
  `updatedAt` is the catalog's real age.
- `read_file(workspace_slug, "utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json")`
  — the full contents. ⚠️ These files are ~45–60 KB; prefer the `list_files` check, or ask the user to
  read a value off the OpenHEXA UI, when you only need one fact.
- Previous versions are archived by the pipeline itself under `…/pipeline_cards/historical/` with a
  timestamp suffix — useful for diffing what changed between runs.

## Staleness and versioning

The catalog carries a `generated_at` date, but its parameters are read from each pipeline's **deployed
current version** in that workspace (`pipelineByCode.currentVersion.parameters`, recorded as
`parameters_source: "openhexa_deployed"`) — not scraped from GitHub `main`. So it reflects what is
actually installed, and the old GitHub-vs-installed drift class is gone. What can still be stale is
the catalog vs the workspace *now*: if pipelines have been installed or upgraded since `generated_at`,
re-run the generator.

Each card also records the deployed version it was built from (`version_name` / `version_number`,
added 2026-08-04). Nothing reads them yet — they exist so a future drift check can compare them
against the live `pipelineByCode.currentVersion` and surface a refresh prompt only on real change,
rather than an always-visible "refresh" control that asks users to self-diagnose.

## Pipeline IDs are workspace-specific

Pipeline **UUIDs** and **codes/slugs** both differ across workspaces for the same pipeline. The only
stable identifier is the **Python function name** (e.g. `snt_dhis2_extract`) — used as the key in
`schemas/pipeline_cards.schema.json` and as the `id` in each variant's `pipeline_map.json`.

The app gets pipeline UUIDs at runtime from that workspace's own bucket-hosted catalog, so **UUIDs
can no longer leak across workspaces**: each catalog is generated in place by running
`create_pipeline_cards` there, and is never copied between workspaces. (The old failure mode —
hand-copying a `pipeline_cards.json` from one workspace to another — is structurally impossible now.)

---

## Diagnosing a missing catalog from inside the app

Added 2026-08-05. When `loadCards()` can't read the catalog, the app runs **one extra
`pipelines(workspaceSlug:)` query** — the same query as the status board, so it needs **no scope
beyond `PIPELINES_READ`** — works out which situation the workspace is in, and shows the matching
message with a deep link:

| Diagnosis       | What the app tells the user                                     |
| --------------- | --------------------------------------------------------------- |
| `notInstalled`  | install the generator → link to its **template** page           |
| `neverRun`      | open the pipeline page and press Run                            |
| `inProgress`    | a run is `queued` / `running` / `terminating` — wait; link to it |
| `lastRunFailed` | link straight to the failed run's logs                          |
| `unknown`       | fallback to the generic "run `create_pipeline_cards`" text      |

Implementation, mirrored in both variants near the top of each `app/<variant>/app.js`:
`GENERATOR_QUERY`, `looksLikeGenerator`, `diagnoseMissingCatalog`, `generatorTemplateUrl` /
`generatorPipelineUrl` / `generatorRunUrl`, `missingCatalogError` — `app/cockpit/app.js:121` +
`:188-300`, `app/flowchart/app.js:80` + `:170-280`. (`diagnoseMissingCatalog` is also reused by the
run-error drift hint, so it resolves the generator's state generally, despite the name.)

Three things to know before touching it:

- **The generator's `code` and `name` vary by how it was installed** — seen in the wild as
  `create-pipeline-cards` (source deploy), `create_pipeline_cards`, and `Create pipeline_cards.json`
  (template install). So **never hardcode its code**: `looksLikeGenerator` lowercases `code`/`name`,
  strips non-alphanumerics, and tests for `pipelinecards` (`GENERATOR_KEY_MATCH`). Links are then
  built from whatever `code` the query actually returned.
- **The template deep link** (verified live 2026-08-05) is
  `https://app.openhexa.org/workspaces/<ws>/templates/Create%20pipeline_cards.json` — i.e.
  `/templates/` + the URL-encoded template **display name**, not a slug. That name is
  `GENERATOR_TEMPLATE_NAME` in both `app.js`.
- ⚠️ **The two variants take different DOM routes for these messages** — `missingCatalogError`
  attaches `err.htmlMessage` (pre-escaped HTML) for cockpit and `err.helpLink = {href, label}` for
  flowchart, whose `init` catch builds a real `<a>`. See the DOM-seam note in
  [`orchestrator-app.md`](orchestrator-app.md#the-two-variant-dom-seam--easy-to-get-wrong).

---

## Reference: how a pipeline's parameters are declared

You should not normally need this — `create_pipeline_cards` extracts parameters from the deployed
pipeline version automatically. Keep it for reading pipeline source on GitHub, for understanding
where the catalog's fields come from, and for the rare case of diagnosing a pipeline whose deployed
version cannot be resolved (the generator leaves those with `id: null` and excludes them; see the
pipeline's `README.md`).

**GitHub repository:** `https://github.com/BLSQ/snt_development`

**Finding the pipeline source file:** each pipeline lives in a folder at the repo root named after
its Python function name (`{pipeline_id}/pipeline.py`). Fetch the raw file via:

```
https://raw.githubusercontent.com/BLSQ/snt_development/main/{pipeline_id}/pipeline.py
```

Example for `snt_dhis2_extract`:

```
https://raw.githubusercontent.com/BLSQ/snt_development/main/snt_dhis2_extract/pipeline.py
```

Do **not** look inside a `pipelines/` folder — it does not contain the correct source files.

**Extracting parameters:** parameters are declared as `@parameter` decorators stacked above the
pipeline function. Read them **top to bottom** — that order is the display order in the UI. Each
decorator maps to one entry in the `parameters` array:

```python
@parameter(
    "param_key",            # → "key"
    name="Display Label",   # → "label"
    help="Help text",       # → "help"
    type=bool,              # → "type"  (see mapping below)
    default=True,           # → "default"  (omit if None)
    required=False,         # → "required"  (omit if False)
    choices=["a", "b"],     # → "choices"  (omit if absent)
)
```

**Type mapping:**

| Python type in decorator | JSON `type` value    |
| ------------------------ | -------------------- |
| `bool`                   | `"bool"`             |
| `int`                    | `"int"`              |
| `float`                  | `"float"`            |
| `str`                    | `"str"`              |
| `DHIS2Connection`        | `"DHIS2Connection"`  |
| `CustomConnection`       | `"CustomConnection"` |
| `File`                   | `"File"`             |

**Rules:**

- Omit `default` if its value is `None`.
- Omit `required` if it is `False` — absence means optional.
- If `choices` is a list of tuples `(value, label)`, keep only the value (first element).
- The card `name` (display title) and `description` (subtitle) are **not** in the Python source. Get
  the display name from `list_pipelines` in OpenHEXA or ask the user. Do not invent them.
- The `id` field is the Python function name — the first argument to `@pipeline(...)`, which is also
  the pipeline's folder name in the `snt_development` repo and the node `id` in each variant's
  `pipeline_map.json`.

⚠️ **Reference only — do not hand-build a catalog from this.** The connection type names above are the
SDK's Python classes; `create_pipeline_cards` sees OpenHEXA's own lowercase codes instead (`dhis2`,
`custom`, `iaso`, `postgresql`, `gcs`, `s3`, `file`) and maps them to these same JSON values via
`PARAMETER_TYPE_MAP` in its `config.py`. If a new connection type ever appears in a pipeline, that map
is the place to extend — the webapp's form then needs a matching branch in `fieldControlHtml`, or the
parameter falls back to a plain text input.
