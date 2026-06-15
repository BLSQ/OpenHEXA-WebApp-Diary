# SNT Pipelines Orchestrator — User Persona & Functional-Scope Questionnaire

> **Status:** For PM review · 2026-06-11
> **Companion to:** `PRODUCT_SPEC.md` (this sharpens §3 "Target user" and §5/§9 scope into
> decisions).
>
> **Purpose (two audiences):**
>
> 1. **PM:** pin down a concrete user persona and confirm the functional scope boundaries.
>    Every question is **Yes / No** on purpose — binary forces a decision instead of "it depends."
> 2. **Future build agents:** once answered, this file is **reference context** for whoever
>    (human or agent) builds the app — it records _who we are building for_ and _what is in/out
>    of scope for v1_.

---

## How to fill this in

- **Tick exactly one box per question** (`[x]`). Use `Open` when you genuinely can't decide yet —
  that's a finding, not a failure.
- Each answer is on its **own line** so the checkbox renders in Obsidian, GitHub, and Google Docs.
- Lines marked **⭐** are the cruxes: if these flip, the product changes shape. They have a
  **Notes** line — please add a sentence of _why_.
- Leave the `(expected: …)` hints — they record the spec's current assumption so an agent can
  see where reality diverged from the draft.

**Legend:** Yes / No / Open — Open = undecided / needs devs / needs research.

---

## What we already established (discovery, 2026-06-11)

Confirmed in conversation with the PM-side owner; treat as **given** unless a question below
overrides it:

- **Primary user:** NMP staff (National Malaria Programme).
- **User↔workspace:** one country = a **small team** sharing the workspace (not a single person).
- **Frequency:** bursty around the periodic SNT exercise **plus** ongoing monthly refreshes
  (DHIS2 has monthly periodicity).
- **Skill ceiling:** assume **Excel-level**; some users are DHIS2 power-analysts. Design for the floor.
- **Process literacy:** user **needs guidance throughout** — does not inherently know what to run or in what order.
- **Language:** **English only** for v1.
- **Connections:** **BLSQ holds the credentials** and creates connections during setup.
- **`SNT_config.json`:** **hand-edited today**; a user-friendly config UI is a **long-term vision**, not built yet.
- **Install from template:** **one-click in the OpenHEXA UI** (no Git/CLI needed).
- **Still undecided (flagged ⭐ below):** user autonomy on failure; who owns setup; whether the
  app should detect/report setup gaps.

---

## A. Identity & role

1. Primary user is an **NMP employee** (vs. external consultant/partner). ⭐
   - [ ] Yes
   - [ ] No
   - [ ] Open
   - **Notes:**
2. There is exactly **one designated person per country**. _(expected: No — a small team.)_
   - [ ] Yes
   - [ ] No
   - [ ] Open
3. If a team: **all members** run pipelines (vs. one runs, others view).
   - [ ] Yes (all run)
   - [ ] No (one runs)
   - [ ] Open
4. The user holds an **M&E / surveillance** role specifically. **EDIT THIS**
   - [ ] Yes
   - [ ] No
   - [ ] Open
5. Malaria-program **domain knowledge** (epi, stratification logic) is part of their job.
   - [ ] Yes
   - [ ] No
   - [ ] Open
6. The **same person** stays across the whole annual cycle (no mid-cycle handoff).
   - [ ] Yes
   - [ ] No
   - [ ] Open

## B. Skills & tooling comfort ⭐

7. **Excel** is the high-water mark we must assume. **EDIT THIS**
   - [ ] Yes
   - [ ] No
   - [ ] Open
8. They are **regular DHIS2-suite** users (analytics, pivot, maps).
   - [ ] Yes
   - [ ] No
   - [ ] Open
9. We assume they can read/edit a **JSON config file** unaided. _(expected: No.)_
   - [ ] Yes
   - [ ] No
   - [ ] Open
10. We assume they can read the **Pipeline Runs Messages/Logs** (OH UI) to understand a failure. _(expected: No.)_
    - [ ] Yes
    - [ ] No
    - [ ] Open
11. They are comfortable with the concept of **parameters/arguments**.
    - [ ] Yes
    - [ ] No
    - [ ] Open
12. They know what a **"pipeline" / DAG** is as a concept.
    - [ ] Yes
    - [ ] No
    - [ ] Open
13. **English** is sufficient for the actual NMP users (not just BLSQ). _(expected: Yes for v1.)_
    - [ ] Yes
    - [ ] No
    - [ ] Open
14. Design for the **lowest** skill level (Excel-only), even if power-analysts get a simpler UI than they could handle. ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**

## C. Process knowledge & mental model

15. User already knows **which pipeline to run in what order**. _(expected: No.)_ ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**
16. User already understands **what each pipeline produces**. **WORK ON THIS: basically about how to display README...**
    - [ ] Yes
    - [ ] No
    - [ ] Open
17. User knows the **mandatory / alternative / facultative** distinction without being told.
    - [ ] Yes
    - [ ] No
    - [ ] Open
18. User can judge whether a run **succeeded meaningfully** (beyond a green check).
    - [ ] Yes
    - [ ] No
    - [ ] Open
19. App must **recommend the next step** (vs. only display the map and let them choose). ⭐
    - [ ] Yes (recommend)
    - [ ] No (display only)
    - [ ] Open
    - **Notes:**

## D. Autonomy & support ⭐ (biggest persona fork — currently undecided)

21. User is expected to operate **without a BLSQ contact on call**. ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**
22. On failure, it's acceptable that the user's only recourse is **"contact BLSQ."** ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**
23. App should **explain failures in plain language** (vs. just mirror OpenHEXA's status).
    - [ ] Yes
    - [ ] No
    - [ ] Open
24. A BLSQ technical person is **always reachable** during a country's exercise.
    - [ ] Yes
    - [ ] No
    - [ ] Open
25. It's acceptable that the user **cannot self-recover** from a misconfigured parameter.
    - [ ] Yes
    - [ ] No
    - [ ] Open
26. User needs **in-app guidance/onboarding** (tooltips, "start here").
    - [ ] Yes
    - [ ] No
    - [ ] Open

## E. Setup & access ⭐ (setup owner currently undecided)

27. **BLSQ** performs all technical setup (config, connections, install) before the user starts. ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**
28. If not BLSQ: a **separate, more technical country-side person** does setup.
    - [ ] Yes
    - [ ] No
    - [ ] Open
29. It's acceptable that the running-user **never touches** workspace configuration.
    - [ ] Yes
    - [ ] No
    - [ ] Open
30. The user already has an **OpenHEXA account** with "run" permissions (**"Editor" role**; granted by someone else).
    - [ ] Yes
    - [ ] No
    - [ ] Open
31. The user should **install** (create from template) **missing pipelines** themselves. ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:** _(see I.1 Q51 — note install is one-click)_

## F. Context & environment of use

32. **Desktop/laptop only** (no tablet/phone).
    - [ ] Yes
    - [ ] No
    - [ ] Open
33. User typically has a **stable internet connection**.
    - [ ] Yes
    - [ ] No
    - [ ] Open
34. Usage is **bursty around the periodic SNT exercise**. _(expected: Yes, plus monthly refresh.)_
    - [ ] Yes
    - [ ] No
    - [ ] Open
35. The user returns **monthly** to refresh data (same person as the burst user).
    - [ ] Yes
    - [ ] No
    - [ ] Open
36. User will often **leave and return mid-process** (needs "where did I get to").
    - [ ] Yes
    - [ ] No
    - [ ] Open
37. User works **in the same room/timezone** as the rest of their team.
    - [ ] Yes
    - [ ] No
    - [ ] Open

## G. Goals, motivation & success

38. Primary goal is to **produce the stratification data layers** (not explore/analyze here).
    - [ ] Yes
    - [ ] No
    - [ ] Open
39. **"See at a glance what's done and what's left"** is the single most valuable thing the app gives. ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**
40. User **hands off** outputs to a downstream consumer (SNT Explorer / decision-makers).
    - [ ] Yes
    - [ ] No
    - [ ] Open
41. User is **accountable** for output correctness (vs. just executing on request). **TO THINK ABOUT THIS**
    - [ ] Yes
    - [ ] No
    - [ ] Open
42. App is a success if it only **orchestrates existing pipelines** (no new analysis).
    - [ ] Yes
    - [ ] No
    - [ ] Open

## H. Trust, risk & confidence

43. User is likely **anxious about "breaking something"** by running a pipeline.
    - [ ] Yes
    - [ ] No
    - [ ] Open
44. Runs have **cost/time consequences** the user should be warned about before running.
    - [ ] Yes
    - [ ] No
    - [ ] Open
45. A re-run can **overwrite previous outputs** in a way the user must understand.
    - [ ] Yes
    - [ ] No
    - [ ] Open
46. User needs **confirmation ("are you sure?")** before triggering a run.
    - [ ] Yes
    - [ ] No
    - [ ] Open
47. User will **trust the app's status** over checking OpenHEXA directly, once learned.
    - [ ] Yes
    - [ ] No
    - [ ] Open

---

# I. Functional scope — what stays in the OpenHEXA UI ⭐

> Each confirms: **"Is it acceptable that the app does NOT do this, and the user goes to the
> OpenHEXA UI instead?"** These approve the boundaries `PRODUCT_SPEC.md` §5 only asserts.

## I.1 Pipeline management

48. App **cannot install** a pipeline (user installs with create from template in OH). Acceptable?
    - [ ] Yes
    - [ ] No
    - [ ] Open
49. Since install is **one-click in OH**, the app should **deep-link** to that screen for a missing pipeline (vs. just "ask BLSQ"). ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**
50. App **cannot create / edit / delete / update** pipelines at all. Acceptable?
    - [ ] Yes
    - [ ] No
    - [ ] Open
51. Installing a missing pipeline is **the user's task** (vs. always BLSQ's). ⭐
    - [ ] Yes (user's)
    - [ ] No (BLSQ's)
    - [ ] Open
    - **Notes:** _(tension: "needs guidance throughout" persona vs. one-click install)_

## I.2 Workspace configuration (`SNT_config.json`)

52. App **does not** help build/edit `SNT_config.json` in v1 (still hand-edited). Acceptable?
    - [ ] Yes
    - [ ] No
    - [ ] Open
53. Config is a **pre-condition**, assumed done before the user opens the app (not a step in it).
    - [ ] Yes
    - [ ] No
    - [ ] Open
54. App should **detect config missing/invalid** and say so, even though it won't edit it. ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**
55. The future **config UI** is explicitly **out of scope for this app** (a separate future tool). ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:** _(this is a v1 cut line, NOT a permanent boundary — long-term vision is to build it)_

## I.3 Connections & credentials

56. Since **BLSQ holds credentials**, creating/editing connections is **always** pre-user setup. Acceptable?
    - [ ] Yes
    - [ ] No
    - [ ] Open
57. App **never** touches connections (no create/edit/test); only _uses_ them by slug. Acceptable?
    - [ ] Yes
    - [ ] No
    - [ ] Open
58. App should **warn** when a required connection is absent (a run would fail), though it can't create it. ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**
59. Safe assumption that the running-user **never sees or handles raw credentials**.
    - [ ] Yes
    - [ ] No
    - [ ] Open

## I.4 Setup-gap detection (cross-cutting ⭐ — currently undecided)

60. On load, app should **diagnose readiness** ("connection X missing", "config not set", "pipeline not installed") and link out. ⭐
    - [ ] Yes
    - [ ] No
    - [ ] Open
    - **Notes:**
61. If yes: **link-out + plain-language explanation** is sufficient (no in-app fixing).
    - [ ] Yes
    - [ ] No
    - [ ] Open
62. Acceptable for v1 to **skip all gap-detection** and show setup problems as ordinary pipeline failures.
    - [ ] Yes
    - [ ] No
    - [ ] Open

---

# J. Functional scope — what the app _does_ (confirm the positives for v1)

> `PRODUCT_SPEC.md` lists these; confirm each is in scope for the **first usable version**.

63. **Real last-run status per pipeline** on every load — v1 must-have.
    - [ ] Yes
    - [ ] No
    - [ ] Open
64. **Launching a pipeline with parameters** from the app — v1 must-have.
    - [ ] Yes
    - [ ] No
    - [ ] Open
65. Showing a run's **outputs** (HTML report + dataset links) — v1 must-have (vs. deferrable).
    - [ ] Yes
    - [ ] No
    - [ ] Open
66. **Link to the live OpenHEXA run** (for logs) — v1 must-have.
    - [ ] Yes
    - [ ] No
    - [ ] Open
67. **Link to each pipeline's GitHub README** — v1 must-have.
    - [ ] Yes
    - [ ] No
    - [ ] Open
68. Drawing **dependency arrows** — required in v1 (even if nodes stay clickable).
    - [ ] Yes
    - [ ] No
    - [ ] Open
69. **Dependency locking** (grey-out until upstream succeeds) — explicitly **deferred** past v1. _(spec open-Q2.)_
    - [ ] Yes (deferred)
    - [ ] No (needed in v1)
    - [ ] Open
70. Showing **"missing" pipelines greyed-out** — v1 must-have. _(spec open-Q1.)_
    - [ ] Yes
    - [ ] No
    - [ ] Open
71. Acceptable that status reflects only the **current session's** runs (vs. full persistent history). ⭐
    - [ ] Yes (session-only OK)
    - [ ] No (must persist)
    - [ ] Open
    - **Notes:**

---

## The decisions that most reshape the product

If these flip, rethink the design — push hardest on them:

- **Q21–22** — autonomy on failure (do we need plain-language error help + self-recovery?).
- **Q27 / Q51** — who owns setup, and does "one-click install" pull the user into setup?
- **Q7 / Q9 / Q14** — the true skill floor (Excel-only ⇒ no JSON, no logs).
- **Q15 / Q19** — must the app _guide_ (recommend next step) or merely _display_ the map?
- **Q60** — does the app proactively diagnose setup gaps, or stay silent until a run fails?

## Note on the install-from-template contradiction

Install-from-template being **one-click in OH** quietly contradicts the "BLSQ does all setup /
user needs guidance throughout" persona. If install is genuinely one click, deep-linking the
user there (Q49) may be reasonable even for a non-technical user — so **resolve Q51
deliberately**, don't let it default.
