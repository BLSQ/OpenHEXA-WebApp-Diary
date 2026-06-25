# `pipeline_map.json` — authoring notes

Companion notes for [`pipeline_map.json`](pipeline_map.json) (the workspace-independent SNT
pipeline map). Structure/field reference lives in
[`pipeline_map_schema.json`](pipeline_map_schema.json); this file holds the human rationale,
conventions, and change log that used to live in the map's `_notes` string.

Authored for **T0.4**, translating the agreed T0.3 sketch
([`knowledge/pipeline_map_20260615.png`](knowledge/pipeline_map_20260615.png), made in
Whimsical) plus Giulia's dependency notes.

## Edge type conventions

| `type`     | Meaning                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `solid`    | **HARD** dependency — the `from` pipeline MUST have run before `to` can run.                                                          |
| `optional` | **SOFT** link — `from`'s output is used by `to` if available, but `to` can also run without it (via a parameter fallback). Non-gating. |

## Node type conventions

- **mandatory** — A.1, A.2.
- **alternative** — mutually-exclusive members sharing a `group`: A.3 (5 outlier methods, group
  `a3_outliers`) and A.4 (2 reporting-rate methods, group `a4_reporting_rate`). Running one
  marks the others not-run.
- **facultative** — optional pipeline whose output may itself become an SNT Explorer layer.
  Covers everything that is neither mandatory nor a mutually-exclusive alternative: A.5, A.6,
  A.7, B.1, B.2, B.3, C.1, D.1, D.2. (The former `output` type was folded into `facultative`
  on 2026-06-25 — in practice every pipeline's output can be a layer.)

## Hard A.2 dependents

Per Giulia, these need the pyramid and/or shapes from A.2, so they hard-depend on it:
**A.3, A.4, A.5, A.6, A.7, B.1, B.2, B.3, C.1, D.1.** (A.4 was removed from this list on
2026-06-15, then restored on 2026-06-24 — see change log.)

## Modeling decision: edges out of an alternative group are drawn per member

Only one member of an alternative group ever runs. Because `edges` reference individual node
`id`s (there is no group→group edge), an edge *out of* a group is drawn once **per member**
(e.g. A.3 → A.6 is 5 separate edges, one per outlier method).

### Group-aware lock/unlock (how the "any one member" rule is encoded)

This is the key semantic for edges leaving an alternative group. **It needs no extra field in
the map** — it is derived from the `group` already on each alternative node plus the per-member
edges:

> To decide if node `N` is unlocked: take every **solid** edge `(X → N)`, bucket the sources
> `X` by their `group` (a source with no `group` is its own bucket of size 1), and require
> **at least one completed source per bucket**.

A non-grouped prerequisite is just a bucket of size 1, so the same rule covers both cases. This
means:

- **A.2 → A.4** (restored as `solid` on 2026-06-24): A.2 is a size-1 bucket, so A.4 unlocks once
  A.2 has completed.
- **A.3 → A.4** (was the 2026-06-15 hard edge; **made `optional` on 2026-06-24**): no longer
  gating — soft data flow only. The bucket rule below is retained to illustrate the semantics for
  any future solid edge out of an alternative group.

`optional` edges are **never** gating, regardless of group — they only signal soft data flow
(and styling).

## Change log

### 2026-06-24 — edges (per Giulia)

- **A.3 → A.4 changed `solid` → `optional`** (all 5 × 2 = 10 per-member edges). A.4 reporting
  rate no longer hard-depends on the A.3 outlier group; the link is now a soft, non-gating data
  flow (outlier-imputed data is used if available, else A.4 runs on A.2 alone). This reverses
  the 2026-06-15 "A.4 HARD-depends on A.3" decision below and retires the "first solid edge out
  of an alternative group" case.
- **Added A.2 → A.4 `solid`** (2 edges, one per A.4 member). A.4 now hard-depends on A.2
  (DHIS2 Formatting) instead of on A.3. So A.4 unlocks once A.2 has completed, and **A.1 remains
  the only root.** (This re-establishes the A.2 → A.4 hard dependency that had been removed on
  2026-06-15.)
- **Deleted B.1 → A.5, B.1 → B.2, B.1 → B.3** (all were `optional`). WorldPop Extract (B.1) no
  longer feeds Population Transformation, MAP Extracts, or Access to Health Care. B.1 now has no
  outgoing edges (it remains a leaf, still hard-depending on A.2).

### 2026-06-15 — edges (per Giulia, review of the interactive preview)

- **Added A.2 → D.1** (solid). D.1 ERA5 had no incoming edge, so it behaved like a root
  (runnable from the start); it needs A.2's shapes, like B.1 and C.1.
- **A.2 → B.3 changed `optional` → `solid`.** B.3 Access to Health Care previously had only
  optional prerequisites, so it too was a false root (always unlocked). It now hard-depends on
  A.2. After this, **A.1 is the only true root** of the map.
- **A.4 members moved to `col` 1.5 / 2.5** (were 3 / 4) so the A.4 group box sits centred under
  the A.3 group box (cols 0–4, visual centre = col 2). Purely layout; uses fractional `col`
  (schema relaxed from int to number).

### 2026-06-15 — A.4 dependency (per Giulia)

A.4 reporting rate **no longer hard-depends on A.2** (it can't take A.2's output). Instead **A.4
now HARD-depends on A.3** (it consumes outlier-imputed data). This is the **first solid edge out
of an alternative group**; drawn per member (each A.4 member ← each A.3 member = 5 × 2 = 10
solid edges). See group-aware lock/unlock above.

## Open for T0.5 review

- the exact set of dashed (`optional`) edges into A.6.

(The B.1 → A.5 soft link and the A.3 → A.4 hard edge were both resolved on 2026-06-24 — see
change log: B.1 → A.5 deleted, A.3 → A.4 made `optional`.)

Confirm with Giulia + PM against the rendered layout.
