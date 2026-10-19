# Project Context

> ⚠️ **Cleanup in progress — layout changed, prose being rewritten** (see local `ignore/PLAN.md`).
> The repo is **cockpit-only**: the bundle is `webapps/orchestrator/`; the Flowchart variant is
> parked in `deprecated/flowchart/`.

**Doc hygiene:** this file states current truth only. History lives in git (and, from Phase 3, in
ADRs under `docs/decisions/`); open items go to the backlog, not into prose here.

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
  them. (The `PreToolUse` hook `.claude/hooks/block-destructive-git.js` hard-blocks the
  destructive commands above — treat that block as expected, not an error to work around.)

### 2. Hand small, faster-by-hand tasks back to the user

When a step would be quicker or more reliable for the user to do manually than for the agent to
automate, **stop and ask the user to do it**, then wait for their result before continuing.
This includes:

- Looking up URLs / paths / IDs in the OpenHEXA UI.
- Checking the browser DevTools **Console** / Network tab when a deployed webapp misbehaves.
- Reading a value off a dashboard, or visually confirming something in a running app.
- **Uploading webapp files (wholesale rewrites / new bundles)** — for a full bundle upload or a
  wholesale rewrite of a large file, offer the user the option to drag-and-drop the changed files
  from `webapps/orchestrator/` into the webapp in the OpenHEXA UI instead of having the agent
  deploy via MCP. Mention it as: *"You can also drag the changed file(s) from
  `webapps/orchestrator/` straight into the webapp in OpenHEXA — no agent token cost. Want to do
  that instead, or shall I deploy via the API?"* Small, targeted edits to an existing file don't
  need this offer — `mcp__claude_ai_OpenHEXA__edit_static_webapp_file` (see _MCP deployment_)
  handles those directly.

Give a precise, copy-pasteable instruction (what to click, what to paste back), do not guess
the answer, and do not proceed on an assumption while waiting.

## Master plan & versions

The product definition and the phased **v0 / v1 / v2 roadmap** for the SNT Pipelines Orchestrator
live in `docs/PRODUCT_SPEC.md` (Part C — Versioning). **Read `docs/PRODUCT_SPEC.md` at the start
of any session working toward the orchestrator** to locate the current scope and which version a
piece of work targets. Task tracking lives in Jira.

Work is tracked in Jira (project `SNT25`, Epic `SNT25-536`). **Giulia manages all Jira items
manually through the Jira UI** — the agent does not create, edit, transition, or link Jira issues
for this project. Only touch Jira via the Atlassian MCP if Giulia explicitly asks for it in a
given session.

## OpenHEXA GraphQL Schema

A local copy of the OpenHEXA GraphQL schema is stored under
`reference/openhexa/schema.generated.graphql`. **At the start of any session involving OpenHEXA
static web apps or GraphQL operations, grep it for the types you need** (it is large — don't read
it whole).

To refresh the schema if it becomes stale:

```bash
curl -fsSL -o reference/openhexa/schema.generated.graphql https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql
```

**`mcp__claude_ai_OpenHEXA__get_help_or_doc`** — call it with no topic for an orientation
overview, or with a topic for a full reference page: `cli`, `notebooks-advanced`, `sdk`,
`sql-widgets`, `static-webapps`, `toolbox-dhis2`, `toolbox-hexa`, `toolbox-iaso`,
`writing-pipelines`. The `static-webapps` topic documents the three webapp types (Static / Iframe /
Superset), the GraphQL scope table, example webapps, the `window.OPENHEXA` global (see
_Platform-injected global_), the proxy's Origin check, and the `dev.js` local-development flow
(see _Local development against a live workspace_). It does **not** mention
`edit_static_webapp_file`, `get_static_webapp_file`, `get_static_webapp`, or
`update_static_webapp` — those are MCP-only conveniences on top of the public API; this repo's
_MCP deployment_ section is their only reference.

`propose_webapp_version` / `propose_pipeline_version` appear in the schema's `AssistantToolName`
enum: they belong to the in-app OpenHEXA Assistant, not to our MCP server — ignore them.

---

## SNT Pipelines Orchestrator (end goal)

The end goal of this project is a single, rich static webapp per workspace — the **SNT
Pipelines Orchestrator** — that presents the _complete_ set of official SNT pipelines (18 map
nodes, from the `snt_development` repo) as one guided, interactive surface with a
configuration/run panel. Its bundle is `webapps/orchestrator/`. The earlier small single-pipeline
webapps were the stepping stones toward it and are **retired to `deprecated/`** (reference only —
not maintained).

The visual/UX target is the wireframe `design/wireframes/orchestrator_wireframe_cockpit.html`. The
product is fully specified in `docs/PRODUCT_SPEC.md`, which separates **functionality** (Part A)
from the **UI** (Part B) and the **v0 / v1 / v2 roadmap** (Part C) — **read the wireframe +
PRODUCT_SPEC at the start of any session working toward the orchestrator UI.** Node tags mark each
pipeline as mandatory, alternative, or facultative.

**The map is identical across all workspaces.** Every workspace's orchestrator shows the same full
set of steps. What differs per workspace is only which nodes are _active_ — pipelines not
available in a given workspace appear greyed-out and unclickable.

### The app

`webapps/orchestrator/` is the Cockpit UX — a focused, one-step-at-a-time guided walkthrough,
**bilingual EN / FR**, with the in-app HTML report embed. (The former Flowchart variant, a 2D
node/edge map, is parked in `deprecated/flowchart/` with its spec in
`deprecated/flowchart/SPEC.md`.) Which workspaces run the app is not tracked in the repo — resolve
webapps live with `list_static_webapps`.

The deployed bundle is the **5 files in `webapps/orchestrator/`** (flat — deployed as-is) and is
**fully workspace-independent**. The workspace's pipeline catalog is _not_ deployed — it is read
live from the workspace bucket (see _The pipeline catalog_).

### Data architecture

The orchestrator separates concerns across four kinds of file. The stable join key everywhere
is the node `id` == the pipeline's Python function name (e.g. `snt_dhis2_extract`).

⚠️ **`pipeline_cards.json` is not a repo file** — it lives in each OpenHEXA workspace's own bucket
and is read at runtime (see _The pipeline catalog_). Never create a per-workspace folder for it in
the repo.

| File | Scope | Holds |
| --- | --- | --- |
| `webapps/orchestrator/pipeline_map.json` | workspace-independent (bundle) | all nodes, `code`, bilingual `label`, `ohName`, stage `row` (+ legacy `col`), `track`, `type`, mutex `group`, directed `edges` (dependencies) |
| `webapps/orchestrator/pipeline_descriptions.json` | workspace-independent (bundle) | hand-authored, Markdown-lite-formatted paragraph description per node, keyed by `id`; each value is a bilingual `{ en, fr }` object |
| `pipeline_cards.json` **(in the workspace bucket, not the repo)** | per-workspace | which pipelines exist + `uuid` + `parameters` (drives _active vs greyed_) |
| `webapps/orchestrator/index.html` + `app.js` + `styles.css` | app shell (multi-file) | renders the UI, merges the map + descriptions with the workspace cards, runs/polls pipelines |

#### The pipeline catalog (`pipeline_cards.json`) — bucket-hosted, read at runtime

The catalog is **not bundled and not kept in the repo**. It lives in the workspace's own file
storage at the fixed **bucket key**

```
utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json
```

and is written there by the companion **`create_pipeline_cards`** pipeline, whose source is in this
repo under `pipelines/create_pipeline_cards/` (see its own `README.md`). **Why:** a config change
(a new pipeline installed, a parameter renamed) is then just a pipeline run — no webapp redeploy,
no repo commit.

How the app reads it (`loadCards()` in `webapps/orchestrator/app.js`):

1. `prepareObjectDownload(input: {workspaceSlug, objectKey: CARDS_OBJECT_KEY, forceAttachment: false})`
   through the same-origin `/graphql/` proxy → a signed GCS URL. Needs **`FILES_READ`**.
2. `fetch(signedUrl)` → `.json()`. Works because those signed URLs are CORS-open (the same
   property the report embed relies on — see _Embedding an HTML report in-app_).

Rules that follow from this:

- ⚠️ **Bucket key ≠ repo path.** `CARDS_OBJECT_KEY` (top of `webapps/orchestrator/app.js`) must stay
  in lockstep with `pipelines/create_pipeline_cards/config.py` (`OUTPUT_DIR` + `WEBAPP_CARDS_PATH`)
  — two places. The `utils_pipelines/…` prefix is a runtime path in every workspace bucket; it
  does **not** follow the repo layout. Changing it means changing both places, redeploying the
  webapp and the generator, and re-running the generator in every workspace — otherwise every
  deployed app fails at boot.
- **The generator curates against the _deployed_ map** of the webapp named by its
  `config.WEBAPP_SLUG` (`snt-pipelines-orchestrator-cockpit`), not the repo copy.
- **There is no fallback, by design.** If the object is missing the app **fails at boot** with an
  actionable message ("Run the `create_pipeline_cards` pipeline") rather than silently serving a
  stale bundled copy. It is surfaced in the `boot.failed` panel (i18n keys `boot.cardsMissing` /
  `boot.cardsUnreadable` / `boot.noWorkspace`).
- ⚠️ **Every workspace must have `create_pipeline_cards` deployed and run before its orchestrator
  will boot.** The generator takes **no parameters** (just Run), but its run **fails** if the
  webapp named by `WEBAPP_SLUG` is not deployed in that workspace. So when standing up a new
  workspace: **deploy the orchestrator first, then run the generator.**
- **When the catalog is unreadable the app diagnoses _why_ and links to the fix**, rather than
  showing one generic message — see _Diagnosing a missing catalog from inside the app_ below.
- **Parameters come from the deployed pipeline version, not from GitHub.** The generator reads
  `pipelineByCode.currentVersion.parameters`, so the catalog matches what is actually installed in
  the workspace (see _SNT Pipeline Definitions_).

**Alternative not taken: `workspace.configuration`.** `Workspace.configuration: JSON!` is a
workspace-wide JSON dictionary a pipeline can write (SDK `workspace.configuration = config`, or
the `updateWorkspace` mutation), and the webapp could read it with **no new scope** (`USER_READ`
grants `workspace`). ⚠️ **Do not migrate the catalog to it on a whim.** The bucket path works,
versions each run under `historical/`, and handles a 35–60 KB payload comfortably;
`configuration` is a single blob with no history and no obvious size guarantee.

##### Diagnosing a missing catalog from inside the app

When `loadCards()` can't read the catalog, the app runs **one extra `pipelines(workspaceSlug:)`
query** — the same query as _Reading last-run status_, so it needs **no scope beyond
`PIPELINES_READ`** — works out which of these situations the workspace is in, and shows the
matching message with a deep link:

| Diagnosis       | What the app tells the user                                        |
| --------------- | ------------------------------------------------------------------ |
| `notInstalled`  | install the generator → link to its **template** page              |
| `neverRun`      | open the pipeline page and press Run                               |
| `inProgress`    | a run is `queued` / `running` / `terminating` — wait; link to it    |
| `lastRunFailed` | link straight to the failed run's logs                             |
| `unknown`       | fallback to the generic "run `create_pipeline_cards`" text         |

Implementation, near the top of `webapps/orchestrator/app.js`: `GENERATOR_QUERY`,
`looksLikeGenerator`, `diagnoseMissingCatalog`, `generatorTemplateUrl` / `generatorPipelineUrl` /
`generatorRunUrl`, `missingCatalogError`. (`diagnoseMissingCatalog` is also reused by the
run-error drift hint — see _Running a pipeline_ — so it resolves the generator's state generally,
despite the name.)

Three things to know before touching it:

- **The generator's `code` and `name` vary by how it was installed** — e.g.
  `create-pipeline-cards` (source deploy), `create_pipeline_cards`, and `Create pipeline_cards.json`
  (template install). So **never hardcode its code**: `looksLikeGenerator` lowercases `code`/`name`,
  strips non-alphanumerics, and tests for `pipelinecards` (`GENERATOR_KEY_MATCH`). Links are then
  built from whatever `code` the query actually returned.
- **The template deep link** is
  `https://app.openhexa.org/workspaces/<ws>/templates/Create%20pipeline_cards.json` — i.e.
  `/templates/` + the URL-encoded template **display name**, not a slug. That name is
  `GENERATOR_TEMPLATE_NAME` in `app.js`; if the template is ever renamed, the link breaks silently.
- ⚠️ **DOM route: `innerHTML` with caller-side escaping.** The boot panel and run-status lines are
  set via `innerHTML`: build a pre-escaped HTML string (`missingCatalogError` attaches it as
  `err.htmlMessage`), and any dynamic value passed through `t()` must already be escaped. Handing
  unescaped data to these is an injection.

`webapps/orchestrator/pipeline_descriptions.json` is the single, hand-authored source of node
description text — see `contracts/pipeline_descriptions.schema.json` for the contract and the
Markdown-lite formatting rules (bold/italic/line breaks; no headers, links, or lists). It is
fetched as a same-origin sibling of `app.js`.

⚠️ **Its values are bilingual objects, not strings** — `{ "en": "…", "fr": "…" }`, both holding
the same Markdown-lite prose. **Editing a description means editing both languages.** A plain
string is still accepted and treated as `en`. See _Bilingual UI_ below.

**Generic vs workspace-specific:** the deployed bundle is **5 files, all in
`webapps/orchestrator/`** (`index.html`, `styles.css`, `app.js`, `pipeline_map.json`,
`pipeline_descriptions.json`) **and nothing workspace-specific at all.** The app self-adapts at
runtime via `window.OPENHEXA.workspaceSlug` — which also drives the catalog read — plus
cards-driven greying. The only platform assumptions baked into `app.js` are the hardcoded SaaS
base `https://app.openhexa.org` and the generator's template display name
(`GENERATOR_TEMPLATE_NAME`). → **New workspace = deploy the same 5 files, then run
`create_pipeline_cards` in that workspace.**

Webapp metadata (id, slug, URL, allowed scopes) is **not** stored in the repo — it is resolved
live via `list_static_webapps` / `get_static_webapp` (see _Build / deploy workflow_). The repo is
the reference source for the latest version of the app, **not a record of what is deployed
where**. `webapps/orchestrator/` is the complete source of truth for what to deploy; the
per-workspace half of the picture lives in the workspace bucket and is produced by running a
pipeline, not by committing a file.

`contracts/pipeline_map.schema.json` documents the structure of
`webapps/orchestrator/pipeline_map.json` — read it when authoring or interpreting the map (its
`_generation_instructions` also cover the edge/node-type conventions and the per-member-edge
rule for alternative groups). `design/pipeline_map_preview.html` is a standalone visual render of
the map for review. The map is **hand-authored**; it is not generated from the GraphQL API.

### Node states

The webapp computes three independent state axes per node:

- **available vs greyed** — _static_: a node is available iff its `id` is present in the
  workspace's bucket-hosted `pipeline_cards.json` (with a `uuid`). Otherwise it renders greyed-out
  and is unclickable. This is how the same full map adapts to each workspace — and, since the
  catalog is regenerated by running `create_pipeline_cards`, how a newly-installed pipeline
  becomes clickable without touching the webapp.
- **completed** — the pipeline's **most recent run in the workspace** succeeded (read from the
  cross-session status board, _Reading last-run status_; `cockpitState(node) === "ok"`). It is
  not limited to runs started in the current session.
- **locked vs unlocked** — _dynamic_: derived from `edges`. A node unlocks once every **hard**
  upstream prerequisite (each edge whose `to` equals this node and whose `type` is `"solid"` or
  omitted) is completed. `type: "optional"` edges are **soft, non-gating** — they are listed as
  "uses if available" but do not lock the downstream node (its output is used if available, else
  a parameter fallback applies). When run status is unavailable (opened outside OpenHEXA, or the
  status query was blocked) nothing is locked, so the walkthrough stays explorable.
  **Group-aware unlock:** when several solid prerequisites of a node belong to the same
  alternative `group`, they count as _one_ — only one member of the group need complete.
  Formally: bucket the solid sources of node `N` by their `group` (a source with no `group` is
  its own bucket of size 1) and require **at least one completed source per bucket**
  (`lockedReason()`). The current map has no solid edge leaving a group, so this is dormant
  future-proofing, but any future solid edge out of a group must honor it rather than requiring
  _all_ members.

**Mutual exclusion:** nodes of `type: "alternative"` that share the same `group` are mutually
exclusive — the group member with the most recent successful run is the one "in use"
(`computeGroupInUse()`); data-driven via `group`, not hardcoded (the A.3 outlier-imputation and
A.4 reporting-rate groups).

### Map format

Order and dependencies are **explicit**, with no graph-layout library or CDN dependency:

- The **array order of `nodes` is the walkthrough order** (an alternative group becomes one
  "choose one" step at its first member). `row` is the walkthrough stage (0=Extract … 4=Outputs),
  `track` the data track (A–D). `col` is a leftover 2D coordinate the app does not read (see
  `contracts/pipeline_map.schema.json`).
- `edges` is a list of `{from, to, type}` objects referencing node `id`s; the app uses them for
  each step's Requires / Unlocks / Uses-if-available lists and for locking. `type` is `"solid"`
  or omitted (hard dependency — gates unlocking) or `"optional"` (soft link — listed but does not
  gate).
- Dependencies are expressed **only** as `edges`. There is no per-node prerequisite array and
  no separate layout array — order comes from the `nodes` array, and mutual exclusion from each
  node's `group`.
- **Outputs are not stored in the map or cards.** They are fetched at runtime from
  `pipelineRun.outputs` after a run (see the polling pattern below).

### Bilingual UI (EN / FR)

French is the **main interface language for v1** (nearly all users are French-speaking). It is
implemented as **one webapp with a language toggle**, not as separate per-language builds. Do not
"flatten" the nested `{ en, fr }` data shape.

Where each kind of text comes from, and how it's resolved:

| Tier                                          | Source                                              | Mechanism                              |
| --------------------------------------------- | --------------------------------------------------- | -------------------------------------- |
| App chrome (buttons, statuses, section titles) | the `I18N` table inside `webapps/orchestrator/app.js` | `t("key", {params})`                 |
| Node / step titles                            | `webapps/orchestrator/pipeline_map.json` → `label`   | `pickLang(label)`                      |
| Node descriptions                             | `webapps/orchestrator/pipeline_descriptions.json` → `{ en, fr }` | `pickLang(desc)`          |
| **Parameter labels / help / choices**          | the workspace's bucket-hosted `pipeline_cards.json`  | **not translated — English for now**   |

Key rules when touching app text:

- **`pickLang(v)`** resolves a possibly-bilingual data value: an `{ en, fr }` object picks the
  active language, falls back to `en`, then to `""`; a plain string is returned as-is (so legacy
  flat data keeps working).
- **`t(key, params)`** looks up chrome strings; a missing key falls back to English, then to the
  key itself (so a typo renders visibly rather than silently blank). **Add every new chrome
  string to _both_ `I18N.en` and `I18N.fr`.**
- **Structural fields are never translated:** `id`, `code`, `type`, `group`, `row`/`col`,
  `track`, and `ohName` (`ohName` mirrors the pipeline's name in OpenHEXA so users can find it
  there; it is display-only — matching is by `id`).
- **Language resolution order** (at boot): `?lang=` query param (wins, and is persisted) →
  `localStorage["snt_lang"]` → default `en`. Switching language sets `LANG`, rebuilds the steps,
  and re-renders everything from scratch — there is no partial-update path to maintain.

⚠️ The **French strings in `I18N.fr` are drafts pending Giulia's review** (per the code comment in
`webapps/orchestrator/app.js`). Do not present them as final copy.

### Multi-file app architecture

OpenHEXA static webapps serve more than just `index.html`: `index.html` is the entry point, and
everything else (CSS, JS, images, JSON) is served as-is from the same origin. Reference assets with
relative paths (`<script src="app.js">`, `<link href="styles.css">`). Platform injection only
touches `text/html` responses; CSS, JS, and JSON files are untouched.

So the orchestrator is a **multi-file bundle**, not one giant file. These **five files live
together, flat, in `webapps/orchestrator/`**:

- `index.html` — minimal shell (containers + `<link rel="stylesheet" href="styles.css">` and
  `<script src="app.js">`; also the header appbar and the EN/FR toggle)
- `styles.css` — all styling
- `app.js` — render the UI, merge map + descriptions with cards, run + poll pipelines
- `pipeline_map.json` — the map, fetched at runtime
- `pipeline_descriptions.json` — node description text (see _Data architecture_)

`app.js` fetches the two bundled JSON files as same-origin siblings. The third JSON the app needs,
`pipeline_cards.json`, is **not a sibling and not in the bundle** — it is fetched from the
workspace bucket via a signed URL (see _The pipeline catalog_). The shared runtime patterns below
(the `gql` helper, status polling, `prepareObjectDownload`) live in `app.js`.

### Build / deploy workflow

- Resolve the target webapp's `id`/`slug` **live** via `list_static_webapps`. For a full bundle
  deploy, use `mcp__claude_ai_OpenHEXA__update_static_webapp` with that `id` and `files_json` as
  the multi-file array: one `{path, content}` object per file. The files to send are
  `webapps/orchestrator/*` — **5 files, and never a `pipeline_cards.json`.** For a small, targeted
  change to one already-deployed file, use `mcp__claude_ai_OpenHEXA__edit_static_webapp_file`
  instead — see _MCP deployment_ below.
- **Confirm the workspace has a catalog before calling the deploy done.** The bundle alone is not
  a working app: check the object exists with
  `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")`. If
  it is missing, the app will hard-error at boot — the fix is to install and run
  `create_pipeline_cards` in that workspace, not to add a file to the bundle.
- `allowed_operations`: the app requires exactly four scopes — see _`allowed_operations` scopes_.
- **The repo is the source of truth for the app**, and the workspace bucket is the source of truth
  for the catalog. After a deploy there is nothing to "save back". **Partial deploys work** —
  `files_json` may carry only the files that changed (the others are left intact). Read the live
  files back with `get_static_webapp_file` (single file) or `get_static_webapp` (full bundle) to
  verify the deploy or to diff against the repo.

---

## OpenHEXA Static Webapp Runtime Patterns

These patterns apply to any static webapp deployed on OpenHEXA. They are non-obvious and must not be guessed from the schema alone.

### Platform-injected global

The platform injects this global at page load — the only reliable way to get the workspace slug at runtime:

```js
window.OPENHEXA.workspaceSlug;
```

The object carries two more fields the orchestrator doesn't use:

```js
window.OPENHEXA = Object.freeze({
  workspaceSlug: "my-workspace",
  webappSlug: "my-webapp",   // this webapp's own slug
  isPublic: false,            // true for public webapps
});
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

The proxy enforces an **Origin check** (same-origin requests only) and answers **HTTP 403** for a
top-level field outside the webapp's scopes.

### Local development against a live workspace (`dev.js`)

OpenHEXA serves a dev script at **`https://api.openhexa.org/webapps/dev.js`** (the `api.` host —
`app.openhexa.org/webapps/dev.js` 404s). Add one script tag to `index.html` and a local page
(opened over `file://` or any local static server) can call the **real** `/graphql/` proxy against
a real workspace, under that webapp's actual scopes.

```html
<script src="https://api.openhexa.org/webapps/dev.js"></script>
<!-- optionally skip the picker: -->
<script src="https://api.openhexa.org/webapps/dev.js"
        data-workspace-slug="<workspace-slug>"
        data-webapp-slug="<webapp-slug>"></script>
```

A **Connect to OpenHEXA** button appears, you pick a private static webapp and approve, the page
reloads with `window.OPENHEXA` populated, and `fetch("/graphql/")` returns real data. Per the doc
the tag is **inert once deployed** (it only activates on `file://` and `localhost`), and local
calls respect the deployed `allowed_operations` exactly. Webapps created from OpenHEXA's default
template already include the tag.

**The orchestrator does not use it yet.** Adopting it is its own reviewed change, not a drive-by:
it puts a third-party script tag in a production bundle (backlog DEV-1).

### `allowed_operations` scopes

The proxy enforces a whitelist of permitted GraphQL **top-level fields**. Set via the
`allowed_operations` parameter on `update_static_webapp` / `create_static_webapp` — a **typed
JSON list of enum values**, e.g. `["PIPELINES_READ","PIPELINES_RUN","FILES_READ","USER_READ"]`.
Omit it to leave current scopes untouched; pass an empty list to revoke all API access.

What each scope grants (from the `static-webapps` doc — wider than the orchestrator uses):

| Scope             | Top-level fields it unlocks                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `USER_READ`       | `me`, `workspace`                                                                                       |
| `PIPELINES_READ`  | `pipeline`, `pipelines`, `pipelineByCode`, `pipelineRun`, `pipelineVersion`                              |
| `PIPELINES_RUN`   | `runPipeline`, `stopPipeline`                                                                           |
| `FILES_READ`      | `prepareObjectDownload`, `getFileByPath`, `readFileContent`                                             |
| `DATASETS_READ`   | `dataset`, `datasets`, `datasetVersion`, `datasetLink`                                                   |
| `DATABASE_READ`   | `executeSavedQuery` (runs a Data Studio saved query by slug; the query must be shared with the workspace; `executeSQL` is always refused on the proxy) |

`FILES_WRITE` and `DATASETS_WRITE` also exist in the enum, but the doc's table does not list what
they grant — don't rely on a field list for them without checking.

`__typename`, `__schema` and `__type` are always allowed. If a query fails with a permission error
(403) in the webapp, a scope is missing.

Capabilities available under the app's existing scopes but not used (see backlog):
`readFileContent` (an alternative to the signed-URL catalog read), `stopPipeline` (a Stop
button), `getFileByPath` (resolve one bucket object without listing a prefix). The orchestrator
does not need `DATABASE_READ`.

⚠️ **Public webapps cannot call the GraphQL proxy at all.** The orchestrator webapp must therefore
stay **private** — flipping it to public silently kills every query and the app cannot boot.
Check `isPublic` live with `list_static_webapps` / `get_static_webapp`.

**The orchestrator requires four scopes: `PIPELINES_READ, PIPELINES_RUN, FILES_READ, USER_READ`.**
⚠️ **`FILES_READ` is boot-critical**: besides signing report/output downloads, it is what lets the
app read its own `pipeline_cards.json` out of the workspace bucket (see _The pipeline catalog_).
Without it the app fails to load entirely. `USER_READ` is the one most easily forgotten — it's
needed for the `workspace { connections }` query that powers the **connection dropdowns**
(DHIS2 / custom) in the parameter form. Without it the proxy rejects that query and the form falls
back to a plain text slug input (the dropdown just never appears — the app doesn't otherwise
break). To check the scopes actually granted to a deployed app, read them **live** with
`get_static_webapp` (it returns `allowedOperations`).

**Scopes are webapp metadata, not part of the deployed bundle.** They live on the platform's
webapp object, set at create/update time — not re-sent with every file deploy, and not derivable
from the files. So porting the orchestrator to a new workspace is: (1) create the webapp **with
the four scopes**, (2) deploy the 5-file bundle, then (3) install and run `create_pipeline_cards`
in that workspace so the catalog exists in its bucket. Three ways to set the scopes:

- **OpenHEXA UI** — open the webapp → **API access** tab → **Allowed operations** box, with one
  toggle per operation (e.g. "Read pipelines").
- **MCP** — `update_static_webapp` / `create_static_webapp` with the `allowed_operations`
  parameter, passed as a **list** of enum values. All eight values are accepted:
  `PIPELINES_READ`, `PIPELINES_RUN`, `FILES_READ`, `FILES_WRITE`, `DATASETS_READ`,
  `DATASETS_WRITE`, `USER_READ`, `DATABASE_READ`.
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

After changing scopes, re-read them with `get_static_webapp` to confirm they took.

### Reading last-run status for all pipelines (cross-session status board)

This query works through the static-webapp proxy under `PIPELINES_READ` alone (the original
spike's local copy is `deprecated/snt-testing/status_spike/`). It powers the status board.

Pipelines are fetched via the **top-level `pipelines(workspaceSlug:…)` query** — note the
`Workspace` type has **no** `pipelines` field, so `workspace { pipelines }` does _not_ parse.
Pass `window.OPENHEXA.workspaceSlug` as the slug. Each `Pipeline` exposes `runs(...)`; ask for
the single most-recent run with `orderBy: EXECUTION_DATE_DESC, perPage: 1`.

```graphql
query ($ws: String!) {
  pipelines(workspaceSlug: $ws, page: 1, perPage: 100) {
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

The app's status and generator-diagnosis queries use `perPage: 100` and do not paginate — a
workspace with more than 100 pipelines would be silently truncated (backlog APP-1).

`PipelineRunStatus` values (**lowercase**): `queued`, `running`, `success`, `failed`, `stopped`,
`skipped`, `terminating`. A pipeline with no runs returns an empty `runs.items` array (render as
greyed / "no runs"). This is the _list_ status query; to poll a single run you triggered for its
outputs, use the `pipelineRun(id:)` query below.

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

`RunPipelineInput` carries three optional fields the orchestrator doesn't set (ideas in the
backlog):

- `versionId: UUID` — run a specific pipeline version instead of the current one.
- `sendMailNotifications: Boolean` — email the triggering user on completion.
- `enableDebugLogs: Boolean` — verbose run logs.

`stopPipeline(input: {runId})` is also reachable under the app's existing `PIPELINES_RUN` scope.

#### `errors` is an enum, not a message (⚠️ easy to get wrong)

`RunPipelineResult.errors` is **`[PipelineError!]!` — a GraphQL enum**, so it carries codes, never
prose. **Do not string-match it, and never render it raw.** Compare exact values. The full enum
(`reference/openhexa/schema.generated.graphql`, `enum PipelineError`):

`CANNOT_UPDATE_NOTEBOOK_PIPELINE`, `DUPLICATE_PIPELINE_VERSION_NAME`, `FILE_NOT_FOUND`,
`INVALID_CONFIG`, `INVALID_TIMEOUT_VALUE`, `INVALID_VERSION_FILES`, `PERMISSION_DENIED`,
`PIPELINE_ALREADY_COMPLETED`, `PIPELINE_ALREADY_STOPPED`, `PIPELINE_CODE_PARSING_ERROR`,
`PIPELINE_DOES_NOT_SUPPORT_PARAMETERS`, `PIPELINE_NOT_FOUND`, `PIPELINE_RUNS_LIMIT_REACHED`,
`PIPELINE_VERSION_NOT_FOUND`, `TABLE_NOT_FOUND`, `WORKSPACE_NOT_FOUND`.

The app translates them in **`runErrorInfo(errors)`** → `{text, drift}`
(`webapps/orchestrator/app.js`), falling through to a generic branch that still prints the codes
so nothing is swallowed. **Four values mean the catalog no longer matches the installed pipeline**
and are flagged `drift: true` — `INVALID_CONFIG`, `PIPELINE_DOES_NOT_SUPPORT_PARAMETERS`,
`PIPELINE_NOT_FOUND`, `PIPELINE_VERSION_NOT_FOUND`. For those, the caller appends a "refresh the
catalogue" line linking to the generator, via `catalogueRefreshHintHtml`, which reuses
`diagnoseMissingCatalog` (see _Diagnosing a missing catalog from inside the app_).

Implementation details worth preserving:

- **The hint renders in a second pass.** `runNode` paints the error text immediately, then re-renders
  with the hint appended once the extra `pipelines(...)` query resolves — so the error is never
  delayed by the lookup. This is safe because `setRunStatusLine` no-ops when
  `APP.selectedId !== nodeId`, so a slow lookup can't paint onto a different node.
- ⚠️ **`.sb-runstatus` is `display: flex; flex-wrap: wrap`** — a `<br>` inside it becomes a flex item
  and does **not** break the line. The hint is a `<span class="rs-hint">` with `flex: 0 0 100%`
  (in `webapps/orchestrator/styles.css`). Same trap applies to any future second line there.
- Any new mapping needs its strings in **both** `I18N.en` and `I18N.fr` (keys `runerr.*`,
  `link.refreshCatalogue`).

### Polling a run for status and outputs

The app splits this into two queries (`app.js`): `RUN_POLL_QUERY` (`id status executionDate
duration`) polled while the run is in flight, and an outputs query fetched once it has finished:

```graphql
query ($id: UUID!) {
  pipelineRun(id: $id) {
    outputs {
      __typename
      ... on BucketObject { key name type }
      ... on GenericOutput { uri genericName: name }   # alias required: name is String! vs String
    }
    datasetVersions {
      id
      name
      dataset {
        slug
        name
        workspace {
          slug
        }
      }
    }
  }
}
```

`outputs` is a union type — always use `__typename` inline fragments. **Terminal statuses:
`success`, `failed`, `stopped`, `skipped`.** `queued`, `running` and `terminating` are still in
flight — keep polling through `terminating` (`isRunFinished`, `RUN_ACTIVE_STATUSES` in `app.js`).
The app polls every 5 s for up to 40 min (`POLL_INTERVAL_MS`, `POLL_MAX_ATTEMPTS`), then shows
"stopped watching — still running in OpenHEXA".

Two fields worth knowing:

- **`PipelineRunOutput` has a third member the app ignores:**
  `BucketObject | DatabaseTable | GenericOutput`. Without a `... on DatabaseTable` fragment a
  table output is fetched but silently unrendered — harmless (unions skip unmatched members), but
  it means "no outputs shown" is not proof of "no outputs produced". Add the fragment if any SNT
  pipeline starts emitting tables.
- **`progress: Int!`** is available on every run and is not read by the app — the seam to use if
  the run status line should show a percentage rather than just `running`.

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

**This mutation is not limited to run outputs** — `objectKey` may be *any* key in the workspace
bucket. That is what lets the app read its own configuration at boot (see _The pipeline catalog_).
The signed URLs are CORS-open, so `fetch` works cross-origin — not just `<iframe>`.

### Embedding an HTML report in-app (iframe)

A run's HTML report is shown **inline** rather than only linked out
(`webapps/orchestrator/app.js` → `renderReportEmbeds()`; the original feasibility spike is in
`deprecated/snt-app-dev/report-embed/`):

- Get a signed URL via `prepareObjectDownload` with **`forceAttachment: false`** (an attachment
  disposition would download instead of render), then mount it as `<iframe src="{signedUrl}">`.
- It works because the **GCS signed URLs send no `X-Frame-Options` / restrictive
  `frame-ancestors`**, so they are frameable from the webapp origin.
- **Signed URLs expire.** Treat a mounted iframe as perishable: re-request a fresh URL rather
  than caching one across a long session (the app tracks whether a frame is currently mounted
  with a fresh URL and re-signs on demand).

### Constructing OpenHEXA front-end URLs (dataset / pipeline-run pages)

⚠️ **Do NOT derive the app host from the webapp's hostname.** On the SaaS the static webapp is
served under `*.openhexa.io` (e.g. `<webapp-slug>.openhexa.io`) but the main app UI lives at
**`app.openhexa.org`** — a _different domain_ (`.org`, not `.io`). String-munging the webapp
hostname yields `app.openhexa.io`, which is wrong — that host treats `app` as a webapp slug and
returns a 404 "Web app not found" page.

```js
// Hardcode the SaaS front-end base (revisit for self-hosted installs):
var appBase = "https://app.openhexa.org";

// Dataset (version) page. The plain /workspaces/<ws>/datasets/<slug>/ form 404s; the page needs
// BOTH the `from/<sourceWs>` segment (workspace that owns the dataset) AND a
// `?version=<datasetVersionId>` query param:
var datasetUrl =
  appBase + "/workspaces/" + workspaceSlug + "/datasets/" + datasetSlug +
  "/from/" + sourceWorkspaceSlug + "/?version=" + datasetVersionId;
// For a run's output datasets, get datasetSlug + sourceWorkspaceSlug + the
// version id from pipelineRun.datasetVersions { id dataset { slug workspace { slug } } }.

// Pipeline-run page (uses the pipeline CODE, not the UUID; note trailing slash):
var runUrl =
  appBase + "/workspaces/" + workspaceSlug + "/pipelines/" + pipelineCode + "/runs/" + runId + "/";
```

### MCP deployment

Two tools can push changes to a webapp; pick based on the size of the change. Static webapps are
stored as **git repositories** on the platform, so every write below lands as a commit.

- **`mcp__claude_ai_OpenHEXA__edit_static_webapp_file`** — **preferred for small, targeted edits**
  to an existing text file (a few lines in `app.js`, a CSS tweak, one description). Takes the
  webapp `id` (from `list_static_webapps`), a `path`, and an `old_string`/`new_string` pair — the
  same find/replace contract as the Edit tool. The backend reads the current file, applies the
  replacement, and commits; the agent never has to load the full file into context. `old_string`
  must match exactly (including whitespace) and, unless `replace_all: true`, must be unique in the
  file — include enough surrounding context. Text files only.
- **`mcp__claude_ai_OpenHEXA__update_static_webapp`** — for **new files**, a **wholesale
  rewrite** of a file, or the first deploy of a bundle. Takes `files_json` as a JSON array of
  `{path, content}` objects (contents inline — it cannot read a path on disk). It also takes
  `files_to_delete_json`, a JSON array of paths to remove (paths that don't exist are ignored);
  both can be combined in one call and are applied as one commit. `name`/`description` are
  honored, so a rename is one call — but a rename is outward-facing: **confirm with Giulia before
  renaming anything**, and re-read with `list_static_webapps` afterwards. `create_static_webapp`
  takes `name`, `description`, `files_json` and `allowed_operations` (no `isPublic` / `icon` /
  `subdomain` — those need the UI or raw GraphQL `updateWebapp`).

**Partial / incremental deploys work.** `files_json` may contain **only the files that changed** —
omitted files are left untouched, _not_ deleted. Always re-verify after a deploy (see below), and
keep the full bundle reproducible from `webapps/orchestrator/` so a full re-deploy is always
possible.

To **read back** the currently-deployed files:

- **`mcp__claude_ai_OpenHEXA__get_static_webapp_file(workspace_slug, webapp_slug, path)`** — reads
  **one** text file; `start_line`/`end_line` (integers) read a slice of a large file. **Preferred
  for verifying a single-file edit.**
- **`mcp__claude_ai_OpenHEXA__get_static_webapp(workspace_slug, webapp_slug)`** — reads
  **every** file plus metadata (`allowedOperations`, `permissions`, each file's `content` +
  `encoding`: `TEXT`/`BASE64`). Use for a **full drift audit**. Binary files return
  `content: null`, so it cannot back up an image or font. It returns every **text** file inline,
  and `app.js` alone is ~100 KB — an expensive call. If you only need one file, or only the
  scopes, use `get_static_webapp_file` or `list_static_webapps` instead.

Use the **slug** (from `list_static_webapps`), not the UUID, for both read tools.

**Manual UI upload.** For a wholesale rewrite or a full bundle, offer the user the option to drag
the changed file(s) from `webapps/orchestrator/` straight into the webapp in the OpenHEXA UI — no
agent token cost (see guardrail 2). **After any deploy, read the changed file(s) back and diff
against the repo.**

**Version history and rollback (platform-side, not via MCP).** Because webapps are git-backed,
the GraphQL `Webapp` type exposes `versions` (`WebappVersion { id, message, authorName,
authorEmail, date }`), `commitDiff(ref)`, `files(ref:)`, `previewUrl`, `serveUrl` and `subdomain`;
`UpdateWebappInput.publishedVersionId` selects which commit is served. **No MCP tool exposes
versions, diffs or publishing a version** — they are reachable only through the OpenHEXA UI or raw
GraphQL against the main API. Whether `previewUrl` serves an unpublished head is unverified; a
tested rollback procedure is a backlog item (REL-3).

**Other deploy paths.** The OpenHEXA **CLI deploys pipelines only, not static webapps**. The
Python SDK's webapp surface is **read-only** (`workspace.get_webapp(slug)`,
`OpenHexaClient().get_webapp_by_slug(...)`) — no method to create or update webapp files. So MCP
(`edit_static_webapp_file` / `update_static_webapp`), the OpenHEXA UI, and raw GraphQL
(`updateWebapp` with `files` / `filesToDelete`) are the ways to deploy a bundle.

### Pipeline IDs are workspace-specific

Pipeline **UUIDs** and **codes/slugs** both differ across workspaces for the same pipeline. The only stable identifier is the **Python function name** (e.g. `snt_dhis2_extract`) — this is used as the key in `contracts/pipeline_cards.schema.json` and as the `id` in `webapps/orchestrator/pipeline_map.json`. The app gets pipeline UUIDs at runtime from that workspace's own bucket-hosted `pipeline_cards.json`, generated in place by running `create_pipeline_cards` there — so UUIDs never cross workspaces. Never copy a catalog between workspaces.

---

## SNT Pipeline Definitions

`contracts/pipeline_cards.schema.json` documents the expected structure of a `pipeline_cards.json`
— field definitions and type mapping. Read it when interpreting pipeline data.

**The catalog is generated by a pipeline, not by the agent.** Each workspace has exactly one
`pipeline_cards.json`, in its own bucket at
`utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json`, produced by the
`create_pipeline_cards` pipeline (source: `pipelines/create_pipeline_cards/`, docs: its
`README.md`). See _The pipeline catalog_ above for how the app reads it.

**Regenerating it is the answer to almost every catalog question** — a pipeline was installed,
removed, or had a parameter renamed; the app greys out something that should be live; a run is
rejected with `INVALID_CONFIG` or another of the drift-flagged `PipelineError` codes (see
_`errors` is an enum, not a message_). In all of those cases the fix is **run
`create_pipeline_cards` in that workspace**, not to hand-edit anything. Giulia runs pipelines
herself: give her the run plan rather than calling `run_pipeline`, unless she asks. The webapp
picks the new catalog up on its next page load — no redeploy.

**To inspect a workspace's current catalog** (e.g. to check whether a pipeline is present, or what
parameters it exposes):

- `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")` —
  cheap existence + `updatedAt` check. Do this before assuming a workspace has a catalog at all.
- `read_file(workspace_slug, "utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json")`
  — the full contents. ⚠️ These files are tens of KB; prefer the `list_files` check, or ask the
  user to read a value off the OpenHEXA UI, when you only need one fact.
- Previous versions are archived by the pipeline itself under `…/pipeline_cards/historical/` with a
  timestamp suffix — useful for diffing what changed between runs.

**Staleness.** The catalog carries a `generated_at` date, and its parameters are read from each
pipeline's **deployed current version** in that workspace
(`pipelineByCode.currentVersion.parameters`, recorded as `parameters_source:
"openhexa_deployed"`). So it reflects what was installed when the generator ran. What can be stale
is the catalog vs the workspace *now*: if pipelines have been installed or upgraded since
`generated_at`, re-run the generator. **Do not** patch a parameter by hand to "fix" drift — that
desynchronises the bucket file from the generator and the next run silently reverts it.

Each card also records the deployed version it was built from (`version_name` /
`version_number`). Nothing reads them yet — they exist so a future drift check can compare them
against the live `pipelineByCode.currentVersion` and surface a refresh prompt only on real change
(backlog).

### Reference: how a pipeline's parameters are declared

You should not normally need this — `create_pipeline_cards` extracts parameters from the deployed
pipeline version automatically. Keep it for reading pipeline source on GitHub, for understanding
where the catalog's fields come from, and for diagnosing a pipeline whose deployed version cannot
be resolved (the generator gives those `id: null` and excludes them; see the caveats in the
pipeline's `README.md`).

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
- The `id` field is the Python function name — the first argument to `@pipeline(...)`, which is also the pipeline's folder name in the `snt_development` repo and the node `id` in `webapps/orchestrator/pipeline_map.json`.

⚠️ **Reference only — do not hand-build a catalog from this.** The connection type names above are
the SDK's Python classes; `create_pipeline_cards` sees OpenHEXA's own lowercase codes instead
(`dhis2`, `custom`, `iaso`, `postgresql`, `gcs`, `s3`, `file`) and maps them via
`PARAMETER_TYPE_MAP` in its `config.py` (also emitting `IASOConnection`, `PostgreSQLConnection`,
`GCSConnection`, `S3Connection`). The webapp's form has dedicated controls only for DHIS2 and
custom connections (`fieldControlHtml`); any other connection type falls back to a plain text
input. A new type needs a branch there for a proper control.

---

## Workspace-Specific Configuration

**The repo holds no workspace-specific artifacts at all.** Everything committed here is generic;
the only per-workspace data lives in each OpenHEXA workspace's own bucket (see _The pipeline
catalog_).

- **`webapps/orchestrator/`** — the orchestrator bundle (`index.html`, `styles.css`, `app.js`,
  `pipeline_map.json`, `pipeline_descriptions.json`), flat and deployed as-is, shared by every
  workspace.
- **`pipelines/`** — OpenHEXA pipelines that support the webapp itself (as opposed to the
  ~18 SNT process pipelines the orchestrator *runs*, which live in the separate `snt_development`
  repo). Currently just `create_pipeline_cards/`, which generates each workspace's catalog.
  ⚠️ Its bucket output key starts `utils_pipelines/…` — a runtime path, not a repo path.
- **`contracts/`** — JSON contracts for the map, the descriptions and the generated catalog.
- **`reference/openhexa/`** — external reference material (`schema.generated.graphql`).
- **`docs/`**, **`design/`** — consolidated docs, and WIP/design explorations respectively.
- **`deprecated/`** — the parked Flowchart variant, retired spikes and pre-orchestrator
  single-file webapps; history, never a template (see `deprecated/README.md`).

⚠️ **There is no `workspaces/` folder, and there must not be one.** A per-workspace copy of
`pipeline_cards.json` in the repo would reintroduce the redeploy-per-config-change problem the
bucket-hosted catalog solves.

Webapp identity and scopes (`id`, `slug`, `url`, `allowedOperations`) are **not** stored in the
repo — resolve them live via `list_static_webapps` / `get_static_webapp` whenever you deploy or
inspect an app.

**The live app is an inspectable source of truth, not a black box.** Before editing an existing
webapp, pull the deployed files and diff them against `webapps/orchestrator/` to catch drift
(e.g. edits made directly in the OpenHEXA UI). A `pipeline_cards.json` found inside a deployed
webapp is a leftover — nothing fetches it; it can be dropped with `files_to_delete_json`.

### How to build or update the webapp for a workspace

The agent's job is to keep the `webapps/orchestrator/` bundle correct, then deploy. Keeping the
per-workspace catalog accurate is **not an agent task** — it is a pipeline run (see _The pipeline
catalog_). The primary source files are:

- **`contracts/pipeline_cards.schema.json`** — the contract for the generated catalog: field definitions and type mapping.
- **`webapps/orchestrator/pipeline_map.json`** (+ `contracts/pipeline_map.schema.json`) — the map and its contract.
- **`webapps/orchestrator/pipeline_descriptions.json`** (+ `contracts/pipeline_descriptions.schema.json`) — the single, hand-authored source of each node's description text.
- **`pipelines/create_pipeline_cards/`** — the generator that produces each workspace's catalog in its bucket.

When building or updating the orchestrator for a workspace:

1. Confirm the workspace has a catalog — `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")`. If it's missing, the app cannot boot there; installing + running `create_pipeline_cards` comes first (after the webapp exists). Read it with `read_file` only if you actually need its contents.
2. Edit the app under `webapps/orchestrator/`; edit `webapps/orchestrator/pipeline_descriptions.json` for description-text changes. There is nothing per-workspace to edit in the repo.
3. Follow the runtime patterns above (`gql` helper, `allowed_operations`, escaping seam, etc.).
4. Resolve the webapp `id` via `list_static_webapps`, then deploy: for a new workspace or a
   full-bundle refresh use `mcp__claude_ai_OpenHEXA__update_static_webapp` with
   `webapps/orchestrator/*` (5 files); for a small edit to one already-deployed file use
   `mcp__claude_ai_OpenHEXA__edit_static_webapp_file` instead (see _MCP deployment_).
5. Nothing to sync back — the repo has no per-workspace files to update after a deploy.

### Session start workflow

**At the start of any session involving deployment or pipeline operations, always ask the user
which OpenHEXA workspace they want to work on before doing anything else.**

Then:

1. Check whether the workspace has a catalog in its bucket:
   `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")`.
   Note the `updatedAt` — that is the catalog's real age.
2. If yes — that is the pipeline catalog; the app reads it itself at runtime. Resolve the webapp
   `id`/`slug` live via `list_static_webapps` when you need to deploy or inspect. Read the file
   with `read_file` only if you need its contents, not just its existence.
3. If no — the orchestrator cannot boot in that workspace. Tell the user, and ask them to install
   and run **`create_pipeline_cards`** there (source in `pipelines/create_pipeline_cards/`).
   It takes **no parameters** — just Run. But check that the webapp named by its
   `config.WEBAPP_SLUG` is deployed in that workspace first, since its map is the curation
   authority and the run fails without it. Do not generate a catalog by hand and do not add one
   to the bundle.

When about to **edit an existing webapp**, pull its live files (`get_static_webapp`, or
`get_static_webapp_file` for the one file you'll change) and diff them against
`webapps/orchestrator/` first — this catches drift before you overwrite it on the next deploy.

Resolving workspace / app identifiers (all **live** — nothing stored in the repo):

- **workspace slug** — from `list_workspaces`; used in all MCP tool calls (and injected at runtime as `window.OPENHEXA.workspaceSlug`).
- **webapp `id` / `slug` / `url` / `allowedOperations`** — from `list_static_webapps` / `get_static_webapp`. `id` is passed to `update_static_webapp` / `edit_static_webapp_file`; `slug` to the `get_*` tools.
