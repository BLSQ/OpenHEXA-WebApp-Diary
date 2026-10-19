# Flowchart variant — spec & implementation notes (parked)

Extracted unchanged in substance from `docs/PRODUCT_SPEC.md` (§8, §9.2, flowchart rows/tails of
§3, §4, §8.1, §10), `CLAUDE.md` and `README.md` when the repo became cockpit-only (Oct 2026).
Dates and statuses are as they stood then. Paths are rewritten to this folder; line numbers refer
to `app/app.js` here. **History, never a template.**

---

## Product spec (from PRODUCT_SPEC §8)

### The 2D map _(side product, may follow Cockpit)_

**Strategic role:** developed **as a side product** (Giulia's preference), it may follow the
Cockpit into user-facing releases later. At the time it was the more broadly-deployed variant.
Target UX: `orchestrator_wireframe.html` (⚠️ **to be updated to current UX!**) and consider
variants like `orchestrator_frosted.html`.

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

In the variant framing, Part A of the spec (F1–F10) was "the same for both UI variants"; Cockpit
renders it as a guided sequence, Flowchart as a 2D map. Both were **independently-deployable
bundles** that did not share files (each had its own `pipeline_map.json`), so their UIs could drift.

### Gaps vs Cockpit when parked (from PRODUCT_SPEC §3, §8.1, §10)

- **Language:** English-only. Cockpit has the EN/FR toggle.
- **Dependencies section:** not condensed — full Requires / Unlocks / Uses lists (Cockpit made
  every panel section collapsible, Dependencies collapsed by default).
- **HTML report:** links out only; no in-app `<iframe>` embed.
- Open decisions that carried a "port to Flowchart if/when it goes user-facing" sub-point:
  French localization (§10 item 1c) and the report embed (§10 item 10).
- §10 item 7 (which variant(s) ship): Cockpit is the v1 lead; Flowchart "may follow". Open at the
  time: does Flowchart ever become user-facing or stay an internal/power-user tool? Could both
  "flavours" be offered at once (two webapps in the workspace, or a switch), or would that confuse
  users?

## Roadmap (from PRODUCT_SPEC §9.2)

| Aspect                        | v0 — today                                                  | v1 — first real users (adds…)                                                       | v2 — longer term (adds…)                                            |
| ----------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Functionality (F1–F10)**    | ✅ Full set built (§6)                                      | — (baseline carries forward)                                                       | —                                                                  |
| **Deployment scope**          | Deployed to `snt-app-dev`, `snt-testing`, `cmr-snt-process` | Exposed to real users **if/when promoted** after Cockpit                           | Further workspaces as a power-user alternative                     |
| **Map UX**                    | Pan/zoom 2D canvas + collapsible legend; card + side panel  | Polish (fit-to-screen defaults, legend clarity) for real-user readiness            | Larger-map ergonomics (mini-map / grouping) as the map grows       |
| **Per-pipeline descriptions** | Placeholder / partial one-liners                            | **Short paragraph per pipeline** — ✅ **inherited automatically** (shared `pipeline_descriptions.json`), so tracks Cockpit's progress | Richer descriptions                          |
| **Documentation source**      | README link out to GitHub `main` (F3)                       | **Resolve GitHub-README vs installed-version drift** (shared with Cockpit) — _not built_ | —                                                            |
| **Dependencies display**      | Full Requires/Unlocks/Uses lists in panel                   | **Collapsible dependencies** (as built in Cockpit) — _not built, needs porting_    | —                                                                  |
| **Report viewing**            | HTML report opens via signed-URL link-out (F6)              | **Embed report content in a box** — _not built, needs porting_ (feasibility confirmed by Cockpit) | —                                            |
| **Localization**              | English only                                                | **French — confirmed main interface language** (aligned with Cockpit) — _not built_; reads the `en` side of the shared bilingual data | French-first; additional languages |
| **Failure help**              | Link out to the OpenHEXA run on failure (F10)               | —                                                                                  | _Plain-language failure summary in-app + deeper run Messages_ (recommended v2) |
| **Guidance intelligence**     | Legend + type cues; static dependency model (F8/F9)         | Improved in-panel guidance/legend                                                  | _Active "recommend the next step"_ (recommended v2)                |
| **Team & scheduling**         | Single shared status board (F1)                             | —                                                                                  | _"Who is running what"_; surface **scheduled/automated** runs (v2) |

---

## Implementation notes (from CLAUDE.md / README.md)

- **Map.** `app/pipeline_map.json` uses `row` as a true 2D grid row (execution stage, top→bottom)
  and `col` to separate the parallel A / B / C / D tracks; the app draws one SVG arrow per edge
  between node centres. Cockpit's map has the same nodes/edges/ids/codes but uses `row` as the
  walkthrough stage index, and its `label`s are bilingual `{en, fr}` objects (Flowchart's are plain
  strings).
- **One catalog for both variants.** The workspace's bucket-hosted `pipeline_cards.json` is
  generated by `create_pipeline_cards` against the *Cockpit* webapp's deployed map
  (`config.WEBAPP_SLUG`). That works for Flowchart only because both maps declare the same node
  ids. If they diverge, each variant would need its own generated catalog. A Flowchart-only
  workspace makes the generator fail unless Cockpit is also deployed there, or `WEBAPP_SLUG` is
  pointed at the Flowchart webapp and the generator redeployed.
- **Descriptions.** `descText(v)` (`app/app.js:324`) is Flowchart's one-line equivalent of
  Cockpit's `pickLang`: it reads `.en` from the bilingual `{en, fr}` description objects (and
  accepts a plain string). It is the seam to widen if Flowchart ever goes bilingual.
- **Missing-catalog diagnosis** — mirrored from Cockpit: `GENERATOR_QUERY` (`app/app.js:80`),
  `diagnoseMissingCatalog` (`:193`), `missingCatalogError` (`:256`), with `looksLikeGenerator` and
  the `generator*Url` helpers in between.
- **DOM route for those messages differs from Cockpit.** Flowchart's `.map-error` box on the canvas
  is **`textContent`-based**, so a link must be a real appended `<a>` element: `missingCatalogError`
  attaches `err.helpLink = {href, label}` and the `init` catch builds the anchor (`app/app.js:2830`
  ff.). Handing it HTML renders visible tags. (Cockpit instead uses `innerHTML` with caller-side
  escaping and `err.htmlMessage`.)
- **Run errors.** `runErrorInfo(errors)` (`app/app.js:2022`) translates the `PipelineError` enum;
  drift codes get a "refresh the catalog" hint from `catalogRefreshHintHtml` (`:2077`) — Cockpit's
  equivalent is `catalogueRefreshHintHtml`. The hint is a `<span class="rs-hint">` with
  `flex: 0 0 100%` because `.sb-runstatus` is a wrapping flex container (a `<br>` would not break).
- **Webapp identity when parked.** Name `SNT Pipelines Orchestrator - Flowchart`; slug
  `snt-pipelines-orchestrator` in some workspaces and `snt-pipelines-orchestrator-flowchart` in
  others (slugs are editable). Always resolve live with `list_static_webapps`.
