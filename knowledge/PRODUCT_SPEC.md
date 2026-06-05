# SNT Pipelines Orchestrator — Product Specification

> **Status:** Draft for review · 2026-06-05
> **Purpose of this document:** describe the end-goal product so it can be (1) validated with
> the PM for fit to user needs, then (2) checked with the OpenHEXA developers for technical
> feasibility. This is the *complete vision*, not a phased delivery plan (see `PLAN.md` for
> how it gets built incrementally).
>
> **How to review:** the PM owns sections 1–7 (what the product is and does). The devs own
> section 8 (technical feasibility). Open points needing a decision are collected in section 9.

---

## 1. In one sentence

A single, no-code web interface — deployed inside an OpenHEXA workspace — that shows the
**entire SNT stratification process as a visual flow chart** and lets a non-technical user
**see the status of, and run, every pipeline** from one place.

## 2. Context & goal

- The **SNT stratification process** imports, processes, cleans and transforms country data to
  produce the data layers needed for the next step — intervention mix and budgeting — which
  happens in a **separate tool, the SNT Explorer**. This app covers only the stratification
  part.
- The process is broken into steps; **each step is an OpenHEXA pipeline**. All these pipelines
  **already exist and work** in OpenHEXA and can be installed into any workspace from templates
  (they work out of the box once the required input data is present).
- Today these pipelines appear in the OpenHEXA **Pipelines** section, **listed in order of
  creation** — not in logical order, and with no indication of which are mandatory, optional,
  or alternatives. This is hard for users to navigate.
- **The app solves this** by re-casting that Pipelines view as a clear, fixed **vertical flow
  chart**, so a user can understand the whole process at a glance and execute it from one screen.

## 3. Target user

- A **"data person"**: understands the SNT stratification process, the country data, and the
  epidemiology. **Does not code.**
- Technical users (R/Python) who want hands-on control are redirected to the native OpenHEXA
  sections (Pipelines, JupyterHub, Datasets) and the `snt_development` GitHub repo — the app
  does not try to replace those.
- The platform is explicitly **"no-code."**

## 4. What the app does

- Presents **all SNT stratification pipelines** as cards arranged in a **fixed vertical flow
  chart** on a canvas.
- Shows, at a glance, the **status of each pipeline**: never run, succeeded, failed, running —
  or **missing** (part of the standard process but not installed in this workspace).
- Lets the user **open a pipeline's details** and **launch it with parameters**, without
  leaving the app.
- Links out to the deeper OpenHEXA views (the actual run with logs, the output datasets, the
  pipeline's README on GitHub) for users who want more detail.

## 5. What the app does NOT do

These stay in the native OpenHEXA UI, by design:

- **Manage pipelines** — install / create / update / delete (done in the OpenHEXA Pipelines
  section).
- **Workspace configuration** — set up via an `SNT_config.json` file, done manually in
  OpenHEXA.
- **Manage connections** — create / edit / delete connections to external data sources or
  databases (done in the OpenHEXA Connections section).

## 6. The pipeline map

- The map is a **vertical flow chart**: pipelines flow top → bottom in execution order, with
  parallel tracks side by side where steps are independent or alternatives.
- The layout is **fixed and standard** — it reflects the SNT process itself, which is the same
  for every workspace and country. **It does not change per workspace.** (What differs per
  workspace is only *which* pipelines are installed.)
- The map is **authored separately** (by the SNT team, validated with the PM) and supplied to
  the app as a **standalone file** — *not* hard-coded into the page. The app reads it as-is.
  This file also captures pipeline **type** (mandatory / alternative / facultative), grouping
  of alternatives, and the **dependency relationships** between pipelines.

## 7. User interface

### 7.1 General
- **Desktop only** (landscape). Not designed for mobile.
- Two regions: a **canvas** (left/main) with the flow chart, and a **side panel** (right) that
  opens when a card is selected.

### 7.2 The pipeline card (on the canvas)
Each card shows:

| Element | Content |
| --- | --- |
| Title | Pipeline name, e.g. "A.1 DHIS2 Extract" |
| Description | One concise sentence |
| Status | Same vocabulary as OpenHEXA (Succeeded / Failed / Running / blank if never run) |
| Status symbol | Corner icon (e.g. green check, red cross) |
| Type label | Corner label: Mandatory / Alternative / Facultative |
| Last execution | Date-time of the last run, if ever run |
| Outputs | Link to latest output files (HTML report and, if produced, dataset) |

### 7.3 The side panel (on card click)
Opens to show, for the selected pipeline:

- Title / name.
- **Link to the pipeline's `README.md`** in the GitHub repo (richer info for the user).
- **Parameters**, each with help text (collapsible if long).
- A **Run** button that triggers the pipeline with the parameters the user has set.
- A **clickable link to the actual OpenHEXA run**, where the user can see details such as log
  messages.

### 7.4 Status vocabulary
The app mirrors OpenHEXA's own pipeline statuses (Succeeded, Failed, Running, …) plus:
- **Never run** — blank / neutral.
- **Missing** — the pipeline belongs to the standard process but is not installed in this
  workspace (see open question 9.1).

### 7.5 Dependency awareness *(intended enhancement, not required for the first version)*
Eventually, pipelines should be marked **active / inactive** depending on whether the
**upstream pipeline succeeded** — because some steps consume the output files of earlier ones
and must run in order. This dependency information is **not recorded anywhere today**; it will
come from the map file (section 6) rather than being baked into the code.

---

## 8. Technical feasibility — points to confirm with the OpenHEXA devs

The app is an **OpenHEXA static webapp** (HTML/CSS/JS served inside a workspace, calling the
GraphQL API through a same-origin proxy). The items below are the assumptions the product
rests on; each needs a dev ✅ / ⚠️.

| # | Capability the product needs | Current understanding | Needs dev confirmation |
| --- | --- | --- | --- |
| F1 | **Show real, persistent status** (last run per pipeline, on every page load) | The GraphQL schema exposes `Pipeline.runs`, so this is queryable client-side | That this query is permitted through the **static-webapp proxy** under the `PIPELINES_READ` scope |
| F2 | **Show outputs of a historical run** (datasets, HTML report) for a run the user didn't trigger this session | `pipelineRun.outputs` + a signed download URL via `prepareObjectDownload` (needs `FILES_READ`) | That historical outputs are reachable the same way as fresh ones |
| F3 | **Launch a pipeline with parameters** from the browser | `runPipeline` mutation, params as a config object; `DHIS2Connection` passed as connection slug | Confirm scopes (`PIPELINES_RUN`) and parameter handling |
| F4 | **Link to the live run page** in the OpenHEXA UI | Need the canonical URL pattern for a run | Provide the URL pattern |
| F5 | **Link to a pipeline's GitHub README** | Need the canonical raw/repo URL pattern per pipeline | Confirm the `snt_development` path convention |
| F6 | **Detect "missing" pipelines** | App can tell which pipelines exist in the workspace vs the standard map | Confirm there's no better signal than "present in workspace or not" |
| F7 | **Serve a multi-file app** (html + css + js + map file + per-workspace config) | OpenHEXA serves the bundle; only `index.html` is HTML-injected, assets are served as-is | Already documented; confirm no surprises |
| F8 | **Required `allowed_operations` scopes** | At minimum `PIPELINES_READ, PIPELINES_RUN, FILES_READ` (+`USER_READ` if listing connections) | Confirm the final set |

> The single highest-risk item is **F1** — it underpins the whole "see status at a glance"
> value. It is being verified first via a small throwaway test app (see `PLAN.md`, task T0.9).

---

## 9. Open questions for the PM (to resolve during validation)

1. **Missing-pipeline UX.** When a standard pipeline isn't installed in a workspace, how should
   it appear? Proposed: **show it greyed-out**; if the user tries to run it, fail with a clear
   message ("This pipeline isn't installed — go create/install it in OpenHEXA"). Confirm or
   adjust.
2. **Dependency locking — in scope, and when?** Marking nodes active/inactive based on upstream
   success (section 7.5) is described as a later enhancement. Confirm it's acceptable for the
   first usable version to **draw the dependency arrows but keep all installed pipelines
   clickable** (no hard locking yet).
3. **Card descriptions.** The one-sentence description per pipeline is **not** in the pipeline
   source code. Who provides the canonical wording — PM, or pulled from each pipeline's README?
4. **Status vocabulary.** Confirm the exact set of statuses to display and their labels/icons
   (matching OpenHEXA's).
5. **Desktop-only.** Confirm there's no need to support tablets/mobile.
6. **Product name.** Confirm "SNT Pipelines Orchestrator" as the user-facing name.
