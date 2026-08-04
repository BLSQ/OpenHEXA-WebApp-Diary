# SNT Pipelines Orchestrator — Product Specification

> **Status:** Reworked · 2026-07-14 (functionality/UI-UX split + versioned roadmap) · amended
> 2026-07-15 (PM feedback folded into v1 scope) · amended 2026-07-31 (**v1 build progress** —
> several v1 items are now built in Cockpit; see the marker legend below) · amended 2026-08-04
> (pipeline catalog moved out of the deployed bundle — §6 supporting infrastructure; no change to
> product scope)
>
> **⚠️ v1 is in progress.** Items below carry a build marker. These stay **v1 scope** — a built
> v1 item is _not_ back-dated into v0, which remains the frozen 2026-07-14 baseline:
>
> - **✅ Built (Cockpit)** — implemented and deployed in the Cockpit variant.
> - **🔨 In progress** — partially done.
> - _(unmarked)_ — still to do.
> **Purpose of this document:** give a single, shared definition of _what the product is_, _what
> it does today_, and _what each version (v0 / v1 / v2) adds_ — so it can be discussed with the
> PM to pin down concrete version scope instead of vague "v1 / v2" labels, and checked with the
> OpenHEXA developers for technical feasibility.
>
> **How this document is organised.** It is deliberately split into three parts:
>
> - **Part A — Functionality** (§4–§6): what the app _does_, independent of how it looks. This is
>   the same for both UI variants.
> - **Part B — UI/UX variants** (§7–§8): the two independently-deployable shells over that same
>   functionality — **Cockpit** (the guided walkthrough, the v1 lead) and **Flowchart** (the 2D
>   map, developed as a side product).
> - **Part C — Versioning** (§9–§10): parallel **v0 / v1 / v2** roadmaps per variant, plus the
>   open decisions the PM still owns (each with a recommended version placement).
>
> **How to review:** the PM owns Parts A and C (what the product is, does, and should become) and
> the variant framing in Part B. The devs own the technical-feasibility catalogue (§6).
>
> **Sources for this revision:** the answered persona questionnaire
> (`docs/personas/persona_questionnaire_answered-20260713.md`) and the deployed orchestrator
> bundles in the repo (`app/flowchart/`, `app/cockpit/`).  
> Features the app _already implements_ are described in the
> present tense; things not yet built are flagged and placed in the roadmap (Part C).

---

## 1. In one sentence

A single, no-code web interface — deployed inside an OpenHEXA workspace — that shows the
**entire SNT stratification process as a visual, guided flow** and lets a small, non-technical
team **see the status of, configure, and run every pipeline** from one place.

## 2. Context & goal

- The **SNT stratification process** imports, processes, cleans and transforms country data to
  produce the data layers needed for the next step — intervention mix and budgeting. Those layers
  most often feed the **SNT Explorer (IASO)**, and may also flow **back into the country's NMDR**
  (national malaria data repository). This app covers only the stratification part.
- The process is broken into steps; **each step is an OpenHEXA pipeline**. The standard SNT
  pipelines **already exist and work** in OpenHEXA and can be installed into any workspace from
  **templates** (they work out of the box once the required input data is present). **More pipelines
  are still being added** — the map is expected to grow.
- In any given OpenHEXA workspace these pipelines appear in the **Pipelines** section, **listed in
  order of creation** — not in logical order, and with no indication of which are mandatory,
  optional, or alternatives. This is hard for users to navigate.
- **The app solves this** by re-casting that Pipelines view as a clear, fixed **process flow**, so
  a user can understand the whole process at a glance and execute it from one screen.
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
  every member runs pipelines or one runs while others view is still open — see §10.)_
- **Skill floor — Excel:** the most advanced data tool we may assume is **Excel/spreadsheets**.
  Some users are DHIS2 power-analysts, but the UI is designed for the Excel-level floor even if
  that under-serves the power users.
- **Codes? No.** The platform is explicitly **no-code**. Technical users who want hands-on control
  are redirected to native OpenHEXA (Pipelines, JupyterHub, Datasets) and the `snt_development`
  GitHub repo — the app does not try to replace those.
- **Mental model — partial.** The user understands **what a pipeline is** (input → process →
  output, chained). But they **do not** reliably know **which pipeline to run in what order**,
  **what each pipeline produces**, or the meaning of the **type labels** unaided. → **The app must
  make all of this discoverable in-context** (descriptions, README links, a legend, guidance).
- **Parameters — not a comfortable concept.** Users are **not** inherently comfortable with the
  idea of parameters (settings chosen before a run that change its behaviour). Yet parameters are
  central to the product's value: they expose the context-specific decisions the analyst is meant
  to own. → **The parameter form must be as approachable as possible** — clear labels, help text,
  sensible defaults — and it is **accepted** that a user may still struggle to choose a value
  (nothing breaks; any parameter can be changed and the pipeline re-run).
- **Ownership, not a black box.** The user is meant to **own the parameter decisions and judge
  whether the results are acceptable** — inspecting each run's report, deciding whether to move on
  or re-run — rather than mechanically executing someone else's script. Accountability for the
  _soundness_ of outputs is expected to be reinforced by **validation workshops** before layers
  return to the NMDR. _(Formal accountability model still open — see §10.)_
- **Guidance throughout.** The user **needs in-app guidance/onboarding** (tooltips, a "start here",
  a legend, and — in Cockpit — a narrative that walks them through the process). The app should
  teach the process, not assume it.
- **Leave and return.** The user will often **leave and return mid-process** and needs to see
  "where did I get to" — which makes **persistent, real status** (not session-only) essential (§6).
- **Language:** initial builds were **English**, and **French is confirmed as the main interface
  language for v1** (PM steer, 2026-07-15) — nearly all users are French-speaking, so French must
  eventually come _first_ (see §9). The "one web app with a **language-switch button**" idea
  (rather than separate per-language builds) is **✅ built (Cockpit)** as of 2026-07-17: an EN/FR
  toggle in the header, remembered per user, with `?lang=fr` deep-linking. Flowchart remains
  English-only. ⚠️ The **French copy is draft, pending review** — the mechanism is done, the
  wording is not signed off.

### 3.1 Autonomy & support (largely still open — see §10)

- The intent is that a country can **increasingly self-serve** (the goal of scheduling/automation
  is that a workspace, once set up, "just runs"). **Training is always assumed.**
- On **failure**, the recourse today is essentially "check the run in OpenHEXA / contact BLSQ."
  Because we are moving toward set-and-schedule, a healthy workspace should rarely fail; when it
  does, a BLSQ technical person may be needed depending on the problem. Whether the app should
  **surface the pipeline's own human-readable run Messages inside the app** is a versioned open
  point (§10, recommended v1).

---

# Part A — Functionality (variant-independent)

> Everything in Part A is **the same for both UI variants**. The Cockpit and Flowchart shells
> (Part B) render this identical set of capabilities differently. Both variants already implement
> the full set below.

## 4. What the app does

- Presents **all standard SNT stratification pipelines** as an interactive **process flow**, with
  dependency arrows drawn between them (rendered as a 2D map in Flowchart, as a guided sequence in
  Cockpit — see Part B).
- Shows, at a glance and **on every load**, the **real last-run status of each pipeline** — never
  run, succeeded, failed, running, etc. — queried live from OpenHEXA so it **persists across
  reloads and across teammates** (not just the current browser session).
- Marks pipelines that are part of the standard process but **not installed in this workspace** as
  **greyed-out** and opens a lightweight "how to install" panel for them (deep link to the
  OpenHEXA templates page).
- Lets the user **open a pipeline's details** in a panel and **launch it with parameters** without
  leaving the app; then **polls the run to completion** and updates the status live.
- After a run, shows that run's **outputs** — output **datasets** and **files** (including the
  **HTML report**) — as direct links.
- Enforces **mutual exclusion within alternative groups**: where the process offers a choice of
  method (e.g. outlier-imputation methods, reporting-rate variants), the app shows which one is
  currently **in use** (the member holding the most recent successful run) and marks the others
  **superseded**.
- Enforces **dependency hard-locking**: a pipeline stays **locked** (its Run button disabled) until
  every **hard** upstream prerequisite has a completed run; it unlocks live as prerequisites
  succeed. Locking is **group-aware** (any one member of an alternative group satisfies the
  prerequisite) and **optional edges are non-gating** (they draw an arrow but do not lock).
- **Links out to the deeper OpenHEXA views** (the live run with logs, the output datasets, the
  pipeline's README on GitHub, the templates page to install a missing pipeline) for anyone who
  wants more detail or needs to act outside the app's scope.

### 4.1 The pipeline map (the process model)

- The map is a **process flow**: pipelines flow in execution order, with parallel **tracks** where
  steps are independent (the app labels tracks **A — DHIS2**, **B — WorldPop & MAP**, **C — DHS**,
  **D — ERA5**).
- The layout is **fixed and standard** — it reflects the SNT process itself, which is the same for
  every workspace and country. **It does not change per workspace.** What differs per workspace is
  only _which_ pipelines are installed (installed → active; not installed → greyed).
- The map is **authored separately** (by the SNT team, validated with the PM) and supplied to each
  variant as a **standalone file** (`app/<variant>/pipeline_map.json`) — _not_ hard-coded into the
  page. It captures, per node: **type** (mandatory / alternative / facultative), the **group** that
  ties mutually-exclusive alternatives together, grid **position** (row/col), and the directed
  **dependency edges** between pipelines (`solid` = hard dependency; `optional` = soft link).
- **Pipeline types** are **mandatory**, **alternative** (one of a mutually-exclusive group — pick
  exactly one), and **facultative** (optional). Because users **don't** know these labels unaided
  (§3), the app must make them legible (legend + in-panel cues). The map is expected to **grow** as
  new pipelines are added.

## 5. What the app does NOT do

These stay in the native OpenHEXA UI, by design. The persona answers **confirmed** these
boundaries.

- **Manage pipelines** — install / create / update / delete. The app **cannot** install a
  pipeline; for a **missing** one it provides a **direct link to the OpenHEXA templates page**
  where it can be installed (one click there), instead of only saying "ask BLSQ."
  _(Longer term, dev-side "template workspaces" will create a workspace pre-populated with all
  relevant SNT pipelines, largely removing per-pipeline install from the user's path.)_
- **Workspace configuration** — the `SNT_config.json` is a **pre-condition**, hand-edited in
  OpenHEXA before the user opens the app. The app **does not** build, edit, or **validate** it.
  A friendly config UI is a **separate future tool**, explicitly out of scope here.
- **Manage connections** — the app **never** creates/edits/tests connections; it only _uses_ them
  by slug. _(Who owns connections is shifting — see §10. The PM's steer is that users should
  eventually set their own connections, so "BLSQ always creates every connection first" is not
  assumed as a permanent truth.)_
- **Proactively diagnose setup gaps.** It is **acceptable not to check readiness up front**: if a
  connection, config, or pipeline is missing, the user finds out when a run fails like any other
  error. _(If we ever add readiness checks, the app would only explain the problem in plain
  language and link out to the right OpenHEXA page — it would never fix anything itself. See §10.)_

## 6. Functionality catalogue & technical feasibility

The stable set of capabilities, each with the technical basis that makes it possible on an
OpenHEXA static webapp (HTML/CSS/JS served inside a workspace, calling the GraphQL API through a
same-origin proxy). **All of these are built and running in both variants' v0** (§9); they are the
shared baseline that the roadmaps build on top of. Every capability marked ✅ has been verified
live.

| ID  | Capability                          | What it means for the user                                                                                                                                                                   | Technical basis                                                                                                                           | Status |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| F1  | **Live, persistent status board**   | On every load, each pipeline shows its real last-run status; true for the whole team, across reloads and days.                                                                               | `pipelines(workspaceSlug:)` → `runs(orderBy: EXECUTION_DATE_DESC, perPage:1)`, permitted through the proxy under `PIPELINES_READ`.        | ✅     |
| F2  | **Missing-pipeline detection**      | Pipelines not installed here are greyed; a panel explains they're standard and deep-links to the templates page to install. Once installed, the node goes live as soon as the catalog is regenerated — no redeploy. | A node is available iff its `id` is in the workspace's `pipeline_cards.json` (with a `uuid`); otherwise greyed. Link is client-side.      | ✅     |
| F3  | **Pipeline detail panel**           | Name/code/type, a description of what the pipeline does, and a link to its GitHub README.                                                                                                    | Static content from the map/cards + `github.com/BLSQ/snt_development/tree/main/<pipeline_id>`.                                            | ✅     |
| F4  | **Parameter form + config preview** | A typed input per parameter (checkbox, number, dropdown, multi-select, **connection dropdown**), help text, sensible defaults; a "preview config" toggle shows the exact package to be sent. | Form generated from `pipeline_cards.json`; connection dropdown from `workspace { connections }` — needs `USER_READ` (else text fallback). | ✅     |
| F5  | **Run + poll**                      | A Run button launches the pipeline and polls it to completion, live-updating the card + panel.                                                                                               | `runPipeline` mutation, params as a `config` object (`DHIS2Connection` passed as connection **slug**). Needs `PIPELINES_RUN`.             | ✅     |
| F6  | **Outputs & report links**          | After a run, links to its output **datasets** and **files**; the **HTML report** opens via a signed URL.                                                                                     | `pipelineRun.outputs` (union — inline fragments) + `prepareObjectDownload` signed URL. Needs `FILES_READ`.                                | ✅     |
| F7  | **Mutual exclusion (alt. groups)**  | For a choose-one method group, shows which member is **in use** (holds the latest success) and marks the others superseded.                                                                  | Derived client-side from run history + the map's `group`. Only a _succeeding_ run moves the "in use" mark.                                | ✅     |
| F8  | **Dependency arrows**               | Draws the dependency edges between pipelines; hard vs optional links are styled differently.                                                                                                 | One SVG arrow per edge, drawn client-side from `pipeline_map.json` edges. No layout library / CDN.                                        | ✅     |
| F9  | **Dependency hard-locking**         | A node is locked (Run disabled) until every hard prerequisite has completed; unlocks live. Group-aware; optional edges don't gate.                                                           | Computed client-side from map edges + the F1 status board. Bucket hard parents by `group`; ≥1 completed per bucket unlocks.               | ✅     |
| F10 | **Deep links out to OpenHEXA**      | Jump to the live run (logs/messages), output datasets, the GitHub README, or the templates page.                                                                                             | `app.openhexa.org/workspaces/<ws>/pipelines/<code>/runs/<runId>/` (note: app UI is on `.org`, not the webapp's `.io` host) + others.      | ✅     |

Supporting infrastructure (not user-facing capabilities): the app is served as a **multi-file
bundle** (only `index.html` is HTML-injected; CSS/JS/JSON served as-is; partial/incremental deploys
work), and requires the scopes **`PIPELINES_READ, PIPELINES_RUN, FILES_READ, USER_READ`**
(`USER_READ` powers F4's connection dropdown and is the one most easily forgotten; `FILES_READ`
covers both F6's downloads and the catalog read described next).

**Where the per-workspace catalog comes from (changed 2026-08-04).** The `pipeline_cards.json` that
drives F2 and F4 is **no longer part of the deployed bundle**. It is generated in each workspace by
a companion pipeline (`create_pipeline_cards`), stored in that workspace's own file storage, and
read by the app at page load via a signed URL. Three consequences worth knowing at product level:

- **Configuration changes no longer need a deploy.** Installing a pipeline, or a parameter changing
  in a pipeline's newer version, is picked up by re-running the generator and refreshing the page.
  This removes the developer from the loop for the most common kind of change.
- **The parameter form matches the version actually installed** in the workspace (parameters are
  read from its deployed pipeline version, not from GitHub `main`) — closing a real drift risk
  where a form could offer parameters the installed pipeline didn't accept. Note this is a
  _different_ problem from the README drift in §8.1, which is about documentation and is still open.
- **A workspace must have the generator run once before its orchestrator works** — otherwise the app
  shows a "run `create_pipeline_cards`" message instead of the map. One extra setup step per
  workspace, in exchange for the two benefits above.

---

# Part B — UI/UX variants (same functionality, different shell)

> Both variants render the **same functionality catalogue** (§6) over the **same map data**. They
> are **independently-deployable bundles** (`app/cockpit/`, `app/flowchart/`) that do not share
> files, so their UIs can drift. What follows describes only the _presentation and interaction_ —
> not the underlying capabilities, which are defined once in Part A.

## 7. Cockpit variant — the guided walkthrough _(v1 lead)_

**Strategic role:** this is the **primary variant intended for real users** (the PM's favourite).
Its guided one-step-at-a-time structure is what teaches the process. A **full narrative layer** —
extra per-step text walking the user through the whole process — was considered for v1 but
**deliberately parked** (2026-07-15 PM steer): authoring all that guidance text is too big a rabbit
hole to take on now. **v1 instead invests in richer per-pipeline descriptions** (a short paragraph
each — see §9.1), with the narrative layer reconsidered later as a possible v2. Narrative target UX
(reference only, _not_ v1): `design/wireframes/orchestrator_wireframe_cockpit_narrative.html`.

- **One-step-at-a-time focus.** Instead of a whole-canvas map, the Cockpit foregrounds the
  **current / next relevant step** and walks the user forward through the process, using the same
  dependency model (F8/F9) to decide what comes next.
- **Per-pipeline descriptions** (the v1 content investment): each step's one-liner is expanded to a
  **short paragraph** — what the pipeline is, what it produces, and how to read its result — aimed
  at the Excel-level floor and the "partial mental model" persona (§3). The PM drafts the text for a
  couple of pipelines as a template; Giulia completes the rest.
  **🔨 In progress — 2 of 18 expanded** (as of 2026-07-31): `snt_dhis2_extract` (A.1) and
  `snt_dhis2_formatting` (A.2) now carry full paragraphs; the remaining 16 are still one-liners.
  The delivery mechanism is done — text lives in `app/pipeline_descriptions.json` (one shared copy,
  bilingual `{en, fr}`), so completing this is **content authoring, not development**.
- Renders the full functionality set (F1–F10): status per step, parameter form + preview, run +
  poll, outputs/report links, mutual-exclusion notices, and lock/unlock state.
- **Desktop only** (landscape). Not designed for mobile/tablet.

## 8. Flowchart variant — the 2D map _(side product, may follow)_

**Strategic role:** developed **as a side product** (Giulia's preference), it may follow the
Cockpit into user-facing releases later. It is currently the more broadly-deployed variant.
Target UX: `design/wireframes/orchestrator_wireframe.html` (⚠️ **to be updated to current UX!**) and consider variants like `design/wireframes/orchestrator_frosted.html`.

- **Whole-process 2D canvas.** Two regions: a **canvas** (left/main) with the flow chart and a
  **side panel** (right) that opens when a card is selected.
- The canvas is a **pan-and-zoom surface** (drag to pan, wheel or +/–/fit buttons to zoom) with a
  collapsible **legend** (arrow types + tracks) pinned in the corner, so the whole map fits on
  screen and the meaning of arrows/tracks is always at hand.
- **The pipeline card (on the canvas)** shows: code + name (e.g. "A.1 · DHIS2 Extract"); a **type
  cue** (mandatory = corner badge; alternatives = "choose one" group box; facultative = unbadged);
  live **status**; **last execution** date-time with a ↗ link to that run; and **state**
  (_available_ vs _greyed_; for alternative groups, _in use_ vs _superseded_; locked vs unlocked).
- **The side panel (on card click)** renders the full functionality set (F1–F10) for the selected
  pipeline: latest-run status line, description, README link, the parameter form + preview, the
  Run button, latest outputs, the link to the live OpenHEXA run, and any alternative-group /
  lock notice. For a **greyed (not-installed)** pipeline it instead explains the pipeline is part
  of the standard map but isn't installed here, and links to its README + the templates page.
- **Desktop only** (landscape).

### 8.1 Shared UI rules (both variants)

- **Status vocabulary.** The app mirrors OpenHEXA's own run statuses — `queued`, `running`,
  `success`, `failed`, `stopped`, `skipped`, `terminating` — plus two app-level states: **Never
  run** (exists here, no runs; neutral) and **Missing** (standard but not installed; greyed, §5/F2).
- **Trust, risk & confidence.** **No "are you sure?" confirmation** before a run and **no cost/time
  warning** — users are not assumed to be anxious about "breaking something," and there are no
  per-run cost consequences to guard against. A **re-run can overwrite previous outputs**, and the
  app should make that consequence legible in its copy, without gating runs behind a modal.
- **Dependencies section — condense (v1). ✅ Built (Cockpit).** The panel's **Dependencies** block
  (the F8/F9 "Requires / Unlocks next / Uses if available" lists) took too much vertical space —
  worst case **A.2 · DHIS2 Formatting**, which unlocks 10+ pipelines. **Treatment as built:** each
  labelled section (**Dependencies**, _Choose a method_, _Parameters_, _Latest outputs_) became a
  **collapsible box** with a keyboard-accessible header toggle; **Dependencies starts collapsed**
  (it's the tallest) while the others start open. The description block is deliberately **not**
  collapsible — it stays permanently visible. This settles the "whole section vs per-type lists"
  choice in §10 in favour of collapsing the whole section.
  ⚠️ **Not built:** the **per-type counts** in the collapsed header (_"Requires (2 pipelines)"_,
  _"Unlocks (11 pipelines)"_) — the header reads just "Dependencies". Still open whether the counts
  are wanted now that the block is collapsed by default. **Flowchart: not built** (still full lists).
- **Embed the HTML report (v1). ✅ Built (Cockpit) — feasibility confirmed.** Rather than only link
  out to the run's HTML report (F6), its **content renders in a box at the bottom of the step** so
  the user reads the result without leaving the app. **The technical question is answered:** the
  report's GCS signed URL sends no `X-Frame-Options` / restrictive `frame-ancestors`, so it is
  safely frameable from the webapp origin — implemented as an `<iframe>` on a freshly-signed URL
  (signed URLs expire, so the frame is re-signed on demand). Validated by the
  `archive/snt-app-dev/report-embed/` spike first. **Flowchart: not built** (still links out).
- **Documentation source — README drift (planned v1).** The detail panel links out to each
  pipeline's **README on GitHub `main`** (F3), which reflects the _latest_ pipeline version and may
  not match the (possibly older) version **installed** in the workspace. v1 resolves this. A
  promising route: pipelines installed from a template carry a **"Template Documentation"** field
  (equivalent to the GitHub README) that could be **extracted and surfaced in-app** — e.g. a button
  opening a popup — instead of linking out. _Open question for the team (§10): how is the template's
  "Template Documentation" field linked to GitHub?_

---

# Part C — Versioning

## 9. Roadmap (v0 / v1 / v2)

**How to read this.** All of the **functionality catalogue (F1–F10, §6) is already present at v0**
for both variants — that shared baseline is _not_ repeated in the tables below. The tables track
only the **deltas**: what each version _adds_ on top of the previous one. Definitions:

- **v0 — the frozen baseline (as of 2026-07-14).** What was built and deployed at the time this
  roadmap was drawn. ⚠️ **v0 is a historical snapshot, not "whatever is built today."** Work
  completed since then belongs to **v1** and stays in the v1 column with a build marker — do not
  migrate finished v1 items back into v0.
- **v1 — first version exposed to real users, and the version currently in progress.** The bar for
  putting the app in front of an actual NMP team. **Cockpit is the v1 lead**; Flowchart's v1 is a
  later, parallel milestone.
- **v2 — longer-term view.** Bigger enhancements, several of them shaped by feedback from v1 users
  and by the platform's move toward scheduling/automation.

Items in _italics_ are open decisions (see §10) placed at their **recommended** version.

### 9.1 Cockpit roadmap _(v1 lead)_

| Aspect                       | v0 — today                                                    | v1 — first real users (adds…)                                                                                              | v2 — longer term (adds…)                                                                     |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Functionality (F1–F10)**   | ✅ Full set built (§6)                                        | — (baseline carries forward)                                                                                              | —                                                                                           |
| **Deployment scope**         | Deployed to `snt-app-dev`, `snt-testing` (dev/test only)      | Deployed to a **real country workspace** for a pilot NMP team                                                             | Rolled out to further country workspaces                                                     |
| **Per-pipeline descriptions**| Placeholder / partial one-liners                              | **Short paragraph per pipeline** (what it is / produces / how to read it); **PM seeds a couple, Giulia completes the rest** — 🔨 **2 of 18 done** (A.1, A.2) | Richer per-step "how to read this" content                                                   |
| **Guidance / narrative**     | Guided one-step-at-a-time structure in place; minimal copy    | — (**full narrative layer parked** — see §7)                                                                              | _Full narrative layer_ — per-step plain-language walkthrough; onboarding "start here" tour   |
| **Documentation source**     | README link out to GitHub `main` (F3)                         | **Resolve GitHub-README vs installed-version drift**; explore surfacing the template's **"Template Documentation"** in-app | —                                                                                           |
| **Dependencies display**     | Full Requires/Unlocks/Uses lists in panel                     | ✅ **Built** — labelled sections collapsible; Dependencies starts collapsed. _Per-type counts not built_ (§8.1)            | —                                                                                           |
| **Report viewing**           | HTML report opens via signed-URL link-out (F6)                | ✅ **Built** — report embedded in a box at the bottom of the step (iframe on signed URL; feasibility confirmed)             | —                                                                                           |
| **Localization**             | English only                                                  | ✅ **Built** — single-app **EN/FR toggle** (persisted, `?lang=` deep-link). ⚠️ French copy is **draft, pending review**     | French-first; additional languages as needed                                                |
| **Failure help**             | Link out to the OpenHEXA run on failure (F10)                 | —                                                                                                                         | _Plain-language failure summary in-app + deeper run Messages / log excerpts_ (recommended v2)|
| **Guidance intelligence**    | Static dependency model drives order (F8/F9)                  | Static, pre-authored order only                                                                                          | _Active "recommend the next step to run"_ (recommended v2)                                   |
| **Team & scheduling**        | Single shared status board (F1)                               | —                                                                                                                         | _"Who is running what" visibility_; surface **scheduled/automated** runs (v2)                |
| **Setup self-service**       | Uses connections by slug only (F5); BLSQ sets up config/conns | —                                                                                                                         | _User-set connections_ / readiness checks, pending platform + ownership decisions            |

### 9.2 Flowchart roadmap _(side product — may follow Cockpit)_

| Aspect                        | v0 — today                                                  | v1 — first real users (adds…)                                                       | v2 — longer term (adds…)                                            |
| ----------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Functionality (F1–F10)**    | ✅ Full set built (§6)                                      | — (baseline carries forward)                                                       | —                                                                  |
| **Deployment scope**          | Deployed to `snt-app-dev`, `snt-testing`, `cmr-snt-process` | Exposed to real users **if/when promoted** after Cockpit                           | Further workspaces as a power-user alternative                     |
| **Map UX**                    | Pan/zoom 2D canvas + collapsible legend; card + side panel  | Polish (fit-to-screen defaults, legend clarity) for real-user readiness            | Larger-map ergonomics (mini-map / grouping) as the map grows       |
| **Per-pipeline descriptions** | Placeholder / partial one-liners                            | **Short paragraph per pipeline** — ✅ **inherited automatically** (shared `pipeline_descriptions.json`), so tracks Cockpit's 2-of-18 | Richer descriptions                          |
| **Documentation source**      | README link out to GitHub `main` (F3)                       | **Resolve GitHub-README vs installed-version drift** (shared with Cockpit) — _not built_ | —                                                            |
| **Dependencies display**      | Full Requires/Unlocks/Uses lists in panel                   | **Collapsible dependencies** (as built in Cockpit) — _not built, needs porting_    | —                                                                  |
| **Report viewing**            | HTML report opens via signed-URL link-out (F6)              | **Embed report content in a box** — _not built, needs porting_ (feasibility now confirmed by Cockpit) | —                                            |
| **Localization**              | English only                                                | **French — confirmed main interface language** (aligned with Cockpit) — _not built_; reads the `en` side of the shared bilingual data | French-first; additional languages |
| **Failure help**              | Link out to the OpenHEXA run on failure (F10)               | —                                                                                  | _Plain-language failure summary in-app + deeper run Messages_ (recommended v2) |
| **Guidance intelligence**     | Legend + type cues; static dependency model (F8/F9)         | Improved in-panel guidance/legend                                                  | _Active "recommend the next step"_ (recommended v2)                |
| **Team & scheduling**         | Single shared status board (F1)                             | —                                                                                  | _"Who is running what"_; surface **scheduled/automated** runs (v2) |

## 10. Open decisions for the PM (with recommended version placement)

Each open point below is tagged with the version where it is **recommended** to land, so the PM can
confirm or move it. Placing these is the main purpose of this document.

1. **French localization — _v1 (decided; ✅ built in Cockpit)._** French is **confirmed as the main
   interface language for v1** (PM, 2026-07-15), for both variants. **Sub-question resolved:** yes —
   **one web app with a language-switch button** works, and is built (Cockpit, 2026-07-17): an EN/FR
   header toggle, choice persisted, `?lang=fr` deep-linkable. No separate per-language builds needed.
   **Remaining for v1:** (a) **review/sign off the French copy** — currently draft; (b) decide whether
   **parameter labels/help** (which come from the pipeline source, not the app) should also be
   translated — today they stay English; (c) port to Flowchart if/when it goes user-facing.
2. **In-app failure help — _moved to v2._** On a failed run, surface a **plain-language summary
   in-app** and (deeper) **run Messages / log excerpts** — both now targeted at **v2** (was v1
   light). v1 keeps the link-out to the OpenHEXA run (F10). _(Q24; PM re-prioritised 2026-07-15.)_
3. **Per-pipeline descriptions — _v1 (scope adjusted)._** Each pipeline's one-liner is expanded to a
   **short paragraph** (a few sentences: what it is / produces / how to read its result). **Authoring
   model (PM, 2026-07-15):** the PM drafts the text for **a couple of pipelines** as a template, then
   **Giulia completes the rest**. This replaces both the earlier "one-line description" scope and the
   parked full-narrative layer. _(Carried over.)_
4. **Recommend the next step — _recommended v2._** Today (v1) the app is a **map you read**: it
   shows each pipeline's status, locks steps until their prerequisites succeed, and (in Cockpit)
   walks you through a fixed, pre-authored order — but _you_ still decide what to run next. An
   **active recommendation engine** (v2) would instead point at one specific action, computing it
   from the workspace's live state, including harder calls like "A.1 changed, so A.2 is now stale
   — re-run it." **Concretely** it would most likely be an inline **"next step" banner** pinned at
   the top (e.g. _"Next: run A.2 · DHIS2 Formatting"_ with a Run button) — or, in Cockpit, a
   highlighted **"▶ Recommended next"** call-to-action on the relevant step; a persistent strip,
   **not** a pop-up/modal (which interrupts and gets dismissed, whereas the recommendation should
   sit there as long as it's true). A lighter-touch variant is purely in-map: a **glowing
   highlight / "▶ next" badge** on the recommended node, so the guidance lives on the map itself.
   It's placed at v2 because it shifts the product from _showing_ the process to _driving_ it — a
   product-shape decision that can feel paternalistic to a domain expert meant to own the choices,
   and is best calibrated with real v1 feedback. _(Q20.)_
5. **Team run model & visibility — _recommended v2._** Do **all** members run pipelines, or one
   runs while others view? Should the app show **"who is running what"** (they share one workspace
   and one set of runs)? Note the real DRC-workshop confusion when two users install the same
   template pipeline. _(Q3/Q37.)_
6. **Connections & setup ownership — _recommended v2._** The steer is that users should eventually
   **set their own connections** (contradicting "BLSQ always sets them up first"). Confirm the
   target model, whether the running user ever handles raw credentials, and whether "one-click
   install" legitimately pulls a non-technical user into setup. Depends on platform support.
   _(Q27/Q28/Q51/Q57/Q60.)_
7. **Which variant(s) ship to users, and when — _standing strategic decision._** Current steer:
   **Cockpit is the v1 lead** (PM favourite, with the narrative layer); **Flowchart** is developed
   as a side product that **may follow**. Confirm whether Flowchart ever becomes a user-facing
   release or remains an internal/power-user tool. Consider if it would be possible to present both "flavours" at the same time (as separated web apps both available in the ws, or switch between) or would that confuse the user?
8. **Documentation source — README drift vs "Template Documentation" — _v1._** The detail panel
   links out to each pipeline's README on GitHub `main`, which is the _latest_ version and may not
   match the (older) version **installed** in the workspace. v1 resolves this. A candidate route:
   pipelines installed from a template carry a **"Template Documentation"** field (equivalent to the
   README) that could be **extracted and shown in-app** (e.g. a popup) instead of linking out.
   **Question for the team (Giulia to ask):** how is the template pipeline's "Template Documentation"
   field linked to GitHub? _(New, 2026-07-15.)_
9. **Condense the Dependencies section — _v1 (✅ built in Cockpit; one sub-question left)._** The
   panel's Dependencies block was too tall (A.2 · DHIS2 Formatting unlocks 10+). **Treatment
   decided by implementation:** collapse the **whole section** — every panel section is now a
   collapsible box, and Dependencies **starts collapsed**. It stays in place (not moved to the
   bottom of the panel). **Still open:** are the **per-type counts** in the collapsed header
   (_"Requires (2 pipelines)"_ / _"Unlocks (11 pipelines)"_) still wanted, now that the block is
   collapsed by default? Not built. _(New, PM 2026-07-15; built same day.)_
10. **Embed the HTML report in-app — _v1 (✅ built in Cockpit; feasibility confirmed)._** The run's
    HTML report now renders **in a box at the bottom of the step**, not only as a link (F6).
    **Technical point resolved:** the report **can** be safely embedded — its GCS signed URL sends
    no `X-Frame-Options` / restrictive `frame-ancestors`, so an `<iframe>` from the webapp origin
    works. Signed URLs expire, so the frame is mounted on a freshly-signed URL and re-signed on
    demand. Proven by the `archive/snt-app-dev/report-embed/` spike, then implemented. **Remaining
    for v1:** port to Flowchart if/when it goes user-facing. _(New, 2026-07-15; spiked and built
    the same day.)_

Resolved earlier (kept for traceability): missing-pipeline UX → greyed + clickable "how to
install" panel with a templates deep link (Q49/Q70); persistent vs session-only status → must
persist across reloads and teammates (Q71); desktop-only, no mobile/tablet (Q33); outputs display
→ built (HTML report + dataset/file links, Q65); up-front readiness checks → not required, fail-on-
run is acceptable (Q63); dependency hard-locking → **built in both variants** (was open in the
previous draft).
