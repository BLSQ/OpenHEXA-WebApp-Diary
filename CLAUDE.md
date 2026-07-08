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
- **Uploading webapp files** — For any webapp file changes (single files or full bundles), offer the user the option to drag-and-drop changed files directly into the OpenHEXA UI from `app/` (generic files) or `workspaces/<ws>/pipeline_cards.json` (the workspace-specific file) instead of having the agent assemble and deploy via MCP. This avoids reading large files into context and is often faster. Mention it as: *"You can also drag the changed file(s) from `app/` (or `workspaces/<ws>/pipeline_cards.json`) straight into the OpenHEXA webapp settings — no size limit and no agent token cost. Want to do that instead, or shall I deploy via the API?"*

Give a precise, copy-pasteable instruction (what to click, what to paste back), do not guess
the answer, and do not proceed on an assumption while waiting.

## Master plan

The plan of action for the SNT Pipelines Orchestrator lives in `docs/PLAN.md` (phased,
atomic tasks with owner tags). **Read
`docs/PLAN.md` at the start of any session working toward the orchestrator**, and locate
the task being worked on (e.g. "do T1.2") there before starting.

The plan is mirrored to Jira (project `SNT25`, Epic `SNT25-536`). **Giulia manages all Jira
items manually through the Jira UI** — the agent does not create, edit, transition, or link
Jira issues for this project. `docs/JIRA_ITEMS.md` is kept as a human-facing reference and
drafting sheet (issue wording, hierarchy, and conventions) that inspires the manual updates; do
not act on it as an agent task list. Only touch Jira via the Atlassian MCP if Giulia explicitly
asks for it in a given session.

## OpenHEXA GraphQL Schema

A local copy of the OpenHEXA GraphQL schema is stored under `schemas/schema.generated.graphql`.

**Always read this file at the start of any session involving OpenHEXA static web apps or GraphQL operations.**

To refresh the schema if it becomes stale:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql" -OutFile "schemas/schema.generated.graphql"
```

---

## SNT Pipelines Orchestrator (end goal)

The end goal of this project is a single, rich static webapp per workspace — the **SNT
Pipelines Orchestrator** — that renders the _complete_ flow diagram of all official SNT
pipelines (~18, from the `snt_development` repo) as an interactive 2D map with a
configuration/run sidebar. The current small single-pipeline webapps are stepping stones
toward it.

The visual and UX target is the wireframe `design/wireframes/orchestrator_wireframe.html` (a
low-fidelity greyscale layout for UX review), and the product is fully specified in
`docs/PRODUCT_SPEC.md` — **read both at the start of any session working toward the
orchestrator UI.** The layout is a scrollable canvas showing the pipeline map on the left, and
a side panel on the right that — when a node is selected — shows its description, a link to the
pipeline's GitHub README, a generated parameters form, a **Run** button, a link to the live
OpenHEXA run, and (after a run) the data outputs and HTML report links. Node tags mark each
pipeline as mandatory, alternative, or facultative.

**The map is identical across all workspaces.** Every workspace's orchestrator shows the same
full diagram. What differs per workspace is only which nodes are _active_ — pipelines not
available in a given workspace appear greyed-out and unclickable.

### Data architecture

The orchestrator separates concerns across three kinds of file. The stable join key everywhere
is the node `id` == the pipeline's Python function name (e.g. `snt_dhis2_extract`).

| File                                   | Scope                                                  | Holds                                                                                          |
| -------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `app/pipeline_map.json`                | **workspace-independent** (one shared file)            | all nodes, grid position (`row`/`col`), `type`, mutex `group`, directed `edges` (dependencies) |
| `workspaces/<ws>/pipeline_cards.json`  | per-workspace                                          | which pipelines exist + `uuid` + `parameters` (drives _active vs greyed_)                      |
| `app/index.html` + `app/app.js` + `app/styles.css` | shared app shell (multi-file)             | renders the map, merges it with the workspace cards, runs/polls pipelines                      |

**Generic vs workspace-specific:** the deployed bundle is **5 files — 4 generic + 1
workspace-specific.** Generic (reused unchanged in every workspace, all under `app/`):
`index.html`, `styles.css`, `app.js`, `pipeline_map.json`. Workspace-specific (the only file
that changes per workspace): `workspaces/<ws>/pipeline_cards.json`. The app self-adapts at
runtime via `window.OPENHEXA.workspaceSlug` + cards-driven greying, so the only non-per-workspace
assumption baked into `app.js` is the hardcoded SaaS base `https://app.openhexa.org`. → **new
workspace = same 4 generic files (`app/`) + a new `workspaces/<ws>/pipeline_cards.json`.** (See
README's "Generic vs workspace-specific" for the human-facing version.)

Webapp metadata (id, slug, URL, allowed scopes) is **not** stored in the repo — it is resolved
live at deploy time via `list_static_webapps` / `get_static_webapp` (see _Build / deploy
workflow_). The `app/` bundle plus `workspaces/<ws>/pipeline_cards.json` is the repo's source of
truth for what to deploy.

`schemas/pipeline_map.schema.json` documents the structure of `app/pipeline_map.json` — read
it when authoring or interpreting the map (its `_generation_instructions` also cover the
edge/node-type conventions and the per-member-edge rule for alternative groups).
`design/pipeline_map_preview.html` is a standalone visual render of the map for review. The map
is **hand-authored** (a separate task); it is not generated from the GraphQL API.

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
  **Group-aware unlock:** when several solid prerequisites of a node belong to the same
  alternative `group`, they count as _one_ — only one member of the group need complete.
  Formally: bucket the solid sources of node `N` by their `group` (a source with no `group` is
  its own bucket of size 1) and require **at least one completed source per bucket**; a
  non-grouped prerequisite is just a size-1 bucket, so this generalizes the simple rule. This
  only bites for a **solid edge leaving an alternative group** — the current map has none
  (A.3→A.4 became `optional` on 2026-06-24), so it is dormant future-proofing, but any future
  solid edge out of a group must honor it rather than requiring _all_ members.
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

- Resolve the target webapp's `id`/`slug` **live** via `list_static_webapps` (there is no
  `workspace_config.json` any more). Deploy via `mcp__claude_ai_OpenHEXA__update_static_webapp`
  with that `id` and `files_json` as the multi-file array: one `{path, content}` object per file
  in the bundle above. The files to send are `app/*` (generic) + that workspace's
  `workspaces/<ws>/pipeline_cards.json`.
- `allowed_operations`: at minimum `PIPELINES_READ, PIPELINES_RUN, FILES_READ`. Add
  `USER_READ` if the app queries workspace connections at runtime (to populate
  `DHIS2Connection` dropdowns).
- **The repo is the source of truth**, not a per-workspace mirror: the generic bundle lives once
  under `app/`, and each workspace contributes only `workspaces/<ws>/pipeline_cards.json`. After
  a deploy, keep those files in sync (e.g. if you regenerated a workspace's cards, save them back
  to `workspaces/<ws>/pipeline_cards.json`; if you changed the app, it's already committed under
  `app/`). **Partial deploys work** — `files_json` may carry only the files that changed (the
  others are left intact); you do **not** have to resend the whole bundle every time (see _MCP
  deployment_ below for the confirmation + caveats). You can read the live files back with
  `get_static_webapp` to verify the deploy or to diff against the repo.

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

**The orchestrator requires four scopes: `PIPELINES_READ, PIPELINES_RUN, FILES_READ, USER_READ`.**
`USER_READ` is the one most easily forgotten — it's needed for the `workspace { connections }`
query that powers the **DHIS2-connection dropdown** in the parameter form (T2.2). Without it the
proxy rejects that query with `Operations not allowed: workspace` and the form silently falls
back to a plain text slug input (the connection dropdown just never appears — the app doesn't
otherwise break). This bit `snt-testing` (created June with only the first three; `USER_READ`
added 2026-06-23). To check the scopes actually granted to a deployed app, read them **live**
with `get_static_webapp` (it returns `allowedOperations`) — that is now the source of truth, so
drift is caught by inspecting the live webapp rather than a stored config file.

**Scopes are webapp metadata, not part of the deployed bundle.** They live on the platform's
webapp object, set **once per webapp at create/update time** — not re-sent with every file
deploy, and not derivable from the files. So porting the orchestrator to a new workspace is:
(1) create the webapp **with the four scopes**, then (2) deploy the 4 generic files + that
workspace's `pipeline_cards.json`. Three ways to set the scopes:

- **OpenHEXA UI** — the webapp settings page has an **"Allowed operations"** checklist (confirmed
  2026-06-23 — Giulia can tick the four by hand; no agent/API needed).
- **MCP** — `update_static_webapp` / `create_static_webapp` with the `allowed_operations`
  parameter (comma-separated).
- **Raw GraphQL** — the management mutation against the main OH API (`app.openhexa.org/graphql/`,
  authenticated as the user — **not** the webapp's own `/graphql/` proxy, which can't grant its
  own scopes). `createWebapp` takes the same `allowedOperations` on creation:

  ```graphql
  mutation ($input: UpdateWebappInput!) {
    updateWebapp(input: $input) { success errors webapp { id allowedOperations } }
  }
  # variables:
  # { "input": { "id": "<webapp-uuid>",
  #              "allowedOperations": ["PIPELINES_READ","PIPELINES_RUN","FILES_READ","USER_READ"] } }
  ```

  `allowedOperations` is a `[WebappOperationScope!]` enum: `PIPELINES_READ`, `PIPELINES_RUN`,
  `FILES_READ`, `FILES_WRITE`, `DATASETS_READ`, `DATASETS_WRITE`, `USER_READ`. ⚠️ A scope-only
  re-apply has been seen to echo stale scopes on the first call — **re-verify with
  `get_static_webapp` after changing scopes** (a no-files re-apply makes it stick).

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

**Partial / incremental deploys work (confirmed live 2026-06-19).** Despite the tool's own description still saying "replace all files," `files_json` may contain **only the files that changed** — the omitted files are left untouched, _not_ deleted. Verified by deploying `app.js` alone to the orchestrator and reading back with `get_static_webapp`: all other files (CSS, HTML, both JSON) survived intact. This is the **preferred** way to ship a small change: send just that one file, no need to rebuild/re-escape the whole ~88 KB bundle. Caveats: (1) it's confirmed on the SaaS as of 2026-06-19 — if a future deploy ever shows files vanishing, fall back to sending the full set; (2) **always re-verify with `get_static_webapp` after a partial deploy** (confirm the expected file count + that your change landed) until the behavior is battle-tested; (3) keep the full bundle reproducible from the repo (`app/` + `workspaces/<ws>/pipeline_cards.json`) so a full re-deploy is always possible. Assembling a single file's `content` inline on Windows: `([string](Get-Content -Raw -Encoding UTF8 app.js) | ConvertTo-Json -Depth 2)` → write to a temp file → Read it → paste as the `content` value (avoids hand-escaping quotes/regex/newlines).

To **read back** the currently-deployed files, use `mcp__claude_ai_OpenHEXA__get_static_webapp(workspace_slug, webapp_slug)` — it returns each file's `content` + `encoding` (`TEXT`/`BASE64`). Use this to verify a deploy or diff the live app against the repo (`app/` + `workspaces/<ws>/pipeline_cards.json`) — the live app is no longer a black box.

**Large-file deploy friction (Read cap).** `files_json` carries file _contents inline_ — the
tool can't read from a path on disk. To author the call the agent must pull the bytes into
context with Read, which caps at ~25k tokens. The orchestrator's `app.js`, once JSON-escaped
(`ConvertTo-Json`), is ~59 KB (~29k tokens), so a single Read **truncates** it. 

**PREFERRED: Manual UI upload.** The bottleneck is only getting bytes _into the agent_. For any
file changes, **offer the user the option to drag the changed file(s) from `app/` (generic) or
`workspaces/<ws>/pipeline_cards.json` (the canonical local copies) straight into the OpenHEXA
UI** — no agent Read, no token cost, no size limit. This is the fastest and cheapest path and should be offered as the default unless the user prefers automation.

**If API deploy is necessary** (confirmed 2026-06-22): write the escaped string to a temp file,
then read it back in slices with the Bash tool (`cut -c1-20000 file`, `-c20001-40000 file`, …)
and concatenate the slices **exactly** into the `content` value — ideally inside a **subagent**
so the large payload stays out of the main context. Smaller files (`styles.css`, the JSON data
files) still read in one go. **Always verify after a chunked deploy**: re-read live via
`get_static_webapp` and diff against the local copy (e.g. a quick `node -e` length/equality
check) — a single dropped/altered char between slices would break the file. The OpenHEXA
**CLI deploys pipelines only, not static webapps**, so there is no command-line deploy path
today (a feature request to the OH devs is in flight).

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

Pipeline **UUIDs** and **codes/slugs** both differ across workspaces for the same pipeline. The only stable identifier is the **Python function name** (e.g. `snt_dhis2_extract`) — this is used as the key in `schemas/pipeline_cards.schema.json` and as the `id` in `app/pipeline_map.json`. The app gets pipeline UUIDs at runtime from `pipeline_cards.json` (which is fetched alongside the app bundle). Never copy UUIDs from another workspace's `pipeline_cards.json`.

---

## SNT Pipeline Definitions

`schemas/pipeline_cards.schema.json` documents the expected structure for workspace-specific `pipeline_cards.json` files — field definitions, type mapping, and generation instructions. Read it when generating or interpreting pipeline data.

Each workspace has a `workspaces/<ws>/pipeline_cards.json` — a cached catalog of every pipeline available in that workspace, with display names, UUIDs, and full parameter definitions fetched from GitHub.

**At session start, check whether `workspaces/<ws>/pipeline_cards.json` exists:**

- **If yes** — use it as the pipeline catalog. No need to call `list_pipelines` or fetch GitHub sources.
- **If no** — generate it following the `_generation_instructions` in `schemas/pipeline_cards.schema.json`, save it to `workspaces/<ws>/pipeline_cards.json`, then proceed.

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
- The `id` field is the Python function name — the first argument to `@pipeline(...)`, which is also the pipeline's folder name in the `snt_development` repo and the node `id` in `app/pipeline_map.json`.

---

## Workspace-Specific Configuration

The repo keeps **generic** and **workspace-specific** artifacts physically separate:

- **`app/`** — the generic orchestrator bundle (`index.html`, `styles.css`, `app.js`,
  `pipeline_map.json`), shared by every workspace. Single source of truth for the app; there
  are no per-workspace copies.
- **`workspaces/<ws>/pipeline_cards.json`** — the **only** per-workspace file: that workspace's
  cached pipeline catalog (names, UUIDs, parameters). `<ws>` is the workspace slug with hyphens
  (e.g. `snt-app-dev`). Never copy UUIDs from another workspace's cards.
- **`schemas/`**, **`docs/`**, **`design/`** — contracts, consolidated docs, and WIP/design
  explorations respectively.
- **`archive/`** — retired spikes and pre-orchestrator single-file webapps, kept for reference
  only (not deployed, not maintained).

Webapp identity and scopes (`id`, `slug`, `url`, `allowedOperations`) are **not** stored in the
repo — resolve them live via `list_static_webapps` / `get_static_webapp` whenever you deploy or
inspect an app.

**The agent CAN now read the live webapp's files** via `mcp__claude_ai_OpenHEXA__get_static_webapp(workspace_slug, webapp_slug)` (added in the 2026-06 OH release). It returns metadata, `allowedOperations`, a `permissions` block, and every file's full `content` with an `encoding` field (`TEXT` for UTF-8, `BASE64` for binary). Use the **slug** (from `list_static_webapps`), not the UUID. This means:

- **The live app is an inspectable source of truth, not a black box.** Before editing an existing webapp, pull the deployed files and diff them against the repo (`app/` + `workspaces/<ws>/pipeline_cards.json`) to catch drift (e.g. edits made directly in the OpenHEXA UI).
- To build a workspace's deploy set, combine `app/*` with that workspace's `workspaces/<ws>/pipeline_cards.json` — there is no per-app mirror folder to assemble.
- After a deploy, **verify** by reading the files back with `get_static_webapp` and diffing against the repo.
- ✅ `update_static_webapp` supports **partial/incremental deploys** (confirmed live 2026-06-19): send only the changed files in `files_json`; omitted files are left intact, not deleted. The tool's description still says "replace all files," but that's stale. Prefer partial deploys for small edits, and re-verify with `get_static_webapp` afterward (see _MCP deployment_ for details + caveats).

### How to build or update the webapp for a workspace

The agent's job is to keep the `app/` bundle correct and each workspace's
`workspaces/<ws>/pipeline_cards.json` accurate, then deploy. The primary source files are:

- **`schemas/pipeline_cards.schema.json`** — canonical pipeline definitions: which parameters to expose, their types, defaults, and help text.
- **`workspaces/<ws>/pipeline_cards.json`** — workspace-specific catalog with pipeline UUIDs and parameter definitions. Fetched at runtime by the app.
- **`app/pipeline_map.json`** (+ `schemas/pipeline_map.schema.json`) — the shared map and its contract.

When building or updating the orchestrator for a workspace:

1. Use `schemas/pipeline_cards.schema.json` and `workspaces/<ws>/pipeline_cards.json` to determine which pipelines exist and what UI to build.
2. Edit the generic app under `app/` (shared by all workspaces); edit only `workspaces/<ws>/pipeline_cards.json` for per-workspace changes.
3. Follow the runtime patterns above (prefixed IDs, shared functions, `allowed_operations`, etc.).
4. Resolve the webapp `id` via `list_static_webapps`, then deploy via `mcp__claude_ai_OpenHEXA__update_static_webapp` with `app/*` + `workspaces/<ws>/pipeline_cards.json`.
5. Keep the repo in sync (save any regenerated cards back to `workspaces/<ws>/pipeline_cards.json`).

> For the **SNT Pipelines Orchestrator** specifically, follow the multi-file architecture in
> _SNT Pipelines Orchestrator (end goal)_ above: the map (`app/pipeline_map.json`, validated
> against `schemas/pipeline_map.schema.json`) supplies layout and dependencies, the workspace's
> `workspaces/<ws>/pipeline_cards.json` supplies which nodes are active plus their params/UUIDs,
> and the app is deployed as a bundle rather than a single inlined `index.html`.

### Session start workflow

**At the start of any session involving deployment or pipeline operations, always ask the user which OpenHEXA workspace they want to work on before doing anything else.**

Then:

1. Check whether `workspaces/<ws>/pipeline_cards.json` already exists (`<ws>` = the workspace slug, hyphens).
2. If yes — use it as the pipeline catalog; resolve the webapp `id`/`slug` live via `list_static_webapps` when you need to deploy or inspect.
3. If no — use `mcp__claude_ai_OpenHEXA__list_workspaces` to find the workspace slug, `mcp__claude_ai_OpenHEXA__list_pipelines` to resolve pipeline UUIDs, generate `workspaces/<ws>/pipeline_cards.json` (per the schema's `_generation_instructions`), and use `mcp__claude_ai_OpenHEXA__list_static_webapps` to find the webapp when deploying.

When about to **edit an existing webapp**, pull its live files with `mcp__claude_ai_OpenHEXA__get_static_webapp` first and diff them against the repo (`app/` + `workspaces/<ws>/pipeline_cards.json`) — this catches drift (e.g. edits made directly in the OpenHEXA UI) before you overwrite it on the next deploy.

Resolving workspace / app identifiers (all **live** — nothing stored in the repo):

- **workspace slug** — from `list_workspaces`; used in all MCP tool calls (and injected at runtime as `window.OPENHEXA.workspaceSlug`).
- **webapp `id` / `slug` / `url` / `allowedOperations`** — from `list_static_webapps` / `get_static_webapp`. `id` is passed to `update_static_webapp`; `slug` to `get_static_webapp`.
