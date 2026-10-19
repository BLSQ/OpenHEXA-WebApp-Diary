# Flowchart variant (parked)

**History, never a template.** This is the second UI variant of the SNT Pipelines Orchestrator —
an interactive 2D node/edge map of the whole SNT process, with a configuration/run side panel.

## Why it is parked

The **Cockpit** variant (the guided one-step-at-a-time walkthrough, now `webapps/orchestrator/`)
is the v1 lead and the PM's preferred UX. Flowchart was developed as a side product that "may
follow". To keep the repo small and single-purpose, the repo became cockpit-only in October 2026
and Flowchart was moved here unchanged.

## What is here

| Path | What |
| --- | --- |
| `app/` | The last repo state of the Flowchart bundle (`index.html`, `app.js`, `styles.css`, `pipeline_map.json`), moved unchanged from `app/flowchart/`. |
| `orchestrator_wireframe.html` | The Flowchart target UX wireframe (flagged at the time as "to be updated to current UX"). |
| `orchestrator_frosted.html` | A visual-style exploration of the 2D map (uses a subset of the Flowchart map). |
| [`SPEC.md`](SPEC.md) | Flowchart-specific product spec, roadmap and implementation notes, extracted from `docs/PRODUCT_SPEC.md`, `CLAUDE.md` and `README.md`. |

## State when parked

- Functionally at the shared v0 baseline (F1–F10 in `docs/PRODUCT_SPEC.md`): live status board,
  greyed missing pipelines, parameter form, run + poll, outputs, mutual exclusion, dependency
  arrows and hard-locking, deep links.
- **English-only** (reads the `en` side of the bilingual data). No in-app report embed, no
  collapsible panel sections — those landed in Cockpit only.
- Reads the same bucket-hosted `pipeline_cards.json` as Cockpit (no bundled catalog).
- Flowchart webapps may still be live on some OpenHEXA workspaces. **The repo does not track
  deployments**; resolve live with `list_static_webapps` if it matters. Whether to unpublish them
  is a backlog item.

## Reviving it

1. Copy `app/` into its own folder under `webapps/` (e.g. `webapps/orchestrator_flowchart/`) and
   add `pipeline_descriptions.json` from `webapps/orchestrator/` — the deployed bundle needs it as a
   same-origin sibling.
2. Diff `app/pipeline_map.json` against `webapps/orchestrator/pipeline_map.json`: the node **ids**
   must match, because one catalog serves every webapp in a workspace (see `SPEC.md`).
3. Port what Cockpit gained since (bilingual UI, report embed, collapsible sections, any run-error
   or catalog-diagnosis changes) — `SPEC.md` lists the known gaps.
4. Update the paths in comments and `_notes` (they still say `app/…` and `schemas/…`).
