# Project Context

## OpenHEXA GraphQL Schema

A local copy of the OpenHEXA GraphQL schema is stored in this directory as `schema.generated.graphql`.

**Always read this file at the start of any session involving OpenHEXA static web apps or GraphQL operations.**

To refresh the schema if it becomes stale:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql" -OutFile "schema.generated.graphql"
```

---

## OpenHEXA Static Webapp Runtime Patterns

These patterns apply to any static webapp deployed on OpenHEXA. They are non-obvious and must not be guessed from the schema alone.

### Platform-injected global

The platform injects this global at page load — the only reliable way to get the workspace slug at runtime:

```js
window.OPENHEXA.workspaceSlug;
```

### GraphQL proxy

All API calls go to the same-origin relative URL `/graphql/`. No auth token is needed; authentication is handled via session cookie:

```js
fetch("/graphql/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables }),
});
```

### `allowed_operations` scopes

The proxy enforces a whitelist of permitted GraphQL operations. Set via `update_static_webapp` MCP tool's `allowed_operations` parameter (comma-separated). Valid values:

`PIPELINES_READ`, `PIPELINES_RUN`, `FILES_READ`, `FILES_WRITE`, `DATASETS_READ`, `DATASETS_WRITE`, `USER_READ`

If a query fails with a permission error in the webapp, a scope is missing. The SNT pipeline webapp requires at minimum `PIPELINES_READ, PIPELINES_RUN, FILES_READ`.

### Running a pipeline

Pass the pipeline **UUID** (not code/slug) as `id`. Parameters go in `config` as a plain JSON object with keys matching the pipeline's parameter names exactly:

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

For parameters of type `DHIS2Connection`, pass the **connection slug** (e.g. `"dhis2-nmdr-drc"`), not the UUID. List available connections with `mcp__claude_ai_OpenHEXA__list_connections`.

### Polling a run for status and outputs

```graphql
query ($id: UUID!) {
  pipelineRun(id: $id) {
    status
    duration
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

`outputs` is a union type — always use `__typename` inline fragments. Terminal statuses: `success`, `failed`, `stopped`, `terminating`.

### Getting a signed download URL for a bucket output (e.g. HTML report)

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

### Constructing the app.openhexa.io dataset URL

```js
var appBase =
  "https://app." + window.location.hostname.split(".").slice(1).join(".");
// e.g. window.location.hostname = "a-2-dhis2-formatting.openhexa.io"
// → appBase = "https://app.openhexa.io"
var datasetUrl =
  appBase + "/workspaces/" + workspaceSlug + "/datasets/" + datasetSlug + "/";
```

### Multi-card pattern (multiple pipelines on one page)

When a single webapp hosts cards for multiple pipelines:

- Prefix all element IDs with the card key (e.g. `a1_statusBox`, `a2_runBtn`)
- Store per-pipeline config (UUID, `getConfig` fn, `validate` fn) in a `PIPELINE_CONFIG` object keyed by prefix
- All shared functions (`gql`, `setStatus`, `showOutputs`, etc.) accept `prefix` as their first argument
- Cards run completely independently — triggering one does not affect the other's state

### MCP deployment

Use `mcp__claude_ai_OpenHEXA__update_static_webapp` with `files_json` as a JSON array of `{path, content}` objects to deploy. The `name` and `description` fields are silently ignored by the server — rename webapps from the OpenHEXA UI instead.

### Pipeline IDs are workspace-specific

Pipeline **UUIDs** and **codes/slugs** both differ across workspaces for the same pipeline. The only stable identifier is the **Python function name** (e.g. `snt_dhis2_extract`) — this is used as the key in both `pipeline_cards_template.json` and `workspace_config.json`. When building a new `workspace_config.json`, find the matching pipeline by searching `list_pipelines` results by display name (e.g. "A.1 DHIS2 Extract") — do not rely on the code/slug matching. Never copy UUIDs from another workspace's config.

---

## SNT Pipeline Definitions

`pipeline_cards_template.json` documents the expected JSON structure with one worked example (A.1). It is a reference only.

`pipeline_cards.json` is the working file used when building `index.html`. It contains the full definitions for every pipeline the user has requested cards for. Build or update it using the instructions below.

`pipelines_a1-a6.json` is an **obsolete** file — ignore it.

### How to build or update `pipeline_cards.json`

The user will specify which pipelines to include. For each one, fetch its source code from GitHub and extract the parameter definitions directly from the `@parameter` decorators.

**GitHub repository:** `https://github.com/BLSQ/snt_development`

**Finding the pipeline source file:** each pipeline lives in a folder at the repo root named after its Python function name (`{pipeline_id}/pipeline.py`). Fetch the raw file via:

```
https://raw.githubusercontent.com/BLSQ/snt_development/main/{pipeline_id}/pipeline.py
```

Example for `snt_dhis2_extract`:
```
https://raw.githubusercontent.com/BLSQ/snt_development/main/snt_dhis2_extract/pipeline.py
```

Do **not** look inside a `pipelines/` folder — it does not contain the correct source files.

**Extracting parameters:** parameters are declared as `@parameter` decorators stacked above the pipeline function. Read them **top to bottom** — that order is the display order in the UI. Each decorator maps to one entry in the `parameters` array:

```python
@parameter(
    "param_key",            # → "key"
    name="Display Label",   # → "label"
    help="Help text",       # → "help"
    type=bool,              # → "type"  (see mapping below)
    default=True,           # → "default"  (omit if None)
    required=False,         # → "required"  (omit if False)
    choices=["a", "b"],     # → "choices"  (omit if absent)
)
```

**Type mapping:**

| Python type in decorator | JSON `type` value |
|---|---|
| `bool` | `"bool"` |
| `int` | `"int"` |
| `str` | `"str"` |
| `DHIS2Connection` | `"DHIS2Connection"` |
| `File` | `"File"` |

**Rules:**
- Omit `default` if its value is `None`.
- Omit `required` if it is `False` — absence means optional.
- If `choices` is a list of tuples `(value, label)`, keep only the value (first element).
- The card `name` (display title) and `description` (subtitle) are **not** in the Python source. Get the display name from `list_pipelines` in OpenHEXA or ask the user. Do not invent them.
- The `id` field is the Python function name — the first argument to `@pipeline(...)`, which is also the folder name in the repo and the key in `workspace_config.json`.

---

## Workspace-Specific Configuration

`workspace_config.json` files store the resolved IDs for a specific OpenHEXA workspace (pipeline UUIDs, webapp ID, connection slugs). There is one file per target workspace. These IDs are looked up via MCP tools and must never be copied from another workspace's config.

### What `index.html` is

`index.html` is the actual webapp file as it was last deployed to OpenHEXA. It contains hardcoded pipeline UUIDs specific to the workspace it was last deployed to (currently `snt-drc-workshop-demo`). It is **not** a generic template — it is a working file that must be built or updated by the agent for each target workspace.

**There is no MCP tool to read or download existing webapp code from OpenHEXA.** The only available tools are for creating or updating webapps. This means:

- The local `index.html` is the sole source of truth the agent can read. Always read it before making any changes.
- If tasked with updating an existing webapp, the user must manually download the current version from OpenHEXA and save it as `index.html` in this directory before the session. If no local `index.html` exists, the agent must build from scratch.
- Never assume the live webapp on OpenHEXA matches the local file — only the user can verify this by checking the deployed URL.

### How to build or update the webapp for a workspace

The agent's job is to produce the correct `index.html` for a given workspace and deploy it. The two source files are:

- **`pipeline_cards_template.json`** — canonical pipeline definitions: which parameters to expose, their types, defaults, and help text. Read this to know what UI to build.
- **`workspace_config.json`** — workspace-specific UUIDs to embed in the JavaScript (`PIPELINE_CONFIG` object). Read this to get the correct `id` values for each pipeline card.

When building or updating `index.html`:

1. Use `pipeline_cards_template.json` to determine the parameters and card layout for each pipeline.
2. Use `workspace_config.json` to fill in the pipeline UUIDs in the `PIPELINE_CONFIG` JS object.
3. Follow the runtime patterns above (prefixed IDs, shared functions, `allowed_operations`, etc.).
4. Deploy via `mcp__claude_ai_OpenHEXA__update_static_webapp` using `webapp.id` from `workspace_config.json`.

### Session start workflow

**At the start of any session involving deployment or pipeline operations, always ask the user which OpenHEXA workspace they want to work on before doing anything else.**

Then:

1. Check whether a `workspace_config.json` already exists for that workspace in this directory.
2. If yes — read it and use the IDs it contains.
3. If no — use `mcp__claude_ai_OpenHEXA__list_workspaces` to find the workspace slug, then `mcp__claude_ai_OpenHEXA__list_pipelines` and `mcp__claude_ai_OpenHEXA__list_static_webapps` to resolve all UUIDs, then write a new `workspace_config.json` before proceeding.

Keys used in `workspace_config.json`:

- `workspace_slug` — used in all MCP tool calls
- `webapp.id` — passed to `update_static_webapp` to deploy
- `pipelines` — keyed by pipeline code (slug), value is the UUID passed to `runPipeline`
- `connections` — keyed by type (e.g. `"dhis2"`), value is the connection slug passed as a `DHIS2Connection` parameter
