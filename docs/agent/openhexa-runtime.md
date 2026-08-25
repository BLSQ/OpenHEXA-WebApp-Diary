# OpenHEXA Static Webapp — Runtime Patterns

> **Read this before writing or debugging any webapp code that talks to the OpenHEXA API.**
> These patterns are non-obvious and must not be guessed from the GraphQL schema alone.
> For deploying the resulting bundle, read [`deploy.md`](deploy.md) instead.

A local copy of the OpenHEXA GraphQL schema is at `schemas/schema.generated.graphql`. **Read it at
the start of any session involving static webapps or GraphQL operations.** To refresh it if stale:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql" -OutFile "schemas/schema.generated.graphql"
```

**`mcp__claude_ai_OpenHEXA__get_help_or_doc`** is the upstream documentation. Call it with no topic
for an orientation overview, or `topic="static-webapps"` for the full reference page (other topics:
`cli`, `sdk`, `notebooks-advanced`, `toolbox-dhis2`, `toolbox-hexa`, `toolbox-iaso`,
`writing-pipelines`). The topic list is unchanged as of 2026-08-24.

⚠️ **The upstream `static-webapps` doc has two traps — see
[`settled-questions.md`](settled-questions.md) before copying its examples.** It also does not
mention `edit_static_webapp_file`, `get_static_webapp_file`, `get_static_webapp`, or
`update_static_webapp` at all; those four are undocumented-upstream, agent-only conveniences, and
[`deploy.md`](deploy.md) is their only source of truth.

---

## Platform-injected global

The platform injects this global at page load — the only reliable way to get the workspace slug at
runtime:

```js
window.OPENHEXA = Object.freeze({
  workspaceSlug: "my-workspace",
  webappSlug: "my-webapp",   // this webapp's own slug — e.g. "snt-pipelines-orchestrator" vs
                             // "snt-pipelines-orchestrator-cockpit"
  isPublic: false,           // true for public webapps
});
```

`webappSlug` would let `app.js` detect its own variant at runtime (the slugs differ per variant).
**Neither variant reads it today** (verified 2026-07-31): each variant ships its own `app.js`, so it
already knows what it is. Noted only because it is the seam to use if one bundle ever has to serve
both variants.

## GraphQL proxy

All API calls go to the same-origin relative URL `/graphql/`. No auth token is needed;
authentication is handled via session cookie:

```js
fetch("/graphql/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables }),
});
```

## `allowed_operations` scopes

The proxy enforces a whitelist of permitted GraphQL **top-level fields**. Set via the
`allowed_operations` parameter on `update_static_webapp` / `create_static_webapp` — as of 2026-08-24
that parameter is a **typed JSON list of enum values**, e.g.
`["PIPELINES_READ","PIPELINES_RUN","FILES_READ","USER_READ"]`. Omit it to leave current scopes
untouched; pass an empty list to revoke all API access.

What each scope grants (from the official `static-webapps` doc, 2026-08-24 — wider than the
orchestrator uses):

| Scope             | Top-level fields it unlocks                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `USER_READ`       | `me`, `workspace`                                                                                            |
| `PIPELINES_READ`  | `pipeline`, `pipelines`, `pipelineByCode`, `pipelineRun`, `pipelineVersion`                                   |
| `PIPELINES_RUN`   | `runPipeline`, **`stopPipeline`**                                                                            |
| `FILES_READ`      | `prepareObjectDownload`, **`getFileByPath`**, **`readFileContent`**                                          |
| `FILES_WRITE`     | `prepareObjectUpload`, `createBucketFolder`, `writeFileContent`                                              |
| `DATASETS_READ`   | `dataset`, `datasets`, `datasetVersion`, `datasetLink`                                                        |
| `DATASETS_WRITE`  | `createDataset`, `updateDataset`, `createDatasetVersion`, `updateDatasetVersion`, `createDatasetVersionFile`  |

`__typename`, `__schema` and `__type` are always allowed. If a query fails with a permission error
in the webapp, a scope is missing.

**The orchestrator requires four scopes: `PIPELINES_READ, PIPELINES_RUN, FILES_READ, USER_READ`.**

- ⚠️ **`FILES_READ` is boot-critical** (since 2026-08-04): besides signing report/output downloads,
  it is what lets the app read its own `pipeline_cards.json` out of the workspace bucket. Without it
  the app fails to load entirely, rather than merely losing its download links.
- `USER_READ` is the one most easily forgotten — it powers the `workspace { connections }` query
  behind the **DHIS2-connection dropdown** in the parameter form. Without it the proxy rejects that
  query with `Operations not allowed: workspace` and the form silently falls back to a plain text
  slug input (the dropdown just never appears; nothing else breaks). This bit `snt-testing` (created
  June with only the first three; `USER_READ` added 2026-06-23).

⚠️ **Public webapps cannot call the GraphQL proxy at all** (confirmed in the doc, 2026-08-24). Every
orchestrator webapp must therefore stay **private** — flipping one to public silently kills every
query and the app cannot boot. All six orchestrator webapps are `isPublic: false` (verified live
2026-08-24); `list_static_webapps` returns `isPublic`, so this is cheap to check.

### Three granted capabilities the orchestrator does not yet use

- **`readFileContent(workspaceSlug, filePath, startLine, endLine)`** reads a text file's content
  directly, under the `FILES_READ` the app already has — an alternative to the current
  `prepareObjectDownload` → `fetch(signedUrl)` dance for the catalog. Don't switch on a whim (see
  [`settled-questions.md`](settled-questions.md)); worth knowing if signed-URL expiry or CORS ever
  becomes a problem.
- **`stopPipeline`** would back a Stop/Cancel button on a running node — no new scope needed beyond
  the `PIPELINES_RUN` the app already holds.
- **`getFileByPath`** resolves one bucket object without listing a whole prefix.

### Granting scopes

**Scopes are webapp metadata, not part of the deployed bundle.** They live on the platform's webapp
object, set **once per webapp at create/update time** — not re-sent with every file deploy, and not
derivable from the files. To check the scopes actually granted to a deployed app, read them **live**
with `get_static_webapp` (it returns `allowedOperations`) — that is the source of truth, so drift is
caught by inspecting the live webapp rather than a stored config file.

Three ways to set them:

- **OpenHEXA UI** — the webapp settings page has an **"Allowed operations"** checklist (confirmed
  2026-06-23; Giulia can tick the four by hand, no agent/API needed).
- **MCP** — `update_static_webapp` / `create_static_webapp` with `allowed_operations` passed as a
  **list** of enum values. `DATABASE_READ` is not accepted here — use the UI or raw GraphQL.
- **Raw GraphQL** — the management mutation against the main OH API (`app.openhexa.org/graphql/`,
  authenticated as the user — **not** the webapp's own `/graphql/` proxy, which can't grant its own
  scopes). `createWebapp` takes the same `allowedOperations` on creation:

  ```graphql
  mutation ($input: UpdateWebappInput!) {
    updateWebapp(input: $input) { success errors webapp { id allowedOperations } }
  }
  # variables:
  # { "input": { "id": "<webapp-uuid>",
  #              "allowedOperations": ["PIPELINES_READ","PIPELINES_RUN","FILES_READ","USER_READ"] } }
  ```

  `allowedOperations` is a `[WebappOperationScope!]` enum with **eight** values as of the 2026-08
  release: `PIPELINES_READ`, `PIPELINES_RUN`, `FILES_READ`, `FILES_WRITE`, `DATASETS_READ`,
  `DATASETS_WRITE`, `USER_READ`, and `DATABASE_READ`. This mutation is the only programmatic way to
  grant `DATABASE_READ` (the MCP tools' enum omits it — see
  [`settled-questions.md`](settled-questions.md)).

  ⚠️ A scope-only re-apply has been seen to echo stale scopes on the first call — **re-verify with
  `get_static_webapp` after changing scopes** (a no-files re-apply makes it stick).

---

## Reading last-run status for all pipelines (cross-session status board)

**Confirmed working through the static-webapp proxy under `PIPELINES_READ` alone** (status spike,
verified live in `snt-testing`: a pipeline triggered in the OH UI showed up as `running` on the next
app refresh — the spike webapp `t0-9-status-proxy-spike` is still there, and its local copy is
`archive/snt-testing/status_spike/`). This is the query that powers the read-only status board.

Pipelines are fetched via the **top-level `pipelines(workspaceSlug:…)` query** — note the
`Workspace` type has **no** `pipelines` field, so `workspace { pipelines }` does _not_ parse. Pass
`window.OPENHEXA.workspaceSlug` as the slug. Each `Pipeline` exposes `runs(...)`; ask for the single
most-recent run with `orderBy: EXECUTION_DATE_DESC, perPage: 1`.

```graphql
query ($ws: String!) {
  pipelines(workspaceSlug: $ws, page: 1, perPage: 50) {
    totalItems
    items {
      id
      code
      name
      runs(orderBy: EXECUTION_DATE_DESC, page: 1, perPage: 1) {
        totalItems
        items {
          id
          status
          executionDate
          duration
        }
      }
    }
  }
}
```

A pipeline with no runs returns an empty `runs.items` array (render as greyed / "no runs"). This is
the _list_ status query; to poll a single run you triggered for its outputs, use the
`pipelineRun(id:)` query below.

## Running a pipeline

Pass the pipeline **UUID** (not code/slug) as `id`. Parameters go in `config` as a plain JSON object
with keys matching the pipeline's parameter names exactly:

```graphql
mutation ($input: RunPipelineInput!) {
  runPipeline(input: $input) {
    success
    errors
    run {
      id
      status
    }
  }
}
```

For parameters of type `DHIS2Connection`, pass the **connection slug** (e.g. `"dhis2-nmdr-drc"`),
not the UUID. List available connections with `mcp__claude_ai_OpenHEXA__list_connections`.

`RunPipelineInput` carries three optional fields the orchestrator doesn't currently set (noted
2026-08-24 — all long-standing, just never written down):

- `versionId: UUID` — run a specific pipeline version instead of the current one. Relevant if the
  catalog's recorded `version_name` / `version_number` is ever used to pin runs to the version the
  parameter form was generated from.
- `sendMailNotifications: Boolean` — email the triggering user on completion. Worth considering for
  the long SNT pipelines, where users leave the tab.
- `enableDebugLogs: Boolean` — verbose run logs, useful when linking a user to a failed run.

`stopPipeline(input: {runId})` is also reachable under the app's existing `PIPELINES_RUN` scope.

### ⚠️ `errors` is an enum, not a message

`RunPipelineResult.errors` is **`[PipelineError!]!` — a GraphQL enum**, so it carries codes, never
prose. **Do not string-match it, and never render it raw** (the orchestrator used to show users a
literal `Couldn't start the run: INVALID_CONFIG`). Compare exact values. The full enum
(`schemas/schema.generated.graphql`, `enum PipelineError`):

`CANNOT_UPDATE_NOTEBOOK_PIPELINE`, `DUPLICATE_PIPELINE_VERSION_NAME`, `FILE_NOT_FOUND`,
`INVALID_CONFIG`, `INVALID_TIMEOUT_VALUE`, `INVALID_VERSION_FILES`, `PERMISSION_DENIED`,
`PIPELINE_ALREADY_COMPLETED`, `PIPELINE_ALREADY_STOPPED`, `PIPELINE_CODE_PARSING_ERROR`,
`PIPELINE_DOES_NOT_SUPPORT_PARAMETERS`, `PIPELINE_NOT_FOUND`, `PIPELINE_RUNS_LIMIT_REACHED`,
`PIPELINE_VERSION_NOT_FOUND`, `TABLE_NOT_FOUND`, `WORKSPACE_NOT_FOUND`.

Both variants translate them in **`runErrorInfo(errors)`** → `{text, drift}`
(`app/cockpit/app.js:2587`, `app/flowchart/app.js:2022`), falling through to a generic branch that
still prints the codes so nothing is swallowed. **Four values mean the catalog no longer matches the
installed pipeline** and are flagged `drift: true` — `INVALID_CONFIG`,
`PIPELINE_DOES_NOT_SUPPORT_PARAMETERS`, `PIPELINE_NOT_FOUND`, `PIPELINE_VERSION_NOT_FOUND`. For
those, the caller appends a "refresh the catalogue" line linking to the generator, via
`catalogueRefreshHintHtml` (cockpit) / `catalogRefreshHintHtml` (flowchart), which reuse
`diagnoseMissingCatalog` (see [`catalog.md`](catalog.md)).

Implementation details worth preserving:

- **The hint renders in a second pass.** `runNode` paints the error text immediately, then re-renders
  with the hint appended once the extra `pipelines(...)` query resolves — so the error is never
  delayed by the lookup. This is safe because `setRunStatusLine` no-ops when
  `APP.selectedId !== nodeId`, so a slow lookup can't paint onto a different node.
- ⚠️ **`.sb-runstatus` is `display: flex; flex-wrap: wrap`** — a `<br>` inside it becomes a flex item
  and does **not** break the line. The hint is a `<span class="rs-hint">` with `flex: 0 0 100%`
  (styled in both `app/<variant>/styles.css`). Same trap applies to any future second line there.
- Any new mapping must be added in **both** variants, and cockpit's strings in **both** `I18N.en` and
  `I18N.fr` (keys `runerr.*`, `link.refreshCatalogue`).

## Polling a run for status and outputs

```graphql
query ($id: UUID!) {
  pipelineRun(id: $id) {
    status
    duration
    progress
    outputs {
      __typename
      ... on BucketObject {
        key
        name
      }
      ... on GenericOutput {
        uri
      }
    }
    datasetVersions {
      id
      dataset {
        slug
        name
      }
    }
  }
}
```

`outputs` is a union type — always use `__typename` inline fragments.

⚠️ **Statuses are lowercase.** `PipelineRunStatus` values: `queued`, `running`, `success`, `failed`,
`stopped`, `skipped`, `terminating`. Terminal statuses: `success`, `failed`, `stopped`,
`terminating`. The upstream doc's example compares against `"SUCCESS"` / `"FAILED"` / `"STOPPED"`
and would loop forever.

Two fields worth knowing (both long-standing; confirmed still present 2026-08-24):

- **`PipelineRunOutput` has a third member the app ignores:**
  `BucketObject | DatabaseTable | GenericOutput`. Without a `... on DatabaseTable` fragment a table
  output is fetched but silently unrendered — harmless (unions skip unmatched members), but it means
  "no outputs shown" is not proof of "no outputs produced". Add the fragment if any SNT pipeline
  starts emitting tables.
- **`progress: Int!`** is available on every run and is not currently read — the seam to use if the
  run status line should show a percentage rather than just `running`.

## Getting a signed download URL for a bucket output (e.g. HTML report)

Requires `FILES_READ` scope:

```graphql
mutation ($input: PrepareObjectDownloadInput!) {
  prepareObjectDownload(input: $input) {
    success
    downloadUrl
  }
}
```

Input fields: `workspaceSlug`, `objectKey` (from the BucketObject), `forceAttachment: false`.

**This mutation is not limited to run outputs** — `objectKey` may be _any_ key in the workspace
bucket. That is what lets the app read its own configuration at boot: the orchestrator signs
`utils_pipelines/create_pipeline_cards/pipeline_cards/pipeline_cards.json` and `fetch`es it as JSON
(see [`catalog.md`](catalog.md)). The signed URLs are CORS-open, so `fetch` works cross-origin — not
just `<iframe>`.

## Embedding an HTML report in-app (iframe)

**Confirmed feasible and shipped in the `cockpit` variant** (spike
`archive/snt-app-dev/report-embed/` + the live `report-embed-probe` webapp in `snt-app-dev`;
implemented in `app/cockpit/app.js` → `renderReportEmbeds()`).

A run's HTML report can be shown **inline** rather than only linked out:

- Get a signed URL via `prepareObjectDownload` with **`forceAttachment: false`** (an attachment
  disposition would download instead of render), then mount it as `<iframe src="{signedUrl}">`.
- It works because the **GCS signed URLs send no `X-Frame-Options` / restrictive
  `frame-ancestors`**, so they are frameable from the webapp origin.
- **Signed URLs expire.** Treat a mounted iframe as perishable: re-request a fresh URL rather than
  caching one across a long session (the cockpit tracks whether a frame is currently mounted with a
  fresh URL and re-signs on demand).
- The `flowchart` variant does **not** embed — it still links out to the report.

## Constructing OpenHEXA front-end URLs (dataset / pipeline-run pages)

⚠️ **Do NOT derive the app host from the webapp's hostname.** On the SaaS the static webapp is served
under `*.openhexa.io` (e.g. `snt-pipelines-orchestrator.openhexa.io`) but the main app UI lives at
**`app.openhexa.org`** — a _different domain_ (`.org`, not `.io`). String-munging the webapp hostname
(`"https://app." + hostname.split(".").slice(1).join(".")`) yields `app.openhexa.io`, which is wrong
— that host treats `app` as a webapp slug and returns a 404 "Web app not found" page. Verified live
2026-06-18.

```js
// Hardcode the SaaS front-end base (revisit for self-hosted installs):
var appBase = "https://app.openhexa.org";

// Dataset (version) page — verified live 2026-06-19. The plain
// /workspaces/<ws>/datasets/<slug>/ form 404s; the page needs BOTH the
// `from/<sourceWs>` segment (workspace that owns the dataset) AND a
// `?version=<datasetVersionId>` query param:
var datasetUrl =
  appBase + "/workspaces/" + workspaceSlug + "/datasets/" + datasetSlug +
  "/from/" + sourceWorkspaceSlug + "/?version=" + datasetVersionId;
// e.g. https://app.openhexa.org/workspaces/snt-app-dev/datasets/snt-dhis2-formatted/from/snt-app-dev/?version=<versionId>
// For a run's output datasets, get datasetSlug + sourceWorkspaceSlug + the
// version id from pipelineRun.datasetVersions { id dataset { slug workspace { slug } } }.

// Pipeline-run page (uses the pipeline CODE, not the UUID; note trailing slash):
var runUrl =
  appBase + "/workspaces/" + workspaceSlug + "/pipelines/" + pipelineCode + "/runs/" + runId + "/";
// e.g. https://app.openhexa.org/workspaces/snt-app-dev/pipelines/a-1-dhis2-extract/runs/<runId>/
```

## Multi-card pattern (multiple pipelines on one page)

When a single webapp hosts cards for multiple pipelines:

- Prefix all element IDs with the card key (e.g. `a1_statusBox`, `a2_runBtn`)
- Store per-pipeline config (UUID, `getConfig` fn, `validate` fn) in a `PIPELINE_CONFIG` object keyed
  by prefix
- All shared functions (`gql`, `setStatus`, `showOutputs`, etc.) accept `prefix` as their first
  argument
- Cards run completely independently — triggering one does not affect the other's state

## Local development against a live workspace (`dev.js`) — documented upstream, NOT live yet

⚠️ **Status as of 2026-08-24: documented but not deployed.**
`https://app.openhexa.org/webapps/dev.js` returns a hard **404** (probed directly — not an auth
redirect). So this cannot be used today. It is recorded here because it would remove this project's
single biggest friction — the deploy-to-test loop — and because a future agent finding the upstream
doc should not waste a session concluding it's broken.

What the doc describes: add one script tag to `index.html` and a local page (opened over `file://` or
any local static server) can call the **real** `/graphql/` proxy against a real workspace, under that
webapp's actual scopes.

```html
<script src="https://app.openhexa.org/webapps/dev.js"></script>
<!-- optionally skip the picker: -->
<script src="https://app.openhexa.org/webapps/dev.js"
        data-workspace-slug="snt-app-dev"
        data-webapp-slug="snt-pipelines-orchestrator-cockpit"></script>
```

A **Connect to OpenHEXA** button appears, you pick a private static webapp and approve, the page
reloads with `window.OPENHEXA` populated, and `fetch("/graphql/")` returns real data. The doc states
the tag is **inert once deployed** (it only activates on `file://` and `localhost`), so it is safe to
leave in `index.html`, and that local calls respect the deployed `allowed_operations` exactly.

**Before relying on it:** re-probe the URL. If it 200s, this is worth adopting deliberately — the
whole orchestrator could then be iterated locally against `snt-app-dev`, with deploys reserved for
finished work. Treat adding the tag to both variants' `index.html` as its own reviewed change, not a
drive-by: it puts a third-party script tag in a production bundle.
