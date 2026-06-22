# SNT Orchestrator — Jira Items (reference / drafting sheet)

> **Purpose:** a human-facing reference and drafting sheet for the project's Jira issues — the
> full text, hierarchy, and conventions that **inspire** Giulia's manual Jira work.
> Source of the tasks: [PLAN.md](PLAN.md).
>
> **⚠️ Jira is managed manually.** Giulia creates, edits, transitions, and links all Jira items
> directly in the Jira UI (project **SNT25**, Epic **SNT25-536**), using this sheet as a
> drafting aid. The **agent must not** create, edit, transition, or link Jira issues, and should
> not treat this file as a task list to execute. Only touch Jira via the Atlassian MCP if Giulia
> explicitly asks for it in a given session. The "Created in Jira" tables below are a manually
> maintained snapshot and may lag the live Jira board.

## Conventions reference (how each issue is built)

Kept as a reference for the manual Jira work — these are the conventions Giulia follows when
creating/updating issues in the UI, not steps for an agent to run.

**Coordinates**

- Site: `bluesquare.atlassian.net`. Project: **SNT25** (id 15083) · Epic: **SNT25-536**.

**Hierarchy & labels**

- One **Epic** → five phase **Stories** → atomic **Tasks**. Story and Task are the same Jira
  level, so each **Task is parented to the Epic** and tied to its phase by a `phase:N` label +
  a **"relates to"** link to the phase Story.
- **Owner** → `owner:*` labels (`owner:giulia`, `owner:agent`, `owner:pm`, `owner:oh-devs`).
- **Dependencies** → **"is blocked by"** issue links between Tasks (the _Blocked by_ column).
- All issues carry the `snt-orchestrator` label.
- **Status:** unstarted issues are **Backlog**; Phase 0 T0.1–T0.4/T0.6/T0.7 and Phase 1
  T1.1–T1.6 are **Done** (the read-only board is built and deployed to `snt-app-dev`); the
  remaining open Phase 0–1 items are the human review gates (T0.0 spec validation, T0.5 layout
  review, T1.7 UI review).
- **Description** = the action. It deliberately omits owner / parent / dependencies — those are
  Jira fields, labels and links, not prose.
- **Acceptance criteria** = the task's _Done when_. Items marked _(proposed)_ were not spelled
  out in PLAN.md and are suggested here for review.
- Every Task summary keeps its `T-x` prefix so this sheet ↔ PLAN.md ↔ Jira stay cross-referable.

## Created in Jira

| Item                              | Key                                                            | Status                                       |
| --------------------------------- | -------------------------------------------------------------- | -------------------------------------------- |
| Epic — SNT Pipelines Orchestrator | [SNT25-536](https://bluesquare.atlassian.net/browse/SNT25-536) | In Progress                                  |
| Story — Phase 0                   | [SNT25-537](https://bluesquare.atlassian.net/browse/SNT25-537) | In Progress                                  |
| Story — Phase 1                   | [SNT25-547](https://bluesquare.atlassian.net/browse/SNT25-547) | In Progress                                  |
| Story — Phase 2                   | [SNT25-548](https://bluesquare.atlassian.net/browse/SNT25-548) | Backlog                                      |
| Story — Phase 3                   | [SNT25-549](https://bluesquare.atlassian.net/browse/SNT25-549) | Backlog                                      |
| Story — Phase 4                   | [SNT25-550](https://bluesquare.atlassian.net/browse/SNT25-550) | Backlog                                      |
| Phase 0 Tasks T0.0–T0.7           | SNT25-538, SNT25-540–546                                       | T0.1–T0.4/T0.6/T0.7 Done; T0.0, T0.5 Backlog |

---

## Epic

| Key       | Type | Summary                    | Labels             |
| --------- | ---- | -------------------------- | ------------------ |
| SNT25-536 | Epic | SNT Pipelines Orchestrator | `snt-orchestrator` |

**Description:**
No-code OpenHEXA static webapp that renders the full SNT stratification pipeline flow as an
interactive map, and lets a non-coding user see the status of — and run — every pipeline from
one screen.

Source of truth (in repo):

- master plan & atomic tasks `knowledge/PLAN.md`;
- product spec `knowledge/PRODUCT_SPEC.md`.

---

## Story — Phase 0 · Foundations & de-risking (SNT25-537)

**Description:** Phase 0 of the orchestrator. Three parallel tracks — workspace setup (A), the
pipeline map (B), and a status-query spike (C) — plus a product-validation gate, all of which
unblock Phase 1.
**Exit criteria:** the product spec is validated; the SNT App Dev workspace has all pipelines
installed and run once; a valid `pipeline_map.json` exists and renders the intended layout; the
status query is confirmed working through the static-webapp proxy.

| Ref  | Key       | Type | Summary                                              | Owner               | Blocked by       | Status   |
| ---- | --------- | ---- | ---------------------------------------------------- | ------------------- | ---------------- | -------- |
| T0.0 | SNT25-538 | Task | T0.0 — Validate the product spec                     | giulia, pm, oh-devs | —                | Backlog  |
| T0.1 | SNT25-540 | Task | T0.1 — Set up the SNT App Dev workspace              | giulia              | —                | **Done** |
| T0.2 | SNT25-541 | Task | T0.2 — Generate workspace config + cards             | agent, giulia       | T0.1             | **Done** |
| T0.3 | SNT25-542 | Task | T0.3 — Consolidate the full map content              | giulia, pm          | —                | **Done** |
| T0.4 | SNT25-543 | Task | T0.4 — Translate the sketch into `pipeline_map.json` | agent               | T0.3             | **Done** |
| T0.5 | SNT25-544 | Task | T0.5 — Review the rendered layout                    | giulia, pm          | T0.4, T1.2, T1.3 | Backlog  |
| T0.6 | SNT25-545 | Task | T0.6 — Spike: status query through the proxy         | agent, giulia       | —                | **Done** |
| T0.7 | SNT25-546 | Task | T0.7 — If blocked: precise ask to OH devs            | oh-devs             | T0.6             | **Done** |

### T0.0 — Validate the product spec

**Description:** Review `knowledge/PRODUCT_SPEC.md` with the PM — the product/UX sections and
the **"Open questions for the PM"** list — then check technical feasibility with the OH devs
using the **"Technical feasibility"** checklist (items F1–F8). Capture answers back into the
spec and the decision logs in `knowledge/PLAN.md`.
**Acceptance criteria:** the PM's open questions are resolved and every technical-feasibility
item (F1–F8) has a dev ✅/⚠️.

### T0.1 — Set up the SNT App Dev workspace

**Description:** Stand up the dedicated "SNT App Dev" workspace so there is a stable,
fully-populated environment with real pipeline status to build against. Work through the
checklist in order:

- [ ] Create the "SNT App Dev" workspace in OpenHEXA and record its slug (likely `snt-app-dev`).
- [ ] Install every official SNT pipeline (from templates) into the workspace (~20).
- [ ] Set up the DHIS2/other connections, the `SNT_config.json`, and the input data each pipeline needs.
- [ ] Run each installed pipeline at least once, so there is real status + outputs for the board to display.

**Acceptance criteria:** all four boxes ticked — workspace exists (slug shared), all ~20
pipelines installed, a manual A.1 → A.2 run succeeds end-to-end, and each pipeline has at least
one terminal run (ideally `success`).

### T0.2 — Generate workspace config + cards

**Description:** Create `snt_app_dev/workspace_config.json` (pipeline UUIDs, connection slugs,
app id) and `snt_app_dev/pipeline_cards.json` (catalog + parameters), per the schemas and
instructions in `CLAUDE.md`.
**Acceptance criteria:** both files exist, validate against their schemas, and all UUIDs resolve.

### T0.3 — Consolidate the full map content

**Description:** Gather the complete pipeline list and the intended layout into one sketch: for
every pipeline — execution stage (`row`), horizontal track (`col`), `type`
(mandatory/alternative/facultative), mutex `group`, and dependency `edges`. Pull in colleagues'
existing diagrams; fill gaps; validate with the PM.
**Acceptance criteria:** there is one agreed sketch (paper/diagram/table) covering all pipelines.

### T0.4 — Translate the sketch into `pipeline_map.json`

**Description:** Turn the agreed sketch into a schema-valid `pipeline_map.json` (repo root,
shared across all workspaces) and validate it against `pipeline_map_schema.json`.
**Acceptance criteria:** the file validates and every node `id` matches a pipeline function name.

### T0.5 — Review the rendered layout

**Description:** Once the grid + arrows render (Phase 1), sanity-check node positions and edges
against the agreed sketch.
**Acceptance criteria:** the on-screen map matches the agreed flow.

### T0.6 — Spike: status query through the proxy _(Done)_

**Description:** Deploy a throwaway static webapp that queries pipeline last-run status through
the same-origin `/graphql/` proxy under `PIPELINES_READ`, to confirm cross-session status is
feasible before building the board. _Result (2026-06-08):_ deployed `t0-9-status-proxy-spike`
to `snt-testing`; it returned real last-run statuses for all pipelines, and a pipeline triggered
in the OH UI showed as `running` on refresh. Confirmed: cross-session status works through the
proxy under `PIPELINES_READ` alone. The `Workspace` type has no `pipelines` field, so the working
query uses the top-level `pipelines(workspaceSlug:…)` → `items { runs(orderBy:
EXECUTION_DATE_DESC, perPage:1) }`. Documented in `CLAUDE.md`; local mirror at
`snt_testing/status_spike/index.html`. (Deployed artifact keeps its original `t0-9` name.)
**Acceptance criteria:** ✅ met — the test app prints real statuses and live status transitions
appear on refresh.

### T0.7 — If blocked: precise ask to OH devs _(Done)_

**Description:** Contingency — if the spike (T0.6) had shown the status query blocked by the
proxy, file a precise ticket to the OH devs (exact query, required scope, error seen). Not
needed: T0.6 succeeded, so the confirmed working query is documented in `CLAUDE.md` ("Reading
last-run status for all pipelines") instead.
**Acceptance criteria:** ✅ met — status retrieval is working; no OH-devs ticket required.

---

## Story — Phase 1 · Read-only status board (SNT25-547)

**Description:** 📊 The first version of the app we can actually share — a "look, don't touch"
status board. The whole pipeline map shows up on screen, every pipeline box displays how its
most recent run went (even runs other people started), and clicking a box opens a side panel
with its details. 👀 It's all read-only for now: no Run button and no locking of steps behind
their prerequisites — those come in later phases. The aim is simply to give everyone one clear
screen to _see_ the full SNT flow and where each pipeline stands. 🗺️
**Exit criteria:** 🚀 published to the SNT App Dev workspace; ✅ the statuses on the board match
what OpenHEXA shows; 👍 reviewed and signed off by Giulia and the PM.

| Ref  | Key   | Type | Summary                         | Owner      | Blocked by | Status   |
| ---- | ----- | ---- | ------------------------------- | ---------- | ---------- | -------- |
| T1.1 | _tbd_ | Task | T1.1 — Scaffold the app bundle  | agent      | T0.2, T0.4 | **Done** |
| T1.2 | _tbd_ | Task | T1.2 — Render the grid          | agent      | T1.1       | **Done** |
| T1.3 | _tbd_ | Task | T1.3 — Draw the SVG arrows      | agent      | T1.2       | **Done** |
| T1.4 | _tbd_ | Task | T1.4 — Available vs greyed      | agent      | T1.2       | **Done** |
| T1.5 | _tbd_ | Task | T1.5 — Live status layer        | agent      | T1.1, T0.6 | **Done** |
| T1.6 | _tbd_ | Task | T1.6 — Read-only detail sidebar | agent      | T1.4       | **Done** |
| T1.7 | _tbd_ | Task | T1.7 — UI review round          | pm, giulia | T1.6       | Backlog  |

### T1.1 — Scaffold the app bundle

**Description:** 🏗️ Lay the foundations of the new app. Instead of starting from a blank page,
we copy a small app we already trust (`snt_testing/population_transformation_split/`) and reshape
it into a fresh `snt_app_dev/orchestrator/` folder. The app is split into three files, each with
one clear job: `index.html` is the skeleton of the page, `styles.css` handles how things look,
and `app.js` handles the logic.

At this stage the app doesn't draw anything yet — the only goal is to make sure it can wake up
and read its two data files: the shared map of all pipelines (`pipeline_map.json`) and the list
of pipelines that actually exist in this workspace (`pipeline_cards.json`). Once both are loaded,
the app combines them into a single list of nodes it can later put on screen. 🔗

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** this task is owned by the agent and has
nothing visible on the page yet — so to "see" it working you peek behind the scenes in the
browser's **developer console** (open the app, press `F12`, click the **Console** tab). It's a
hidden panel where the app can print messages for developers; it's not part of the visible
webpage. Here's how to convince yourself it works:

1. 🚀 Open the app and open the dev console.
2. 👀 Watch what it prints. In T1.1 we deliberately add a line that prints the combined list of
   pipeline boxes the app just built — so the console fills with ~18 entries (`snt_dhis2_extract`,
   `snt_dhis2_format`, …), each tagged _available_ or _greyed_.
3. ✅ Reading that list confirms three things happened: it found and opened the shared map
   (`pipeline_map.json`), it found and opened this workspace's pipeline list
   (`pipeline_cards.json`), and it correctly _merged_ the two (matched each map box to whether
   this workspace actually has that pipeline).

The failure cases are just as visible: a missing file or a typo shows a red error instead of the
list 🛑, and broken merge logic shows an empty list or everything marked greyed.

🔑 Mental model: think of T1.1 as wiring up the engine and turning the key — you can't see the
car move yet, but you listen for the engine to turn over. "Log the merged node list" is that
engine sound. T1.2 is where it becomes visible (boxes appear on screen); T1.1's whole job is to
prove the data plumbing is sound _before_ anything is built on top of it — so if boxes go missing
later, you already know the data wasn't the problem.
**Acceptance criteria:** the app loads both JSON files and logs the merged node list.

### T1.2 — Render the grid

**Description:** 🗺️ Bring the map to life on screen. Every pipeline in the map has two
coordinates that say where it belongs: a `row` (how far down the page it sits, roughly its step
in the overall flow from top to bottom) and a `col` (where it sits left-to-right, which keeps the
parallel branches — like the A, B and D tracks — neatly side by side). 📐

This task takes those coordinates and actually draws each pipeline as a box (a "node") in the
right spot on the canvas, so the whole flow lines up the way it was designed in the map. No
arrows, colours, or clicking yet — just every box showing up in its correct place. ✅

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** this is the first task you can actually
_see_ — so the test is your own eyes. 👀

1. 🚀 Open the app. You should now see a page full of labelled boxes instead of a blank screen.
2. 🧭 Compare the layout to the agreed map sketch (the one consolidated back in T0.3): are the
   boxes roughly in the right rows top-to-bottom, and do the parallel A / B / D tracks sit in
   their own columns side by side?
3. 🔢 Do a quick headcount — roughly 18 boxes, one per pipeline, with nothing overlapping or
   piled up in a corner.

Don't worry yet about arrows, colours, or whether anything is clickable — those are later tasks.
The only question here is "is every box in the place the map says it should be?" 📐 If a box is
missing or in the wrong spot, that usually points back to its `row`/`col` values in
`pipeline_map.json`.
**Acceptance criteria:** all nodes appear in the intended grid positions.

### T1.3 — Draw the SVG arrows

**Description:** ➡️ Connect the dots. Now that the boxes are in place, we draw the arrows that
show how one pipeline feeds into the next. The map already lists these connections (each one is
called an "edge"), and for every connection we draw a single arrow from one box to another so
the reader can follow the flow at a glance. 👀

We draw these arrows ourselves with plain built-in web tools (SVG), without pulling in any
outside drawing library or relying on the internet — this keeps the app simple, fast, and
self-contained. The key thing to get right is direction: each arrow must point from the pipeline
that comes first to the one that depends on it. 🎯

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** again, an eyes-on check — this time
following the lines. 👀

1. 🚀 Open the app: the boxes from T1.2 should now be joined by arrows.
2. ➡️ Pick a pipeline you know feeds another (for example, an "extract" step feeding a "format"
   step) and check the arrow runs _from_ the earlier one _to_ the later one — the arrowhead is on
   the correct end, not pointing backwards.
3. 🔍 Spot-check a couple more connections against the map sketch: every link drawn in the map
   should have exactly one arrow, and there should be no arrows between boxes that aren't actually
   related.

A common giveaway of a bug here is an arrow pointing the wrong way 🔄 or a connection that's
missing entirely — both trace back to the `edges` list in `pipeline_map.json`.
**Acceptance criteria:** every dependency edge is visible and points the right way.

### T1.4 — Available vs greyed

**Description:** 🌗 Show what's actually usable in this workspace. The map always shows the
_complete_ picture — every SNT pipeline that could exist — but not every workspace has all of
them installed. This task teaches the app to tell the difference. 🔍

The rule is simple: if a pipeline appears in the workspace's own list (`pipeline_cards.json`),
it's "available" and shown in full colour. If it doesn't, it's "greyed out" — dimmed and not
clickable — so the user can still see it's part of the bigger flow but understands it isn't
ready to use here. ⚪ This is exactly what lets the same single map work for every workspace
while still feeling tailored to each one. 🧩

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** here you can prove the rule to yourself by
comparing the screen to the workspace's pipeline list. 👀

1. 🗂️ Open `snt_app_dev/pipeline_cards.json` and skim the list of pipelines it contains — these
   are the ones installed in this workspace.
2. 🚀 Open the app and look at the map: the boxes shown in full colour should match that list,
   and any pipeline _not_ in the list should appear dimmed/greyed. ⚪
3. 🖱️ Try clicking a greyed box — nothing should happen (it's intentionally not clickable),
   whereas a coloured box should respond.

A neat way to really convince yourself: imagine temporarily removing one pipeline from
`pipeline_cards.json` — that box should flip to greyed on the next reload. 🔁 This is the same
mechanism that makes the one shared map adapt to every workspace.
**Acceptance criteria:** missing pipelines render greyed; installed ones render active.

### T1.5 — Live status layer

**Description:** 🚦 Make the board show real, up-to-date information. For every available
pipeline, the app asks OpenHEXA "how did your most recent run go?" and shows the answer right on
the box. Each node gets a little status badge — for example ✅ success, ❌ failed, or 🔄 still
running — together with the date and time of that last run. 🕒

We also add a handy link on each node that jumps straight to that run's page in OpenHEXA, so
anyone can dig into the details with one click. The big win here is that this reflects what's
really happening on the platform — even runs that other people started — not just runs launched
from this app. The test is straightforward: what the board shows should match what you'd see in
the OpenHEXA Pipelines screen after a refresh. 🔁

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** this one is satisfying to check because
you're comparing the app against the real OpenHEXA platform side by side. 🪟🪟

1. 🚀 Open the app in one tab and the OpenHEXA **Pipelines** view (for the SNT App Dev workspace)
   in another.
2. 🚦 Go pipeline by pipeline: the status badge and last-run time on each box should match what
   OpenHEXA reports for that same pipeline. ✅ ❌ 🔄
3. 🔗 Click the "open in OpenHEXA" link on a node and confirm it lands on the right run's page.
4. 🧪 The convincing test: trigger a run from the OpenHEXA UI (or ask a colleague to), then
   reload the app — that pipeline's badge should update to `running`, then to its final status.
   This proves the board reflects _everyone's_ activity, not just runs started from the app. 🔁

If a badge disagrees with OpenHEXA, it usually means the status query came back stale or for the
wrong run — a reload is the first thing to try.
**Acceptance criteria:** statuses on the board match the OpenHEXA Pipelines view after a reload.

### T1.6 — Read-only detail sidebar

**Description:** 📋 Give each pipeline a "details" view. When the user clicks a node on the map,
a panel slides open on the side of the screen showing everything worth knowing about that
pipeline: its name, a short description of what it does, and the list of settings (parameters) it
uses. 🛠️ In this first version these settings are shown for reading only — you can look but not
change or launch anything yet (running comes in Phase 2).

The panel also gathers the useful links in one place: a shortcut to the pipeline's full
documentation (`README.md`) on GitHub 📖, and links to its latest results — any datasets it
produced and its HTML report — so the user can review the outputs without hunting around. 📄
The goal is that every available pipeline opens a tidy, accurate summary with links that all
work. 🔗

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** the test here is to click around and read
carefully — you're checking that the panel tells the truth and that every link actually goes
somewhere. 👀

1. 🖱️ Click an available (coloured) box: a panel should slide open on the side.
2. 📋 Read it over — name, description, and the list of settings (parameters) — and sanity-check
   that they match what you'd expect for that pipeline. Remember: in this phase these are
   read-only, so there's no Run button yet (that's Phase 2).
3. 📖 Click the GitHub `README.md` link and confirm it opens that pipeline's documentation.
4. 📄 Click the output links (datasets / HTML report) and confirm they open the latest results —
   no dead links or "not found" pages.
5. 🔁 Repeat on two or three different pipelines to make sure the panel updates to match whichever
   box you clicked (and isn't stuck showing the first one).

A broken or missing link 🛑, or a panel showing the wrong pipeline's details, is the kind of
thing this check is meant to catch.
**Acceptance criteria:** every available node shows correct details and working links.

### T1.7 — UI review round

**Description:** 👀 Step back and look at it together. With the read-only board live, the PM and
Giulia go through it with fresh eyes: Is it easy to understand at a glance? Do the colours,
labels, and layout make sense? Is anything confusing, cramped, or missing? 🤔 This is a
look-and-feel review, not a bug hunt — it's about whether the board _communicates_ well to
someone who isn't a developer. 🎨

Every comment and idea is written down as a clear, concrete to-do, so the polish work in Phase 3
has a ready-made list to pick from rather than a vague sense of "make it nicer." ✨
**Acceptance criteria:** feedback is captured as concrete follow-up tasks.

---

## Story — Phase 2 · Make it runnable (SNT25-548)

**Description:** Make the board interactive — configure and launch pipelines from the sidebar,
poll the run, and refresh that node's status and outputs.
**Exit criteria:** Giulia can run any available pipeline from the board and watch it complete.

| Ref  | Key   | Type | Summary                                      | Owner         | Blocked by | Status  |
| ---- | ----- | ---- | -------------------------------------------- | ------------- | ---------- | ------- |
| T2.1 | _tbd_ | Task | T2.1 — Confirm params aren't stale           | giulia, agent | T0.2       | Backlog |
| T2.2 | _tbd_ | Task | T2.2 — Parameter form + config builder       | agent         | T1.6, T2.1 | Backlog |
| T2.3 | _tbd_ | Task | T2.3 — Run + poll                            | agent         | T2.2       | Backlog |
| T2.4 | _tbd_ | Task | T2.4 — Mutual exclusion (alternative groups) | agent         | T2.3       | Backlog |
| T2.5 | _tbd_ | Task | T2.5 — Missing-pipeline message              | agent         | T1.4       | Backlog |
| T2.6 | _tbd_ | Task | T2.6 — Deploy + QA running                   | agent, giulia | T2.3       | Backlog |

### T2.1 — Confirm params aren't stale

**Description:** Before we let anyone launch a pipeline, make sure the app's "memory" of each
pipeline parameters is still accurate. The app keeps a saved snapshot of every pipeline's
parameters in a file called `pipeline_cards.json`.

But the real pipelines keep evolving: a parameter can be renamed, added, or removed by their developers. If our snapshot has fallen out of date, a run launched from the
board fails with a confusing technical error (something like _"the provided config contains
invalid key(s)"_) 🛑.

So this task is a quick freshness check: for **only** the pipelines we're about to make
runnable (not all ~18), we re-read their current settings straight from the source on GitHub,
compare them to our snapshot, and patch any differences back in — then stamp the snapshot with a
new date.
It's plumbing, not visible UI, but it's what stops Run from failing for a simple avoidable reason later.

> 🔗 **Relates to G.1 !**
>
> This is the **interim, manual** version of what **G.1** (_Auto-refresh
> `pipeline_cards.json` via an OpenHEXA pipeline_) automates permanently — both keep card params
> from drifting and causing `invalid key(s)` run failures.
>
> ✍🏽 Do T2.1 by hand for now; once G.1
> ships, this recurring manual check is **superseded**.
>
> **Note**: One deliberate difference: T2.1 reads
> params from **GitHub** `main`, whereas G.1 reads from **OpenHEXA** directly (the _deployed_
> version a run actually accepts) — so G.1 is also the more accurate source, not just the
> automated one.

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** nothing changes on screen here — this is a
data hygiene step — so the "proof" is in the file and the agent's report 📋

1. 🗂️ Open `snt_app_dev/pipeline_cards.json` and note the `generated_at` date near the top —
   that's when the snapshot was last taken.
2. 🔍 The agent will tell you, pipeline by pipeline, whether the live settings on GitHub still
   match the snapshot — and if anything drifted, exactly what changed (a renamed/added/removed
   setting).
3. ✅ Afterwards, the `generated_at` date should be bumped to today, and any drift should be
   reflected in the file.

The reassuring outcome is often "no drift — already in sync"; the valuable outcome is catching a change _before_ it breaks a real run.

**Acceptance criteria:** card params match the current GitHub source for each runnable pipeline.

### T2.2 — Parameter form + config builder

**Description:** Turn each pipeline's list of parameters into a real fill-in form in the side
panel.
Every pipeline declares what it needs before it can run (see parametes in pipeline.py files).
This task reads that list (the same parameters the sidebar showed read-only in Phase 1) and automatically builds the matching input boxes the user can actually type in or pick from.

Two nice touches:

1. each kind of setting gets the right kind of input (a checkbox for yes/no, a number box for a year, a plain text box for free text), and
2. for "which DHIS2 connection?"
   settings we show a **dropdown of the connections that actually exist in this workspace** instead
   of asking the user to know and type a cryptic code. Once the user fills things in, the app
   quietly bundles their answers into a neat package (the "config") in exactly the shape OpenHEXA
   expects. The Run button isn't wired up yet (that's the next task) — here we're just building the
   form and the package it produces. 📦

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** the test is to open a pipeline and see a
form you can actually interact with. 👀

1. 🖱️ Click an available (coloured) box to open its side panel.
2. 📝 Where Phase 1 showed settings as read-only text, you should now see real, editable
   fields — boxes to type in, checkboxes to tick, and a dropdown for any DHIS2-connection
   setting.
3. 🎛️ Check the dropdown lists this workspace's real connections (not a blank or a code to type).
4. 🧪 There's no Run button to press yet, but if the agent left a debug line, filling the form
   and triggering it should print a clean little config package with your values in it.

The thing to confirm here is "does each setting show the _right type_ of input, and does it
collect what I typed correctly?" — getting the package shape right is what makes the actual run
work in T2.3. 🔗
**Acceptance criteria:** the form produces a valid `config` object for a test pipeline.

### T2.3 — Run + poll

**Description:** ▶️ Make the **Run** button actually launch a
pipeline.

When the user fills in the form (from T2.2) and clicks Run, the app sends that config off to OpenHEXA to start the pipeline for real.
Then, because a pipeline can take a while, the app keeps quietly checking back every few seconds (aka _polling_) — and updates the node live: the status badge moves from 🔄 running to ✅
success (or ❌ failed), and once it's finished the node's outputs (datasets, reports) refresh too.

🎮 The result is that a user can drive a real pipeline end-to-end from the board without ever leaving the page or
touching the OpenHEXA UI.

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** this is the satisfying one — you actually
run something and watch it happen. 🍿

1. 🖱️ Open an available pipeline, fill in its form, and click **Run**.
2. 🔄 Watch the node's badge: it should switch to _running_ within a few seconds, then settle on
   its final result (✅ success or ❌ failed) once the pipeline finishes — without you reloading
   the page.
3. 🪟 Cross-check in OpenHEXA: open the **Pipelines** view for SNT App Dev in another tab — the
   same run you just launched should be there too, with a matching status.
4. 📄 After it finishes, the node's outputs (datasets / report links) should refresh to show the
   fresh results.

Pick a quick, cheap pipeline for the first try so you're not waiting long. ⏱️ If the badge never
leaves _running_, that usually means the polling stopped early or the run errored on OpenHEXA's
side — the OpenHEXA run page will say why.

**Acceptance criteria:** a real run triggered from the board completes and the node updates.

### T2.4 — Mutual exclusion (alternative groups)

**Description:** 🔀 Handle the "either/or" steps gracefully. A few places in the SNT flow offer
**alternatives** — two different ways to do the same job, where you're meant to pick one, not
both (for example, the five outlier-imputation methods of **A.3**, or the two ways to compute the
**A.4** reporting rate). 🤔 The map already knows which pipelines are alternatives to each other
because they share the same `group` label (and are `type: "alternative"`).

This task makes the board respect that "pick one" rule, driven entirely by the data — no
pipeline is hard-coded, so if the map adds or changes an alternative group later it just works. 🧩

**The rule — "current = most recent _successful_ run":** within a group, the member whose latest
**successful** run is the most recent is the **active choice**; every other member is
**superseded** (visibly set aside). Crucially the pick flips on **success, not on launch**:

- ▶️ Running an option shows its live `running` badge but does **not** change the active choice yet
  — a run that ends up failing must not throw away the alternative that's still the valid output.
- ✅ Only when a run **succeeds** does that member become the active choice and its siblings flip to
  superseded (it's now the most-recent success in the group).
- ❌ A **failed** / stopped run changes nothing — the previously-successful member stays current.
- This same rule also paints the board correctly **on page load** from real OpenHEXA run dates
  (no in-app session memory needed): if two alternatives each have a real past success, the newer
  one shows as active. It dovetails with Phase 3 locking (T3.1), where "is the group satisfied?"
  should mean _the active member_ has a successful run.

**Visual treatment** (mock-up: [`knowledge/t24_pickone_demo.html`](t24_pickone_demo.html)):

- **Active choice** — green radio ● + green ring + an "active" tag; full colour.
- **Superseded** — dimmed (~55%) with a hollow radio ○, but **still fully clickable and runnable**
  (running it to success is exactly how you switch the pick). This is deliberately distinct from
  the dashed-grey **unavailable/greyed** look (a pipeline not installed in the workspace, T1.4).
- The group box keeps its existing _"— choose one"_ label; an optional variant names the active
  method (e.g. _"A.4 — using Data Element"_). Both are shown in the demo for review.

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** the test is to run one of a pair and watch
its sibling step aside — **once the run succeeds**. 👀

1. 🔎 Find an alternative group on the map — there are two: the **A.3** outlier-imputation methods
   and the **A.4** reporting-rate options.
2. ▶️ Run one option in the group and watch it: while it's `running`, nothing else changes yet.
3. ✅ When it **succeeds**, it becomes the active choice (green radio/ring + "active" tag) and the
   other option(s) in that group dim to "superseded".
4. ❌ Bonus check: if a run **fails**, the active choice should _not_ change — whatever last
   succeeded stays current.
5. 🔁 Run the _other_ option and let it succeed — the roles swap, so whichever **succeeded** last
   is the one shown as current.

The point being proven: you can never end up with two conflicting alternatives both looking
"active" at once, and a failed experiment never discards the alternative that still holds a valid
result. ⚖️
**Acceptance criteria:** after a successful run of one group member, that member is marked the
active choice and the others in its `group` render superseded (data-driven via `group`); a failed
run leaves the current choice unchanged.

### T2.5 — Missing-pipeline message

**Description:** 🚧 Be kind about pipelines that simply aren't installed in this workspace.
Remember the same full map is shown everywhere, so some boxes are greyed-out because that
pipeline doesn't exist here (see T1.4). 🌗 This task makes sure that if a user ever ends up
trying to _run_ one of those not-installed pipelines, they get a clear, friendly explanation —
something like _"This pipeline isn't installed in this workspace yet — install it first"_ —
rather than a confusing technical error or a button that silently does nothing. 💬

It's a small but important polish: it turns a dead-end into a helpful signpost, so a
non-technical user always understands _why_ something can't be run and what to do about it. 🪧

---

**👩‍🏫 Tutorial for the human (optional, hands-on):** the test is to deliberately poke at a
not-installed pipeline and confirm you get a helpful message. 👀

1. ⚪ Identify a greyed-out (not-installed) box on the map.
2. 🖱️ Try to act on it as if you wanted to run it.
3. 💬 Instead of nothing happening or a cryptic error, you should see a plain-language message
   explaining it isn't installed here and needs installing first.

> 🔎 **Worth a quick sanity check with Giulia before building:** since Phase 1 (T1.4 / T1.6) made
> greyed boxes **unclickable**, a user currently can't even open the sidebar — let alone reach a
> Run button — for a not-installed pipeline. So this guard may be either (a) mostly a safety net
> for edge cases, or (b) a sign we want greyed boxes to stay clickable enough to _show_ this
> message. Worth deciding which, so the task targets the real scenario. 🤔

**Acceptance criteria:** the message appears for a deliberately-missing pipeline.

### T2.6 — Deploy + QA running

**Description:** Deploy the runnable version to SNT App Dev and QA by running real pipelines from
the board.
**Acceptance criteria:** Giulia runs several pipelines from the deployed app successfully.

---

## Story — Phase 3 · Dependency locking + polish (SNT25-549)

**Description:** Dependency locking + polish — lock downstream nodes until upstream runs
succeed, add loading/empty/error states, and apply the Phase 1 UI-review feedback.

| Ref  | Key   | Type | Summary                 | Owner     | Blocked by | Status  |
| ---- | ----- | ---- | ----------------------- | --------- | ---------- | ------- |
| T3.1 | _tbd_ | Task | T3.1 — Upstream locking | agent     | T2.3       | Backlog |
| T3.2 | _tbd_ | Task | T3.2 — States & errors  | agent     | T1.7       | Backlog |
| T3.3 | _tbd_ | Task | T3.3 — Aesthetics pass  | agent, pm | T1.8       | Backlog |

### T3.1 — Upstream locking

**Description:** Implement upstream locking — a node unlocks only once every upstream `edge` has
a completed/successful run.
**Acceptance criteria:** downstream nodes stay locked until their prerequisites succeed.

### T3.2 — States & errors

**Description:** Add loading, empty, and error states for status fetch and pipeline runs.
**Acceptance criteria:** _(proposed)_ each state renders a clear message instead of a blank or
broken UI.

### T3.3 — Aesthetics pass

**Description:** Apply the Phase 1 UI-review feedback; polish for desktop-landscape use.
**Acceptance criteria:** _(proposed)_ the agreed review-feedback items are addressed and signed
off by the PM.

---

## Story — Phase 4 · Generalize across workspaces (SNT25-550)

**Description:** Generalize across workspaces — confirm the generic-bundle vs per-workspace-config
separation, prove portability on a second workspace, and document the runbook.

| Ref  | Key   | Type | Summary                                 | Owner         | Blocked by | Status  |
| ---- | ----- | ---- | --------------------------------------- | ------------- | ---------- | ------- |
| T4.1 | _tbd_ | Task | T4.1 — Verify generic/per-ws separation | agent         | T2.6       | Backlog |
| T4.2 | _tbd_ | Task | T4.2 — Deploy to a second workspace     | agent, giulia | T4.1       | Backlog |
| T4.3 | _tbd_ | Task | T4.3 — Document the runbook             | agent, giulia | T4.2       | Backlog |

### T4.1 — Verify generic/per-ws separation

**Description:** Confirm the bundle has zero hardcoded workspace specifics; everything
workspace-specific lives in the per-workspace config + cards files.
**Acceptance criteria:** the same `index.html`/`styles.css`/`app.js`/`pipeline_map.json` work
unchanged in a second workspace.

### T4.2 — Deploy to a second workspace

**Description:** Prove portability by deploying the orchestrator to one more workspace using only
a new `workspace_config.json` + `pipeline_cards.json`.
**Acceptance criteria:** _(proposed)_ the second workspace's orchestrator works with no code
changes — only new config + cards.

### T4.3 — Document the runbook

**Description:** Update `CLAUDE.md` / `README.md` with the "add a new workspace orchestrator"
runbook.
**Acceptance criteria:** _(proposed)_ a new-workspace deploy can be followed step-by-step from
the docs.

---

## Generic - ToDos not tied to any specific Phase

> Candidate work that is recognised but **not** slotted into a committed phase. Some of these are Jira issues linked to the Story https://bluesquare.atlassian.net/browse/SNT25-553 .  
> Currenrly **excluded from the Totals count**.

### G.1 — Auto-refresh `pipeline_cards.json` via an OpenHEXA pipeline

**Description:**
`pipeline_cards.json` (per-workspace catalog of pipeline UUIDs + parameters that drives the
orchestrator's active/greyed nodes) is currently regenerated by hand and drifts from the live
workspace — UUIDs change when a pipeline is re-created, new pipelines appear, and `@parameter`
decorators get edited. Move this to an OpenHEXA pipeline so the file stays correct automatically,
launchable manually from the OH UI and/or on a schedule.

> 🔗 **Relates to T2.1.** This **automates and supersedes** the manual freshness check in
> **T2.1** (_Confirm params aren't stale_): T2.1 re-fetches params by hand for the few pipelines
> about to be run, whereas G.1 regenerates the whole file on demand/on a schedule so the drift
> never accumulates. Note the different source of truth — T2.1 reads from **GitHub** `main`; G.1
> reads from **OpenHEXA** directly (the _deployed_ version a run actually accepts), which is why
> G.1 is also more accurate, not just automated. Until G.1 ships, T2.1 is the interim stopgap.

Key design points:

- **Source UUIDs _and_ parameters from OH directly**, not from GitHub. `PipelineVersion.parameters`
  is fully exposed via GraphQL (`code`, `name`, `help`, `type`, `choices`, `default`, `multiple`,
  `required`, `connection`, `widget`), so the refresh needs no GitHub fetch — and OH reflects what
  a run will actually accept (prevents the `invalid key(s)` run errors), which the GitHub `main`
  source does not guarantee.
- **Curation = the join with `pipeline_map.json`.** Include a pipeline iff its `id` is a node in
  the map **and** it exists live in the workspace. No separate manifest is needed; "in map but not
  live → greyed-out" is the existing behaviour. (This rule reproduces the manual curation done on
  2026-06-19, which dropped `snt_dhis2_quality_of_care` and `snt_assemble_results` precisely because
  they are not map nodes.)
- The generated file then carries only **volatile data** (`id`, `uuid`, `openhexa_code`,
  `parameters`); display name/description/position come from the map at render time, joined by `id`.

**Spike (do first) — delivery mechanism:** decide how the refreshed file reaches the webapp, and
confirm the pipeline's credentials/scopes for it:

1. Pipeline calls `updateStaticWebapp` to redeploy just `pipeline_cards.json` (keeps the current
   same-origin `fetch("./pipeline_cards.json")` unchanged) — _open question: can a pipeline call
   that mutation?_
2. Pipeline writes cards to the workspace bucket; the webapp fetches it at runtime via a signed URL
   (`prepareObjectDownload`, already under the app's `FILES_READ` scope) — **preferred if feasible**:
   decouples cards from the deploy so all deployed files become generic.
3. Webapp queries pipelines + params live at page load and drops the static file entirely — viable
   but loses git-versioned/diffable cards and pushes the map-join curation into `app.js`.

**Risks / notes:**

- Param values would reflect the **deployed** pipeline version (may lag GitHub `main`); document OH
  as the chosen source of truth.
- Publish atomically so the webapp never reads a half-written file mid-refresh.
- Decide multi-workspace shape: one pipeline parameterised by workspace slug vs one per workspace.

**Acceptance criteria:**

- An OH pipeline regenerates a workspace's `pipeline_cards.json` from live OH data joined with
  `pipeline_map.json`, matching the current schema (or an agreed slimmed schema).
- Runnable manually from the OH UI and on a schedule.
- The orchestrator webapp picks up refreshed cards without a manual redeploy.
- Param values reflect the deployed pipeline versions (documented as the source of truth).

---

## Totals

1 Epic + 5 Stories + 28 Tasks = **34 issues** (+ extra created directly in the Jira UI, without being referenced here)

_Backlog (unphased) candidates not counted above: B.1._
