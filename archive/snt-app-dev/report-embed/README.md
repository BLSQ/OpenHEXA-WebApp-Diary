# HTML Report Embed Probe

Throwaway diagnostic for **PRODUCT_SPEC §9.1 "Report viewing" / open decision #10** — can a
pipeline run's HTML report be embedded in-app instead of only linked out (F6)?

It reuses the orchestrator's real machinery (`/graphql/` proxy → `prepareObjectDownload`) so the
result reflects exactly how the production app would behave.

## What it tests

Given a real HTML report (a `.html` bucket object from a successful run), it mints a signed
download URL and runs two tests **in the actual webapp browser origin**:

- **Test A — direct `<iframe src>` (Option A):** loads the signed URL into an iframe. Cross-origin
  X-Frame-Options blocking can't be detected reliably from script, so **the real verdict is
  visual** — does the report render in the box, or is it blank/an error page?
- **Test B — cross-origin `fetch()` (Option B):** tries to fetch the signed URL for
  `srcdoc`/Blob injection. A `TypeError` = the storage bucket doesn't allow CORS for this origin →
  Option B unavailable (Option A can still work).

## Deploy (manual)

It's a single self-contained `index.html` (no other files). Deploy it as its own static webapp:

1. In OpenHEXA (`snt-app-dev`), create a new static webapp — e.g. **"Report Embed Probe"**.
2. Grant scopes **`PIPELINES_READ`, `FILES_READ`** (these two are enough).
3. Upload `index.html`.
4. Open the webapp, click **Scan for HTML reports**, pick one, click **Run embed tests**.

_(Alternatively drop `index.html` into any existing webapp that already has those two scopes and
open `…/index.html` — but a dedicated throwaway webapp keeps it clean.)_

## How to read the result

- **Test A box renders the report** → Option A works → embed via `<iframe src={signed URL}>`
  (recommended; lazy-mint on expand because signed URLs expire).
- **Test A blank/error** → framing is blocked (X-Frame-Options / CSP). Fall back to Test B result.
- **Test B "CORS allowed"** → Option B (fetch → `srcdoc`/Blob) is available.
- **Both fail** → keep the link-out (F6) as-is; in-app embed not feasible on current platform.

Report back the two verdict badges + the "Signed URL host" value and whether the report visibly
rendered.
