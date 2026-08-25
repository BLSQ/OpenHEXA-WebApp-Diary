# Settled questions — don't re-investigate these

Each line is a conclusion already paid for. **Check here before spending a session rediscovering
something.** Re-open one only with new information (e.g. a URL that used to 404 now returns 200).

## ✍️ Adding to this file (agents: this is part of your job)

This file only stays useful if it is fed. **Before ending a session, add a row here if any of these
happened:**

- You spent more than a few minutes establishing that something **isn't possible** → _Dead ends_.
- You followed an upstream doc/example and it was **wrong or misleading** → _Upstream doc traps_.
- You found that a note in this repo (here, `CLAUDE.md`, or any `docs/agent/*.md`) was **stale**, and
  corrected it → _Corrections_ (and fix the note itself in the same change).
- You evaluated a workable alternative and **deliberately didn't adopt it** → _Roads not taken_.
  Record the *why*, so it doesn't come back as a suggestion next session.
- You noticed something absent or unused that **looks like a bug but isn't** → _Known gaps_.

Rules for a good entry:

- **One row, not a paragraph.** The conclusion first, the evidence second. If it needs more than ~3
  lines, put the detail in the relevant `docs/agent/*.md` and link to it from here.
- **Date it** (`YYYY-MM-DD`) in the `Verified` / `Changed` column, or `—` if it's timeless. A dated
  claim can be re-checked; an undated one just rots.
- **Say what would reopen it** where that's knowable — "worth re-probing", "revisit if X becomes a
  problem". That's the difference between a settled question and a closed door.
- **Don't add speculation or TODOs.** This file is for things that were actually investigated. Ideas
  and pending work belong in `docs/PRODUCT_SPEC.md` or Jira.
- **Correct in place, don't append.** If an existing row turns out to be wrong, edit that row and
  move it to _Corrections_ — never leave two rows disagreeing with each other.

Adding a row is cheap (one line, no approval needed) and it is the single highest-leverage thing a
session can leave behind. Mention it to the user when you do — they may want it worded differently.

## Dead ends — things that look possible but aren't

| Question | Answer | Verified |
| --- | --- | --- |
| Can we develop locally against a live workspace via `dev.js`? | **No, not yet.** `https://app.openhexa.org/webapps/dev.js` returns a hard **404** (probed directly — not an auth redirect), despite being documented upstream. Worth re-probing: it would remove the deploy-to-test loop. Details in [`openhexa-runtime.md`](openhexa-runtime.md#local-development-against-a-live-workspace-devjs--documented-upstream-not-live-yet). | 2026-08-24 |
| Can the OpenHEXA **SDK** deploy a webapp? | **No.** The `sdk` and `toolbox-hexa` doc summaries both list "webapps" among what `OpenHexaClient` covers, which looks promising but isn't: the whole webapp surface is read-only — `workspace.get_webapp(slug)` and `client.get_webapp_by_slug(workspace_slug, webapp_slug)`, returning `name`, `url`, `description`, `icon`, `is_favorite`, `created_by`, `permissions`. There is **no** method to create or update webapp files. | 2026-08-24 |
| Can the OpenHEXA **CLI** deploy a webapp? | **No** — it deploys pipelines only. A feature request to the OH devs is in flight. | — |
| So how *do* we deploy? | **MCP (`edit_static_webapp_file` / `update_static_webapp`) or the OpenHEXA UI. Those are the only two paths.** See [`deploy.md`](deploy.md). | — |
| Is the front-end host derivable from the webapp hostname? | **No.** Webapps are `*.openhexa.io`; the app UI is `app.openhexa.org` — a different TLD. String-munging yields `app.openhexa.io`, which 404s. Hardcode the base. | 2026-06-18 |

## Upstream doc traps — do not copy its examples verbatim

| Trap | Reality |
| --- | --- |
| Its run-polling example breaks on `["SUCCESS", "FAILED", "STOPPED"]` | `PipelineRunStatus` is **lowercase** (`success`, `failed`, …). Copying it gives a poll loop that never terminates. This repo's code is correct; the doc is not. |
| Its `allowed_operations` scope table | Accurate, but **wider than the orchestrator uses**. The orchestrator needs exactly four scopes. |
| It never mentions `edit_static_webapp_file`, `get_static_webapp_file`, `get_static_webapp`, `update_static_webapp` | Those four are undocumented-upstream, agent-only conveniences. [`deploy.md`](deploy.md) is their only source of truth. |

## Corrections — notes that used to say the opposite

These were true once. They are not now; the current answer is the one below.

| Topic | Current truth | Changed |
| --- | --- | --- |
| Variant identification | **Names are now consistent** (`- Flowchart` / `- Cockpit`); **flowchart slugs are not** (two forms live). The old "match on slug, names are unreliable" rule is inverted. Rule now in [`orchestrator-app.md`](orchestrator-app.md#telling-variants-apart-on-the-live-platform). | 2026-08-24 |
| `get_static_webapp_file` `start_line`/`end_line` | ✅ **Work.** The tool's schema now declares both as `integer` (was `string`), matching the underlying `readWebappFile` GraphQL field's `Int` type. Verified by reading `app.js` lines 1–15 from the live `snt-pipelines-orchestrator` webapp in `snt-app-dev` — returned exactly that slice with `success: true`, no coercion error. The old "omit both, read the whole file" workaround is unnecessary. | fixed 2026-07-17 |
| `update_static_webapp` `name`/`description` | ✅ **Honored.** A rename is a one-call fix, not a UI-only operation. *(Not re-verified live by this repo — and a rename is outward-facing, so confirm with Giulia first.)* | 2026-08 release |
| `allowed_operations` parameter shape | A **typed JSON list** of enum values, e.g. `["PIPELINES_READ","FILES_READ"]` — **not** a comma-separated string. | 2026-08-24 |
| `get_static_webapp` on binary files | Returns **`content: null`** (only `encoding: BASE64` + path). It no longer dumps base64 blobs, but it also can't back up an image or font. | 2026-08 release |
| Partial deploys | ✅ **Work** — `files_json` may carry only changed files; omitted files survive. The tool description used to say "replace all files," contradicting observed behaviour; it now agrees. | confirmed 2026-06-19 |
| `docs/PLAN.md`, `docs/JIRA_ITEMS.md` | **Retired.** The roadmap lives in `docs/PRODUCT_SPEC.md` Part C; task tracking lives in Jira. | — |
| `workspaces/<ws>/<variant>/` tree | **Deleted.** The catalog moved to the workspace bucket. Do not recreate it — see [`catalog.md`](catalog.md). | 2026-08-04 |

## Roads not taken — considered, rejected, recorded

Options that work but weren't adopted. Listed so a future session knows they exist *and* why they
weren't taken — not as pending suggestions.

- **`workspace.configuration` as the catalog's home.** `Workspace.configuration: JSON!` is a
  workspace-wide JSON dictionary. A pipeline writes it with the SDK (`workspace.configuration = config`)
  or the `updateWorkspace` mutation, and the webapp could read it **with no new scope** (`USER_READ`
  already grants the `workspace` field). The upstream `sdk` doc's own example is conspicuously
  SNT-flavoured (`SNT_PIPELINE_COUNT`), so someone on the OH side may be thinking about this shape.
  ⚠️ **Do not migrate on a whim.** The bucket path is shipped, works, versions each run under
  `historical/`, and handles a 35–60 KB payload comfortably; `configuration` is a single blob with no
  history and no obvious size guarantee.

- **`readFileContent` instead of `prepareObjectDownload` → `fetch(signedUrl)` for the catalog.** Works
  under the `FILES_READ` the app already has. Not switched: the signed-URL path is shipped, works, and
  is also what the report embed needs. Worth revisiting only if signed-URL expiry or CORS becomes a
  problem.

- **The rest of the 2026-08 schema diff.** Data Studio / saved queries with visibility,
  `executeSavedQuery`, self-hosted orgs, `analyticsEnabled` — touches **nothing** this project uses.
  Don't spend a session re-diffing it.

## Known gaps that are not bugs

- **`DATABASE_READ`** — an 8th `WebappOperationScope` added in the 2026-08 release (grants
  workspace-database reads). It is **not** in the MCP tools' `allowed_operations` enum (grant it via
  the OpenHEXA UI or the raw `updateWebapp` mutation) and **not** in the doc's scope table, so which
  fields it unlocks is unverified. The orchestrator does not need it — noted so its absence from the
  MCP enum doesn't read as a bug.
- **`DatabaseTable` run outputs are silently unrendered** — the app has no `... on DatabaseTable`
  fragment. Harmless (unions skip unmatched members), but "no outputs shown" is not proof of "no
  outputs produced".
- **A live `pipeline_cards.json` inside a webapp** is a leftover from before 2026-08-04. Nothing
  fetches it; drop it with `files_to_delete_json`.
- **`window.OPENHEXA.webappSlug` is unread by both variants** (verified 2026-07-31) — each variant
  ships its own `app.js`, so it already knows what it is. It's the seam to use only if one bundle ever
  has to serve both variants.
- **`progress: Int!` on a run is unread** — the seam for a percentage in the run status line.
- **`RunPipelineInput.versionId` / `sendMailNotifications` / `enableDebugLogs` are unset** — all
  long-standing, all available.
