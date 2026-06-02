# SNT Pipeline Webapps

This repository contains everything needed to build and deploy **OpenHEXA static webapps** that let users trigger SNT pipeline runs from a browser — no code required.

Each webapp is a single `index.html` file served by OpenHEXA. It calls the OpenHEXA GraphQL API via a same-origin proxy to start pipeline runs and poll their status.

---

## Repository contents

| File | Purpose |
|---|---|
| `CLAUDE.md` | Instructions for AI agents working on this repo. Read by Claude Code at session start. |
| `pipeline_cards_template.json` | Canonical pipeline definitions: parameter keys, types, labels, help text, defaults. Source of truth for what to build. |
| `workspace_config_<name>.json` | Workspace-specific resolved IDs (pipeline UUIDs, webapp ID, connection slugs). One file per OpenHEXA workspace. |
| `index.html` | The last-deployed webapp HTML. Workspace-specific (hardcoded UUIDs). |
| `schema.generated.graphql` | Local copy of the OpenHEXA GraphQL schema. Used by AI agents for query/mutation reference. |

---

## How it works

```
pipeline_cards_template.json   ← what parameters to show
        +
workspace_config_<name>.json   ← which pipeline UUIDs to call
        ↓
      index.html               ← deployed to OpenHEXA
```

The template defines the UI for each pipeline (parameters, types, validation). The workspace config provides the correct UUIDs for a specific OpenHEXA instance. The agent combines them to produce `index.html` and deploys it.

---

## Using with an AI agent (Claude Code)

Open this directory in Claude Code. The agent will automatically read `CLAUDE.md` for full instructions. Then just describe what you want:

- **Deploy to an existing workspace:** "Update the webapp in workspace X to add pipeline Y"
- **Set up a new workspace:** "Create the webapp for workspace Z" — the agent will look up all UUIDs via the OpenHEXA MCP tools and write a new `workspace_config_<name>.json`
- **Add a new pipeline card:** "Add a card for `snt_dhis2_incidence`" — the agent will fetch the pipeline source from GitHub, extract parameters, update `pipeline_cards_template.json`, and redeploy

The agent needs access to the **OpenHEXA MCP server** (configured in Claude Code settings) to look up workspace/pipeline IDs and deploy webapps.

---

## Adding a new workspace

1. Open Claude Code in this directory
2. Say: _"Create the webapp for workspace `<workspace name>`"_
3. The agent will:
   - Find the workspace slug via `list_workspaces`
   - Resolve pipeline UUIDs via `list_pipelines`
   - Write a new `workspace_config_<name>.json`
   - Build and deploy `index.html`
4. Commit the new `workspace_config_<name>.json` and the updated `index.html`

---

## Adding a new pipeline card

1. Make sure `pipeline_cards_template.json` has an entry for the pipeline (if not, tell the agent to add it — it will fetch parameters from the [snt_development GitHub repo](https://github.com/BLSQ/snt_development))
2. Tell the agent which workspace to deploy to and which pipelines to include
3. The agent rebuilds `index.html` and deploys

---

## Refreshing the OpenHEXA schema

If the schema becomes stale, regenerate it with:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql" -OutFile "schema.generated.graphql"
```

---

## Deployed webapps

| Workspace | Webapp URL | Config file |
|---|---|---|
| SNT DRC Workshop Demo | https://a-2-dhis2-formatting.openhexa.io/ | `workspace_config.json` |
| SNT Testing | https://dhis2-reporting-rate.openhexa.io/ | `workspace_config_snt_testing.json` |
