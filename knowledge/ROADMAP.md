# SNT Orchestrator — Visual Roadmap

> Companion to [PLAN.md](PLAN.md). Same tasks, drawn as flowcharts.
> The diagrams below are [Mermaid](https://mermaid.js.org/) — they render automatically in
> GitHub and in most IDE markdown previewers (VS Code: open this file and press `Ctrl+Shift+V`).
> Edit the code blocks to keep them in sync with PLAN.md.

## Owner legend

| Colour | Owner | |
| --- | --- | --- |
| 🟡 Amber | 🧑 **You** (Giulia) | OpenHEXA actions, map content, reviews |
| 🔵 Blue | 🤖 **Agent** (Claude Code) | Code & JSON, deploy, mirror files |
| ⚪ Grey | 👔 **PM** | UI design input, map validation |
| 🔴 Red | 🛠️ **OH devs** | Platform / MCP / proxy questions |

---

## 1. High-level: phases & the three parallel tracks

Phase 0 splits into three tracks that run **at the same time** and converge on Phase 1.

```mermaid
flowchart TD
    classDef phase fill:#eef2f5,stroke:#005a9c,color:#222,font-weight:bold;

    subgraph P0[Phase 0 · Foundations & de-risking — start all three today]
        direction LR
        TA["Track A · Workspace<br/>🧑 create SNT App Dev,<br/>install + run all pipelines"]
        TB["Track B · The map<br/>🧑👔 consolidate layout →<br/>🤖 pipeline_map.json"]
        TC["Track C · Status spike<br/>🤖🧑 prove runs query<br/>through the proxy"]
    end

    P0 --> P1["Phase 1 · Read-only status board<br/>(first shippable webapp)"]
    P1 --> P2["Phase 2 · Make it runnable"]
    P2 --> P3["Phase 3 · Locking + polish"]
    P3 --> P4["Phase 4 · Generalize across workspaces"]

    class P1,P2,P3,P4 phase;
```

---

## 2. Detailed: atomic tasks & dependencies

Each box is one atomic task from PLAN.md. Arrows mean **"must finish before."** Colour = owner.

```mermaid
flowchart TD
    classDef you fill:#ffeeba,stroke:#856404,color:#222;
    classDef agent fill:#b8daff,stroke:#004085,color:#222;
    classDef pm fill:#d6d8db,stroke:#383d41,color:#222;
    classDef oh fill:#f5c6cb,stroke:#721c24,color:#222;

    subgraph P0[Phase 0 · Foundations & de-risking]
        T00["T0.0 🧑👔🛠️ Validate product spec"]
        subgraph TA[Track A · Workspace]
            T01["T0.1 🧑 Create SNT App Dev ws"]
            T02["T0.2 🧑 Install ~20 pipelines"]
            T03["T0.3 🧑 Connections + config + data"]
            T04["T0.4 🧑 Run each pipeline once"]
            T05["T0.5 🤖 Gen config + cards"]
        end
        subgraph TB[Track B · The map]
            T06["T0.6 🧑👔 Consolidate map content"]
            T07["T0.7 🤖 Build pipeline_map.json"]
            T08["T0.8 🧑👔 Review rendered layout"]
        end
        subgraph TC[Track C · Status spike]
            T09["T0.9 🤖🧑 Spike: runs query via proxy"]
            T010["T0.10 🛠️ If blocked: ticket to OH devs"]
        end
    end

    subgraph P1[Phase 1 · Read-only status board]
        T11["T1.1 🤖 Scaffold app bundle"]
        T12["T1.2 🤖 Render grid"]
        T13["T1.3 🤖 Draw SVG arrows"]
        T14["T1.4 🤖 Available vs greyed"]
        T15["T1.5 🤖 Live status layer"]
        T16["T1.6 🤖 Read-only sidebar"]
        T17["T1.7 🤖🧑 Deploy + QA"]
        T18["T1.8 👔🧑 UI review round"]
    end

    subgraph P2[Phase 2 · Make it runnable]
        T21["T2.1 🧑🤖 Confirm params not stale"]
        T22["T2.2 🤖 Param form + config builder"]
        T23["T2.3 🤖 Run + poll"]
        T24["T2.4 🤖 Mutual exclusion"]
        T25["T2.5 🤖 Missing-pipeline message"]
        T26["T2.6 🤖🧑 Deploy + QA running"]
    end

    subgraph P3[Phase 3 · Locking + polish]
        T31["T3.1 🤖 Upstream locking"]
        T32["T3.2 🤖 States & errors"]
        T33["T3.3 🤖👔 Aesthetics pass"]
    end

    subgraph P4[Phase 4 · Generalize]
        T41["T4.1 🤖 Verify generic separation"]
        T42["T4.2 🤖🧑 Deploy 2nd workspace"]
        T43["T4.3 🤖🧑 Document runbook"]
    end

    T01 --> T02
    T01 --> T03
    T02 --> T04
    T03 --> T04
    T02 --> T05
    T06 --> T07
    T07 --> T08
    T12 --> T08
    T13 --> T08
    T01 --> T09
    T09 --> T010
    T00 --> T11
    T05 --> T11
    T07 --> T11
    T11 --> T12
    T12 --> T13
    T12 --> T14
    T11 --> T15
    T09 --> T15
    T14 --> T16
    T15 --> T17
    T16 --> T17
    T17 --> T18
    T05 --> T21
    T16 --> T22
    T21 --> T22
    T22 --> T23
    T23 --> T24
    T14 --> T25
    T23 --> T26
    T23 --> T31
    T17 --> T32
    T18 --> T33
    T26 --> T41
    T41 --> T42
    T42 --> T43

    class T00,T01,T02,T03,T04,T06 you;
    class T05,T07,T09,T11,T12,T13,T14,T15,T16,T17,T21,T22,T23,T24,T25,T26,T31,T32,T33,T41,T42,T43 agent;
    class T08,T18 pm;
    class T010 oh;
```

---

## Reading the dependency map

- **The critical path to a shippable Phase 1** runs: `T0.6 → T0.7 → T1.1 → T1.2 → … → T1.7`.
  The map (Track B) is the long pole — start it now.
- **T0.9 (the spike) has only one prerequisite** (a workspace with some runs), so it can go
  first, in parallel, using the existing `snt_testing` workspace.
- **T0.8 reaches back** into Phase 0 from `T1.2`/`T1.3`: you can only eyeball the rendered
  layout once the grid + arrows exist.
