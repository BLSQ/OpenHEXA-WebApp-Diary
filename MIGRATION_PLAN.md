# Repo Reorganization — Migration Plan

> One-time checklist for restructuring the repo into a clean `app/` + `workspaces/` +
> `schemas/` + `docs/` + `design/` + `archive/` layout. **Delete this file once the migration
> is committed.**

## Why (what this fixes)

- The "shared, workspace-independent" files were physically **duplicated and had drifted**:
  `pipeline_map.json` existed in 4 places (all different by whitespace/key-order; semantically
  root = `snt_app_dev` = `cmr`, while `snt_testing` was a stale v2026-06-15); the app shell
  (`index.html`/`styles.css`/`app.js`) was current in `snt_app_dev`/`cmr` but stale in
  `snt_testing`; `pipeline_cards.json` was duplicated per workspace (top-level + orchestrator
  copy) and had diverged in `snt_testing`.
- `workspace_config.json` is **legacy** — its IDs/scopes are now re-resolvable live via
  `list_static_webapps` / `get_static_webapp`. (`cmr` already has none.)
- `knowledge/` mixed consolidated specs, WIP design explorations, and process docs.
- The root was flat: schema/contract files, the map, and workspace folders all intermingled.

**Canonical sources chosen:** app shell ← `snt_app_dev/orchestrator/`; map ← root
`pipeline_map.json` (both are the current v2026-06-25). `snt_testing`'s orchestrator copies are
stale and are dropped.

## Execution order (IMPORTANT — do NOT run in parallel)

`schemas/pipeline_map.schema.json` is both **edited** (Step 2) and **moved** (Step 1), so the
two steps collide if run together. Run them in sequence:

1. **Step 2 — content edits (agent), in place** at current paths.
2. **Step 1 — file moves (Giulia)**: `git mv` / `git rm`; the moves carry the Step-2 edits along.
3. **Review & commit** once.

(Reverse order also works — moves first, then the agent edits at the new paths — it just adds a
hand-off. The only rule is: not simultaneously.)

## Target tree

```
SNT25-532/
├─ README.md
├─ CLAUDE.md
├─ app/                              ← generic orchestrator bundle (single source of truth)
│  ├─ index.html                        (from snt_app_dev/orchestrator/)
│  ├─ styles.css
│  ├─ app.js
│  └─ pipeline_map.json                 (from root — canonical v2026-06-25 map)
├─ workspaces/                       ← per-ws: ONLY the file that differs
│  ├─ snt-app-dev/pipeline_cards.json
│  ├─ snt-testing/pipeline_cards.json   (orchestrator copy — current, not the stale top-level)
│  └─ cmr-snt-process/pipeline_cards.json
├─ schemas/                          ← machine-readable contracts / references
│  ├─ pipeline_map.schema.json          (was pipeline_map_schema.json)
│  ├─ pipeline_cards.schema.json        (was pipeline_cards_schema.json)
│  └─ schema.generated.graphql          (kept name — matches upstream "generated" file)
├─ docs/                             ← consolidated knowledge (stable)
│  ├─ PRODUCT_SPEC.md
│  ├─ PLAN.md
│  ├─ JIRA_ITEMS.md
│  └─ personas/
│     ├─ persona_questionnaire.md
│     ├─ persona_questionnaire_Giulia-20260706.md
│     └─ persona_questionnaire_PM-20260624.md
├─ design/                           ← WIP / explorations (churny, not contracts)
│  ├─ wireframes/
│  │  ├─ orchestrator_wireframe.html
│  │  └─ orchestrator_wireframe_cockpit.html
│  ├─ grid_editor.html
│  ├─ pipeline_map_preview.html
│  └─ pipeline_map_20260625.png
└─ archive/                          ← retired spikes & pre-orchestrator apps
   ├─ snt-testing/
   │  ├─ dhis2_reporting_rate/
   │  ├─ population_transformation/
   │  ├─ population_transformation_split/
   │  └─ status_spike/
   └─ snt-drc-workshop-demo/            (whole legacy single-file app, incl. its workspace_config.json)
```

(`.claude/`, `.gitignore`, `ignore/` untouched.)

## Path mapping (old → new)

| Old | New | Note |
|---|---|---|
| `pipeline_map.json` | `app/pipeline_map.json` | root = canonical |
| `snt_app_dev/orchestrator/{index.html,styles.css,app.js}` | `app/…` | canonical shell |
| `snt_app_dev/orchestrator/pipeline_cards.json` | `workspaces/snt-app-dev/pipeline_cards.json` | |
| `snt_testing/orchestrator/pipeline_cards.json` | `workspaces/snt-testing/pipeline_cards.json` | current deployed copy |
| `cmr_snt_process/orchestrator/pipeline_cards.json` | `workspaces/cmr-snt-process/pipeline_cards.json` | |
| `pipeline_map_schema.json` | `schemas/pipeline_map.schema.json` | |
| `pipeline_cards_schema.json` | `schemas/pipeline_cards.schema.json` | |
| `schema.generated.graphql` | `schemas/schema.generated.graphql` | |
| `knowledge/{PRODUCT_SPEC,PLAN,JIRA_ITEMS}.md` | `docs/…` | |
| `knowledge/persona_questionnaire*.md` | `docs/personas/…` | |
| `knowledge/orchestrator_wireframe*.html` | `design/wireframes/…` | |
| `knowledge/grid_editor.html` | `design/grid_editor.html` | |
| `knowledge/pipeline_map_preview.html` | `design/pipeline_map_preview.html` | |
| `knowledge/pipeline_map_20260625.png` | `design/pipeline_map_20260625.png` | |
| `snt_testing/{dhis2_reporting_rate,population_transformation,population_transformation_split,status_spike}/` | `archive/snt-testing/…` | |
| `snt_drc_workshop_demo/` | `archive/snt-drc-workshop-demo/` | whole folder |

### Deleted (not moved)

- `pipeline_map_NOTES.md` — after relocating the bucket rule + per-member convention (see
  Step 2). A.2 rationale is dropped intentionally.
- `snt_app_dev/pipeline_cards.json` — redundant top-level (identical to the orchestrator copy kept).
- `snt_testing/pipeline_cards.json` — **stale** top-level (differs from the deployed orchestrator
  copy, which is kept). ⚠️ eyeball once before deleting, in case it held a newer manual edit.
- `snt_app_dev/workspace_config.json`, `snt_testing/workspace_config.json` — legacy.
  (The DRC one rides into `archive/` as a snapshot.)
- Redundant generic copies: `snt_testing/orchestrator/{index.html,styles.css,app.js,pipeline_map.json}`
  (stale), `cmr_snt_process/orchestrator/{index.html,styles.css,app.js,pipeline_map.json}`, and
  `snt_app_dev/orchestrator/pipeline_map.json` (dupes of `app/`).

## Step 1 — file moves (Git Bash, from repo root; Giulia runs these)

```bash
# create new homes
mkdir -p app workspaces/snt-app-dev workspaces/snt-testing workspaces/cmr-snt-process \
         schemas docs/personas design/wireframes \
         archive/snt-testing

# app/  (canonical generic bundle)
git mv snt_app_dev/orchestrator/index.html   app/index.html
git mv snt_app_dev/orchestrator/styles.css   app/styles.css
git mv snt_app_dev/orchestrator/app.js       app/app.js
git mv pipeline_map.json                      app/pipeline_map.json

# workspaces/  (cards only)
git mv snt_app_dev/orchestrator/pipeline_cards.json      workspaces/snt-app-dev/pipeline_cards.json
git mv snt_testing/orchestrator/pipeline_cards.json      workspaces/snt-testing/pipeline_cards.json
git mv cmr_snt_process/orchestrator/pipeline_cards.json  workspaces/cmr-snt-process/pipeline_cards.json

# schemas/
git mv pipeline_map_schema.json    schemas/pipeline_map.schema.json
git mv pipeline_cards_schema.json  schemas/pipeline_cards.schema.json
git mv schema.generated.graphql    schemas/schema.generated.graphql

# docs/
git mv knowledge/PRODUCT_SPEC.md  docs/PRODUCT_SPEC.md
git mv knowledge/PLAN.md          docs/PLAN.md
git mv knowledge/JIRA_ITEMS.md    docs/JIRA_ITEMS.md
git mv knowledge/persona_questionnaire.md                 docs/personas/persona_questionnaire.md
git mv knowledge/persona_questionnaire_Giulia-20260706.md docs/personas/persona_questionnaire_Giulia-20260706.md
git mv knowledge/persona_questionnaire_PM-20260624.md     docs/personas/persona_questionnaire_PM-20260624.md

# design/
git mv knowledge/orchestrator_wireframe.html         design/wireframes/orchestrator_wireframe.html
git mv knowledge/orchestrator_wireframe_cockpit.html design/wireframes/orchestrator_wireframe_cockpit.html
git mv knowledge/grid_editor.html                    design/grid_editor.html
git mv knowledge/pipeline_map_preview.html           design/pipeline_map_preview.html
git mv knowledge/pipeline_map_20260625.png           design/pipeline_map_20260625.png

# archive/  (whole folders move in one go)
git mv snt_testing/dhis2_reporting_rate            archive/snt-testing/dhis2_reporting_rate
git mv snt_testing/population_transformation       archive/snt-testing/population_transformation
git mv snt_testing/population_transformation_split archive/snt-testing/population_transformation_split
git mv snt_testing/status_spike                    archive/snt-testing/status_spike
git mv snt_drc_workshop_demo                       archive/snt-drc-workshop-demo

# deletions (redundant / stale / legacy)
git rm snt_app_dev/orchestrator/pipeline_map.json
git rm snt_testing/orchestrator/index.html snt_testing/orchestrator/styles.css \
       snt_testing/orchestrator/app.js snt_testing/orchestrator/pipeline_map.json
git rm cmr_snt_process/orchestrator/index.html cmr_snt_process/orchestrator/styles.css \
       cmr_snt_process/orchestrator/app.js cmr_snt_process/orchestrator/pipeline_map.json
git rm snt_app_dev/pipeline_cards.json snt_testing/pipeline_cards.json
git rm snt_app_dev/workspace_config.json snt_testing/workspace_config.json
git rm pipeline_map_NOTES.md

# tidy now-empty dirs (git ignores empty dirs; clear them on disk)
rmdir snt_app_dev/orchestrator snt_app_dev \
      snt_testing/orchestrator snt_testing \
      cmr_snt_process/orchestrator cmr_snt_process knowledge 2>/dev/null || true
```

## Step 2 — content edits (agent does these, in place, before Step 1)

**A. `pipeline_map_schema.json`** (edited in place; moved to `schemas/` in Step 1)
- Update `_description` / `_generation_instructions`: "single pipeline_map.json at the repo root"
  → `app/pipeline_map.json`.
- Add the per-member-edge convention (relocated from `pipeline_map_NOTES.md`): *"Edges out of an
  alternative group are drawn per member: because edges reference individual node ids (no
  group→group edge), a dependency leaving a group is written once per member (e.g. A.3→A.6 = 5
  edges). For the unlock semantics of a solid edge out of a group, see the group-aware bucket
  rule in CLAUDE.md → Node states."*

**B. `CLAUDE.md`**
- Data-architecture table + prose: `pipeline_map.json` → `app/pipeline_map.json`;
  `<ws>/pipeline_cards.json` → `workspaces/<ws>/pipeline_cards.json`; **remove the
  `workspace_config.json` row and every section that depends on it.**
- "Generic vs workspace-specific": bundle is now `app/` (4 generic) + `workspaces/<ws>/pipeline_cards.json` (1).
- **Deploy/mirror workflow rewrite:** drop "mirror all deployed files under `<ws>/<app_key>/`";
  the repo is the source of truth (`app/` + `workspaces/`). After a deploy, only re-sync
  `workspaces/<ws>/pipeline_cards.json` if it changed. Webapp `id`/`slug`/scopes resolved live
  via `list_static_webapps` / `get_static_webapp` (no `workspace_config.json`).
- Reference fixes: `pipeline_map_schema.json` → `schemas/pipeline_map.schema.json`;
  `pipeline_cards_schema.json` → `schemas/pipeline_cards.schema.json`;
  `knowledge/PLAN.md` → `docs/PLAN.md` (and JIRA_ITEMS, PRODUCT_SPEC, wireframe);
  `schema.generated.graphql` refresh `-OutFile` → `schemas/schema.generated.graphql`;
  **delete the `pipeline_map_NOTES.md` sentence.**
- Insert the **group-aware bucket rule** into "Node states → locked vs unlocked":
  > **Group-aware unlock:** when several solid prerequisites of a node belong to the same
  > alternative `group`, they count as *one* — only one member need complete. Formally: bucket
  > the solid sources of node `N` by their `group` (a source with no `group` is its own bucket of
  > size 1) and require **at least one completed source per bucket**; a non-grouped prerequisite
  > is a size-1 bucket, so this generalizes the simple rule. This only bites for a **solid edge
  > leaving an alternative group** — the current map has none (A.3→A.4 became `optional` on
  > 2026-06-24), so it is dormant future-proofing, but any future solid edge out of a group must
  > honor it rather than requiring *all* members.
- Session-start / "how to build" sections: replace the `<workspace>/<app_key>/` mirror model
  with `app/` + `workspaces/<ws>/`.

**C. `README.md`**
- Rewrite the tree + tables to the new layout; drop `workspace_config.json` and the
  deployed-apps mirror description.
- Fix stale PNG refs (`pipeline_map_20260615.png` / `_20260610.png` don't exist — only
  `_20260625.png` does) → `design/pipeline_map_20260625.png`.

## Operational consequences (not blockers)

1. **`snt-testing`'s live orchestrator will lag `app/`** (its deployed shell is stale). The
   reorg doesn't touch the live app; redeploy `app/*` to snt-testing whenever you choose.
   `snt-app-dev` and `cmr` live already match `app/`.
2. **No more `workspace_config.json`** → each deploy starts with a `list_static_webapps` call to
   get the webapp id/slug. Deployed URLs remain recorded in the README table.
3. **`snt_testing` cards mismatch** — the orchestrator copy (deployed) is kept; the top-level is
   deleted. Eyeball once before deleting in case the top-level held a newer manual edit.

## Post-migration verification

- `git status` shows only renames + the expected deletions; no stray content changes.
- Tree matches the target above; `knowledge/`, `snt_app_dev/`, `snt_testing/`,
  `cmr_snt_process/`, `snt_drc_workshop_demo/` no longer exist at root.
- Grep the repo for stale paths: `knowledge/`, `pipeline_map_NOTES`, `workspace_config`,
  `_schema.json` (old names), `<ws>/<app_key>` — all resolved in CLAUDE.md / README.
- `app/app.js` still `fetch`es `./pipeline_map.json` and `./pipeline_cards.json` (same-origin,
  unchanged — deploy still co-locates both).
- Delete this `MIGRATION_PLAN.md`.
```
