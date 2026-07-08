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
├── app/                             # Generic orchestrator bundle — shared by ALL workspaces (single source of truth)
│   ├── index.html                   #   Minimal shell
│   ├── styles.css                   #   All styling
│   ├── app.js                       #   All logic (renders map, merges cards, runs/polls pipelines)
│   └── pipeline_map.json            #   Shared, hand-authored map (layout + dependency edges)
│
├── workspaces/                      # Per-workspace data — ONLY the file that differs per workspace
│   ├── snt-app-dev/
│   │   └── pipeline_cards.json      #   Cached pipeline catalog (names, UUIDs, parameters)
│   ├── snt-testing/
│   │   └── pipeline_cards.json
│   └── cmr-snt-process/
│       └── pipeline_cards.json
│
├── schemas/                         # Machine-readable contracts / references
│   ├── pipeline_map.schema.json     #   Schema for app/pipeline_map.json
│   ├── pipeline_cards.schema.json   #   Schema + instructions for generating pipeline_cards.json
│   └── schema.generated.graphql     #   OpenHEXA GraphQL schema — query reference for agents
│
├── docs/                            # Consolidated knowledge (stable)
│   ├── PRODUCT_SPEC.md              #   Product specification
│   ├── PLAN.md                      #   Phased, atomic task plan for the orchestrator
│   ├── JIRA_ITEMS.md                #   Reference/drafting sheet for Jira issues — managed manually (project SNT25)
│   └── personas/                    #   UX persona / discovery questionnaires
│
├── design/                          # WIP / design explorations (not contracts)
│   ├── wireframes/                  #   UX/visual targets for the orchestrator (map + cockpit variants)
│   ├── grid_editor.html             #   Interactive map-layout editor
│   ├── pipeline_map_preview.html    #   Standalone visual render of pipeline_map.json (for review)
│   └── pipeline_map_20260625.png    #   Map sketch (Whimsical)
│
└── archive/                         # Retired spikes & pre-orchestrator single-file apps (reference only)
    ├── snt-testing/                 #   dhis2_reporting_rate, population_transformation(_split), status_spike
    └── snt-drc-workshop-demo/       #   Older flat single-file webapp
```

**Generic** artifacts live in `app/` (the shared bundle) plus `schemas/` / `docs/` / `design/`.
**Workspace-specific** data is just `workspaces/<ws>/pipeline_cards.json` — one file per
workspace. Adding a new workspace means adding one `pipeline_cards.json`; nothing else changes.

> **No stored webapp config.** Webapp identity and scopes (id, slug, URL, allowed operations) are
> resolved **live** from the OpenHEXA API (`list_static_webapps` / `get_static_webapp`) at deploy
> time — the repo no longer keeps a `workspace_config.json`.

---

## The data architecture (orchestrator)

The orchestrator separates concerns across three kinds of file. The stable join key everywhere is
the node `id` == the pipeline's Python function name (e.g. `snt_dhis2_extract`).

| File                                   | Scope                          | Holds                                                                      |
| -------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `app/pipeline_map.json`                | **workspace-independent** (one shared file) | all nodes, grid position, type, mutex group, directed `edges` (deps) |
| `workspaces/<ws>/pipeline_cards.json`  | per-workspace                  | which pipelines exist + `uuid` + `parameters` (drives _active vs greyed_)  |
| `app/index.html` + `app/app.js` + `app/styles.css` | shared app shell (multi-file) | renders the map, merges with cards, runs/polls pipelines        |

The **map is identical across all workspaces** — every orchestrator shows the same full diagram.
What differs per workspace is only which nodes are _active_: a node is available iff its `id`
appears in that workspace's `pipeline_cards.json`. Pipelines not present render greyed-out and
unclickable. The map is **hand-authored** (validated against `schemas/pipeline_map.schema.json`),
not generated from the API.

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

Webapp identity and scopes (`id`, slug, URL, allowed operations) are **not** stored in the repo —
they're resolved live from the OpenHEXA API (`list_static_webapps` / `get_static_webapp`) at
deploy time, and are never fetched by the running app.

The app **self-adapts at runtime**: OpenHEXA injects `window.OPENHEXA.workspaceSlug` at page
load (so the same `app.js` queries _this_ workspace), and the generic map greys out any node
whose `id` isn't in this workspace's `pipeline_cards.json`. → **New workspace = same 4 generic
files (`app/`) + a new `workspaces/<ws>/pipeline_cards.json`** (proven in Phase 4 / tasks T4.1–T4.2).

> **One caveat to the "fully generic" claim:** `app.js` hardcodes the SaaS front-end base
> `https://app.openhexa.org` (for run / dataset links). That's the same for every SaaS
> workspace, but a self-hosted OpenHEXA install would need it changed — it's the only
> non-per-workspace assumption baked into the code.

---

## How it works

```
schemas/pipeline_cards.schema.json    ← schema + instructions for building pipeline catalogs (global)
        ↓ (generated once per workspace)
workspaces/<ws>/pipeline_cards.json   ← cached pipeline catalog: names, UUIDs, parameters (fetched at runtime)
        +
app/pipeline_map.json                 ← shared, hand-authored map: layout + dependency edges
app/index.html + app/styles.css + app/app.js   ← generic app shell (shared by all workspaces)
        ↓
deploy set = app/*  +  workspaces/<ws>/pipeline_cards.json
        ↓
OpenHEXA static webapp   (webapp id/slug resolved live via list_static_webapps)
```

---

## Using with an AI agent (Claude Code)

Open this directory in Claude Code. The agent reads `CLAUDE.md` for full instructions
automatically. For orchestrator work it also reads `docs/PLAN.md` and `docs/JIRA_ITEMS.md`
at session start. Then just describe what you want:

- **Deploy to an existing workspace:** "Update the webapp in workspace X to add pipeline Y"
- **Set up a new workspace:** "Create the webapp for workspace Z" — the agent looks up all UUIDs
  via the OpenHEXA MCP tools and creates a new `workspaces/<ws>/pipeline_cards.json`
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
   - Resolve pipeline UUIDs via `list_pipelines` (webapp id/slug via `list_static_webapps` at deploy time)
   - Create `workspaces/<ws>/pipeline_cards.json`
   - Deploy the generic `app/` bundle + that `pipeline_cards.json` to the workspace's webapp
4. Commit the new `workspaces/<ws>/pipeline_cards.json`

---

## Adding a new pipeline card

1. Tell the agent which workspace to deploy to and which pipelines to include
2. If a pipeline's parameters aren't already cached in `workspaces/<ws>/pipeline_cards.json`, the
   agent fetches the source from the
   [snt_development GitHub repo](https://github.com/BLSQ/snt_development) and extracts the
   `@parameter` decorators (see the type mapping and rules in `CLAUDE.md`)
3. The agent redeploys the bundle (`app/*` + `workspaces/<ws>/pipeline_cards.json`)

> `pipeline_cards.json` is a **cache, not live truth.** Each file carries a `generated_at` date;
> a pipeline's parameters on GitHub can drift after that. Before deploying, the agent states the
> cache date and asks whether to re-fetch params for the pipeline(s) the app will run.

---

## Deploying the bundle (and a known friction)

Deploys go through the OpenHEXA MCP tool (`update_static_webapp`), which the agent calls with
the file contents passed **inline** (the webapp `id` is resolved live via `list_static_webapps`).
Partial deploys work — only the changed files need to be sent — and after every deploy the agent
re-reads the live files with `get_static_webapp` and diffs them against the repo (`app/` +
`workspaces/<ws>/pipeline_cards.json`) to confirm what's live matches the source.

**Known friction (large files).** The deploy tool only accepts file _contents_, not a file
_path_, and the agent can only load a file into its working context up to a size limit. The
orchestrator's `app.js` has grown past that limit, so the agent has to read it back in slices
and reassemble it before sending — an automated but clunky extra step on every `app.js` deploy.
It's verified each time (the live file is diffed against the local copy), so it's a speed bump,
not a risk.

**Manual fallback — drag-drop from the repo.** Because the bottleneck is only about getting the
bytes _into the agent_, uploading a file yourself through the browser avoids it entirely. If the
OpenHEXA UI lets you replace files on an existing webapp (**Web Apps → the webapp →
edit/settings**), you can drag the changed file(s) straight from `app/` (generic) or
`workspaces/<ws>/pipeline_cards.json` into the UI — the repo copy is always the up-to-date
source, so this is safe. (The OpenHEXA
**CLI** can deploy _pipelines_ from local files but **not** static webapps today, so there's no
command-line shortcut yet — a request to add one has been raised with the OpenHEXA team.)

---

## Refreshing the OpenHEXA schema

If `schemas/schema.generated.graphql` becomes stale, regenerate it with:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql" -OutFile "schemas/schema.generated.graphql"
```

---

## Deployed webapps

The active product is the **SNT Pipelines Orchestrator**, deployed as the generic `app/` bundle
+ each workspace's `pipeline_cards.json`:

| Workspace       | Slug              | URL                                                          |
| --------------- | ----------------- | ----------------------------------------------------------- |
| SNT App Dev     | `snt-app-dev`     | https://snt-pipelines-orchestrator.openhexa.io/             |
| SNT Testing     | `snt-testing`     | https://snt-testing-snt-pipelines-orchestrator.openhexa.io/ |
| CMR SNT Process | `cmr-snt-process` | _resolve live via `list_static_webapps`_                    |

URLs and IDs are resolved **live** from the OpenHEXA API (`list_static_webapps`) — that, not this
table, is the source of truth.

> **Legacy single-pipeline webapps** (A.2 DHIS2 Formatting in the DRC workshop demo; DHIS2
> Reporting Rate, Population Transformation, and the status spike in SNT Testing) were the
> stepping stones toward the orchestrator. Their local copies now live under `archive/` and are
> no longer maintained.

> The **SNT Pipelines Orchestrator** is built in the dedicated **`snt-app-dev`** workspace (all
> ~18 pipelines installed — the primary build target) and also deployed to **`snt-testing`** (a
> subset installed, so it demos the greyed-out state) and **`cmr-snt-process`**.
