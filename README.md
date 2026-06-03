# SNT Pipeline Webapps

This repository contains everything needed to build and deploy **OpenHEXA static webapps** that let users trigger SNT pipeline runs from a browser — no code required.

Each webapp is a single `index.html` file served by OpenHEXA. It calls the OpenHEXA GraphQL API via a same-origin proxy to start pipeline runs and poll their status.

---

## Repository structure

```
/
├── CLAUDE.md                        # Agent instructions (read by Claude Code at session start)
├── README.md
├── .gitignore
├── schema.generated.graphql         # OpenHEXA GraphQL schema — used by agents for query reference
├── pipeline_cards_schema.json       # Schema/instructions for generating pipeline_cards.json files
│
├── snt_drc_workshop_demo/           # One folder per workspace
│   ├── workspace_config.json        #   Resolved IDs (pipeline UUIDs, webapp ID, connection slugs)
│   ├── pipeline_cards.json          #   Cached pipeline catalog (names, UUIDs, parameters)
│   └── index.html                   #   Last-deployed webapp for this workspace
│
└── snt_testing/
    ├── workspace_config.json
    ├── pipeline_cards.json
    └── index.html
```

**Global files** (root) apply to all workspaces. **Workspace folders** contain workspace-specific artifacts. Adding a new workspace means creating a new folder — nothing else changes.

---

## How it works

```
pipeline_cards_schema.json        ← schema + instructions for building pipeline catalogs (global)
        ↓ (generated once per workspace)
<workspace>/pipeline_cards.json   ← cached pipeline catalog: names, UUIDs, parameters
        +
<workspace>/workspace_config.json ← webapp ID, connection slugs (workspace-specific)
        ↓
<workspace>/index.html            ← deployed to OpenHEXA, saved here after every deploy
```

---

## Using with an AI agent (Claude Code)

Open this directory in Claude Code. The agent will automatically read `CLAUDE.md` for full instructions. Then just describe what you want:

- **Deploy to an existing workspace:** "Update the webapp in workspace X to add pipeline Y"
- **Set up a new workspace:** "Create the webapp for workspace Z" — the agent will look up all UUIDs via the OpenHEXA MCP tools and create a new `<workspace>/` folder
- **Add a new pipeline card:** "Add a card for `snt_dhis2_incidence`" — the agent fetches the pipeline source from GitHub, extracts parameters, updates `pipeline_cards_template.json`, and redeploys

The agent needs access to the **OpenHEXA MCP server** (configured in Claude Code settings) to look up workspace/pipeline IDs and deploy webapps.

---

## Adding a new workspace

1. Open Claude Code in this directory
2. Say: _"Create the webapp for workspace `<workspace name>`"_
3. The agent will:
   - Find the workspace slug via `list_workspaces`
   - Resolve pipeline UUIDs via `list_pipelines`
   - Create `<workspace>/workspace_config.json`
   - Build and deploy `<workspace>/index.html`
4. Commit the new workspace folder

---

## Adding a new pipeline card

1. Make sure `pipeline_cards_template.json` has an entry for the pipeline (if not, tell the agent — it will fetch parameters from the [snt_development GitHub repo](https://github.com/BLSQ/snt_development))
2. Tell the agent which workspace to deploy to and which pipelines to include
3. The agent rebuilds and redeploys `<workspace>/index.html`

---

## Refreshing the OpenHEXA schema

If the schema becomes stale, regenerate it with:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/BLSQ/openhexa-app/main/frontend/schema.generated.graphql" -OutFile "schema.generated.graphql"
```

---

## Deployed webapps

| Workspace | Webapp URL | Folder |
|---|---|---|
| SNT DRC Workshop Demo | https://a-2-dhis2-formatting.openhexa.io/ | `snt_drc_workshop_demo/` |
| SNT Testing | https://dhis2-reporting-rate.openhexa.io/ | `snt_testing/` |
