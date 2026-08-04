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
- **Uploading webapp files (wholesale rewrites / new bundles)** — For a full bundle upload or a wholesale rewrite of a large file, offer the user the option to drag-and-drop changed files directly into the OpenHEXA UI from `app/<variant>/` (the variant's bundle) or `app/pipeline_descriptions.json` (shared across variants) instead of having the agent assemble and deploy via MCP. This avoids reading large files into context and is often faster. Mention it as: *"You can also drag the changed file(s) from `app/<variant>/` (or `app/pipeline_descriptions.json`) straight into the OpenHEXA webapp settings — no size limit and no agent token cost. Want to do that instead, or shall I deploy via the API?"* Small, targeted edits to an existing file don't need this offer — `mcp__claude_ai_OpenHEXA__edit_static_webapp_file` (see _MCP deployment_) handles those directly without hitting the Read cap.

Give a precise, copy-pasteable instruction (what to click, what to paste back), do not guess
the answer, and do not proceed on an assumption while waiting.

## Master plan & versions

The product definition and the phased **v0 / v1 / v2 roadmap** for the SNT Pipelines Orchestrator
live in `docs/PRODUCT_SPEC.md` (Part C — Versioning). **Read `docs/PRODUCT_SPEC.md` at the start
of any session working toward the orchestrator** to locate the current scope and which version a
piece of work targets. _(The former `docs/PLAN.md` and `docs/JIRA_ITEMS.md` task sheets have been
retired; the roadmap now lives in PRODUCT_SPEC.md and task tracking lives in Jira.)_

Work is tracked in Jira (project `SNT25`, Epic `SNT25-536`). **Giulia manages all Jira items
manually through the Jira UI** — the agent does not create, edit, transition, or link Jira issues
for this project. Only touch Jira via the Atlassian MCP if Giulia explicitly asks for it in a
given session.

## OpenHEXA GraphQL Schema

A local copy of the OpenHEXA GraphQL schema is stored under `schemas/schema.generated.graphql`.

**Always read this file at the start of any session involving OpenHEXA static web apps or GraphQL operations.**

To refresh the schema if it becomes stale:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql" -OutFile "schemas/schema.generated.graphql"
```

**New MCP tool (noted 2026-07-17): `mcp__claude_ai_OpenHEXA__get_help_or_doc`.** Call it with no
topic for an orientation overview, or `topic="static-webapps"` (also: `cli`, `sdk`,
`notebooks-advanced`, `toolbox-dhis2`, `toolbox-hexa`, `toolbox-iaso`, `writing-pipelines`) for a
full reference page. The `static-webapps` topic documents the GraphQL scope table (matches what's
already recorded below — no drift), five example webapps, and the `window.OPENHEXA` global (see
_Platform-injected global_). It does **not** mention `edit_static_webapp_file`,
`get_static_webapp_file`, `get_static_webapp`, or `update_static_webapp` at all — those four
remain undocumented-upstream, agent-only conveniences on top of the public API; treat this repo's
_MCP deployment_ section as their only source of truth.

---

## SNT Pipelines Orchestrator (end goal)

The end goal of this project is a single, rich static webapp per workspace — the **SNT
Pipelines Orchestrator** — that presents the _complete_ set of official SNT pipelines (~18,
from the `snt_development` repo) as one guided, interactive surface with a configuration/run
sidebar. It now exists in two deployable UI variants (`flowchart`, `cockpit` — see _UI
variants_). The earlier small single-pipeline webapps were the stepping stones toward it and
are now **retired to `archive/`** (reference only — not deployed, not maintained).

The visual/UX targets are the wireframes `design/wireframes/orchestrator_wireframe.html`
(flowchart) and `design/wireframes/orchestrator_wireframe_cockpit.html` (cockpit). The product is
fully specified in `docs/PRODUCT_SPEC.md`, which separates variant-independent **functionality**
(Part A) from the **UI variants** (Part B) and the **v0 / v1 / v2 roadmap** (Part C) — **read the
relevant wireframe + PRODUCT_SPEC at the start of any session working toward the orchestrator
UI.** In the flowchart variant, the layout is a scrollable canvas showing the pipeline map on the left, and
a side panel on the right that — when a node is selected — shows its description, a link to the
pipeline's GitHub README, a generated parameters form, a **Run** button, a link to the live
OpenHEXA run, and (after a run) the data outputs and HTML report links. Node tags mark each
pipeline as mandatory, alternative, or facultative.

**The map is identical across all workspaces** (for a given UI variant — see below). Every
workspace's orchestrator shows the same full diagram. What differs per workspace is only which
nodes are _active_ — pipelines not available in a given workspace appear greyed-out and
unclickable.

### UI variants

The orchestrator can exist as more than one independently-deployable **UI variant** — same
underlying pipeline data, different layout/UX. Each variant is a fully self-contained bundle
under `app/<variant>/`, and does **not** share files with any other variant — including
`pipeline_map.json`, which is duplicated per variant (not a single shared file) so each UI can
drift independently. There is **no per-workspace repo data any more**: the workspace's pipeline
catalog is read live from the workspace bucket at runtime (see _Data architecture_).

- **`flowchart`** — an interactive 2D node/edge map with a config/run sidebar. Deployed to
  `snt-app-dev`, `snt-testing`, `cmr-snt-process`. **English-only** (see _Bilingual UI_).
- **`cockpit`** — a focused, one-step-at-a-time guided walkthrough, and the **v1 lead variant**
  (where new functionality lands first). Target UX is
  `design/wireframes/orchestrator_wireframe_cockpit.html`. Deployed to `snt-app-dev` and
  `snt-testing` (not to `cmr-snt-process`). **Bilingual EN / FR** and carries the in-app HTML
  report embed — two features the flowchart variant does not have.

Deploying a given (workspace, variant) pair is **5 files** — 4 generic (`app/<variant>/*`) + 1
cross-variant shared file (`app/pipeline_descriptions.json`). **The deployed bundle is now fully
workspace-independent**: nothing in it differs per workspace. The workspace's pipeline catalog is
_not_ deployed — it is read live from the workspace bucket (see _The pipeline catalog_).

**Telling variants apart on the live platform.** Webapp identity isn't stored in the repo, so
resolve it live with `list_static_webapps`. Prefer the **webapp `slug`** — it is consistent
across every workspace (verified live 2026-07-31):

| Variant     | Slug                                   | Name (as deployed)                     |
| ----------- | -------------------------------------- | -------------------------------------- |
| `flowchart` | `snt-pipelines-orchestrator`           | `SNT Pipelines Orchestrator - Flowchart` |
| `cockpit`   | `snt-pipelines-orchestrator-cockpit`   | `SNT Pipelines Orchestrator - Cockpit`   |

⚠️ **Names are less reliable than slugs.** The `- Flowchart` / `- Cockpit` suffix convention
(plain hyphen, **not** an em dash) holds in `snt-app-dev` and `snt-testing`, but
**`cmr-snt-process` is still named the bare `SNT Pipelines Orchestrator`** — a known
inconsistency, not a second variant. Its slug (`snt-pipelines-orchestrator`) still identifies it
correctly as `flowchart`. Match on slug; treat the name as a human label only.

### Data architecture

The orchestrator separates concerns across four kinds of file. The stable join key everywhere
is the node `id` == the pipeline's Python function name (e.g. `snt_dhis2_extract`).

⚠️ **Only the first, second and fourth rows live in this repo.** `pipeline_cards.json` is **not a
repo file** — it lives in each OpenHEXA workspace's own bucket and is read at runtime (see _The
pipeline catalog_ immediately below). The old `workspaces/<ws>/<variant>/` tree was deleted on
2026-08-04; do not recreate it.

| File                                   | Scope                                                  | Holds                                                                                          |
| -------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `app/<variant>/pipeline_map.json`      | per-variant, workspace-independent (see _UI variants_) | all nodes, `code`, `label` (bilingual in cockpit), `ohName`, grid position (`row`/`col`), `track`, `type`, mutex `group`, directed `edges` (dependencies) |
| `app/pipeline_descriptions.json`       | shared across every variant AND every workspace (see _Data architecture_ note below) | hand-authored, Markdown-lite-formatted paragraph description per node, keyed by `id`; each value is a bilingual `{ en, fr }` object |
| `pipeline_cards.json` **(in the workspace bucket, not the repo)** | per-workspace, **shared by both variants** | which pipelines exist + `uuid` + `parameters` (drives _active vs greyed_)      |
| `app/<variant>/index.html` + `app/<variant>/app.js` + `app/<variant>/styles.css` | per-variant app shell (multi-file) | renders the UI, merges the map + descriptions with the workspace cards, runs/polls pipelines |

#### The pipeline catalog (`pipeline_cards.json`) — bucket-hosted, read at runtime

Since 2026-08-04 the catalog is **not bundled and not kept in the repo**. It lives in the
workspace's own file storage at the fixed key

```
utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json
```

and is written there by the companion **`create_pipeline_cards`** pipeline, whose source is in this
repo under `utils_pipelines/create_pipeline_cards/` (see its own `README.md`). **Why:** a config
change (a new pipeline installed, a parameter renamed) is then just a pipeline run — no webapp
redeploy, no repo commit.

How the app reads it (identical in both variants, `loadCards()` in each `app/<variant>/app.js`):

1. `prepareObjectDownload(input: {workspaceSlug, objectKey: CARDS_OBJECT_KEY, forceAttachment: false})`
   through the same-origin `/graphql/` proxy → a signed GCS URL. Needs **`FILES_READ`**.
2. `fetch(signedUrl)` → `.json()`. Works because those signed URLs are CORS-open (the same
   property the report embed relies on — see _Embedding an HTML report in-app_).

Rules that follow from this:

- **`CARDS_OBJECT_KEY`** is a hardcoded constant at the top of each variant's `app.js`. It must
  stay in lockstep with `utils_pipelines/create_pipeline_cards/config.py` (`OUTPUT_DIR` +
  `WEBAPP_CARDS_PATH`). Changing the output location means changing three places.
- **One catalog serves both variants.** The generator curates against the webapp's *deployed*
  `pipeline_map.json`, and both variants' maps declare the same node ids (verified 2026-08-04), so
  there is no per-variant catalog. If the two maps ever diverge in node ids, that assumption
  breaks and each variant would need its own generated file.
- **There is no fallback, by design.** If the object is missing the app **fails at boot** with an
  actionable message ("Run the `create_pipeline_cards` pipeline") rather than silently serving a
  stale bundled copy. Cockpit surfaces it in its `boot.failed` panel (i18n keys
  `boot.cardsMissing` / `boot.cardsUnreadable` / `boot.noWorkspace`); flowchart renders a
  `.map-error` box onto the canvas.
- ⚠️ **Every workspace must have `create_pipeline_cards` deployed and run before its orchestrator
  will boot.** Present in `snt-app-dev` and `snt-testing`. **Absent in `cmr-snt-process`** as of
  2026-08-04 — its live flowchart app keeps working on its already-deployed bundle, but a redeploy
  there requires installing and running the generator first. **The generator takes no parameters**
  (just Run), but it curates against the deployed map of the webapp named by its
  `config.WEBAPP_SLUG` — currently `snt-pipelines-orchestrator-cockpit`, the lead variant. So in
  `cmr-snt-process` (Flowchart only, no Cockpit app yet) it will **fail** until the Cockpit app is
  deployed there, or `WEBAPP_SLUG` is pointed at `snt-pipelines-orchestrator` and the generator
  redeployed. Giulia is bringing that workspace's apps up to date manually.
- **Parameters now come from the deployed pipeline version, not from GitHub.** The generator reads
  `pipelineByCode.currentVersion.parameters`, so the catalog matches what is actually installed in
  the workspace. This removes the old GitHub-source-scraping step and the drift it caused (see
  _SNT Pipeline Definitions_).

`app/pipeline_descriptions.json` is the one exception to "each variant owns its files": it sits
directly under `app/` (not inside any `app/<variant>/` subfolder) because the same hand-authored
text is shown identically in every variant. There's only ever one copy to edit — see
`schemas/pipeline_descriptions.schema.json` for the contract and the Markdown-lite formatting
rules (bold/italic/line breaks; no headers, links, or lists). Because each variant is still
deployed as its own separate OpenHEXA static webapp (same-origin `fetch` only), this one repo
file must be copied into **both** `app/flowchart/`'s and `app/cockpit/`'s deploy bundle at deploy
time — same content, deployed twice.

⚠️ **Its values are bilingual objects, not strings** — `{ "en": "…", "fr": "…" }`, both holding
the same Markdown-lite prose. **Editing a description means editing both languages.** A plain
string is still accepted and treated as `en` (backward compatibility). See _Bilingual UI_ below.

**Generic vs workspace-specific:** for a given variant, the deployed bundle is **5 files — 4
variant-generic + 1 cross-variant shared — and nothing workspace-specific at all.**
Variant-generic (reused unchanged across every workspace for that variant, all under
`app/<variant>/`): `index.html`, `styles.css`, `app.js`, `pipeline_map.json`. Cross-variant shared
(same content in both variants' bundles): `app/pipeline_descriptions.json`. The app self-adapts at
runtime via `window.OPENHEXA.workspaceSlug` — which now also drives the catalog read — plus
cards-driven greying, so the only non-per-workspace assumption baked into `app.js` is the
hardcoded SaaS base `https://app.openhexa.org`. → **new workspace = deploy the same 5 files,
then run `create_pipeline_cards` in that workspace.** (See README's "Generic vs
workspace-specific" for the human-facing version.)

Webapp metadata (id, slug, URL, allowed scopes) is **not** stored in the repo — it is resolved
live at deploy time via `list_static_webapps` / `get_static_webapp` (see _Build / deploy
workflow_). The `app/<variant>/` bundle plus `app/pipeline_descriptions.json` is the repo's
complete source of truth for what to deploy; the per-workspace half of the picture lives in the
workspace bucket and is produced by running a pipeline, not by committing a file.

`schemas/pipeline_map.schema.json` documents the structure of each variant's
`app/<variant>/pipeline_map.json` — read it when authoring or interpreting the map (its
`_generation_instructions` also cover the edge/node-type conventions and the per-member-edge
rule for alternative groups).
`design/pipeline_map_preview.html` is a standalone visual render of the map for review. The map
is **hand-authored** (a separate task); it is not generated from the GraphQL API.

### Node states

The webapp computes three independent state axes per node:

- **available vs greyed** — _static_: a node is available iff its `id` is present in the
  workspace's bucket-hosted `pipeline_cards.json` (with a `uuid`). Otherwise it renders greyed-out
  and is unclickable. This is how the same full map adapts to each workspace — and, since the
  catalog is regenerated by running `create_pipeline_cards`, how a newly-installed pipeline
  becomes clickable without touching the webapp.
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

### Bilingual UI (EN / FR)

French is the **main interface language for v1** (PM steer, 2026-07-15 — nearly all users are
French-speaking). It is implemented as **one webapp with a language toggle**, not as separate
per-language builds.

**Status: shipped in `cockpit` only** (2026-07-17). The `flowchart` variant remains English-only.
Both read the same shared `app/pipeline_descriptions.json`, so the nested shape must keep working
for both — do not "flatten" it.

Where each kind of text comes from, and how it's resolved:

| Tier                                          | Source                                              | Mechanism                              |
| --------------------------------------------- | --------------------------------------------------- | -------------------------------------- |
| App chrome (buttons, statuses, section titles) | the `I18N` table inside `app/cockpit/app.js`         | `t("key", {params})`                   |
| Node / step titles                            | `app/cockpit/pipeline_map.json` → `label`            | `pickLang(label)`                      |
| Node descriptions                             | `app/pipeline_descriptions.json` → `{ en, fr }`      | `pickLang(desc)`                       |
| **Parameter labels / help / choices**          | the workspace's bucket-hosted `pipeline_cards.json`  | **not translated — English for now**   |

Key rules when touching cockpit text:

- **`pickLang(v)`** resolves a possibly-bilingual data value: an `{ en, fr }` object picks the
  active language, falls back to `en`, then to `""`; a plain string is returned as-is. This is
  why legacy flat data and the flowchart variant keep working.
- **`t(key, params)`** looks up chrome strings; a missing key falls back to English, then to the
  key itself (so a typo renders visibly rather than silently blank). **Add every new chrome
  string to _both_ `I18N.en` and `I18N.fr`.**
- **Structural fields are never translated:** `id`, `code`, `type`, `group`, `row`/`col`,
  `track`, and `ohName` (`ohName` is the load-bearing OpenHEXA display name — translating it
  breaks pipeline matching).
- **Language resolution order** (at boot): `?lang=` query param (wins, and is persisted) →
  `localStorage["snt_lang"]` → default `en`. Switching language sets `LANG`, rebuilds the steps,
  and re-renders everything from scratch — there is no partial-update path to maintain.
- The flowchart variant has a one-line equivalent of `pickLang` (its `descText()` helper) that
  just reads `.en`. If flowchart ever goes bilingual, that is the seam to widen.

⚠️ The **French strings in `I18N.fr` are drafts pending Giulia's review** (per the code comment in
`app/cockpit/app.js`). Do not present them as final copy.

### Multi-file app architecture

OpenHEXA static webapps serve more than just `index.html`. Per the OpenHEXA docs:

> _"`index.html` is the entry point; everything else (CSS, JS, images, JSON fixtures) is
> served as-is from the same origin... Reference assets with relative paths
> (`<script src="app.js">`, `<link href="style.css">`). The injection only touches `text/html`
> responses; CSS, JS, and JSON files are untouched."_

So the orchestrator is a **multi-file bundle**, not one giant file:

These **four files live together under `app/<variant>/`** (see _UI variants_) — e.g.
`app/flowchart/index.html`, `app/flowchart/pipeline_map.json`, etc.:

- `index.html` — minimal shell (containers + `<link rel="stylesheet" href="styles.css">` and
  `<script src="app.js">`; the cockpit's shell also holds the header appbar and the EN/FR toggle)
- `styles.css` — all styling (cards, node states, sidebar, SVG arrows)
- `app.js` — render the UI, merge map + descriptions with cards, run + poll pipelines
- `pipeline_map.json` — this variant's map, fetched at runtime

One more file is deployed **into the same flat webapp root** but lives elsewhere in the repo,
because its scope differs (see _Data architecture_):

- `pipeline_descriptions.json` — from `app/pipeline_descriptions.json` (shared across variants)

That is the **5-file bundle**. Note the deployed paths are flat — `app.js` fetches the two bundled
JSON files as same-origin siblings (`fetch("./pipeline_map.json")`,
`./pipeline_descriptions.json`), so the repo's folder nesting is a **source-tree** convention that
is flattened at deploy time. The third JSON the app needs, `pipeline_cards.json`, is **not a
sibling and not in the bundle** — it is fetched from the workspace bucket via a signed URL (see
_The pipeline catalog_). All the shared runtime patterns below (the `gql` helper, status polling,
`prepareObjectDownload`, prefixed element handling) still apply — they just live in `app.js`
rather than inline.

### Build / deploy workflow

- First settle **which variant** you're deploying (`flowchart` or `cockpit`) — it determines which
  `app/<variant>/` folder you read from. (It no longer determines which catalog: there is one
  bucket-hosted catalog per workspace, shared by both variants.)
- Resolve the target webapp's `id`/`slug` **live** via `list_static_webapps` (there is no
  `workspace_config.json` any more; distinguish variants live by webapp **slug** — see the table
  in _UI variants_, and note names are inconsistent in `cmr-snt-process`). For a full bundle
  deploy, use `mcp__claude_ai_OpenHEXA__update_static_webapp` with
  that `id` and `files_json` as the multi-file array: one `{path, content}` object per file in
  the bundle above. The files to send are `app/<variant>/*` (generic to that variant) +
  `app/pipeline_descriptions.json` (shared, same content for every variant) — **5 files, and never
  a `pipeline_cards.json`.** For a small, targeted change to one already-deployed file, use
  `mcp__claude_ai_OpenHEXA__edit_static_webapp_file` instead — see _MCP deployment_ below.
- **Confirm the workspace has a catalog before calling the deploy done.** The bundle alone is not
  a working app: check the object exists with
  `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")`. If
  it is missing, the app will hard-error at boot — the fix is to install and run
  `create_pipeline_cards` in that workspace, not to add a file to the bundle.
- `allowed_operations`: at minimum `PIPELINES_READ, PIPELINES_RUN, FILES_READ`. Add
  `USER_READ` if the app queries workspace connections at runtime (to populate
  `DHIS2Connection` dropdowns). Note **`FILES_READ` is now load-bearing at boot**, not just for
  report/output downloads — without it the catalog read fails and the app shows nothing.
- **The repo is the source of truth for the app**, and the workspace bucket is the source of truth
  for the catalog. Each variant's bundle lives once under `app/<variant>/`; no workspace
  contributes any repo file. After a deploy there are no cards to "save back" — regenerating a
  catalog means re-running `create_pipeline_cards`, and nothing needs committing. **Partial
  deploys work** — `files_json` may carry only the files that changed (the others are left
  intact); you do **not** have to resend the whole bundle every time (see _MCP deployment_ below
  for the confirmation + caveats). You can read the live files back with `get_static_webapp_file`
  (single file) or `get_static_webapp` (full bundle) to verify the deploy or to diff against the
  repo.

---

## OpenHEXA Static Webapp Runtime Patterns

These patterns apply to any static webapp deployed on OpenHEXA. They are non-obvious and must not be guessed from the schema alone.

### Platform-injected global

The platform injects this global at page load — the only reliable way to get the workspace slug at runtime:

```js
window.OPENHEXA.workspaceSlug;
```

Per the official `static-webapps` help doc (checked 2026-07-17), the object actually carries two
more fields the orchestrator doesn't currently use:

```js
window.OPENHEXA = Object.freeze({
  workspaceSlug: "my-workspace",
  webappSlug: "my-webapp",   // this webapp's own slug — e.g. "snt-pipelines-orchestrator" vs
                              // "snt-pipelines-orchestrator-cockpit"
  isPublic: false,            // true for public webapps
});
```

`webappSlug` would let `app.js` detect its own variant at runtime (the slugs differ per variant —
see the table in _UI variants_). **Neither variant reads it today** (verified 2026-07-31): each
variant ships its own `app.js`, so it already knows what it is. Noted only because it is the seam
to use if one bundle ever has to serve both variants.

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
⚠️ **`FILES_READ` became boot-critical on 2026-08-04**: besides signing report/output downloads, it
is what lets the app read its own `pipeline_cards.json` out of the workspace bucket (see _The
pipeline catalog_). Without it the app now fails to load entirely, rather than merely losing its
download links. `USER_READ` is the one most easily forgotten — it's needed for the `workspace { connections }`
query that powers the **DHIS2-connection dropdown** in the parameter form. Without it the
proxy rejects that query with `Operations not allowed: workspace` and the form silently falls
back to a plain text slug input (the connection dropdown just never appears — the app doesn't
otherwise break). This bit `snt-testing` (created June with only the first three; `USER_READ`
added 2026-06-23). To check the scopes actually granted to a deployed app, read them **live**
with `get_static_webapp` (it returns `allowedOperations`) — that is now the source of truth, so
drift is caught by inspecting the live webapp rather than a stored config file.

**Scopes are webapp metadata, not part of the deployed bundle.** They live on the platform's
webapp object, set **once per webapp at create/update time** — not re-sent with every file
deploy, and not derivable from the files. So porting the orchestrator to a new workspace is:
(1) create the webapp **with the four scopes**, (2) deploy the 5-file bundle (4 generic +
`pipeline_descriptions.json`), then (3) install and run `create_pipeline_cards` in that workspace
so the catalog exists in its bucket. Three ways to set the scopes:

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

**Confirmed working through the static-webapp proxy under `PIPELINES_READ` alone** (status spike,
verified live in `snt-testing`: a pipeline triggered in the OH UI showed up as `running` on the
next app refresh — the spike webapp `t0-9-status-proxy-spike` is still there, and its local copy
is `archive/snt-testing/status_spike/`). This is the query that powers the read-only status board.

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

**This mutation is not limited to run outputs** — `objectKey` may be *any* key in the workspace
bucket. That is what lets the app read its own configuration at boot: the orchestrator signs
`utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json` and `fetch`es it as JSON
(see _The pipeline catalog_). The signed URLs are CORS-open, so `fetch` works cross-origin — not
just `<iframe>`.

### Embedding an HTML report in-app (iframe)

**Confirmed feasible and shipped in the `cockpit` variant** (spike `archive/snt-app-dev/report-embed/`
+ the live `report-embed-probe` webapp in `snt-app-dev`; implemented in
`app/cockpit/app.js` → `renderReportEmbeds()`).

A run's HTML report can be shown **inline** rather than only linked out:

- Get a signed URL via `prepareObjectDownload` with **`forceAttachment: false`** (an attachment
  disposition would download instead of render), then mount it as `<iframe src="{signedUrl}">`.
- It works because the **GCS signed URLs send no `X-Frame-Options` / restrictive
  `frame-ancestors`**, so they are frameable from the webapp origin.
- **Signed URLs expire.** Treat a mounted iframe as perishable: re-request a fresh URL rather
  than caching one across a long session (the cockpit tracks whether a frame is currently mounted
  with a fresh URL and re-signs on demand).
- The `flowchart` variant does **not** embed — it still links out to the report.

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

Two tools can push changes to a webapp; pick based on the size of the change:

- **`mcp__claude_ai_OpenHEXA__edit_static_webapp_file`** (added 2026-07-07) — **preferred for
  small, targeted edits** to an existing text file (a few lines in `app.js`, a CSS tweak, one
  card's parameters). Takes the webapp `id` (from `list_static_webapps`), a `path`, and an
  `old_string`/`new_string` pair — the same find/replace contract as the Edit tool. The backend
  reads the current file, applies the replacement, and commits; the agent never has to load the
  full file into context. `old_string` must match exactly (including whitespace) and, unless
  `replace_all: true`, must be unique in the file — include enough surrounding context. Text
  files only (not images/binaries). Use `update_static_webapp` instead to add new files or
  rewrite one wholesale.
- **`mcp__claude_ai_OpenHEXA__update_static_webapp`** — for **new files**, a **wholesale
  rewrite** of a file, or the first deploy of a bundle. Takes `files_json` as a JSON array of
  `{path, content}` objects. The `name`/`description` fields are silently ignored by this tool
  (rename webapps from the OpenHEXA UI instead); `create_static_webapp` **does** honor `name`.
  **New (confirmed live 2026-07-17):** it also takes `files_to_delete_json`, a JSON array of
  paths to remove (e.g. `["old.js", "legacy/style.css"]`) — paths that don't exist are ignored.
  Can be combined with `files_json` in the same call; both are applied as one commit. Not yet
  needed by any orchestrator task, but relevant if a variant ever needs to drop a stale file
  (e.g. retiring an old data file after a `pipeline_map.json` restructure) without a full
  wholesale rewrite.

**Partial / incremental deploys work (confirmed live 2026-06-19; as of 2026-07-17 the tool's own
description now says so too — previously it still said "replace all files," contradicting the
observed behavior).** `files_json` may contain **only the files that changed** — the omitted
files are left untouched, _not_ deleted. Verified by deploying `app.js` alone to the orchestrator
and reading back with `get_static_webapp`: all other files (CSS, HTML, both JSON) survived
intact. Caveats: (1) confirmed on the SaaS; (2) **always re-verify after a partial deploy** (see
below); (3) keep the full bundle reproducible from the repo (`app/<variant>/` +
`app/pipeline_descriptions.json`) so a full re-deploy is always possible.

To **read back** the currently-deployed files:

- **`mcp__claude_ai_OpenHEXA__get_static_webapp_file(workspace_slug, webapp_slug, path)`**
  (added 2026-07-07) — reads **one** file; supports `start_line`/`end_line` for large files.
  **Preferred for verifying a single-file edit** (e.g. confirm an `edit_static_webapp_file`
  call landed) — cheap, no Read-cap risk.
- **`mcp__claude_ai_OpenHEXA__get_static_webapp(workspace_slug, webapp_slug)`** — reads
  **every** file plus metadata (`allowedOperations`, `permissions`, each file's `content` +
  `encoding`: `TEXT`/`BASE64`). Use for a **full drift audit** (comparing the whole live bundle
  against the repo) or when you need the file list first. Use the **slug** (from
  `list_static_webapps`), not the UUID, for both tools. Since scopes/allowedOperations are
  webapp-level, not variant-level, still resolve the right webapp by slug first (see _UI variants_).

✅ **`start_line`/`end_line` on `get_static_webapp_file` are fixed** (confirmed live 2026-07-17):
the tool's schema now declares both as `integer` (was `string`), matching the underlying
`readWebappFile` GraphQL field's `Int` type. Verified by reading `app.js` lines 1–15 from the
live `snt-pipelines-orchestrator` webapp in `snt-app-dev` — returned exactly that slice with
`success: true`, no coercion error. The previous workaround (omit both, read the whole file) is
no longer necessary — pass both params for large files to avoid the Read-cap risk described
below. (Previously broken/reported upstream 2026-07-08; this note previously said "currently
broken" — that is now stale.)

**Large-file deploy friction (Read cap) — now mostly avoided.** `update_static_webapp`'s
`files_json` carries file _contents inline_ — the tool can't read from a path on disk, so
authoring the call means pulling the bytes into context with Read, which caps at ~25k tokens.
The orchestrator's `app.js` is now **~90 KB** (flowchart) / **~88 KB** (cockpit) and still
growing — well past that cap, so a single Read **truncates** it, and JSON-escaping
(`ConvertTo-Json`) only inflates it further. `edit_static_webapp_file` sidesteps this entirely for targeted
edits — no full-file Read, no JSON-escaping, no chunking. Everything below is now a **fallback**,
needed only when a file must be wholesale-rewritten (not just patched) and is too large for a
single Read.

**Manual UI upload (fallback for wholesale rewrites).** If a wholesale rewrite is needed and the
escape/chunk dance below feels like overkill, offer the user the option to drag the changed
file(s) from `app/<variant>/` or `app/pipeline_descriptions.json` (the canonical local copies)
straight into the OpenHEXA UI — no agent Read, no token cost, no size limit.

**If a wholesale rewrite must go through the API** (confirmed 2026-06-22): write the escaped
string to a temp file, then read it back in slices with the Bash tool (`cut -c1-20000 file`,
`-c20001-40000 file`, …) and concatenate the slices **exactly** into the `content` value —
ideally inside a **subagent** so the large payload stays out of the main context. Smaller files
(`styles.css`, the JSON data files) still read in one go. **Always verify after a chunked
deploy**: re-read live via `get_static_webapp_file` (or `get_static_webapp` for a full check)
and diff against the local copy (e.g. a quick `node -e` length/equality check) — a single
dropped/altered char between slices would break the file. The OpenHEXA **CLI deploys pipelines
only, not static webapps**, so there is no command-line deploy path today (a feature request to
the OH devs is in flight).

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

Pipeline **UUIDs** and **codes/slugs** both differ across workspaces for the same pipeline. The only stable identifier is the **Python function name** (e.g. `snt_dhis2_extract`) — this is used as the key in `schemas/pipeline_cards.schema.json` and as the `id` in each variant's `app/<variant>/pipeline_map.json`. The app gets pipeline UUIDs at runtime from that workspace's own bucket-hosted `pipeline_cards.json`, so **UUIDs can no longer leak across workspaces**: each workspace's catalog is generated in place by running `create_pipeline_cards` there, and is never copied between workspaces. (The old failure mode — hand-copying a `pipeline_cards.json` from one workspace to another — is structurally impossible now.)

---

## SNT Pipeline Definitions

`schemas/pipeline_cards.schema.json` documents the expected structure of a `pipeline_cards.json`
— field definitions and type mapping. Read it when interpreting pipeline data.

**The catalog is generated by a pipeline, not by the agent.** Each workspace has exactly one
`pipeline_cards.json`, in its own bucket at
`utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json`, produced by the
`create_pipeline_cards` pipeline (source: `utils_pipelines/create_pipeline_cards/`, docs: its
`README.md`). It is shared by both UI variants. See _The pipeline catalog_ above for how the app
reads it.

**Regenerating it is the answer to almost every catalog question** — a pipeline was installed,
removed, or had a parameter renamed; the app greys out something that should be live; a run fails
with `The provided config contains invalid key(s): …`. In all of those cases the fix is **run
`create_pipeline_cards` in that workspace** (via the OpenHEXA UI, or `run_pipeline` if the user
asks), not to hand-edit anything. The webapp picks the new catalog up on its next page load — no
redeploy.

**To inspect a workspace's current catalog** (e.g. to check whether a pipeline is present, or what
parameters it exposes):

- `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")` —
  cheap existence + `updatedAt` check. Do this before assuming a workspace has a catalog at all.
- `read_file(workspace_slug, "utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json")`
  — the full contents. ⚠️ These files are ~45–60 KB; prefer the `list_files` check, or ask the user
  to read a value off the OpenHEXA UI, when you only need one fact.
- Previous versions are archived by the pipeline itself under `…/pipeline_cards/historical/` with a
  timestamp suffix — useful for diffing what changed between runs.

**Staleness works differently now.** The catalog still carries a `generated_at` date, but its
parameters are read from each pipeline's **deployed current version** in that workspace
(`pipelineByCode.currentVersion.parameters`, recorded as `parameters_source:
"openhexa_deployed"`) — not scraped from GitHub `main`. So it reflects what is actually installed,
and the old GitHub-vs-installed drift class is gone. What can still be stale is the catalog vs the
workspace *now*: if pipelines have been installed or upgraded since `generated_at`, re-run the
generator. **Do not** patch a parameter by hand to "fix" drift — that desynchronises the bucket
file from the generator and the next run silently reverts it.

### Reference: how a pipeline's parameters are declared

You should not normally need this — `create_pipeline_cards` extracts parameters from the deployed
pipeline version automatically. Keep it for reading pipeline source on GitHub, for understanding
where the catalog's fields come from, and for the rare case of diagnosing a pipeline whose
deployed version cannot be resolved (the generator leaves those with `id: null` and excludes them;
see the caveats in the pipeline's `README.md`).

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
- The `id` field is the Python function name — the first argument to `@pipeline(...)`, which is also the pipeline's folder name in the `snt_development` repo and the node `id` in each variant's `app/<variant>/pipeline_map.json`.

⚠️ **Reference only — do not hand-build a catalog from this.** The connection type names above are
the SDK's Python classes; `create_pipeline_cards` sees OpenHEXA's own lowercase codes instead
(`dhis2`, `custom`, `iaso`, `postgresql`, `gcs`, `s3`, `file`) and maps them to these same JSON
values via `PARAMETER_TYPE_MAP` in its `config.py`. If a new connection type ever appears in a
pipeline, that map is the place to extend — the webapp's form then needs a matching branch in
`fieldControlHtml`, or the parameter falls back to a plain text input.

---

## Workspace-Specific Configuration

**The repo now holds no workspace-specific artifacts at all.** Everything committed here is either
generic or per-variant; the only per-workspace data lives in each OpenHEXA workspace's own bucket
(see _The pipeline catalog_).

- **`app/<variant>/`** — one generic orchestrator bundle per UI variant (`index.html`,
  `styles.css`, `app.js`, `pipeline_map.json`), shared by every workspace for that variant.
  Single source of truth for that variant's app; there are no per-workspace copies. See
  _UI variants_ for the current list (`flowchart`, `cockpit`).
- **`app/pipeline_descriptions.json`** — the one file under `app/` that sits outside any
  `<variant>/` subfolder: hand-authored node description text, shared unchanged across every
  variant and every workspace. Single source of truth; must be copied into both variants' deploy
  bundles (see _Data architecture_).
- **`utils_pipelines/`** — OpenHEXA pipelines that support the webapp itself (as opposed to the
  ~18 SNT process pipelines the orchestrator *runs*, which live in the separate `snt_development`
  repo). Currently just `create_pipeline_cards/`, which generates each workspace's catalog.
- **`schemas/`**, **`docs/`**, **`design/`** — contracts, consolidated docs, and WIP/design
  explorations respectively.
- **`archive/`** — retired spikes and pre-orchestrator single-file webapps, kept for reference
  only (not deployed, not maintained).

⚠️ **There is no `workspaces/` folder.** It held `workspaces/<ws>/<variant>/pipeline_cards.json`
and was deleted on 2026-08-04 when both variants moved to reading the catalog from the bucket. If
you find yourself wanting to create it, you are about to reintroduce the redeploy-per-config-change
problem that change removed. Old copies remain in git history if ever needed.

Webapp identity and scopes (`id`, `slug`, `url`, `allowedOperations`) are **not** stored in the
repo — resolve them live via `list_static_webapps` / `get_static_webapp` whenever you deploy or
inspect an app.

**The agent CAN now read and edit the live webapp's files directly.**
`mcp__claude_ai_OpenHEXA__get_static_webapp(workspace_slug, webapp_slug)` (added in the 2026-06
OH release) returns metadata, `allowedOperations`, a `permissions` block, and every file's full
`content` with an `encoding` field (`TEXT` for UTF-8, `BASE64` for binary) — use for a full
drift audit. `mcp__claude_ai_OpenHEXA__get_static_webapp_file(workspace_slug, webapp_slug,
path)` (added 2026-07-07) reads a single file (with optional `start_line`/`end_line`) — use for
a cheap single-file check. Use the **slug** (from `list_static_webapps`), not the UUID, for
both. This means:

- **The live app is an inspectable source of truth, not a black box.** Before editing an existing webapp, pull the deployed files and diff them against the repo (`app/<variant>/` + `app/pipeline_descriptions.json`) to catch drift (e.g. edits made directly in the OpenHEXA UI). A live `pipeline_cards.json` still present in a webapp is a **leftover from before 2026-08-04** — nothing fetches it; it can be dropped with `files_to_delete_json`.
- A variant's deploy set is just `app/<variant>/*` + `app/pipeline_descriptions.json` — the same 5 files for every workspace, with no per-workspace assembly step at all.
- After a deploy, **verify** by reading the changed file(s) back (`get_static_webapp_file` for one file, `get_static_webapp` for the whole bundle) and diffing against the repo.
- ✅ For small, targeted edits prefer `mcp__claude_ai_OpenHEXA__edit_static_webapp_file`
  (find/replace on one file, added 2026-07-07) over `update_static_webapp` — it never needs the
  file's full content in context. Reserve `update_static_webapp` (which does support
  **partial/incremental deploys**, confirmed live 2026-06-19 — send only the changed files in
  `files_json`; omitted files are left intact) for new files or wholesale rewrites. See _MCP
  deployment_ for details + caveats.

### How to build or update the webapp for a workspace

The agent's job is to keep each variant's `app/<variant>/` bundle correct, then deploy. Keeping the
per-workspace catalog accurate is **no longer an agent task** — it is a pipeline run (see _The
pipeline catalog_). The primary source files are:

- **`schemas/pipeline_cards.schema.json`** — the contract for the generated catalog: field definitions and type mapping.
- **`app/<variant>/pipeline_map.json`** (+ `schemas/pipeline_map.schema.json`) — that variant's map and its contract.
- **`app/pipeline_descriptions.json`** (+ `schemas/pipeline_descriptions.schema.json`) — the single, hand-authored source of each node's description text, shared across every variant and workspace.
- **`utils_pipelines/create_pipeline_cards/`** — the generator that produces each workspace's catalog in its bucket.

When building or updating the orchestrator for a workspace:

1. Settle which variant (`flowchart` or `cockpit`) you're working on.
2. Confirm the workspace has a catalog — `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")`. If it's missing, the app cannot boot there; installing + running `create_pipeline_cards` comes first. Read it with `read_file` only if you actually need its contents.
3. Edit the variant's app under `app/<variant>/` (shared by all workspaces for that variant); edit `app/pipeline_descriptions.json` for description-text changes (shared across variants). There is nothing per-workspace to edit in the repo.
4. Follow the runtime patterns above (prefixed IDs, shared functions, `allowed_operations`, etc.).
5. Resolve the webapp `id` via `list_static_webapps` (distinguish variants by webapp **slug** —
   see _UI variants_), then deploy: for a new workspace or a full-bundle refresh use
   `mcp__claude_ai_OpenHEXA__update_static_webapp` with `app/<variant>/*` +
   `app/pipeline_descriptions.json` (5 files); for a small edit to one already-deployed file use
   `mcp__claude_ai_OpenHEXA__edit_static_webapp_file` instead (see _MCP deployment_).
6. Nothing to sync back — the repo has no per-workspace files to update after a deploy.

> For the **SNT Pipelines Orchestrator** specifically, follow the multi-file architecture in
> _SNT Pipelines Orchestrator (end goal)_ above: the map (`app/<variant>/pipeline_map.json`,
> validated against `schemas/pipeline_map.schema.json`) supplies layout and dependencies, the
> workspace's bucket-hosted `pipeline_cards.json` supplies which nodes are active plus their
> params/UUIDs, and the app is deployed as a bundle rather than a single inlined `index.html`.

### Session start workflow

**At the start of any session involving deployment or pipeline operations, always ask the user
which OpenHEXA workspace *and which UI variant* (`flowchart` or `cockpit`) they want to work on
before doing anything else.**

Then:

1. Check whether the workspace has a catalog in its bucket:
   `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")`
   (`<ws>` = the workspace slug, hyphens). Note the `updatedAt` — that is the catalog's real age.
2. If yes — that is the pipeline catalog; the app reads it itself at runtime. Resolve the webapp
   `id`/`slug` live via `list_static_webapps` when you need to deploy or inspect (match the variant
   by webapp **slug** — see _UI variants_). Read the file with `read_file` only if you need its
   contents, not just its existence.
3. If no — the orchestrator cannot boot in that workspace. Tell the user, and ask them to install
   and run **`create_pipeline_cards`** there (source in `utils_pipelines/create_pipeline_cards/`).
   It takes **no parameters** — just Run. But check that the webapp named by its
   `config.WEBAPP_SLUG` (currently the Cockpit app) is deployed in that workspace first, since its
   map is the curation authority and the run fails without it. Do not generate a catalog by hand
   and do not add one to the bundle.

When about to **edit an existing webapp**, pull its live files with `mcp__claude_ai_OpenHEXA__get_static_webapp` first and diff them against the repo (`app/<variant>/` + `app/pipeline_descriptions.json`) — this catches drift (e.g. edits made directly in the OpenHEXA UI) before you overwrite it on the next deploy.

Resolving workspace / app identifiers (all **live** — nothing stored in the repo):

- **workspace slug** — from `list_workspaces`; used in all MCP tool calls (and injected at runtime as `window.OPENHEXA.workspaceSlug`).
- **webapp `id` / `slug` / `url` / `allowedOperations`** — from `list_static_webapps` / `get_static_webapp`. `id` is passed to `update_static_webapp`; `slug` to `get_static_webapp`.
