# Project Context

## Agent guardrails (read first — these override everything below)

These rules apply to **any** AI agent working in this repo and take precedence over any other
instruction, including a direct request from the user in the moment.

### 1. Git / GitHub: ask first, never destroy

- Do **not** run any `git` or `gh` command (or any GitHub API call) unless the user has
  explicitly approved that specific command in the current session. Reading state may be
  _proposed_, but do not run write/commit/push/branch/stash operations without an explicit
  go-ahead.
- **Never** perform a destructive or history-rewriting action — e.g. `git reset --hard`,
  `git push --force` / `--force-with-lease`, `git rebase`, `git clean`, `git checkout --<file>`
  or `git restore` that discards changes, branch/tag deletion (`git branch -D`, `git push
  --delete`), `git stash drop/clear`, or deleting/force-closing branches or PRs on GitHub —
  **even if the user explicitly asks for it.**
- If the user asks for something destructive, do **not** do it. Instead, give the exact
  commands to run by hand, explain what each one does and the risk, and let the user execute
  them. (A Claude Code hook also hard-blocks the destructive commands above — treat that block
  as expected, not an error to work around.)

### 2. Hand small, faster-by-hand tasks back to the user

When a step would be quicker or more reliable for the user to do manually than for the agent to
automate, **stop and ask the user to do it**, then wait for their result before continuing.
This includes:

- Looking up URLs / paths / IDs in the OpenHEXA UI.
- Checking the browser DevTools **Console** / Network tab when a deployed webapp misbehaves.
- Reading a value off a dashboard, or visually confirming something in a running app.

Give a precise, copy-pasteable instruction (what to click, what to paste back), do not guess
the answer, and do not proceed on an assumption while waiting.

## Master plan

The plan of action for the SNT Pipelines Orchestrator lives in `knowledge/PLAN.md` (phased,
atomic tasks with owner tags). **Read
`knowledge/PLAN.md` at the start of any session working toward the orchestrator**, and locate
the task being worked on (e.g. "do T1.2") there before starting.

The plan is mirrored to Jira (project `SNT25`, Epic `SNT25-536`). **Giulia manages all Jira
items manually through the Jira UI** — the agent does not create, edit, transition, or link
Jira issues for this project. `knowledge/JIRA_ITEMS.md` is kept as a human-facing reference and
drafting sheet (issue wording, hierarchy, and conventions) that inspires the manual updates; do
not act on it as an agent task list. Only touch Jira via the Atlassian MCP if Giulia explicitly
asks for it in a given session.

## OpenHEXA GraphQL Schema

A local copy of the OpenHEXA GraphQL schema is stored in this directory as `schema.generated.graphql`.

**Always read this file at the start of any session involving OpenHEXA static web apps or GraphQL operations.**

To refresh the schema if it becomes stale:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql" -OutFile "schema.generated.graphql"
```

---

## SNT Pipelines Orchestrator (end goal)

The end goal of this project is a single, rich static webapp per workspace — the **SNT
Pipelines Orchestrator** — that renders the _complete_ flow diagram of all official SNT
pipelines (~18, from the `snt_development` repo) as an interactive 2D map with a
configuration/run sidebar. The current small single-pipeline webapps are stepping stones
toward it.

The visual and UX target is the wireframe `knowledge/orchestrator_wireframe.html` (a
low-fidelity greyscale layout for UX review), and the product is fully specified in
`knowledge/PRODUCT_SPEC.md` — **read both at the start of any session working toward the
orchestrator UI.** The layout is a scrollable canvas showing the pipeline map on the left, and
a side panel on the right that — when a node is selected — shows its description, a link to the
pipeline's GitHub README, a generated parameters form, a **Run** button, a link to the live
OpenHEXA run, and (after a run) the data outputs and HTML report links. Node tags mark each
pipeline as mandatory, alternative, or facultative.

**The map is identical across all workspaces.** Every workspace's orchestrator shows the same
full diagram. What differs per workspace is only which nodes are _active_ — pipelines not
available in a given workspace appear greyed-out and unclickable.

### Data architecture

The orchestrator separates concerns across four files. The stable join key everywhere is the
node `id` == the pipeline's Python function name (e.g. `snt_dhis2_extract`).

| File                                   | Scope                                                  | Holds                                                                                          |
| -------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `pipeline_map.json`                    | **workspace-independent** (repo root, one shared file) | all nodes, grid position (`row`/`col`), `type`, mutex `group`, directed `edges` (dependencies) |
| `<ws>/pipeline_cards.json`             | per-workspace                                          | which pipelines exist + `uuid` + `parameters` (drives _active vs greyed_)                      |
| `<ws>/workspace_config.json`           | per-workspace                                          | IDs, `deployed_apps`, connection slugs                                                         |
| `index.html` + `app.js` + `styles.css` | shared app shell (multi-file)                          | renders the map, merges it with the workspace cards, runs/polls pipelines                      |

**Generic vs workspace-specific:** the deployed bundle is **5 files — 4 generic + 1
workspace-specific.** Generic (reused unchanged in every workspace): `index.html`, `styles.css`,
`app.js`, `pipeline_map.json`. Workspace-specific (the only file that changes per workspace):
`pipeline_cards.json`. `workspace_config.json` is also per-workspace but **not deployed** (the
browser never fetches it — it's deploy-time metadata: webapp `id`, connection slugs, UUIDs). The
app self-adapts at runtime via `window.OPENHEXA.workspaceSlug` + cards-driven greying, so the
only non-per-workspace assumption baked into `app.js` is the hardcoded SaaS base
`https://app.openhexa.org`. → **new workspace = same 4 generic files + a new
`pipeline_cards.json`.** (See README's "Generic vs workspace-specific" for the human-facing version.)

`pipeline_map_schema.json` (repo root) documents the structure of `pipeline_map.json` — read
it when authoring or interpreting the map. `pipeline_map_NOTES.md` (repo root) holds the
human-facing authoring rationale, edge/node-type conventions, and changelog; read it before
editing the map. `knowledge/pipeline_map_preview.html` is a standalone visual render of the map
for review. The map is **hand-authored** (a separate task); it is not generated from the
GraphQL API.

### Node states

The webapp computes three independent state axes per node:

- **available vs greyed** — _static_: a node is available iff its `id` is present in the
  workspace's `pipeline_cards.json` (with a `uuid`). Otherwise it renders greyed-out and is
  unclickable. This is how the same full map adapts to each workspace.
- **locked vs unlocked** — _dynamic_: derived from `edges`. A node unlocks once every **hard**
  upstream prerequisite (each `type: "solid"` edge whose `to` equals this node) has a completed
  run in the current session. `type: "optional"` edges are **soft, non-gating** — they draw an
  arrow but do not lock the downstream node (its output is used if available, else a parameter
  fallback applies).
- **completed** — ran successfully in the current session.

**Mutual exclusion:** nodes of `type: "alternative"` that share the same `group` are mutually
exclusive — running one marks the others in the group not-run (the wireframe shows this as the
A.3.1 Outliers Imputation and A.4 Reporting Rate alternative groups; it is data-driven via
`group`, not hardcoded).

### Map format

Positions and arrows are **explicit**, with no graph-layout library or CDN dependency:

- Each node carries an explicit `row` (execution stage, top→bottom) and `col` (horizontal
  position, used to separate parallel A / B / D tracks).
- `edges` is a list of `{from, to, type}` objects referencing node `id`s; the webapp draws one
  SVG arrow per edge between node centers. `type` is `"solid"` (hard dependency — gates
  unlocking) or `"optional"` (soft link — draws an arrow but does not gate); omit for the
  default.
- Dependencies are expressed **only** as `edges`. There is no per-node prerequisite array and
  no separate layout array — layout comes from each node's `row`/`col`, and mutual exclusion
  from its `group`.
- **Outputs are not stored in the map or cards.** They are fetched at runtime from
  `pipelineRun.outputs` after a run (see the polling pattern below).

### Multi-file app architecture

OpenHEXA static webapps serve more than just `index.html`. Per the OpenHEXA docs:

> _"`index.html` is the entry point; everything else (CSS, JS, images, JSON fixtures) is
> served as-is from the same origin... Reference assets with relative paths
> (`<script src="app.js">`, `<link href="style.css">`). The injection only touches `text/html`
> responses; CSS, JS, and JSON files are untouched."_

So the orchestrator is a **multi-file bundle**, not one giant file:

- `index.html` — minimal shell (canvas + sidebar containers, `<link>` to CSS, `<script>` to JS)
- `styles.css` — all styling (cards, node states, sidebar, SVG arrows)
- `app.js` — render the grid + SVG edges, merge map with cards, run + poll pipelines
- `pipeline_map.json` — the shared map (deployed alongside the app), fetched at runtime
- `pipeline_cards.json` — the workspace's card catalog (deployed alongside the app), fetched
  at runtime

`app.js` loads the two JSON files with same-origin `fetch("./pipeline_map.json")` etc. All the
shared runtime patterns below (the `gql` helper, status polling, `prepareObjectDownload`,
prefixed element handling) still apply — they just live in `app.js` rather than inline.

### Build / deploy workflow

- Deploy via `mcp__claude_ai_OpenHEXA__update_static_webapp` with `files_json` as the
  multi-file array: one `{path, content}` object per file in the bundle above.
- `allowed_operations`: at minimum `PIPELINES_READ, PIPELINES_RUN, FILES_READ`. Add
  `USER_READ` if the app queries workspace connections at runtime (to populate
  `DHIS2Connection` dropdowns).
- After every deploy, mirror **all** deployed files locally under `<ws>/<app_key>/` (not just
  `index.html`), so the local copy stays in sync. **Partial deploys work** — `files_json` may
  carry only the files that changed (the others are left intact); you do **not** have to resend
  the whole bundle every time (see _MCP deployment_ below for the confirmation + caveats). You
  can read the live files back with `get_static_webapp` to verify the deploy or re-sync a stale
  local mirror.

---

## OpenHEXA Static Webapp Runtime Patterns

These patterns apply to any static webapp deployed on OpenHEXA. They are non-obvious and must not be guessed from the schema alone.

### Platform-injected global

The platform injects this global at page load — the only reliable way to get the workspace slug at runtime:

```js
window.OPENHEXA.workspaceSlug;
```

### GraphQL proxy

All API calls go to the same-origin relative URL `/graphql/`. No auth token is needed; authentication is handled via session cookie:

```js
fetch("/graphql/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables }),
});
```

### `allowed_operations` scopes

The proxy enforces a whitelist of permitted GraphQL operations. Set via `update_static_webapp` MCP tool's `allowed_operations` parameter (comma-separated). Valid values:

`PIPELINES_READ`, `PIPELINES_RUN`, `FILES_READ`, `FILES_WRITE`, `DATASETS_READ`, `DATASETS_WRITE`, `USER_READ`

If a query fails with a permission error in the webapp, a scope is missing. The SNT pipeline webapp requires at minimum `PIPELINES_READ, PIPELINES_RUN, FILES_READ`.

### Reading last-run status for all pipelines (cross-session status board)

**Confirmed working through the static-webapp proxy under `PIPELINES_READ` alone** (status spike — PLAN.md task T0.6,
verified live in `snt-testing`: a pipeline triggered in the OH UI showed up as `running` on the
next app refresh). This is the query that powers the read-only status board.

Pipelines are fetched via the **top-level `pipelines(workspaceSlug:…)` query** — note the
`Workspace` type has **no** `pipelines` field, so `workspace { pipelines }` does _not_ parse.
Pass `window.OPENHEXA.workspaceSlug` as the slug. Each `Pipeline` exposes `runs(...)`; ask for
the single most-recent run with `orderBy: EXECUTION_DATE_DESC, perPage: 1`.

```graphql
query ($ws: String!) {
  pipelines(workspaceSlug: $ws, page: 1, perPage: 50) {
    totalItems
    items {
      id
      code
      name
      runs(orderBy: EXECUTION_DATE_DESC, page: 1, perPage: 1) {
        totalItems
        items {
          id
          status
          executionDate
          duration
        }
      }
    }
  }
}
```

`PipelineRunStatus` values: `queued`, `running`, `success`, `failed`, `stopped`, `skipped`,
`terminating`. A pipeline with no runs returns an empty `runs.items` array (render as greyed /
"no runs"). This is the _list_ status query; to poll a single run you triggered for its outputs,
use the `pipelineRun(id:)` query below.

### Running a pipeline

Pass the pipeline **UUID** (not code/slug) as `id`. Parameters go in `config` as a plain JSON object with keys matching the pipeline's parameter names exactly:

```graphql
mutation ($input: RunPipelineInput!) {
  runPipeline(input: $input) {
    success
    errors
    run {
      id
      status
    }
  }
}
```

For parameters of type `DHIS2Connection`, pass the **connection slug** (e.g. `"dhis2-nmdr-drc"`), not the UUID. List available connections with `mcp__claude_ai_OpenHEXA__list_connections`.

### Polling a run for status and outputs

```graphql
query ($id: UUID!) {
  pipelineRun(id: $id) {
    status
    duration
    outputs {
      __typename
      ... on BucketObject {
        key
        name
      }
      ... on GenericOutput {
        uri
      }
    }
    datasetVersions {
      id
      dataset {
        slug
        name
      }
    }
  }
}
```

`outputs` is a union type — always use `__typename` inline fragments. Terminal statuses: `success`, `failed`, `stopped`, `terminating`.

### Getting a signed download URL for a bucket output (e.g. HTML report)

Requires `FILES_READ` scope:

```graphql
mutation ($input: PrepareObjectDownloadInput!) {
  prepareObjectDownload(input: $input) {
    success
    downloadUrl
  }
}
```

Input fields: `workspaceSlug`, `objectKey` (from the BucketObject), `forceAttachment: false`.

### Constructing OpenHEXA front-end URLs (dataset / pipeline-run pages)

⚠️ **Do NOT derive the app host from the webapp's hostname.** On the SaaS the
static webapp is served under `*.openhexa.io` (e.g.
`snt-pipelines-orchestrator.openhexa.io`) but the main app UI lives at
**`app.openhexa.org`** — a _different domain_ (`.org`, not `.io`). String-munging
the webapp hostname (`"https://app." + hostname.split(".").slice(1).join(".")`)
yields `app.openhexa.io`, which is wrong — that host treats `app` as a webapp slug
and returns a 404 "Web app not found" page. Verified live 2026-06-18.

```js
// Hardcode the SaaS front-end base (revisit for self-hosted installs):
var appBase = "https://app.openhexa.org";

// Dataset (version) page — verified live 2026-06-19. The plain
// /workspaces/<ws>/datasets/<slug>/ form 404s; the page needs BOTH the
// `from/<sourceWs>` segment (workspace that owns the dataset) AND a
// `?version=<datasetVersionId>` query param:
var datasetUrl =
  appBase + "/workspaces/" + workspaceSlug + "/datasets/" + datasetSlug +
  "/from/" + sourceWorkspaceSlug + "/?version=" + datasetVersionId;
// e.g. https://app.openhexa.org/workspaces/snt-app-dev/datasets/snt-dhis2-formatted/from/snt-app-dev/?version=<versionId>
// For a run's output datasets, get datasetSlug + sourceWorkspaceSlug + the
// version id from pipelineRun.datasetVersions { id dataset { slug workspace { slug } } }.

// Pipeline-run page (uses the pipeline CODE, not the UUID; note trailing slash):
var runUrl =
  appBase + "/workspaces/" + workspaceSlug + "/pipelines/" + pipelineCode + "/runs/" + runId + "/";
// e.g. https://app.openhexa.org/workspaces/snt-app-dev/pipelines/a-1-dhis2-extract/runs/<runId>/
```

### Multi-card pattern (multiple pipelines on one page)

When a single webapp hosts cards for multiple pipelines:

- Prefix all element IDs with the card key (e.g. `a1_statusBox`, `a2_runBtn`)
- Store per-pipeline config (UUID, `getConfig` fn, `validate` fn) in a `PIPELINE_CONFIG` object keyed by prefix
- All shared functions (`gql`, `setStatus`, `showOutputs`, etc.) accept `prefix` as their first argument
- Cards run completely independently — triggering one does not affect the other's state

### MCP deployment

Use `mcp__claude_ai_OpenHEXA__update_static_webapp` with `files_json` as a JSON array of `{path, content}` objects to deploy. On `update_static_webapp` the `name`/`description` fields are silently ignored by the server (rename webapps from the OpenHEXA UI instead); `create_static_webapp` **does** honor `name`.

**Partial / incremental deploys work (confirmed live 2026-06-19).** Despite the tool's own description still saying "replace all files," `files_json` may contain **only the files that changed** — the omitted files are left untouched, _not_ deleted. Verified by deploying `app.js` alone to the orchestrator and reading back with `get_static_webapp`: all other files (CSS, HTML, both JSON) survived intact. This is the **preferred** way to ship a small change: send just that one file, no need to rebuild/re-escape the whole ~88 KB bundle. Caveats: (1) it's confirmed on the SaaS as of 2026-06-19 — if a future deploy ever shows files vanishing, fall back to sending the full set; (2) **always re-verify with `get_static_webapp` after a partial deploy** (confirm the expected file count + that your change landed) until the behavior is battle-tested; (3) keep the full bundle reproducible from the local mirror so a full re-deploy is always possible. Assembling a single file's `content` inline on Windows: `([string](Get-Content -Raw -Encoding UTF8 app.js) | ConvertTo-Json -Depth 2)` → write to a temp file → Read it → paste as the `content` value (avoids hand-escaping quotes/regex/newlines).

To **read back** the currently-deployed files, use `mcp__claude_ai_OpenHEXA__get_static_webapp(workspace_slug, webapp_slug)` — it returns each file's `content` + `encoding` (`TEXT`/`BASE64`). Use this to re-sync or verify the local mirror against what's actually live (the live app is no longer a black box).

**Large-file deploy friction (Read cap).** `files_json` carries file _contents inline_ — the
tool can't read from a path on disk. To author the call the agent must pull the bytes into
context with Read, which caps at ~25k tokens. The orchestrator's `app.js`, once JSON-escaped
(`ConvertTo-Json`), is ~59 KB (~29k tokens), so a single Read **truncates** it. Workaround
(confirmed 2026-06-22): write the escaped string to a temp file, then read it back in slices
with the Bash tool (`cut -c1-20000 file`, `-c20001-40000 file`, …) and concatenate the slices
**exactly** into the `content` value — ideally inside a **subagent** so the large payload stays
out of the main context. Smaller files (`styles.css`, the JSON data files) still read in one go.
**Always verify after a chunked deploy**: re-read live via `get_static_webapp` and diff against
the local copy (e.g. a quick `node -e` length/equality check) — a single dropped/altered char
between slices would break the file. **Manual fallback (offload to the user):** the bottleneck
is only getting bytes _into the agent_, so if the OpenHEXA UI supports replacing files on an
existing webapp, the user can drag the changed file(s) from `<ws>/<app_key>/` (the canonical
local copy) straight into the UI — no size limit. The OpenHEXA **CLI deploys pipelines only, not
static webapps**, so there is no command-line deploy path today (a feature request to the OH devs
is in flight).

### Assembling `files_json` on Windows (PowerShell 5.1)

Splitting an app into html+css+js just means a longer `files_json` array — OpenHEXA serves the
bundle as documented (relative `<link>`/`<script>` resolve same-origin; only `index.html` is
HTML-injected). The friction is building the JSON on Windows, not the deploy:

- **Read as UTF-8 explicitly** — `Get-Content -Raw` defaults to ANSI and mangles non-ASCII
  (`—`, emoji `📄🗂`, glyphs `✓✕⦸`) into mojibake. Use `Get-Content -Raw -Encoding UTF8`.
- **Cast content to `[string]` before `ConvertTo-Json`** — otherwise the property serializes as
  `{value, Count}` and balloons (~50×: a 20 KB bundle became 1.17 MB).
- **Pass the array via `-InputObject`, do NOT pipe it** (confirmed 2026-06-22) — `$arr |
  ConvertTo-Json` (even with the `,$arr` array-preserve comma) re-wraps each element as a
  `{value, Count}` object instead of emitting a plain array of `{path, content}`. Use
  `ConvertTo-Json -InputObject $arr` so you get a real top-level JSON array. Sanity-check the
  output starts with `[`.
- **`ConvertTo-Json` emits `<` `>` `&` `'` as escaped unicode sequences (`\uXXXX`), not
  literal characters** — valid JSON, OpenHEXA parses and serves it fine. Don't "fix" it. (Bonus:
  if you also escape any remaining non-ASCII to `\uXXXX`, the payload is pure ASCII, which makes
  byte-slicing it for read-back split-safe — see the Read-cap workaround above.)

Recipe (build the array, then serialize with `-InputObject` — not a pipe):

```powershell
$arr = @($files | % { [PSCustomObject]@{ path = $_; content = [string](Get-Content -Raw -Encoding UTF8 $_) } })
ConvertTo-Json -InputObject $arr -Depth 5 -Compress | Out-File -Encoding utf8 "$env:TEMP/snt_files_json.json"
```

### Pipeline IDs are workspace-specific

Pipeline **UUIDs** and **codes/slugs** both differ across workspaces for the same pipeline. The only stable identifier is the **Python function name** (e.g. `snt_dhis2_extract`) — this is used as the key in both `pipeline_cards_schema.json` and `workspace_config.json`. When building a new `workspace_config.json`, find the matching pipeline by searching `list_pipelines` results by display name (e.g. "A.1 DHIS2 Extract") — do not rely on the code/slug matching. Never copy UUIDs from another workspace's config.

---

## SNT Pipeline Definitions

`pipeline_cards_schema.json` (repo root) documents the expected structure for workspace-specific `pipeline_cards.json` files — field definitions, type mapping, and generation instructions. Read it when generating or interpreting pipeline data.

Each workspace folder contains a `pipeline_cards.json` — a cached catalog of every pipeline available in that workspace, with display names, UUIDs, and full parameter definitions fetched from GitHub.

**At session start, check whether `<workspace>/pipeline_cards.json` exists:**

- **If yes** — use it as the pipeline catalog. No need to call `list_pipelines` or fetch GitHub sources.
- **If no** — generate it following the `_generation_instructions` in `pipeline_cards_schema.json`, save it to `<workspace>/pipeline_cards.json`, then proceed.

`pipeline_cards.json` is the primary source for: which pipelines exist in the workspace (with UUIDs) and what parameters each pipeline accepts (for building UI cards).

**It is a cache, not live truth — confirm before deploy.** Each file carries a `generated_at`
date; a pipeline's `@parameter` decorators on GitHub can change after that (a renamed/added/
removed param makes runs fail with `The provided config contains invalid key(s): …`). So
before building or deploying any webapp, state the cards' `generated_at` date and ask the user
whether to re-fetch params for **only the pipeline(s) that app will run** (not the whole
catalog) from `…/snt_development/main/{pipeline_id}/pipeline.py`. If they confirm, re-extract
the decorators, patch any drift into both `pipeline_cards.json` (bump `generated_at`) and the
app's `PIPELINE_CONFIG`/form, then deploy.

### How to add or update a pipeline definition

The user will specify which pipelines to include. For each one, fetch its source code from GitHub and extract the parameter definitions directly from the `@parameter` decorators.

**GitHub repository:** `https://github.com/BLSQ/snt_development`

**Finding the pipeline source file:** each pipeline lives in a folder at the repo root named after its Python function name (`{pipeline_id}/pipeline.py`). Fetch the raw file via:

```
https://raw.githubusercontent.com/BLSQ/snt_development/main/{pipeline_id}/pipeline.py
```

Example for `snt_dhis2_extract`:

```
https://raw.githubusercontent.com/BLSQ/snt_development/main/snt_dhis2_extract/pipeline.py
```

Do **not** look inside a `pipelines/` folder — it does not contain the correct source files.

**Extracting parameters:** parameters are declared as `@parameter` decorators stacked above the pipeline function. Read them **top to bottom** — that order is the display order in the UI. Each decorator maps to one entry in the `parameters` array:

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
- The card `name` (display title) and `description` (subtitle) are **not** in the Python source. Get the display name from `list_pipelines` in OpenHEXA or ask the user. Do not invent them.
- The `id` field is the Python function name — the first argument to `@pipeline(...)`, which is also the folder name in the repo and the key in `workspace_config.json`.

---

## Workspace-Specific Configuration

Each workspace has its own folder in this repo, named after the workspace slug with hyphens replaced by underscores (e.g. `snt_testing/`, `snt_drc_workshop_demo/`). Every workspace folder contains:

- **`workspace_config.json`** — resolved IDs for that workspace (pipeline UUIDs, webapp IDs under `deployed_apps`, connection slugs). Looked up via MCP tools. Never copy these IDs from another workspace's folder.
- **One subfolder per deployed webapp**, mirroring every file as it was last deployed to OpenHEXA. A simple single-pipeline webapp is a single `index.html`; the SNT Pipelines Orchestrator is a multi-file bundle (`index.html` + `styles.css` + `app.js` + `pipeline_map.json` + `pipeline_cards.json` — see the multi-file app architecture above). The subfolder name is a short, descriptive snake_case identifier that matches the corresponding key in `deployed_apps` (e.g. `dhis2_reporting_rate/index.html`, `population_transformation/index.html`).

**The agent CAN now read the live webapp's files** via `mcp__claude_ai_OpenHEXA__get_static_webapp(workspace_slug, webapp_slug)` (added in the 2026-06 OH release). It returns metadata, `allowedOperations`, a `permissions` block, and every file's full `content` with an `encoding` field (`TEXT` for UTF-8, `BASE64` for binary). Use the **slug** (from `list_static_webapps`), not the UUID. This means:

- **The live app is now an inspectable source of truth, not a black box.** Before editing an existing webapp, you can pull the deployed files and reconcile them with the local `<workspace>/<app_key>/` copy instead of assuming the two match.
- If the local mirror is missing or stale, re-create it from `get_static_webapp` rather than asking the user to manually download — or build from scratch only if the app doesn't exist yet.
- After every deploy, still write the deployed file(s) to `<workspace>/<app_key>/` so the local copy stays in sync, and you can **verify** the deploy by reading the files back and diffing.
- ✅ `update_static_webapp` supports **partial/incremental deploys** (confirmed live 2026-06-19): send only the changed files in `files_json`; omitted files are left intact, not deleted. The tool's description still says "replace all files," but that's stale. Prefer partial deploys for small edits, and re-verify with `get_static_webapp` afterward (see _MCP deployment_ for details + caveats).

### How to build or update the webapp for a workspace

The agent's job is to produce the correct `<workspace>/<app_key>/index.html` for a given webapp and deploy it. The two source files are:

- **`pipeline_cards_schema.json`** (repo root) — canonical pipeline definitions: which parameters to expose, their types, defaults, and help text. Read this to know what UI to build.
- **`<workspace>/workspace_config.json`** — workspace-specific UUIDs to embed in the JavaScript (`PIPELINE_CONFIG` object). Read this to get the correct `id` values for each pipeline card.

When building or updating `<workspace>/<app_key>/index.html`:

1. Use `pipeline_cards_schema.json` to determine the parameters and card layout for each pipeline.
2. Use `<workspace>/workspace_config.json` to fill in the pipeline UUIDs in the `PIPELINE_CONFIG` JS object.
3. Follow the runtime patterns above (prefixed IDs, shared functions, `allowed_operations`, etc.).
4. Deploy via `mcp__claude_ai_OpenHEXA__update_static_webapp` using `deployed_apps.<app_key>.id` from the workspace config.
5. Write the deployed file(s) to `<workspace>/<app_key>/`.

> For the **SNT Pipelines Orchestrator** specifically, follow the multi-file architecture in
> _SNT Pipelines Orchestrator (end goal)_ above: the map (`pipeline_map.json`, validated
> against `pipeline_map_schema.json`) supplies layout and dependencies, the workspace's
> `pipeline_cards.json` supplies which nodes are active plus their params/UUIDs, and the app
> is deployed as a bundle rather than a single inlined `index.html`.

### Session start workflow

**At the start of any session involving deployment or pipeline operations, always ask the user which OpenHEXA workspace they want to work on before doing anything else.**

Then:

1. Check whether a folder for that workspace already exists (e.g. `snt_testing/`).
2. If yes — read `<workspace>/workspace_config.json` and use the IDs it contains.
3. If no — use `mcp__claude_ai_OpenHEXA__list_workspaces` to find the workspace slug, then `mcp__claude_ai_OpenHEXA__list_pipelines` and `mcp__claude_ai_OpenHEXA__list_static_webapps` to resolve all UUIDs, then create the workspace folder and write `workspace_config.json` before proceeding.

When about to **edit an existing webapp**, consider pulling its live files with `mcp__claude_ai_OpenHEXA__get_static_webapp` first and reconciling them with the local `<workspace>/<app_key>/` mirror — this catches drift (e.g. edits made directly in the OpenHEXA UI) before you overwrite it on the next deploy.

Keys used in `workspace_config.json`:

- `workspace_slug` — used in all MCP tool calls
- `deployed_apps` — keyed by a short snake_case app identifier that also names the local subfolder (e.g. `dhis2_reporting_rate`, `population_transformation`). Each value has `id` (passed to `update_static_webapp`), `slug`, and `url`.
- `pipelines` — keyed by Python function name, value is the UUID passed to `runPipeline`
- `connections` — keyed by type (e.g. `"dhis2"`), value is the connection slug passed as a `DHIS2Connection` parameter
