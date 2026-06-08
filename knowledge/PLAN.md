# SNT Pipelines Orchestrator — Plan of Action

> **Status:** Draft v1 · Living document — edit freely as decisions change.
> **Goal:** a single, generic, multi-file static webapp that renders the full SNT
> stratification pipeline map and lets a non-coding user see status and run pipelines,
> deployable across workspaces with only per-workspace config files swapped.

This is the master plan. It is meant to be read by **you, your collaborators, and the AI
agent**. Keep it in the repo next to the code and context files so everyone (humans and
agents) works from the same source of truth.

---

## How to read this plan

- **Phases** are ordered milestones. Each ends in something concrete and reviewable.
- **Tasks** are *atomic*: one focused unit of work with a clear "done when…" check. An
  atomic task is small enough that it's either clearly done or clearly not — no ambiguity.
  Each agent task = roughly one focused Claude Code session.
- **Owner** tells you who does it. The agent does the coding; *you* own the content and the
  in-OpenHEXA actions; the PM and OH devs are pulled in where their input is the bottleneck.

| Owner | Who | Does |
| --- | --- | --- |
| 🧑 **You** | Giulia | OpenHEXA actions (create ws, run pipelines, connections), map content, reviews |
| 🤖 **Agent** | Claude Code | Writing/validating code & JSON, deploying via MCP, mirroring files |
| 👔 **PM** | SNT product owner | UI design input, validating the map against user needs |
| 🛠️ **OH devs** | OpenHEXA team | Platform/MCP/proxy questions, scopes, any new tooling |

- **Dep** = which tasks must finish first.
- **You'll learn** = the web-dev / agent concept that task teaches (this project is also about
  building your own expertise and ownership).

---

## Scope decisions (locked for v1)

These were decided in the planning discussion. Revisit only deliberately.

| Decision | Choice | Why |
| --- | --- | --- |
| First milestone | **Read-only status board** | Lowest risk, shippable, immediately useful as an overview |
| Cross-session status | **Must-have in v1** | It's the core value; confirmed feasible via `Pipeline.runs` in the GraphQL schema |
| Dependency locking | **Deferred to Phase 3** | Endgoal doc says "added later"; v1 draws arrows but keeps nodes clickable |
| Plan & tasks | **Markdown in this repo** | Single source of truth next to code + context |
| Build/test workspace | **New "SNT App Dev" ws** | Dedicated, stable, fully populated — not the shared `snt_testing` |
| Timeline | **No hard deadline** | Optimize for solid foundations + your ownership, not speed |

**Out of scope (per endgoal doc) — the webapp never does these:** install/update/delete
pipelines, edit workspace config (`SNT_config.json`), or manage connections. Those stay in
the OpenHEXA UI.

---

## The three parallel tracks you can start today

Phase 0 is not a single line of work — it's three independent tracks that unblock Phase 1.
Start all three now; none waits on the others.

```
TRACK A · Workspace        TRACK B · The Map          TRACK C · Status spike
(🧑 You, 🛠️ OH devs)        (🧑 You, 👔 PM, 🤖 Agent)    (🤖 Agent, 🧑 You, 🛠️ OH devs)
create SNT App Dev          gather full pipeline list   deploy throwaway test app
install ~20 pipelines       + layout from colleagues    query pipelines{runs} via proxy
wire connections/config     → pipeline_map.json         confirm status works (or file
run each once (real status) validate layout w/ PM         a precise OH-dev ticket)
        └──────────────────────────┴──────────────────────────┘
                                    ▼
                    PHASE 1 — Read-only status board
```

---

## Phase 0 — Foundations & de-risking

**Exit criteria:** the product spec is validated; the SNT App Dev workspace has all pipelines
installed and run once; a valid `pipeline_map.json` exists and renders the intended layout; we
have *confirmed* the status query works through the static-webapp proxy.

### Gate — validate the product before building

- **T0.0 — Validate the product spec** · 🧑 + 👔 + 🛠️ · Dep: —
  Review `knowledge/PRODUCT_SPEC.md` with the **PM** (sections 1–7 + open questions in §9),
  then check **technical feasibility with the OH devs** (§8). Capture answers back into the
  spec and the logs below.
  *Done when:* §9 open questions are resolved and every §8 feasibility item has a dev ✅/⚠️.
  *You'll learn:* how to turn a brain-dump into a stakeholder-ready spec and de-risk a product
  before writing code.

### Track A — Workspace setup

- **T0.1 — Create the "SNT App Dev" workspace** · 🧑 · Dep: —
  Create the workspace in OpenHEXA. Record its **slug** (likely `snt-app-dev`).
  *Done when:* the workspace exists and you can share its slug.

- **T0.2 — Install all official SNT pipelines** · 🧑 · Dep: T0.1
  Install every official SNT pipeline (from templates) into the new workspace.
  *Done when:* the Pipelines section lists all ~20.

- **T0.3 — Configure connections, config & input data** · 🧑 (🛠️ if blocked) · Dep: T0.1
  Set up DHIS2/other connections, `SNT_config.json`, and the input data each pipeline needs.
  *Done when:* a manual run of A.1 → A.2 succeeds end-to-end.

- **T0.4 — Run every pipeline once (successfully)** · 🧑 · Dep: T0.2, T0.3
  Trigger each pipeline so there is *real* status + outputs for the board to display.
  *Done when:* each pipeline has at least one terminal run (ideally `success`).

- **T0.5 — Generate workspace config + cards** · 🤖 (with 🧑) · Dep: T0.2
  Create `snt_app_dev/workspace_config.json` (UUIDs, connection slugs, app id) and
  `snt_app_dev/pipeline_cards.json` (catalog + params), per the existing schemas/instructions
  in `CLAUDE.md`.
  *Done when:* both files exist, validate against their schemas, and UUIDs resolve.

### Track B — The map (the long pole)

- **T0.6 — Consolidate the full map content** · 🧑 + 👔 · Dep: —
  Gather the complete pipeline list and the *intended* layout into one sketch: for every
  pipeline — execution stage (`row`), horizontal track (`col`), `type`
  (mandatory/alternative/facultative), mutex `group`, and dependency `edges`. Pull in
  colleagues' existing diagrams; fill gaps; **validate with the PM** (he understands user
  needs and the process flow).
  *Done when:* you have one agreed sketch (paper/diagram/table) covering all pipelines.
  *You'll learn:* how the map's data model (`row`/`col`/`edges`/`group`) drives the whole app.

- **T0.7 — Translate the sketch into `pipeline_map.json`** · 🤖 · Dep: T0.6
  Turn the sketch into a schema-valid `pipeline_map.json` (repo root, shared across all
  workspaces) and validate it against `pipeline_map_schema.json`.
  *Done when:* the file validates and every node `id` matches a pipeline function name.

- **T0.8 — Review the rendered layout** · 🧑 + 👔 · Dep: T0.7, T1.2, T1.3
  Once the grid + arrows render (Phase 1), sanity-check positions and edges against the sketch.
  *Done when:* the on-screen map matches the agreed flow.

### Track C — Technical spike (de-risk status)

> A *spike* is a small throwaway experiment to answer one risky question before you build on it.

- **T0.9 — Spike: does the status query work through the proxy?** · 🤖 + 🧑 · Dep: T0.1 (any ws with runs)
  ✅ **DONE (2026-06-08).** Deployed throwaway app `t0-9-status-proxy-spike` to `snt-testing`
  (scope `PIPELINES_READ` only). It returned real last-run statuses for all pipelines;
  manually triggering a pipeline in the OH UI then refreshing showed it as `running`.
  **Confirmed: cross-session status works through the proxy under `PIPELINES_READ` alone.**
  Correction to the original sketch: the `Workspace` type has no `pipelines` field, so the
  query uses the top-level `pipelines(workspaceSlug:…)` query → `items { runs(orderBy:
  EXECUTION_DATE_DESC, perPage:1) }`. Working query documented in `CLAUDE.md`. Local mirror:
  `snt_testing/status_spike/index.html`.
  *Done when:* ~~the test app prints real statuses for several pipelines~~ ✅ — and live status
  transitions are reflected on refresh.
  *You'll learn:* the proxy + `allowed_operations` model, and how to verify an assumption
  cheaply before committing to it.

- **T0.10 — If blocked: precise ask to OH devs** · 🛠️ · Dep: T0.9
  ✅ **RESOLVED — not blocked.** T0.9 succeeded, so no OH-devs ticket is needed; instead the
  confirmed working query is documented in `CLAUDE.md` (*"Reading last-run status for all
  pipelines"*).
  *Done when:* ~~status retrieval is either working or has an owned ticket~~ ✅ working.

---

## Phase 1 — Read-only status board (first shippable webapp)

The first real deliverable: the full map renders, every node shows real status, clicking a
node opens a read-only detail panel. **No Run button, no locking yet.**

**Exit criteria:** deployed to SNT App Dev, statuses match what you see in the OpenHEXA UI,
reviewed by you + PM.

- **T1.1 — Scaffold the app bundle** · 🤖 · Dep: T0.5, T0.7
  Create `snt_app_dev/orchestrator/` with `index.html` + `styles.css` + `app.js`, cloned from
  the proven split app (`snt_testing/population_transformation_split/`). `app.js` fetches
  `./pipeline_map.json` and `./pipeline_cards.json`.
  *Done when:* the app loads both files and logs the merged node list.
  *You'll learn:* the multi-file static-webapp structure and same-origin `fetch`.

- **T1.2 — Render the grid** · 🤖 · Dep: T1.1
  Place each node at its `row`/`col` on the canvas.
  *Done when:* all nodes appear in the intended grid positions.

- **T1.3 — Draw the SVG arrows** · 🤖 · Dep: T1.2
  Draw one SVG arrow per `edge` between node centers (no graph-layout library).
  *Done when:* every dependency edge is visible and points the right way.
  *You'll learn:* drawing connectors with inline SVG and element geometry.

- **T1.4 — Available vs greyed** · 🤖 · Dep: T1.2
  A node is *available* iff its `id` is in `pipeline_cards.json`; otherwise render it
  greyed-out and unclickable.
  *Done when:* missing pipelines show greyed; installed ones show active.

- **T1.5 — Live status layer** · 🤖 · Dep: T1.1, T0.9
  For each available node, fetch its latest run; show a status badge + last-run datetime, and
  a link to that run's page in the OpenHEXA UI.
  *Done when:* statuses on the board match the OpenHEXA Pipelines view after a reload.
  *You'll learn:* querying live data on load and mapping it onto UI state.

- **T1.6 — Read-only detail sidebar** · 🤖 · Dep: T1.4
  Clicking a node opens the sidebar: name, description, parameters (display only), a link to
  the pipeline's `README.md` on GitHub, and links to its latest outputs (datasets / HTML
  report).
  *Done when:* every available node shows correct details and working links.

- **T1.7 — Deploy + QA** · 🤖 + 🧑 · Dep: T1.5, T1.6
  Deploy to SNT App Dev via MCP; mirror all files to `snt_app_dev/orchestrator/`; you verify
  against the live workspace.
  *Done when:* the deployed URL shows the correct map + real statuses.

- **T1.8 — UI review round** · 👔 + 🧑 · Dep: T1.7
  PM + you review look/feel and clarity; collect feedback into Phase 3 polish tasks.
  *Done when:* feedback is captured as concrete follow-up tasks below.

---

## Phase 2 — Make it runnable

Add interactivity: configure and launch pipelines from the sidebar, poll the run, refresh
that node's status and outputs.

**Exit criteria:** you can run any available pipeline from the board and watch it complete.

- **T2.1 — Confirm params aren't stale** · 🧑 + 🤖 · Dep: T0.5
  Per the `CLAUDE.md` cache caveat: before wiring runs, re-fetch the `@parameter` decorators
  for the pipelines to be run and patch any drift into `pipeline_cards.json`.
  *Done when:* card params match the current GitHub source for each runnable pipeline.

- **T2.2 — Parameter form + config builder** · 🤖 · Dep: T1.6, T2.1
  Generate the input form from each card's params; build the `config` object; render
  `DHIS2Connection` params as a dropdown of the workspace's connections.
  *Done when:* the form produces a valid `config` for a test pipeline.

- **T2.3 — Run + poll** · 🤖 · Dep: T2.2
  Wire the Run button to the `runPipeline` mutation; poll the run; refresh that node's status
  and outputs on completion. (Reuse the proven single-app logic.)
  *Done when:* a real run triggered from the board completes and the node updates.

- **T2.4 — Mutual exclusion (alternative groups)** · 🤖 · Dep: T2.3
  Running one node of an `alternative` `group` marks the others in that group not-current
  (data-driven via `group`, not hardcoded).
  *Done when:* running A.3.1 visually supersedes A.3.2, etc.

- **T2.5 — Missing-pipeline message** · 🤖 · Dep: T1.4
  Attempting to run a greyed/missing pipeline shows a clear "install this pipeline first"
  message instead of a cryptic error.
  *Done when:* the message appears for a deliberately-missing pipeline.

- **T2.6 — Deploy + QA running** · 🤖 + 🧑 · Dep: T2.3
  *Done when:* you run several pipelines from the deployed app successfully.

---

## Phase 3 — Dependency locking + polish

- **T3.1 — Upstream locking** · 🤖 · Dep: T2.3
  A node unlocks only once every upstream `edge` has a completed/successful run.
  *Done when:* downstream nodes stay locked until prerequisites succeed.

- **T3.2 — States & errors** · 🤖 · Dep: T1.7
  Loading, empty, and error states for status fetch and runs.

- **T3.3 — Aesthetics pass** · 🤖 + 👔 · Dep: T1.8
  Apply the Phase 1 review feedback; desktop-landscape polish.

---

## Phase 4 — Generalize across workspaces

- **T4.1 — Verify generic/per-ws separation** · 🤖 · Dep: T2.6
  Confirm the bundle has *zero* hardcoded workspace specifics; everything ws-specific lives in
  the per-ws config + cards files.
  *Done when:* the same `index.html`/`styles.css`/`app.js`/`pipeline_map.json` work unchanged
  in a second workspace.

- **T4.2 — Deploy to a second workspace** · 🤖 + 🧑 · Dep: T4.1
  Prove portability by deploying to one more workspace with only new config + cards.

- **T4.3 — Document the runbook** · 🤖 + 🧑 · Dep: T4.2
  Update `CLAUDE.md`/`README.md` with the "add a new workspace orchestrator" steps.

---

## How to work with the agent (methodology)

For someone new to web dev + agents, this is how to get the most out of Claude Code on this
project — and keep ownership:

1. **One task per session.** Open a session, point at one task ID above, and ask the agent to
   do *just that*. Small scope = reviewable output = you understand what changed.
2. **Demand the acceptance check.** Every task has a "Done when…". Ask the agent to show you
   it's met (a screenshot, a query result, the rendered page) — don't accept "done" on faith.
3. **Read the diffs.** The agent explains its changes; read them. That's how the expertise
   transfers. Ask "why this way?" when unsure — that's a feature, not a delay.
4. **Keep context files current.** When a decision is made or a fact is learned, update
   `CLAUDE.md` / this plan. The next session starts smarter.
5. **Parallelize humans.** While the agent codes Phase 1, *you* run pipelines (Track A) and
   the *PM* validates the map (Track B). People are the bottleneck, not the agent.

---

## Open questions / decisions log

Add entries as they come up; mark resolved ones.

- **[RESOLVED]** v1 = read-only status board first → see Scope decisions.
- **[OPEN]** Exact URL patterns for (a) a pipeline's GitHub `README.md` and (b) a run's page in
  the OpenHEXA UI — needed for T1.5/T1.6 links. *Owner: 🧑 confirm with OH devs.*
- **[OPEN]** Does `pipelineRun` expose everything needed for the outputs links on a *historical*
  run (not just one you triggered)? *Owner: 🤖 verify during T1.5.*
- **[OPEN]** Final node count and any pipelines beyond the A.x set in the prototype.
  *Owner: 🧑 + 👔 during T0.6.*

## MCP / platform gaps to raise with OH devs

Track here anything the platform/MCP can't currently do, so the OH team can work in parallel.

- **[RESOLVED ✅]** Status query (`pipelines(workspaceSlug:…) { items { runs } }`) through the
  static-webapp proxy under `PIPELINES_READ` — **confirmed working** in T0.9 (2026-06-08). No
  ticket needed.
- *(add more as discovered)*
