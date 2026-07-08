# SNT Pipelines Orchestrator — Product Specification

> **Status:** Revised · 2026-07-06 (persona answers folded in + reconciled with the live app)
> **Purpose of this document:** describe the end-goal product so it can be (1) validated with
> the PM for fit to user needs, then (2) checked with the OpenHEXA developers for technical
> feasibility. This is the _complete vision_, not a phased delivery plan (see `PLAN.md` for
> how it gets built incrementally).
>
> **How to review:** the PM owns sections 1–7 (what the product is and does). The devs own
> section 8 (technical feasibility). Open points needing a decision are collected in section 9.
>
> **Sources for this revision:** the answered persona questionnaire
> (`knowledge/persona_questionnaire_Giulia-20260706.md`) and the deployed orchestrator in the
> `snt-app-dev` workspace (mirrored at `snt_app_dev/orchestrator/`). Where the questionnaire
> settled a previously-open point, it is marked **[decided]**; where it stays open it is carried
> into section 9. Features the app _already implements_ are described in the present tense; things
> not yet built are flagged.

---

## 1. In one sentence

A single, no-code web interface — deployed inside an OpenHEXA workspace — that shows the
**entire SNT stratification process as a visual flow chart** and lets a small, non-technical
team **see the status of, and run, every pipeline** from one place.

## 2. Context & goal

- The **SNT stratification process** imports, processes, cleans and transforms country data to
  produce the data layers needed for the next step — intervention mix and budgeting. Those layers
  most often flow **back into the country's NMDR** (national malaria data repository), and may
  also feed the **SNT Explorer**. This app covers only the stratification part.
- The process is broken into steps; **each step is an OpenHEXA pipeline**. The standard SNT
  pipelines **already exist and work** in OpenHEXA and can be installed into any workspace from
  templates (they work out of the box once the required input data is present). **More pipelines
  are still being added** — the map is expected to grow.
- Today these pipelines appear in the OpenHEXA **Pipelines** section, **listed in order of
  creation** — not in logical order, and with no indication of which are mandatory, optional,
  or alternatives. This is hard for users to navigate.
- **The app solves this** by re-casting that Pipelines view as a clear, fixed **flow chart**,
  so a user can understand the whole process at a glance and execute it from one screen.
- **Direction of travel:** the team is moving toward **scheduling and automating** pipeline runs.
  So the app is less a "run everything by hand every month" tool and more a **monitoring +
  on-demand-run + configuration surface** over a process that is increasingly scheduled. The
  single most valuable thing it gives remains **"see at a glance what's done and what's left."**

## 3. Target user

The persona below is the agreed design target. **Design for the floor, not the ceiling.**

- **Who:** staff of a country's **National Malaria Programme (NMP)** — an employee, not an
  external consultant. Their role centres on **Monitoring & Evaluation / surveillance**, and
  **malaria-program domain knowledge** (epidemiology, stratification logic) is part of the job.
- **A team, not a person:** one country = a **small team** sharing one workspace and one set of
  runs. They work **closely / at overlapping hours** and can coordinate who runs what. _(Whether
  every member runs pipelines or one runs while others view is still open — see §9.)_
- **Skill floor — Excel:** the most advanced data tool we may assume is **Excel/spreadsheets**.
  Some users are DHIS2 power-analysts and regular DHIS2-suite users (analytics, pivot, maps), but
  the UI is designed for the Excel-level floor even if that under-serves the power users.
- **Codes? No.** The platform is explicitly **no-code**. Technical users who want hands-on control
  are redirected to native OpenHEXA (Pipelines, JupyterHub, Datasets) and the `snt_development`
  GitHub repo — the app does not try to replace those.
- **Mental model — partial.** The user understands **what a pipeline is** (input → process →
  output, chained). But they **do not** reliably know **which pipeline to run in what order**,
  **what each pipeline produces**, or the meaning of the **type labels** unaided. → **The app must
  make all of this discoverable in-context** (descriptions, README links, a legend, guidance).
- **Parameters — not a comfortable concept.** Users are **not** inherently comfortable with the
  idea of parameters (settings chosen before a run that change its behaviour). Yet parameters are
  central to the product's value (§7.6): they expose the context-specific decisions the analyst is
  meant to own. → **The parameter form must be as approachable as possible** — clear labels, help
  text, sensible defaults — and it is **accepted** that a user may still struggle to choose or
  enter a value correctly (nothing breaks; any parameter can be changed and the pipeline re-run —
  the difficulty is _understanding what a parameter means_, not a technical failure).
- **Ownership, not a black box.** The user is meant to **own the parameter decisions and judge
  whether the results are acceptable** — inspecting each run's report, deciding whether to move on
  or re-run with different choices — rather than mechanically executing someone else's script.
  Accountability for the _soundness_ of the outputs is expected to be reinforced by **validation
  workshops** before layers return to the NMDR. _(Whether the running user is formally accountable
  vs. a separate validator is still open — see §9.)_
- **Guidance throughout.** The user **needs in-app guidance/onboarding** (tooltips, a "start here",
  a legend). The app should teach the process, not assume it.
- **Leave and return.** The user will often **leave and return mid-process** and needs to see
  "where did I get to" — which makes **persistent, real status** (not session-only) essential
  (§7.4, §9 resolved).
- **Language:** v1 ships in **English** for initial testing. **French is a firm long-term
  requirement** — nearly all users are French-speaking, so French must eventually come _first_.
  French localization is not built yet (see §9).

### 3.1 Autonomy & support (largely still open — see §9)

- The intent is that a country can **increasingly self-serve** (the goal of scheduling/automation
  is that a workspace, once set up, "just runs"). **Training is always assumed.**
- On **failure**, the recourse today is essentially "check the run in OpenHEXA / contact BLSQ."
  Because we are moving toward set-and-schedule, a healthy workspace should rarely fail; when it
  does, a BLSQ technical person may be needed depending on the problem. Whether the app should
  **surface the pipeline's own human-readable run Messages inside the app** (rather than sending
  the user to the OpenHEXA UI) is **undecided** and carried to §9.

## 4. What the app does

- Presents **all standard SNT stratification pipelines** as cards on a **fixed flow-chart canvas**
  (pan + zoom), with dependency arrows drawn between them.
- Shows, at a glance and **on every load**, the **real last-run status of each pipeline** —
  never run, succeeded, failed, running, etc. — queried live from OpenHEXA so it **persists across
  reloads and across teammates** (not just the current browser session). **[decided]**
- Marks pipelines that are part of the standard process but **not installed in this workspace** as
  **greyed-out** and opens a lightweight "how to install" panel for them (see §7.5). **[decided]**
- Lets the user **open a pipeline's details** in a side panel and **launch it with parameters**,
  without leaving the app; then **polls the run to completion** and updates the status live.
- After a run, shows that run's **outputs** — output **datasets** and **files** (including the
  **HTML report**) — as direct links. **[decided: v1 must-have]**
- Enforces **mutual exclusion within alternative groups**: where the process offers a choice of
  method (e.g. the outlier-imputation methods, the reporting-rate variants), the app shows which
  one is currently **in use** (the member holding the most recent successful run) and marks the
  others **superseded**. **[built — see §7.5]**
- Links out to the deeper OpenHEXA views (the live run with logs, the output datasets, the
  pipeline's README on GitHub, the templates page to install a missing pipeline) for anyone who
  wants more detail or needs to act outside the app's scope.

## 5. What the app does NOT do

These stay in the native OpenHEXA UI, by design. The persona answers **confirmed** these
boundaries for v1:

- **Manage pipelines** — install / create / update / delete. The app **cannot** install a
  pipeline; for a **missing** one it provides a **direct link to the OpenHEXA templates page**
  where it can be installed (one click there), instead of only saying "ask BLSQ." **[decided]**
  _(Longer term, dev-side "template workspaces" will create a workspace pre-populated with all
  relevant SNT pipelines, largely removing per-pipeline install from the user's path.)_
- **Workspace configuration** — the `SNT_config.json` is a **pre-condition**, hand-edited in
  OpenHEXA before the user opens the app. The app **does not** build, edit, or **validate** it in
  v1. A friendly config UI is a **separate future tool**, explicitly out of scope here. **[decided]**
- **Manage connections** — the app **never** creates/edits/tests connections; it only _uses_ them
  by slug. **[decided]** _(Note: who owns connections is shifting — see §9. The PM's steer is that
  users should eventually be able to set their own connections, so "BLSQ always creates every
  connection before the user ever opens the app" is **not** assumed as a permanent truth.)_
- **Proactively diagnose setup gaps.** For v1 it is **acceptable not to check readiness up front**:
  if a connection, config, or pipeline is missing, the user finds out when a run fails like any
  other error. **[decided]** _(If we ever add readiness checks, the app would only explain the
  problem in plain language and link out to the right OpenHEXA page — it would never fix anything
  itself.)_

## 6. The pipeline map

- The map is a **flow chart**: pipelines flow **top → bottom** in execution order, with parallel
  **tracks** side by side where steps are independent (the app labels tracks **A — DHIS2**,
  **B — WorldPop & MAP**, **C — DHS**, **D — ERA5**).
- The layout is **fixed and standard** — it reflects the SNT process itself, which is the same
  for every workspace and country. **It does not change per workspace.** What differs per workspace
  is only _which_ pipelines are installed (installed → active; not installed → greyed).
- The map is **authored separately** (by the SNT team, validated with the PM) and supplied to the
  app as a **standalone file** (`pipeline_map.json`) — _not_ hard-coded into the page. The app
  reads it as-is. The file captures, per node: **type** (mandatory / alternative / facultative),
  the **group** that ties mutually-exclusive alternatives together, grid **position** (row/col),
  and the directed **dependency edges** between pipelines (each `solid` = hard dependency, or
  `optional` = soft link).
- **Pipeline types** are **mandatory**, **alternative** (one of a mutually-exclusive group — pick
  exactly one), and **facultative** (optional). Because users **don't** know these labels unaided
  (§3), the app must make them legible (legend + in-panel cues). The map is expected to **grow** as
  new pipelines are added.

## 7. User interface

### 7.1 General

- **Desktop only** (landscape). Not designed for mobile/tablet. **[decided]**
- Two regions: a **canvas** (left/main) with the flow chart, and a **side panel** (right) that
  opens when a card is selected.
- The canvas is a **pan-and-zoom surface** (drag to pan, wheel or +/–/fit buttons to zoom) with a
  collapsible **legend** (arrow types + tracks) pinned in the corner, so the whole map fits on
  screen and the meaning of arrows/tracks is always at hand.

### 7.2 The pipeline card (on the canvas)

Each card shows:

| Element        | Content                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Code + name    | e.g. "A.1 · DHIS2 Extract"                                                                                           |
| Type cue       | Mandatory nodes carry a corner badge; alternatives are wrapped in a "choose one" group box; facultative are unbadged |
| Status         | Same vocabulary as OpenHEXA (see §7.4), stamped live per card                                                        |
| Last execution | Date-time of the last run, when it has ever run, with a ↗ link to that run                                           |
| State          | _Available_ (installed) vs _greyed_ (not installed here); for alternative groups, _in use_ vs _superseded_           |

### 7.3 The side panel (on card click)

For an **available** pipeline, the panel shows:

- Name + code + type, and the **latest-run status line** (status, when, duration).
- A **description** of what the pipeline does.
- A **link to the pipeline's README** on GitHub (`snt_development/<pipeline_id>`).
- A **parameters form** — one input per parameter, typed appropriately (checkbox for booleans,
  number inputs, single-choice dropdowns, multi-select checkbox groups, a **connection dropdown**
  populated from the workspace's connections for `DHIS2Connection`/`CustomConnection` params, with
  a text-slug fallback), each with its **help text**.
- A **Run** button (validates required fields, triggers the run, then polls to completion and
  live-updates the card + panel), plus a **Preview config** toggle that shows the exact package
  that will be sent.
- **Latest outputs** — links to the run's output **datasets** and **files** (the **HTML report**
  opens via a signed URL; other bucket/generic files link out too).
- A **link to the live OpenHEXA run** (logs, messages, full detail).
- For members of an **alternative group**, an **in-use / running / superseded notice** explaining
  where this method stands relative to its siblings.

For a **greyed (not-installed)** pipeline, the panel instead explains that the pipeline is part of
the standard map but isn't installed in this workspace, and links to its **README** and to the
**OpenHEXA templates page** to install it — after which a reload activates it. **[decided]**

### 7.4 Status vocabulary

The app mirrors OpenHEXA's own pipeline run statuses — `queued`, `running`, `success`, `failed`,
`stopped`, `skipped`, `terminating` — plus two app-level states:

- **Never run** — the pipeline exists here but has no runs (neutral).
- **Missing** — part of the standard process but not installed in this workspace (greyed; §7.5).

Status is **real and persistent**: on every load the app asks OpenHEXA for the actual last run of
each pipeline, so the board is true for the whole team after closing the app or days later.
**[decided — resolves former open Q]** Users are expected to come to **trust the app's status**
over checking OpenHEXA directly, once learned.

### 7.5 Missing pipelines & alternative groups

- **Missing (greyed):** shown greyed-out but **still clickable**, opening the "how to install"
  panel (§7.3) with a deep link to the OpenHEXA templates page. **[decided]**
- **Alternative groups (mutual exclusion):** members that share a `group` are mutually exclusive.
  The app derives the **in-use** member purely from run history — **the one holding the most
  recent successful run** — and marks the others **superseded** (greyed but still clickable).
  Triggering a run never moves the "in use" mark; only a _succeeding_ run does. **[built]**

### 7.6 Dependency awareness _(arrows in v1; hard locking deferred)_

- **Arrows are drawn in v1** from the map's dependency edges (hard vs optional links are styled
  differently), but **all installed pipelines stay clickable** — there is **no hard locking** that
  disables a node until its upstream succeeds. **[v1 behaviour confirmed]**
- **Dependency locking** (auto-disable a node until every hard upstream has a completed run) is a
  described enhancement whose **v1-vs-later status is still open** (§9). It would be data-driven
  from the same map edges, not baked into the code.

### 7.7 Trust, risk & confidence

- **No "are you sure?" confirmation** before a run, **no cost/time warning** — users are not
  assumed to be anxious about "breaking something," and there are no per-run cost consequences to
  guard against. **[decided]**
- A **re-run can overwrite previous outputs**, and this is something the **user must understand**;
  the app should make that consequence legible (e.g. in copy/description), without gating runs
  behind a modal. **[decided]**

---

## 8. Technical feasibility — confirmed with the live app

The app is an **OpenHEXA static webapp** (HTML/CSS/JS served inside a workspace, calling the
GraphQL API through a same-origin proxy). The capabilities below were open assumptions in the
first draft; they have since been **verified live** in the `snt-app-dev` orchestrator.

| #   | Capability                                                      | Status       | Notes                                                                                                                                                                            |
| --- | --------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Real, persistent status** (last run per pipeline, every load) | ✅ Confirmed | Top-level `pipelines(workspaceSlug:)` → `runs(orderBy: EXECUTION_DATE_DESC, perPage:1)`, permitted through the proxy under `PIPELINES_READ` (verified in the T0.6 status spike). |
| F2  | **Outputs of a historical run** (datasets, HTML report)         | ✅ Confirmed | `pipelineRun.outputs` (union — inline fragments) + `prepareObjectDownload` signed URL under `FILES_READ`.                                                                        |
| F3  | **Launch a pipeline with parameters**                           | ✅ Confirmed | `runPipeline` mutation, params as a `config` object; `DHIS2Connection` passed as connection **slug**. Needs `PIPELINES_RUN`.                                                     |
| F4  | **Link to the live run page**                                   | ✅ Confirmed | `app.openhexa.org/workspaces/<ws>/pipelines/<code>/runs/<runId>/` (note: the app UI is on `.org`, not the webapp's `.io` host).                                                  |
| F5  | **Link to a pipeline's GitHub README**                          | ✅ Confirmed | `github.com/BLSQ/snt_development/tree/main/<pipeline_id>`.                                                                                                                       |
| F6  | **Detect "missing" pipelines**                                  | ✅ Confirmed | A node is available iff its `id` is present in the workspace's `pipeline_cards.json` (with a `uuid`); otherwise greyed.                                                          |
| F7  | **Serve a multi-file app** (html + css + js + map + cards)      | ✅ Confirmed | Only `index.html` is HTML-injected; CSS/JS/JSON served as-is. Partial/incremental deploys work.                                                                                  |
| F8  | **`allowed_operations` scopes**                                 | ✅ Confirmed | `PIPELINES_READ, PIPELINES_RUN, FILES_READ, USER_READ` (the last powers the connection dropdown).                                                                                |

> All of §4/§7's runtime behaviour is implemented against these and running in `snt-app-dev`.

---

## 9. Open questions for the PM (still to resolve)

Resolved since the first draft (kept here for traceability):

- ~~**Missing-pipeline UX**~~ → **greyed-out + clickable "how to install" panel with a deep link to
  the OpenHEXA templates page.** (Q49/Q70)
- ~~**Persistent vs session-only status**~~ → **must persist across reloads and teammates.** (Q71)
- ~~**Desktop-only**~~ → **confirmed, no mobile/tablet.** (Q33)
- ~~**Outputs display**~~ → **v1 must-have (HTML report + dataset/file links).** (Q65)
- ~~**Up-front readiness checks**~~ → **not in v1; fail-on-run is acceptable.** (Q63)

Still open:

1. **Dependency locking — in scope, and when?** v1 draws the arrows but keeps all installed
   pipelines clickable (no hard locking). Confirm whether locking is a fast-follow or stays
   deferred. _(Questionnaire Q69: Open.)_
2. **Guide vs. display — recommend the next step?** Should the app actively **recommend what to
   run next** (given the "needs guidance throughout" persona) or only display the map and let the
   user choose? _(Q20: Open.)_ This is a product-shape decision.
3. **In-app failure help.** On a failed run, should the app **re-cast the pipeline's own
   human-readable run Messages inside the app** (vs. sending the user to the OpenHEXA UI)? Given
   the Excel-level floor, linking out may be too technical. _(Q24: left blank — needs a decision.)_
4. **Setup ownership.** Who performs technical setup (config, connections, install) — BLSQ, a more
   technical country-side person, or the running user? And does "one-click install" legitimately
   pull a non-technical user into setup? _(Q27/Q28/Q51: Open. Tension flagged in the questionnaire.)_
5. **Connections ownership.** The steer is that users should eventually **set their own
   connections** (contradicting "BLSQ always sets them up first"). Confirm the target model and
   whether the running user ever handles raw credentials. _(Q57/Q60.)_
6. **Accountability & handoff.** Is the running user **accountable for the soundness** of the
   outputs, or do they execute while a separate validator signs off (via validation workshops)?
   And where do outputs go — back into the **NMDR** (most likely) and/or the SNT Explorer?
   _(Q39/Q40: Open.)_ This affects how much decision-support the app must carry.
7. **Team run model.** Do **all** team members run pipelines, or one runs while others view? Since
   they share one workspace and one set of runs, does the app need to show "who is running what"?
   _(Q3: Open; Q37 says they coordinate at overlapping hours.)_
8. **French localization — when?** French is a firm long-term requirement and may be needed sooner
   than "long term" (Q13 leaned that even early testing wants French). Decide the trigger point for
   starting localization.
9. **Card descriptions.** The one-sentence description per pipeline is **not** in the pipeline
   source. Who provides the canonical wording — PM, or pulled from each README? _(Carried over.)_
10. **Product name.** Confirm "SNT Pipelines Orchestrator" as the user-facing name.
