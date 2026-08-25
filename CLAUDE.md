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
- **Uploading webapp files (wholesale rewrites / new bundles)** — For a full bundle upload or a
  wholesale rewrite of a large file, offer the user the option to drag-and-drop changed files
  directly into the OpenHEXA UI from `app/<variant>/` (the variant's bundle) or
  `app/pipeline_descriptions.json` (shared across variants) instead of having the agent assemble and
  deploy via MCP. This avoids reading large files into context and is often faster. Mention it as:
  *"You can also drag the changed file(s) from `app/<variant>/` (or `app/pipeline_descriptions.json`)
  straight into the OpenHEXA webapp settings — no size limit and no agent token cost. Want to do that
  instead, or shall I deploy via the API?"* Small, targeted edits to an existing file don't need this
  offer — `mcp__claude_ai_OpenHEXA__edit_static_webapp_file` handles those directly.

Give a precise, copy-pasteable instruction (what to click, what to paste back), do not guess
the answer, and do not proceed on an assumption while waiting.

### 3. Jira is Giulia's, not the agent's

Work is tracked in Jira (project `SNT25`, Epic `SNT25-536`). **Giulia manages all Jira items manually
through the Jira UI** — the agent does not create, edit, transition, or link Jira issues for this
project. Only touch Jira via the Atlassian MCP if Giulia explicitly asks for it in a given session.

---

## What this project is

The **SNT Pipelines Orchestrator**: one static webapp per OpenHEXA workspace that presents the ~18
official SNT pipelines (from the separate `snt_development` repo) as a single guided, interactive
surface with a configuration/run sidebar. It ships in two independently-deployable UI variants —
**`flowchart`** (a 2D node/edge map, English-only) and **`cockpit`** (a step-by-step walkthrough,
bilingual EN/FR, and the **v1 lead variant** where new functionality lands first).

## Read-this-first map

**Load only what the session needs.** Each file below states its own trigger.

| Read this | When |
| --- | --- |
| `docs/PRODUCT_SPEC.md` | **Any session working toward the orchestrator.** Part A = variant-independent functionality, Part B = UI variants, Part C = the v0/v1/v2 roadmap. Locate the current scope here first. |
| [`docs/agent/orchestrator-app.md`](docs/agent/orchestrator-app.md) | Before editing anything under `app/` — variants, map format, node states, bilingual UI, the two-variant DOM seam. |
| [`docs/agent/openhexa-runtime.md`](docs/agent/openhexa-runtime.md) | Before writing or debugging webapp code that talks to the OpenHEXA API — the proxy, scopes, every GraphQL query, run/poll, signed URLs, report embed. |
| [`docs/agent/deploy.md`](docs/agent/deploy.md) | Before any deploy, or before inspecting a live webapp's files — which tool to use, partial deploys, the Read-cap fallbacks, the PowerShell `files_json` recipe. |
| [`docs/agent/catalog.md`](docs/agent/catalog.md) | Any question about which pipelines exist in a workspace, their UUIDs, or their parameters — including "why is this node greyed out" and `INVALID_CONFIG` run failures. |
| [`docs/agent/settled-questions.md`](docs/agent/settled-questions.md) | **Before investigating any OpenHEXA capability question** — dead ends, upstream doc traps, corrected notes, roads deliberately not taken. Cheap to check, saves whole sessions. **Also write to it:** if a session burns time proving something impossible, hits a wrong upstream example, or rejects a workable alternative, add a dated row before finishing (see the file's own "Adding to this file" section). |
| `schemas/schema.generated.graphql` | Any session involving static webapps or GraphQL operations. |
| `schemas/*.schema.json` | The contracts for `pipeline_map.json`, `pipeline_cards.json`, `pipeline_descriptions.json`. |
| `design/wireframes/orchestrator_wireframe*.html` | The visual/UX target for each variant. |

## Repo layout

Everything committed here is either **generic** or **per-variant**. There are **no workspace-specific
artifacts in the repo at all** — the only per-workspace data lives in each OpenHEXA workspace's own
bucket.

- **`app/<variant>/`** — one generic orchestrator bundle per UI variant (`index.html`, `styles.css`,
  `app.js`, `pipeline_map.json`), shared by every workspace for that variant. Single source of truth
  for that variant's app; there are no per-workspace copies.
- **`app/pipeline_descriptions.json`** — the one file under `app/` outside any `<variant>/` subfolder:
  hand-authored node description text, shared unchanged across every variant and workspace. Values are
  bilingual `{ en, fr }` objects — **editing a description means editing both languages.**
- **`utils_pipelines/`** — OpenHEXA pipelines that support the webapp itself (as opposed to the ~18 SNT
  process pipelines the orchestrator *runs*). Currently just `create_pipeline_cards/`, which generates
  each workspace's catalog.
- **`schemas/`**, **`docs/`**, **`design/`** — contracts, consolidated docs, and WIP/design explorations.
- **`archive/`** — retired spikes and pre-orchestrator single-file webapps. Reference only — not
  deployed, not maintained.

## The four load-bearing invariants

Everything else is detail in the linked docs. These four are always true and are the ones most often
got wrong:

1. **The deployed bundle is 5 files and is entirely workspace-independent.** `app/<variant>/*` (4
   files) + `app/pipeline_descriptions.json`. The app self-adapts at runtime via
   `window.OPENHEXA.workspaceSlug` plus cards-driven greying. The only non-generic thing baked into
   `app.js` is the hardcoded SaaS base `https://app.openhexa.org`. → **new workspace = deploy the same
   5 files, then run `create_pipeline_cards` there.**

2. **The pipeline catalog is not a repo file and is never deployed.** Each workspace's
   `pipeline_cards.json` lives in its own bucket at
   `utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json`, written by running the
   `create_pipeline_cards` pipeline and read live at boot. **A workspace without one cannot boot the
   app.** Never hand-edit it, never add it to a bundle, never copy one between workspaces — the fix
   for any catalog problem is to re-run the generator. See [`catalog.md`](docs/agent/catalog.md).

3. **Webapp identity and scopes are never stored in the repo — resolve them live.** `id`, `slug`,
   `url`, `allowedOperations` all come from `list_static_webapps` / `get_static_webapp` at the moment
   you need them. ⚠️ Two flowchart slugs are live in the wild, so **never match on slug equality** —
   use the rule in
   [`orchestrator-app.md`](docs/agent/orchestrator-app.md#telling-variants-apart-on-the-live-platform).

4. **The orchestrator needs exactly four scopes: `PIPELINES_READ`, `PIPELINES_RUN`, `FILES_READ`,
   `USER_READ`** — and the webapp must stay **private** (public webapps cannot call the GraphQL proxy
   at all). `FILES_READ` is boot-critical: it's what reads the catalog. `USER_READ` is the one most
   often forgotten — without it the DHIS2-connection dropdown silently degrades to a text input.
   Scopes are webapp metadata, set once per webapp, not part of any deploy.

The stable join key across every file and every workspace is the node `id` == the pipeline's Python
function name (e.g. `snt_dhis2_extract`). Pipeline UUIDs and codes differ per workspace; the function
name does not.

## Session start workflow

**At the start of any session involving deployment or pipeline operations, always ask the user which
OpenHEXA workspace *and which UI variant* (`flowchart` or `cockpit`) they want to work on before
doing anything else.**

Then:

1. Check whether the workspace has a catalog:
   `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")`. Note
   the `updatedAt` — that is the catalog's real age.
2. **If yes** — the app reads it itself at runtime; nothing to do. Resolve the webapp `id`/`slug` live
   via `list_static_webapps` when you need to deploy or inspect. Read the catalog's contents with
   `read_file` only if you actually need them (~45–60 KB).
3. **If no** — the orchestrator cannot boot there. Tell the user and ask them to install and run
   **`create_pipeline_cards`** (source in `utils_pipelines/create_pipeline_cards/`). It takes **no
   parameters** — just Run. But first check that the webapp named by its `config.WEBAPP_SLUG`
   (currently the Cockpit app) is deployed in that workspace, since its map is the curation authority
   and the run fails without it. Do not generate a catalog by hand.
4. **Before editing an existing webapp**, pull its live files and diff them against the repo — this
   catches drift (e.g. edits made directly in the OpenHEXA UI) before you overwrite it. See
   [`deploy.md`](docs/agent/deploy.md) for which read tool to use; the full-bundle read is expensive.

Resolving identifiers (all **live** — nothing stored in the repo):

- **workspace slug** — from `list_workspaces`; used in all MCP tool calls (and injected at runtime as
  `window.OPENHEXA.workspaceSlug`).
- **webapp `id` / `slug` / `url` / `allowedOperations`** — from `list_static_webapps` /
  `get_static_webapp`. `id` goes to `update_static_webapp`; `slug` goes to the read tools.
