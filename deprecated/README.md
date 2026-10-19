# deprecated/

**History, never a template.** Nothing in here is deployed, maintained, or kept in sync with the
rest of the repo. Paths, scopes and patterns inside these files may be stale. When building
something new, start from `webapps/orchestrator/` and `docs/`, not from here.

| Folder | What it is |
| --- | --- |
| [`flowchart/`](flowchart/) | The parked **Flowchart** UI variant of the orchestrator (2D node/edge map + side panel), its wireframes, and its extracted spec. See [`flowchart/README.md`](flowchart/README.md). |
| [`snt-app-dev/report-embed/`](snt-app-dev/report-embed/) | Feasibility spike (`report-embed-probe` webapp) proving a run's HTML report can be shown in an `<iframe>` on a signed URL. The technique is now built into the orchestrator. |
| [`snt-testing/status_spike/`](snt-testing/status_spike/) | Spike (`t0-9-status-proxy-spike` webapp) proving the `pipelines(workspaceSlug:) { runs(...) }` last-run-status query works through the webapp proxy under `PIPELINES_READ`. Now the orchestrator's status board. |
| [`snt-testing/dhis2_reporting_rate/`](snt-testing/dhis2_reporting_rate/), [`snt-testing/population_transformation/`](snt-testing/population_transformation/), [`snt-testing/population_transformation_split/`](snt-testing/population_transformation_split/) | Pre-orchestrator single-pipeline webapps (one card per pipeline; `_split` is the first multi-file html+css+js bundle). |
| [`snt-drc-workshop-demo/`](snt-drc-workshop-demo/) | Older flat single-file webapp (A.2 DHIS2 Formatting) built for the DRC workshop, with its own hand-made `pipeline_cards.json` / `workspace_config.json` from before the catalog moved to the workspace bucket. |

## Multi-card pattern (used by the single-pipeline webapps above)

When one webapp hosted cards for several pipelines, the convention was:

- Prefix every element ID with the card key (e.g. `a1_statusBox`, `a2_runBtn`).
- Keep per-pipeline config (UUID, `getConfig` fn, `validate` fn) in a `PIPELINE_CONFIG` object keyed
  by prefix.
- Shared functions (`gql`, `setStatus`, `showOutputs`, …) take `prefix` as their first argument.
- Cards run fully independently — triggering one does not affect another's state.

The orchestrator does not use this pattern.

Some of these spike webapps may still exist on the OpenHEXA platform as leftovers; the repo does not
track that.
