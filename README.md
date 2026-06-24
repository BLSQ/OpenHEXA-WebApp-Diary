# SNT Pipeline Webapps

This repository contains everything needed to build and deploy **OpenHEXA static webapps**
that let users trigger SNT pipeline runs from a browser — no code required.

The end goal is a single, rich webapp per workspace — the **SNT Pipelines Orchestrator** — that
renders the complete flow diagram of all official SNT pipelines (~18, from the `snt_development`
repo) as an interactive 2D map with a configuration/run sidebar. The small single-pipeline
webapps already in this repo are stepping stones toward it.

Webapps call the OpenHEXA GraphQL API via a same-origin proxy to start pipeline runs and poll
their status. A simple webapp can be a single `index.html`; the orchestrator is a **multi-file
bundle** (`index.html` + `styles.css` + `app.js` + JSON data files) served as-is from the same
origin.

> **Agent-driven repo.** This project is built with Claude Code. The authoritative, detailed
> instructions live in [`CLAUDE.md`](CLAUDE.md) — the agent reads it at session start. This
> README is the human-facing overview; when the two disagree, `CLAUDE.md` wins.

---

## Repository structure

```
/
├── CLAUDE.md                        # Agent instructions (read by Claude Code at session start)
├── README.md
├── .gitignore
│
├── knowledge/                       # Planning & spec docs (workspace-independent)
│   ├── PLAN.md                      #   Phased, atomic task plan for the orchestrator
│   ├── JIRA_ITEMS.md                #   Reference/drafting sheet for Jira issues — Jira is managed manually (project SNT25)
│   ├── PRODUCT_SPEC.md              #   Product specification
│   ├── persona_questionnaire.md     #   UX persona / discovery questionnaire
│   ├── orchestrator_wireframe.html  #   UX/visual target for the orchestrator
│   ├── pipeline_map_preview.html    #   Standalone visual render of pipeline_map.json (for review)
│   ├── pipeline_map_20260615.png    #   Map sketch (Whimsical, T0.3) — current
│   └── pipeline_map_20260610.png    #   Map sketch — earlier revision
│
├── schema.generated.graphql         # OpenHEXA GraphQL schema — query reference for agents
├── pipeline_cards_schema.json       # Schema + instructions for generating pipeline_cards.json files
├── pipeline_map_schema.json         # Schema for the shared orchestrator map (pipeline_map.json)
├── pipeline_map.json                # Shared, hand-authored orchestrator map (layout + dependency edges)
├── pipeline_map_NOTES.md            # Authoring rationale, conventions & changelog for pipeline_map.json
│
├── snt_testing/                     # One folder per workspace (slug, hyphens → underscores)
│   ├── workspace_config.json        #   Resolved IDs (pipeline UUIDs, deployed_apps, connection slugs)
│   ├── pipeline_cards.json          #   Cached pipeline catalog (names, UUIDs, parameters)
│   ├── dhis2_reporting_rate/        #   One subfolder per deployed webapp...
│   │   └── index.html               #     ...mirroring every file as last deployed
│   ├── population_transformation/
│   │   └── index.html
│   ├── population_transformation_split/   # multi-file bundle example
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   ├── orchestrator/                # SNT Pipelines Orchestrator bundle (deployed; demos greying — 11 active, 7 greyed)
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── app.js
│   │   ├── pipeline_map.json
│   │   └── pipeline_cards.json
│   └── status_spike/                # status-proxy spike (T0.9), local only — not a tracked deployment
│       └── index.html
│
├── snt_drc_workshop_demo/
│   ├── workspace_config.json
│   ├── pipeline_cards.json
│   └── index.html                   #   (older flat single-file layout)
│
└── snt_app_dev/                     # Dedicated orchestrator build/test workspace (all ~18 pipelines)
    ├── workspace_config.json
    ├── pipeline_cards.json
    └── orchestrator/                # SNT Pipelines Orchestrator bundle (deployed — the primary build target)
        ├── index.html
        ├── styles.css
        ├── app.js
        ├── pipeline_map.json
        └── pipeline_cards.json
```

**Global files** (root + `knowledge/`) apply to all workspaces. **Workspace folders** contain
workspace-specific artifacts. Adding a new workspace means creating a new folder — nothing else
changes.

> **Layout convention.** Each deployed webapp lives in its own snake_case **subfolder** under
> the workspace, matching its key in `deployed_apps` (e.g. `snt_testing/dhis2_reporting_rate/`).
> The older `snt_drc_workshop_demo/` still uses a flat `index.html`; new work follows the
> subfolder convention.

---

## The data architecture (orchestrator)

The orchestrator separates concerns across four files. The stable join key everywhere is the
node `id` == the pipeline's Python function name (e.g. `snt_dhis2_extract`).

| File                                   | Scope                          | Holds                                                                      |
| -------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `pipeline_map.json`                    | **workspace-independent** (root, shared) | all nodes, grid position, type, mutex group, directed `edges` (deps) |
| `<ws>/pipeline_cards.json`             | per-workspace                  | which pipelines exist + `uuid` + `parameters` (drives _active vs greyed_)  |
| `<ws>/workspace_config.json`           | per-workspace                  | IDs, `deployed_apps` (webapp ID, slug, URL, allowed scopes)                |
| `index.html` + `app.js` + `styles.css` | shared app shell (multi-file)  | renders the map, merges with cards, runs/polls pipelines                   |

The **map is identical across all workspaces** — every orchestrator shows the same full diagram.
What differs per workspace is only which nodes are _active_: a node is available iff its `id`
appears in that workspace's `pipeline_cards.json`. Pipelines not present render greyed-out and
unclickable. The map is **hand-authored** (validated against `pipeline_map_schema.json`), not
generated from the API.

### Generic vs workspace-specific (what to reuse)

The deployed bundle is **5 files: 4 generic + 1 workspace-specific.** This is what makes the
orchestrator portable — a new workspace reuses the 4 generic files unchanged and only swaps in
its own `pipeline_cards.json`.

| File                | Generic / WS-specific | Notes                                                                    |
| ------------------- | --------------------- | ------------------------------------------------------------------------ |
| `index.html`        | **Generic**           | Empty page shell — identical everywhere.                                 |
| `styles.css`        | **Generic**           | All styling — no workspace details.                                      |
| `app.js`            | **Generic**           | All logic — **zero** hardcoded workspace specifics (see caveat below).   |
| `pipeline_map.json` | **Generic**           | The shared SNT process map — same in every workspace.                    |
| `pipeline_cards.json` | **⚠️ WS-specific**  | The only file that changes per workspace: which pipelines exist here + their `uuid` + `parameters`. |

A 6th file, `<ws>/workspace_config.json`, is also workspace-specific but is **not deployed** —
the browser never fetches it. It's deploy-time metadata (webapp `id`, slug, allowed scopes) used
by the agent/build, not by the running app.

The app **self-adapts at runtime**: OpenHEXA injects `window.OPENHEXA.workspaceSlug` at page
load (so the same `app.js` queries _this_ workspace), and the generic map greys out any node
whose `id` isn't in this workspace's `pipeline_cards.json`. → **New workspace = same 4 generic
files + a new `pipeline_cards.json`** (proven in Phase 4 / tasks T4.1–T4.2).

> **One caveat to the "fully generic" claim:** `app.js` hardcodes the SaaS front-end base
> `https://app.openhexa.org` (for run / dataset links). That's the same for every SaaS
> workspace, but a self-hosted OpenHEXA install would need it changed — it's the only
> non-per-workspace assumption baked into the code.

---

## How it works

```
pipeline_cards_schema.json        ← schema + instructions for building pipeline catalogs (global)
        ↓ (generated once per workspace)
<workspace>/pipeline_cards.json   ← cached pipeline catalog: names, UUIDs, parameters (fetched at runtime)
        +
pipeline_map.json                 ← shared, hand-authored map: layout + dependency edges (orchestrator)
        +
<workspace>/workspace_config.json ← deploy-time metadata: webapp ID, slug, allowed scopes
        ↓
<workspace>/<app_key>/            ← bundle deployed to OpenHEXA, mirrored here after every deploy
    index.html + styles.css + app.js + pipeline_map.json + pipeline_cards.json
```

---

## Using with an AI agent (Claude Code)

Open this directory in Claude Code. The agent reads `CLAUDE.md` for full instructions
automatically. For orchestrator work it also reads `knowledge/PLAN.md` and `knowledge/JIRA_ITEMS.md`
at session start. Then just describe what you want:

- **Deploy to an existing workspace:** "Update the webapp in workspace X to add pipeline Y"
- **Set up a new workspace:** "Create the webapp for workspace Z" — the agent looks up all UUIDs
  via the OpenHEXA MCP tools and creates a new `<workspace>/` folder
- **Add a new pipeline card:** "Add a card for `snt_dhis2_incidence`" — the agent fetches the
  pipeline source from GitHub, extracts the `@parameter` decorators, updates the workspace's
  `pipeline_cards.json`, and redeploys

The agent needs access to the **OpenHEXA MCP server** (configured in Claude Code settings) to
look up workspace/pipeline IDs and deploy webapps.

---

## Adding a new workspace

1. Open Claude Code in this directory
2. Say: _"Create the webapp for workspace `<workspace name>`"_
3. The agent will:
   - Find the workspace slug via `list_workspaces`
   - Resolve pipeline UUIDs via `list_pipelines` and webapp IDs via `list_static_webapps`
   - Create `<workspace>/workspace_config.json` and `<workspace>/pipeline_cards.json`
   - Build and deploy the webapp into `<workspace>/<app_key>/`
4. Commit the new workspace folder

---

## Adding a new pipeline card

1. Tell the agent which workspace to deploy to and which pipelines to include
2. If a pipeline's parameters aren't already cached in `<workspace>/pipeline_cards.json`, the
   agent fetches the source from the
   [snt_development GitHub repo](https://github.com/BLSQ/snt_development) and extracts the
   `@parameter` decorators (see the type mapping and rules in `CLAUDE.md`)
3. The agent rebuilds and redeploys the webapp bundle under `<workspace>/<app_key>/`

> `pipeline_cards.json` is a **cache, not live truth.** Each file carries a `generated_at` date;
> a pipeline's parameters on GitHub can drift after that. Before deploying, the agent states the
> cache date and asks whether to re-fetch params for the pipeline(s) the app will run.

---

## Deploying the bundle (and a known friction)

Deploys go through the OpenHEXA MCP tool (`update_static_webapp`), which the agent calls with
the file contents passed **inline**. Partial deploys work — only the changed files need to be
sent — and after every deploy the agent re-reads the live files and mirrors them under
`<workspace>/<app_key>/`, so the local copy always matches what's live.

**Known friction (large files).** The deploy tool only accepts file _contents_, not a file
_path_, and the agent can only load a file into its working context up to a size limit. The
orchestrator's `app.js` has grown past that limit, so the agent has to read it back in slices
and reassemble it before sending — an automated but clunky extra step on every `app.js` deploy.
It's verified each time (the live file is diffed against the local copy), so it's a speed bump,
not a risk.

**Manual fallback — drag-drop from the repo.** Because the bottleneck is only about getting the
bytes _into the agent_, uploading a file yourself through the browser avoids it entirely. If the
OpenHEXA UI lets you replace files on an existing webapp (**Web Apps → the webapp →
edit/settings**), you can drag the changed file(s) straight from `<workspace>/<app_key>/` in this
repo into the UI — the repo copy is always the up-to-date source, so this is safe. (The OpenHEXA
**CLI** can deploy _pipelines_ from local files but **not** static webapps today, so there's no
command-line shortcut yet — a request to add one has been raised with the OpenHEXA team.)

---

## Refreshing the OpenHEXA schema

If `schema.generated.graphql` becomes stale, regenerate it with:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql" -OutFile "schema.generated.graphql"
```

---

## Deployed webapps

| Workspace             | Webapp                          | URL                                                       | Folder                                          |
| --------------------- | ------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| SNT DRC Workshop Demo | A.2 DHIS2 Formatting            | https://a-2-dhis2-formatting.openhexa.io/                 | `snt_drc_workshop_demo/`                        |
| SNT Testing           | DHIS2 Reporting Rate            | https://dhis2-reporting-rate.openhexa.io/                 | `snt_testing/dhis2_reporting_rate/`             |
| SNT Testing           | Population Transformation       | https://run-population-transformation-pipeline.openhexa.io/ | `snt_testing/population_transformation/`        |
| SNT Testing           | Population Transformation (split) | https://population-transformation-split.openhexa.io/    | `snt_testing/population_transformation_split/`  |
| SNT App Dev           | SNT Pipelines Orchestrator      | https://snt-pipelines-orchestrator.openhexa.io/          | `snt_app_dev/orchestrator/`                     |
| SNT Testing           | SNT Pipelines Orchestrator      | https://snt-testing-snt-pipelines-orchestrator.openhexa.io/ | `snt_testing/orchestrator/`                  |

URLs and IDs come from each workspace's `workspace_config.json` — that file, not this table, is
the source of truth.

> The **SNT Pipelines Orchestrator** is built in the dedicated **`snt_app_dev`** workspace (all
> ~18 pipelines installed — the primary build target) and also deployed to **`snt_testing`** (11
> of 18 installed, so it demos the greyed-out state). Both are live read-only status boards
> (Phase 1); running pipelines from the board arrives in Phase 2.
