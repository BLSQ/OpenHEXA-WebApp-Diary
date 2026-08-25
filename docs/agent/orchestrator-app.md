# The orchestrator app — variants, map, states, i18n

> **Read this before editing anything under `app/`.**
> The workspace-side data it consumes is in [`catalog.md`](catalog.md); how to ship it is in
> [`deploy.md`](deploy.md); the API calls it makes are in
> [`openhexa-runtime.md`](openhexa-runtime.md).
>
> The product is fully specified in `docs/PRODUCT_SPEC.md`, which separates variant-independent
> **functionality** (Part A) from the **UI variants** (Part B) and the **v0 / v1 / v2 roadmap**
> (Part C). **Read the relevant wireframe + PRODUCT_SPEC at the start of any session working toward
> the orchestrator UI.**

## What it is

A single, rich static webapp per workspace — the **SNT Pipelines Orchestrator** — presenting the
_complete_ set of official SNT pipelines (~18, from the `snt_development` repo) as one guided,
interactive surface with a configuration/run sidebar. The earlier small single-pipeline webapps were
stepping stones and are **retired to `archive/`** (reference only — not deployed, not maintained).

In the flowchart variant the layout is a scrollable canvas showing the pipeline map on the left, and
a side panel on the right that — when a node is selected — shows its description, a link to the
pipeline's GitHub README, a generated parameters form, a **Run** button, a link to the live OpenHEXA
run, and (after a run) the data outputs and HTML report links. Node tags mark each pipeline as
mandatory, alternative, or facultative.

**The map is identical across all workspaces** (for a given UI variant). Every workspace's
orchestrator shows the same full diagram. What differs per workspace is only which nodes are
_active_ — pipelines not available in a given workspace appear greyed-out and unclickable.

## UI variants

Same underlying pipeline data, different layout/UX. Each variant is a fully self-contained bundle
under `app/<variant>/` and does **not** share files with any other variant — including
`pipeline_map.json`, which is duplicated per variant (not a single shared file) so each UI can drift
independently.

- **`flowchart`** — an interactive 2D node/edge map with a config/run sidebar. Target UX:
  `design/wireframes/orchestrator_wireframe.html`. Deployed to `snt-app-dev`, `snt-testing`,
  `cmr-snt-process`. **English-only.**
- **`cockpit`** — a focused, one-step-at-a-time guided walkthrough, and the **v1 lead variant**
  (where new functionality lands first). Target UX:
  `design/wireframes/orchestrator_wireframe_cockpit.html`. Deployed to `snt-app-dev`, `snt-testing`,
  `cmr-snt-process` (the last added 2026-08-05). **Bilingual EN / FR** and carries the in-app HTML
  report embed — two features the flowchart variant does not have.

### Telling variants apart on the live platform

Webapp identity isn't stored in the repo, so **always resolve it live with `list_static_webapps`** —
never hardcode a slug or assume one from a previous session. Verified live 2026-08-24:

| Variant     | Slug(s) seen in the wild                                                    | Name (consistent everywhere)             |
| ----------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| `flowchart` | `snt-pipelines-orchestrator` **or** `snt-pipelines-orchestrator-flowchart`  | `SNT Pipelines Orchestrator - Flowchart` |
| `cockpit`   | `snt-pipelines-orchestrator-cockpit`                                        | `SNT Pipelines Orchestrator - Cockpit`   |

⚠️ **This reversed on 2026-08-24 — the old "match on slug, names are unreliable" rule is now wrong.**
Since a webapp's subdomain/slug is editable in its settings, `cmr-snt-process`'s flowchart app was
re-slugged to `snt-pipelines-orchestrator-flowchart` (URL now
`https://snt-pipelines-orchestrator-flowchart.openhexa.io/`), while its name was fixed to the
`- Flowchart` convention. So today:

- **Names are now consistent** across all three workspaces (`- Flowchart` / `- Cockpit`, plain
  hyphen, **not** an em dash).
- **Flowchart slugs are not** — two forms are live.

**Practical rule:** match `cockpit` on the exact slug `snt-pipelines-orchestrator-cockpit`, and treat
**anything else** matching `snt-pipelines-orchestrator*` as `flowchart`. Do not test for equality
with `snt-pipelines-orchestrator` — that silently misses `cmr-snt-process`. Cross-check against the
name when it matters, and re-list rather than trusting this table: more re-slugging is possible, and
only the live API is authoritative.

## Multi-file app architecture

OpenHEXA static webapps serve more than just `index.html`. Per the OpenHEXA docs:

> _"`index.html` is the entry point; everything else (CSS, JS, images, JSON fixtures) is served as-is
> from the same origin... Reference assets with relative paths (`<script src="app.js">`,
> `<link href="style.css">`). The injection only touches `text/html` responses; CSS, JS, and JSON
> files are untouched."_

So the orchestrator is a **multi-file bundle**, not one giant file. Four files live together under
`app/<variant>/` — e.g. `app/flowchart/index.html`, `app/flowchart/pipeline_map.json`, and the same
four again under `app/cockpit/`:

- `index.html` — minimal shell (containers + `<link rel="stylesheet" href="styles.css">` and
  `<script src="app.js">`; the cockpit's shell also holds the header appbar and the EN/FR toggle)
- `styles.css` — all styling (cards, node states, sidebar, SVG arrows)
- `app.js` — renders the UI, merges map + descriptions with cards, runs + polls pipelines
- `pipeline_map.json` — this variant's map, fetched at runtime

Plus `app/pipeline_descriptions.json`, which is deployed **into the same flat webapp root** but lives
outside any `app/<variant>/` subfolder because the same hand-authored text is shown identically in
every variant. There's only ever one copy to edit. Because each variant is still deployed as its own
separate OpenHEXA static webapp (same-origin `fetch` only), this one repo file must be copied into
**both** variants' deploy bundles — same content, deployed twice.

⚠️ **Its values are bilingual objects, not strings** — `{ "en": "…", "fr": "…" }`, both holding the
same Markdown-lite prose. **Editing a description means editing both languages.** A plain string is
still accepted and treated as `en` (backward compatibility). See
`schemas/pipeline_descriptions.schema.json` for the contract and the Markdown-lite formatting rules
(bold/italic/line breaks; no headers, links, or lists).

## Node states

The webapp computes three independent state axes per node:

- **available vs greyed** — _static_: a node is available iff its `id` is present in the workspace's
  bucket-hosted `pipeline_cards.json` (with a `uuid`). Otherwise it renders greyed-out and
  unclickable. This is how the same full map adapts to each workspace — and, since the catalog is
  regenerated by running `create_pipeline_cards`, how a newly-installed pipeline becomes clickable
  without touching the webapp.
- **locked vs unlocked** — _dynamic_: derived from `edges`. A node unlocks once every **hard**
  upstream prerequisite (each `type: "solid"` edge whose `to` equals this node) has a completed run in
  the current session. `type: "optional"` edges are **soft, non-gating** — they draw an arrow but do
  not lock the downstream node (its output is used if available, else a parameter fallback applies).

  **Group-aware unlock:** when several solid prerequisites of a node belong to the same alternative
  `group`, they count as _one_ — only one member of the group need complete. Formally: bucket the
  solid sources of node `N` by their `group` (a source with no `group` is its own bucket of size 1)
  and require **at least one completed source per bucket**; a non-grouped prerequisite is just a
  size-1 bucket, so this generalizes the simple rule. This only bites for a **solid edge leaving an
  alternative group** — the current map has none (A.3→A.4 became `optional` on 2026-06-24), so it is
  dormant future-proofing, but any future solid edge out of a group must honor it rather than
  requiring _all_ members.
- **completed** — ran successfully in the current session.

**Mutual exclusion:** nodes of `type: "alternative"` that share the same `group` are mutually
exclusive — running one marks the others in the group not-run (the wireframe shows this as the A.3.1
Outliers Imputation and A.4 Reporting Rate alternative groups; it is data-driven via `group`, not
hardcoded).

## Map format

`schemas/pipeline_map.schema.json` documents the structure of each variant's `pipeline_map.json` —
read it when authoring or interpreting the map (its `_generation_instructions` also cover the
edge/node-type conventions and the per-member-edge rule for alternative groups).
`design/pipeline_map_preview.html` is a standalone visual render of the map for review. The map is
**hand-authored** (a separate task); it is not generated from the GraphQL API.

Positions and arrows are **explicit**, with no graph-layout library or CDN dependency:

- Each node carries an explicit `row` (execution stage, top→bottom) and `col` (horizontal position,
  used to separate parallel A / B / D tracks).
- `edges` is a list of `{from, to, type}` objects referencing node `id`s; the webapp draws one SVG
  arrow per edge between node centers. `type` is `"solid"` (hard dependency — gates unlocking) or
  `"optional"` (soft link — draws an arrow but does not gate); omit for the default.
- Dependencies are expressed **only** as `edges`. There is no per-node prerequisite array and no
  separate layout array — layout comes from each node's `row`/`col`, and mutual exclusion from its
  `group`.
- **Outputs are not stored in the map or cards.** They are fetched at runtime from
  `pipelineRun.outputs` after a run.

## Bilingual UI (EN / FR)

French is the **main interface language for v1** (PM steer, 2026-07-15 — nearly all users are
French-speaking). It is implemented as **one webapp with a language toggle**, not as separate
per-language builds.

**Status: shipped in `cockpit` only** (2026-07-17). The `flowchart` variant remains English-only.
Both read the same shared `app/pipeline_descriptions.json`, so the nested shape must keep working for
both — do not "flatten" it.

| Tier                                           | Source                                              | Mechanism                            |
| ---------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| App chrome (buttons, statuses, section titles)  | the `I18N` table inside `app/cockpit/app.js`         | `t("key", {params})`                 |
| Node / step titles                              | `app/cockpit/pipeline_map.json` → `label`            | `pickLang(label)`                    |
| Node descriptions                               | `app/pipeline_descriptions.json` → `{ en, fr }`      | `pickLang(desc)`                     |
| **Parameter labels / help / choices**           | the workspace's bucket-hosted `pipeline_cards.json`  | **not translated — English for now** |

Key rules when touching cockpit text:

- **`pickLang(v)`** resolves a possibly-bilingual data value: an `{ en, fr }` object picks the active
  language, falls back to `en`, then to `""`; a plain string is returned as-is. This is why legacy
  flat data and the flowchart variant keep working.
- **`t(key, params)`** looks up chrome strings; a missing key falls back to English, then to the key
  itself (so a typo renders visibly rather than silently blank). **Add every new chrome string to
  _both_ `I18N.en` and `I18N.fr`.**
- **Structural fields are never translated:** `id`, `code`, `type`, `group`, `row`/`col`, `track`, and
  `ohName` (`ohName` is the load-bearing OpenHEXA display name — translating it breaks pipeline
  matching).
- **Language resolution order** (at boot): `?lang=` query param (wins, and is persisted) →
  `localStorage["snt_lang"]` → default `en`. Switching language sets `LANG`, rebuilds the steps, and
  re-renders everything from scratch — there is no partial-update path to maintain.
- The flowchart variant has a one-line equivalent of `pickLang` (its `descText()` helper) that just
  reads `.en`. If flowchart ever goes bilingual, that is the seam to widen.

⚠️ The **French strings in `I18N.fr` are drafts pending Giulia's review** (per the code comment in
`app/cockpit/app.js`). Do not present them as final copy.

## The two-variant DOM seam (⚠️ easy to get wrong)

The variants take **different DOM routes** for status and error messages — respect the seam when
adding markup:

- **Cockpit** — boot panel and run-status lines are set via **`innerHTML` with caller-side escaping**
  (build a pre-escaped HTML string; any dynamic value passed through `t()` must already be escaped).
- **Flowchart** — its `.map-error` box is **`textContent`-based**, so a link must be a real appended
  `<a>` element.

Handing HTML to flowchart renders visible tags; handing unescaped data to cockpit is an injection.
