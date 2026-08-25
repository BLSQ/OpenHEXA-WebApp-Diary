# Deploying an orchestrator webapp

> **Read this before any deploy, or before inspecting a live webapp's files.**
> Runtime/API behaviour lives in [`openhexa-runtime.md`](openhexa-runtime.md); what the bundle
> contains and why lives in [`orchestrator-app.md`](orchestrator-app.md).

## The deploy set

For a given variant, the bundle is **5 files — 4 variant-generic + 1 cross-variant shared — and
nothing workspace-specific at all**:

| Source path                        | Note                                    |
| ---------------------------------- | --------------------------------------- |
| `app/<variant>/index.html`         | variant-generic                         |
| `app/<variant>/styles.css`         | variant-generic                         |
| `app/<variant>/app.js`             | variant-generic (~90 KB)                |
| `app/<variant>/pipeline_map.json`  | variant-generic                         |
| `app/pipeline_descriptions.json`   | shared — same content in every variant  |

**Deployed paths are flat.** `app.js` fetches the two bundled JSON files as same-origin siblings
(`fetch("./pipeline_map.json")`, `./pipeline_descriptions.json`), so the repo's folder nesting is a
**source-tree** convention that is flattened at deploy time.

⚠️ **Never deploy a `pipeline_cards.json`.** It is not a bundle file — it lives in the workspace
bucket and is read at runtime (see [`catalog.md`](catalog.md)). A live `pipeline_cards.json` still
present in a webapp is a **leftover from before 2026-08-04**; nothing fetches it, and it can be
dropped with `files_to_delete_json`.

## Steps

1. **Settle which variant** you're deploying (`flowchart` or `cockpit`) — it determines which
   `app/<variant>/` folder you read from. It does *not* determine which catalog: there is one
   bucket-hosted catalog per workspace, shared by both variants.
2. **Resolve the target webapp's `id`/`slug` live** via `list_static_webapps`. There is no
   `workspace_config.json`, and nothing about webapp identity is stored in the repo. ⚠️ Two flowchart
   slugs are live — identify the variant by the rule in
   [`orchestrator-app.md`](orchestrator-app.md#telling-variants-apart-on-the-live-platform), not by
   slug equality.
3. **Diff before you overwrite.** Pull the live files and compare against the repo — this catches
   drift (e.g. edits made directly in the OpenHEXA UI). Use `get_static_webapp_file` for one file,
   `get_static_webapp` for a full audit.
4. **Deploy** — pick the tool by size of change (see _Choosing a tool_ below).
5. **Verify** by reading the changed file(s) back and diffing against the repo.
6. **Confirm the workspace has a catalog before calling the deploy done.** The bundle alone is not a
   working app:
   `list_files(workspace_slug, prefix="utils_pipelines/create_pipeline_cards/pipeline_cards/")`. If
   it is missing, the app will hard-error at boot — the fix is to install and run
   `create_pipeline_cards` in that workspace, **not** to add a file to the bundle.
7. **Nothing to sync back.** The repo has no per-workspace files to update after a deploy.

**Scopes are set separately, once per webapp** — they are not part of the bundle. Minimum
`PIPELINES_READ, PIPELINES_RUN, FILES_READ`; the orchestrator needs `USER_READ` too. See
[`openhexa-runtime.md`](openhexa-runtime.md#allowed_operations-scopes) for what each grants and the
three ways to set them.

**Standing up a new workspace** is therefore: (1) create the webapp **with the four scopes**,
(2) deploy the 5-file bundle, (3) install and run `create_pipeline_cards` there so the catalog
exists in its bucket. ⚠️ Deploy **Cockpit first** if you are deploying both — the generator curates
against the Cockpit map (see [`catalog.md`](catalog.md)).

---

## Choosing a tool

All four are MCP tools under the `mcp__claude_ai_OpenHEXA__` prefix — written unprefixed below for
readability, but the callable names are `mcp__claude_ai_OpenHEXA__edit_static_webapp_file`,
`mcp__claude_ai_OpenHEXA__update_static_webapp`,
`mcp__claude_ai_OpenHEXA__get_static_webapp_file(workspace_slug, webapp_slug, path)`, and
`mcp__claude_ai_OpenHEXA__get_static_webapp(workspace_slug, webapp_slug)`.

### `edit_static_webapp_file` — preferred for small, targeted edits

Added 2026-07-07. For a few lines in `app.js`, a CSS tweak, one card's parameters. Takes the webapp
`id` (from `list_static_webapps`), a `path`, and an `old_string`/`new_string` pair — the same
find/replace contract as the Edit tool. The backend reads the current file, applies the replacement,
and commits; **the agent never has to load the full file into context.**

`old_string` must match exactly (including whitespace) and, unless `replace_all: true`, must be
unique in the file — include enough surrounding context. Text files only (not images/binaries).

### `update_static_webapp` — for new files, wholesale rewrites, and first deploys

Takes `files_json` as a JSON array of `{path, content}` objects.

- ✅ **Partial / incremental deploys work** (confirmed live 2026-06-19; the tool's own description
  now says so too). `files_json` may contain **only the files that changed** — omitted files are left
  untouched, _not_ deleted. Verified by deploying `app.js` alone and reading back with
  `get_static_webapp`: all other files survived intact. Caveats: confirmed on the SaaS only; **always
  re-verify after a partial deploy**; keep the full bundle reproducible from the repo so a full
  re-deploy is always possible.
- ✅ **`name`/`description` now work** (changed in the 2026-08 release). A rename is a one-call fix.
  ⚠️ Not re-verified live by this repo, and a webapp rename is outward-facing — **confirm with Giulia
  before renaming anything**, and re-read with `list_static_webapps` afterwards. `create_static_webapp`
  honors `name` too (it always did).
- **`files_to_delete_json`** (confirmed live 2026-07-17) is a JSON array of paths to remove (e.g.
  `["old.js", "legacy/style.css"]`); paths that don't exist are ignored. Can be combined with
  `files_json` in the same call — both are applied as one commit.

### Reading the live files back

- **`get_static_webapp_file(workspace_slug, webapp_slug, path)`** (added 2026-07-07) — reads **one**
  file; supports `start_line`/`end_line`. **Preferred for verifying a single-file edit** — cheap, no
  Read-cap risk. ✅ `start_line`/`end_line` work (fixed 2026-07-17; both are `integer` in the schema
  now — an older note here said they were broken, which is stale).
- **`get_static_webapp(workspace_slug, webapp_slug)`** — reads **every** file plus metadata
  (`allowedOperations`, `permissions`, each file's `content` + `encoding`: `TEXT`/`BASE64`). Use for a
  **full drift audit** or when you need the file list first.

  ⚠️ Two things to weigh first. (1) Since the 2026-08 release, **binary files return `content: null`**
  (only `encoding: BASE64` and the path) — it no longer dumps base64 blobs, but it also means it
  cannot back up an image or font. (2) It returns every **text** file inline, and each `app.js` is
  ~90 KB — so on an orchestrator webapp this is an expensive call. If you only need one file, or only
  the scopes, reach for `get_static_webapp_file` or `list_static_webapps` instead.

Use the **slug** (from `list_static_webapps`), not the UUID, for both read tools. `update_static_webapp`
takes the **`id`**.

**The live app is an inspectable source of truth, not a black box** — diff it against the repo
before editing.

---

## Large-file friction (the Read cap) — mostly avoided now

`update_static_webapp`'s `files_json` carries file _contents inline_ — the tool can't read from a
path on disk, so authoring the call means pulling the bytes into context with Read, which caps at
~25k tokens. The orchestrator's `app.js` is now **~90 KB** (flowchart) / **~88 KB** (cockpit) and
still growing — well past that cap, so a single Read **truncates** it, and JSON-escaping
(`ConvertTo-Json`) only inflates it further.

`edit_static_webapp_file` sidesteps this entirely for targeted edits — no full-file Read, no
JSON-escaping, no chunking. **Everything below is a fallback**, needed only when a file must be
wholesale-rewritten (not just patched) and is too large for a single Read.

### Fallback 1 (preferred): manual UI upload

Offer the user the option to drag the changed file(s) from `app/<variant>/` or
`app/pipeline_descriptions.json` (the canonical local copies) straight into the OpenHEXA UI — no
agent Read, no token cost, no size limit. Per the repo's agent guardrails, **offer this for any
wholesale rewrite or full bundle upload**, phrased as:

> *"You can also drag the changed file(s) from `app/<variant>/` (or `app/pipeline_descriptions.json`)
> straight into the OpenHEXA webapp settings — no size limit and no agent token cost. Want to do that
> instead, or shall I deploy via the API?"*

### Fallback 2: chunked read through the API

Confirmed 2026-06-22. Write the escaped string to a temp file, then read it back in slices with the
Bash tool (`cut -c1-20000 file`, `-c20001-40000 file`, …) and concatenate the slices **exactly** into
the `content` value — ideally inside a **subagent** so the large payload stays out of the main
context. Smaller files (`styles.css`, the JSON data files) still read in one go.

**Always verify after a chunked deploy**: re-read live via `get_static_webapp_file` and diff against
the local copy (e.g. a quick `node -e` length/equality check) — a single dropped/altered char between
slices would break the file.

⚠️ **There is no command-line deploy path.** The OpenHEXA CLI deploys pipelines only, and the SDK's
webapp surface is read-only — see [`settled-questions.md`](settled-questions.md). MCP and the
OpenHEXA UI are the only two ways to deploy a bundle.

---

## Assembling `files_json` on Windows (PowerShell 5.1)

Splitting an app into html+css+js just means a longer `files_json` array — OpenHEXA serves the bundle
as documented (relative `<link>`/`<script>` resolve same-origin; only `index.html` is HTML-injected).
The friction is building the JSON on Windows, not the deploy:

- **Read as UTF-8 explicitly** — `Get-Content -Raw` defaults to ANSI and mangles non-ASCII (`—`,
  emoji `📄🗂`, glyphs `✓✕⦸`) into mojibake. Use `Get-Content -Raw -Encoding UTF8`.
- **Cast content to `[string]` before `ConvertTo-Json`** — otherwise the property serializes as
  `{value, Count}` and balloons (~50×: a 20 KB bundle became 1.17 MB).
- **Pass the array via `-InputObject`, do NOT pipe it** (confirmed 2026-06-22) — `$arr | ConvertTo-Json`
  (even with the `,$arr` array-preserve comma) re-wraps each element as a `{value, Count}` object
  instead of emitting a plain array of `{path, content}`. Use `ConvertTo-Json -InputObject $arr` so you
  get a real top-level JSON array. Sanity-check the output starts with `[`.
- **`ConvertTo-Json` emits `<` `>` `&` `'` as escaped unicode sequences (`\uXXXX`), not literal
  characters** — valid JSON, OpenHEXA parses and serves it fine. Don't "fix" it. (Bonus: if you also
  escape any remaining non-ASCII to `\uXXXX`, the payload is pure ASCII, which makes byte-slicing it
  for read-back split-safe — see Fallback 2 above.)

Recipe (build the array, then serialize with `-InputObject` — not a pipe):

```powershell
$arr = @($files | % { [PSCustomObject]@{ path = $_; content = [string](Get-Content -Raw -Encoding UTF8 $_) } })
ConvertTo-Json -InputObject $arr -Depth 5 -Compress | Out-File -Encoding utf8 "$env:TEMP/snt_files_json.json"
```
