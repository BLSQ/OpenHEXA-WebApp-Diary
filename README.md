# SNT Pipeline Webapps

This repository contains everything needed to build and deploy **OpenHEXA static webapps**
that let users trigger SNT pipeline runs from a browser — no code required.

The active product is the **SNT Pipelines Orchestrator** — one webapp per workspace that presents
all official SNT pipelines (~18, from the `snt_development` repo) as a single guided surface with
a configuration/run sidebar. It ships in **two UI variants**: `flowchart` (an interactive 2D
node/edge map) and `cockpit` (a one-step-at-a-time guided walkthrough, and the variant where new
functionality lands first). The earlier single-pipeline webapps were the stepping stones toward it
and now live in [`archive/`](archive/) for reference only.

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
├── .claude/                         # Claude Code config (shared: settings + guardrail hook)
│   ├── settings.json
│   └── hooks/block-destructive-git.js   #   Hard-blocks destructive git commands
│
├── app/                             # One generic bundle per UI variant — shared by ALL workspaces
│   ├── flowchart/                   #   2D node/edge flow-diagram map. English only
│   │   ├── index.html               #     Minimal shell
│   │   ├── styles.css               #     All styling
│   │   ├── app.js                   #     All logic (renders map, merges cards, runs/polls pipelines)
│   │   └── pipeline_map.json        #     Hand-authored map (layout + dependency edges), this variant only
│   ├── cockpit/                     #   Guided one-step-at-a-time walkthrough. Bilingual EN|FR; embeds HTML reports
│   │   ├── index.html               #     Same 4-file shape as flowchart — variant owns its own copies
│   │   ├── styles.css
│   │   ├── app.js                   #     Also holds the I18N string table (app chrome, EN + FR)
│   │   └── pipeline_map.json        #     May drift from flowchart's map; `label`s are {en, fr}
│   └── pipeline_descriptions.json   #   Shared node descriptions — ONE copy, every variant AND workspace; values are {en, fr}
│
├── workspaces/                      # Per-workspace, per-variant data — ONLY the file that differs
│   ├── snt-app-dev/
│   │   ├── flowchart/
│   │   │   └── pipeline_cards.json  #   Cached pipeline catalog (names, UUIDs, parameters)
│   │   └── cockpit/
│   │       └── pipeline_cards.json
│   ├── snt-testing/
│   │   ├── flowchart/
│   │   │   └── pipeline_cards.json
│   │   └── cockpit/
│   │       └── pipeline_cards.json
│   └── cmr-snt-process/
│       └── flowchart/
│           └── pipeline_cards.json
│
├── schemas/                         # Machine-readable contracts / references
│   ├── pipeline_map.schema.json          #   Schema for app/<variant>/pipeline_map.json
│   ├── pipeline_cards.schema.json        #   Schema + instructions for generating pipeline_cards.json
│   ├── pipeline_descriptions.schema.json #   Schema + Markdown-lite rules for pipeline_descriptions.json
│   └── schema.generated.graphql          #   OpenHEXA GraphQL schema — query reference for agents
│
├── docs/                            # Consolidated knowledge (stable)
│   ├── PRODUCT_SPEC.md              #   Product spec: functionality, UI variants, v0/v1/v2 roadmap
│   └── personas/                    #   UX persona / discovery questionnaires
│
├── design/                          # WIP / design explorations (not contracts)
│   ├── wireframes/                  #   UX/visual targets for the orchestrator:
│   │   ├── orchestrator_wireframe.html               #     flowchart variant
│   │   ├── orchestrator_wireframe_cockpit.html       #     cockpit variant (the live target)
│   │   ├── orchestrator_wireframe_cockpit_narrative.html  #  narrative layer — PARKED (v2)
│   │   └── orchestrator_frosted.html                 #     visual-style exploration
│   ├── grid_editor.html             #   Interactive map-layout editor
│   ├── pipeline_map_preview.html    #   Standalone visual render of pipeline_map.json (for review)
│   └── pipeline_map_20260625.png    #   Map sketch (Whimsical)
│
└── archive/                         # Retired spikes & pre-orchestrator single-file apps (reference only)
    ├── snt-app-dev/report-embed/    #   Report-iframe feasibility spike (since built into cockpit)
    ├── snt-testing/                 #   dhis2_reporting_rate, population_transformation(_split), status_spike
    └── snt-drc-workshop-demo/       #   Older flat single-file webapp
```

_(A local-only `ignore/` folder is git-ignored personal scratch — not part of the project.)_

**Generic** artifacts live in `app/<variant>/` (one bundle per UI variant) plus `schemas/` /
`docs/` / `design/`. **Cross-variant shared** text lives in `app/pipeline_descriptions.json` —
one hand-authored copy of every node's description, deployed unchanged into both variants'
bundles. **Workspace-specific** data is just `workspaces/<ws>/<variant>/pipeline_cards.json` —
one file per workspace per variant. Adding a new workspace to an existing variant means adding
one `pipeline_cards.json`; nothing else changes. See "UI variants" below for why there's more
than one `app/` subfolder.

> **No stored webapp config.** Webapp identity and scopes (id, slug, URL, allowed operations) are
> resolved **live** from the OpenHEXA API (`list_static_webapps` / `get_static_webapp`) at deploy
> time — the repo no longer keeps a `workspace_config.json`.

---

## UI variants

The orchestrator can exist as more than one independently-deployable UI variant — same pipeline
data, different layout/UX. Each variant is a fully self-contained bundle under `app/<variant>/`
(including its own `pipeline_map.json` — variants do not share files, by design, so each UI can
evolve independently).

| Variant     | Status                                          | What it is                                                                                                        |
| ----------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `flowchart` | **Production** — 3 workspaces                   | Interactive 2D node/edge map + config/run sidebar. **English only**; links out to HTML reports                     |
| `cockpit`   | **Production** — 2 workspaces; **v1 lead**      | Focused, one-step-at-a-time guided walkthrough. **Bilingual EN\|FR**, and embeds HTML reports in-app. Target UX: `design/wireframes/orchestrator_wireframe_cockpit.html` |

New functionality generally lands in `cockpit` first (it's the v1 lead variant), so the two
variants are deliberately **not** feature-equal — see the feature notes above.

Deploying a given workspace + variant combination is 6 files — 4 generic (`app/<variant>/*`) +
1 cross-variant shared (`app/pipeline_descriptions.json`, same content in both variants' bundles)
+ 1 workspace-specific (`workspaces/<ws>/<variant>/pipeline_cards.json`).

Since webapp identity isn't stored in the repo, live webapps are told apart by **slug** —
`snt-pipelines-orchestrator` (flowchart) vs `snt-pipelines-orchestrator-cockpit` (cockpit).
Slugs are consistent everywhere; **names are not** — `snt-app-dev` and `snt-testing` use the
`SNT Pipelines Orchestrator - Flowchart` / `- Cockpit` convention, but `cmr-snt-process` is
still named the bare `SNT Pipelines Orchestrator`.

---

## The data architecture (orchestrator)

The orchestrator separates concerns across four kinds of file. The stable join key everywhere is
the node `id` == the pipeline's Python function name (e.g. `snt_dhis2_extract`).

| File                                                                             | Scope                                  | Holds                                                                     |
| -------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `app/<variant>/pipeline_map.json`                                                | **per-variant, workspace-independent** | all nodes, labels, grid position, type, mutex group, directed `edges` (deps) |
| `app/pipeline_descriptions.json`                                                 | **shared across every variant AND workspace** | hand-authored, Markdown-lite description per node, keyed by `id`, as `{en, fr}` |
| `workspaces/<ws>/<variant>/pipeline_cards.json`                                  | per-workspace, per-variant             | which pipelines exist + `uuid` + `parameters` (drives _active vs greyed_) |
| `app/<variant>/index.html` + `app/<variant>/app.js` + `app/<variant>/styles.css` | per-variant app shell (multi-file)     | renders the UI, merges map + descriptions with cards, runs/polls pipelines |

The **map is identical across all workspaces for a given variant** — every orchestrator shows
the same full diagram. What differs per workspace is only which nodes are _active_: a node is
available iff its `id` appears in that workspace's `pipeline_cards.json`. Pipelines not present
render greyed-out and unclickable. The map is **hand-authored** (validated against
`schemas/pipeline_map.schema.json`), not generated from the API.

### Generic vs workspace-specific (what to reuse)

For a given variant, the deployed bundle is **6 files: 4 generic + 1 cross-variant shared + 1
workspace-specific.** This is what makes the orchestrator portable — a new workspace reuses that
variant's 4 generic files (plus the shared descriptions) unchanged and only swaps in its own
`pipeline_cards.json`.

| File                        | Generic / Shared / WS-specific | Notes                                                                                                                                       |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                | **Generic** (per variant)      | Empty page shell — identical across workspaces for this variant.                                                                            |
| `styles.css`                | **Generic** (per variant)      | All styling — no workspace details.                                                                                                         |
| `app.js`                    | **Generic** (per variant)      | All logic — **zero** hardcoded workspace specifics (see caveat below).                                                                      |
| `pipeline_map.json`         | **Generic** (per variant)      | The SNT process map for this variant — same in every workspace, but NOT shared with other variants.                                         |
| `pipeline_descriptions.json`| **🔁 Shared**                  | Node description text (bilingual `{en, fr}`) — one repo copy under `app/`, deployed identically into both variants' bundles (same content, deployed twice). |
| `pipeline_cards.json`       | **⚠️ WS-specific**             | The only file that changes per workspace (and is tracked separately per variant): which pipelines exist here + their `uuid` + `parameters`. |

Webapp identity and scopes (`id`, slug, URL, allowed operations) are **not** stored in the repo —
they're resolved live from the OpenHEXA API (`list_static_webapps` / `get_static_webapp`) at
deploy time, and are never fetched by the running app.

The app **self-adapts at runtime**: OpenHEXA injects `window.OPENHEXA.workspaceSlug` at page
load (so the same `app.js` queries _this_ workspace), and the generic map greys out any node
whose `id` isn't in this workspace's `pipeline_cards.json`. → **New workspace (same variant) =
same 4 generic files (`app/<variant>/`) + `app/pipeline_descriptions.json` + a new
`workspaces/<ws>/<variant>/pipeline_cards.json`** (proven by the ports to `snt-testing` and
`cmr-snt-process`).

> **One caveat to the "fully generic" claim:** `app.js` hardcodes the SaaS front-end base
> `https://app.openhexa.org` (for run / dataset links). That's the same for every SaaS
> workspace, but a self-hosted OpenHEXA install would need it changed — it's the only
> non-per-workspace assumption baked into the code.

---

## Languages (EN | FR)

French is the **main interface language for v1** — nearly all users are French-speaking. It's
built as **one webapp with an EN/FR toggle** in the header, not as separate per-language builds.

**Shipped in the `cockpit` variant only.** `flowchart` is still English-only. Both variants read
the same shared `app/pipeline_descriptions.json`, so its bilingual shape has to keep working for
both — flowchart simply reads the `en` side.

What is and isn't translated:

| Text                                      | Where it lives                                  | Translated?                      |
| ----------------------------------------- | ----------------------------------------------- | -------------------------------- |
| App chrome (buttons, statuses, headings)  | `I18N` table in `app/cockpit/app.js`            | ✅ EN + FR                       |
| Pipeline / step titles                    | `app/cockpit/pipeline_map.json` → `label`        | ✅ `{en, fr}`                    |
| Pipeline descriptions                     | `app/pipeline_descriptions.json`                 | ✅ `{en, fr}`                    |
| Parameter labels, help text, dropdowns    | `workspaces/<ws>/cockpit/pipeline_cards.json`    | ❌ English (comes from pipeline source) |

**If you edit a pipeline description, write both languages.** Values are
`{ "en": "…", "fr": "…" }` objects holding the same Markdown-lite prose. (A plain string still
works and is treated as English, so older entries don't break.)

The toggle remembers your choice (`localStorage`), and you can deep-link a language with
`?lang=fr`. Switching language re-renders the whole panel.

> ⚠️ The French strings are **drafts pending review** — they haven't been signed off as final copy.

---

## How it works

```
schemas/pipeline_cards.schema.json          ← schema + instructions for building pipeline catalogs (global)
        ↓ (generated once per workspace, per variant)
workspaces/<ws>/<variant>/pipeline_cards.json   ← cached pipeline catalog: names, UUIDs, parameters (fetched at runtime)
        +
app/<variant>/pipeline_map.json             ← hand-authored map for this variant: layout + dependency edges
app/pipeline_descriptions.json              ← hand-authored node descriptions, shared across variants + workspaces
app/<variant>/index.html + styles.css + app.js   ← this variant's app shell (shared by all workspaces)
        ↓
deploy set = app/<variant>/*  +  app/pipeline_descriptions.json  +  workspaces/<ws>/<variant>/pipeline_cards.json
        ↓  (flattened — all 6 files land in the webapp root, side by side)
OpenHEXA static webapp   (webapp id/slug resolved live via list_static_webapps; variant told
                          apart live by webapp SLUG — see "UI variants")
```

---

## Using with an AI agent (Claude Code)

Open this directory in Claude Code. The agent reads `CLAUDE.md` for full instructions
automatically. For orchestrator work it also reads `docs/PRODUCT_SPEC.md` (product scope +
v0/v1/v2 roadmap) at session start. Then just describe what you want:

- **Deploy to an existing workspace:** "Update the flowchart webapp in workspace X to add pipeline Y"
- **Set up a new workspace:** "Create the flowchart webapp for workspace Z" — the agent looks up
  all UUIDs via the OpenHEXA MCP tools and creates a new `workspaces/<ws>/flowchart/pipeline_cards.json`
- **Add a new pipeline card:** "Add a card for `snt_dhis2_incidence`" — the agent fetches the
  pipeline source from GitHub, extracts the `@parameter` decorators, updates the workspace's
  `pipeline_cards.json` for the relevant variant, and redeploys

The agent needs access to the **OpenHEXA MCP server** (configured in Claude Code settings) to
look up workspace/pipeline IDs and deploy webapps.

**Guardrails are enforced, not just documented.** `CLAUDE.md` opens with agent guardrails (ask
before any git/GitHub write; never do anything destructive or history-rewriting; hand
faster-by-hand steps back to you), and `.claude/hooks/block-destructive-git.js` is a `PreToolUse`
hook that hard-denies the destructive commands (`git reset --hard`, `push --force`, `rebase`,
`clean`, branch/tag deletion, `stash drop`, `restore`, `filter-branch`, `gh pr close`,
`gh repo delete`, `gh api -X DELETE`, …) regardless of what the agent is asked to do. If you want
one of those, run it by hand.

---

## Adding a new workspace

1. Open Claude Code in this directory
2. Say: _"Create the `<variant>` webapp for workspace `<workspace name>`"_ (specify which UI
   variant — `flowchart` or `cockpit`)
3. The agent will:
   - Find the workspace slug via `list_workspaces`
   - Resolve pipeline UUIDs via `list_pipelines` (webapp id/slug via `list_static_webapps` at deploy time)
   - Create `workspaces/<ws>/<variant>/pipeline_cards.json`
   - Deploy the generic `app/<variant>/` bundle + `app/pipeline_descriptions.json` + that `pipeline_cards.json` to the workspace's webapp
4. Commit the new `workspaces/<ws>/<variant>/pipeline_cards.json`

---

## Adding a new pipeline card

1. Tell the agent which workspace and variant to deploy to, and which pipelines to include
2. If a pipeline's parameters aren't already cached in
   `workspaces/<ws>/<variant>/pipeline_cards.json`, the agent fetches the source from the
   [snt_development GitHub repo](https://github.com/BLSQ/snt_development) and extracts the
   `@parameter` decorators (see the type mapping and rules in `CLAUDE.md`)
3. The agent redeploys the bundle (`app/<variant>/*` + `app/pipeline_descriptions.json` + `workspaces/<ws>/<variant>/pipeline_cards.json`)

> `pipeline_cards.json` is a **cache, not live truth.** Each file carries a `generated_at` date;
> a pipeline's parameters on GitHub can drift after that. Before deploying, the agent states the
> cache date and asks whether to re-fetch params for the pipeline(s) the app will run.

---

## Deploying the bundle (and a known friction)

Deploys go through the OpenHEXA MCP tools (the webapp `id`/`slug` is resolved live via
`list_static_webapps`). There are two paths, and the agent picks by the size of the change:

- **Small, targeted edits** (a few lines of `app.js`, a CSS tweak, one description) go through
  `edit_static_webapp_file` — a find/replace applied server-side, so the agent never loads the
  whole file. This is the normal path.
- **New files, wholesale rewrites, or a first deploy** go through `update_static_webapp`, which
  takes file contents inline.

Partial deploys work — only the changed files need to be sent — and after every deploy the agent
re-reads the changed file(s) live (`get_static_webapp_file` for one file, `get_static_webapp` for
the whole bundle) and diffs them against the repo (`app/<variant>/` +
`app/pipeline_descriptions.json` + `workspaces/<ws>/<variant>/pipeline_cards.json`) to confirm
what's live matches the source.

**Known friction (large files).** The `update_static_webapp` path only accepts file _contents_,
not a file _path_, and the agent can only load a file into its context up to a size limit. Each
`app.js` is now ~90 KB — well past that — so a **wholesale rewrite** of one means reading it back
in slices and reassembling it. Targeted edits avoid this entirely (see above), so this only bites
on a full rewrite. It's verified each time (the live file is diffed against the local copy), so
it's a speed bump, not a risk.

**Manual fallback — drag-drop from the repo.** Because the bottleneck is only about getting the
bytes _into the agent_, uploading a file yourself through the browser avoids it entirely. If the
OpenHEXA UI lets you replace files on an existing webapp (**Web Apps → the webapp →
edit/settings**), you can drag the changed file(s) straight from `app/<variant>/` (generic to
that variant) or `workspaces/<ws>/<variant>/pipeline_cards.json` into the UI — the repo copy is
always the up-to-date source, so this is safe. (The OpenHEXA
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

The active product is the **SNT Pipelines Orchestrator**, deployed per variant as that variant's
generic `app/<variant>/` bundle + each workspace's `pipeline_cards.json`:

Each (workspace, variant) pair is its **own** webapp with its own URL — five in total
(verified live 2026-07-31):

| Workspace       | Slug              | Variant     | URL                                                                 |
| --------------- | ----------------- | ----------- | ------------------------------------------------------------------- |
| SNT App Dev     | `snt-app-dev`     | `flowchart` | https://snt-pipelines-orchestrator.openhexa.io/                     |
| SNT App Dev     | `snt-app-dev`     | `cockpit`   | https://snt-pipelines-orchestrator-cockpit.openhexa.io/             |
| SNT Testing     | `snt-testing`     | `flowchart` | https://snt-testing-snt-pipelines-orchestrator.openhexa.io/         |
| SNT Testing     | `snt-testing`     | `cockpit`   | https://snt-testing-snt-pipelines-orchestrator-cockpit.openhexa.io/ |
| CMR SNT Process | `cmr-snt-process` | `flowchart` | https://cmr-snt-process-snt-pipelines-orchestrator.openhexa.io/     |

`cockpit` is not deployed to `cmr-snt-process`. Note `cmr-snt-process`'s webapp is still named the
bare `SNT Pipelines Orchestrator`, while the other two workspaces use the
`… - Flowchart` / `… - Cockpit` naming — match on **slug**, not name (see "UI variants").

URLs and IDs are resolved **live** from the OpenHEXA API (`list_static_webapps`) — that, not this
table, is the source of truth.

> **Legacy single-pipeline webapps and spikes** (A.2 DHIS2 Formatting in the DRC workshop demo;
> DHIS2 Reporting Rate, Population Transformation, and the status spike in SNT Testing; the
> report-embed feasibility probe in SNT App Dev) were the stepping stones toward the orchestrator.
> Their local copies now live under `archive/` and are no longer maintained. A few of the spike
> webapps are still present on the platform (e.g. `t0-9-status-proxy-spike`,
> `report-embed-probe`) — they're leftovers, not part of the product.

> The **SNT Pipelines Orchestrator** is built in the dedicated **`snt-app-dev`** workspace (all
> ~18 pipelines installed — the primary build target) and also deployed to **`snt-testing`** (a
> subset installed, so it demos the greyed-out state). The `flowchart` variant additionally
> reaches **`cmr-snt-process`**; `cockpit` is live in `snt-app-dev` and `snt-testing` only.
