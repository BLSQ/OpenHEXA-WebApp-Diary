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
- **output** — produces an SNT Explorer layer: A.6, A.7, B.2, B.3, D.2.
- **facultative** — optional add-on that produces no layer: A.5, B.1, C.1, D.1.

## Hard A.2 dependents

Per Giulia, these need the pyramid and/or shapes from A.2, so they hard-depend on it:
**A.3, A.5, A.6, A.7, B.1, B.2, B.3, C.1, D.1.** (A.4 was removed from this list on 2026-06-15
— see change log.)

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

- **A.3 → A.4** (the 2026-06-15 hard edge): A.4 unlocks when **any one** A.3 outlier method has
  completed — not all five.
- **A.2 → A.4** (had it still existed) would have required A.2 (a size-1 bucket) to complete.

`optional` edges are **never** gating, regardless of group — they only signal soft data flow
(and styling).

## Change log

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

- the exact set of dashed (`optional`) edges into A.6;
- the B.1 → A.5 soft link;
- the group-aware unlock semantics for the A.3 → A.4 hard edge.

Confirm all three with Giulia + PM against the rendered layout.
