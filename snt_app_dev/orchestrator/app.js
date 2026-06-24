/* SNT Pipelines Orchestrator — app logic.
 *
 * T1.1 (scaffold): wake up, fetch the two data files, merge them into a single
 * node list, and log that list to the dev console. Nothing is drawn yet — this
 * task only proves the data plumbing is sound before later tasks build the grid
 * (T1.2), arrows (T1.3), greying (T1.4), and status (T1.5) on top of it.
 *
 *   - pipeline_map.json   : the shared, workspace-independent map (all ~18 nodes,
 *                           their row/col, type, group, and edges).
 *   - pipeline_cards.json : this workspace's catalog — which pipelines actually
 *                           exist here, with their UUID and parameters.
 *
 * The stable join key everywhere is the node `id` == the pipeline's Python
 * function name (e.g. "snt_dhis2_extract").
 */

/* ------------------------------------------------------------------ *
 * GraphQL helper — kept from the proven split app for later phases
 * (running / polling pipelines, T2.x). Unused at T1.1 but lives here so
 * the runtime patterns stay in one place.
 * ------------------------------------------------------------------ */
async function gql(query, variables) {
  var res = await fetch("/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: query, variables: variables || {} }),
  });
  var json = await res.json();
  if (json.errors)
    throw new Error(
      json.errors
        .map(function (e) {
          return e.message;
        })
        .join("; "),
    );
  return json.data;
}

/* The cross-session status query — the one the T0.6 spike confirmed works
 * through the static-webapp proxy under PIPELINES_READ alone. The top-level
 * pipelines(workspaceSlug:…) query (the Workspace type has no `pipelines`
 * field) returns each pipeline with its single most-recent run. We ask for
 * `code` too, to build the run's OpenHEXA-UI link. */
var STATUS_QUERY =
  "query ($ws: String!) {" +
  "  pipelines(workspaceSlug: $ws, page: 1, perPage: 100) {" +
  "    items {" +
  "      id" +
  "      code" +
  "      runs(orderBy: EXECUTION_DATE_DESC, page: 1, perPage: 1) {" +
  "        items { id status executionDate duration }" +
  "      }" +
  "    }" +
  "  }" +
  "}";

/* The workspace's connections — used by T2.2 to populate the dropdown for
 * DHIS2Connection / CustomConnection parameters with real slugs instead of
 * asking the user to type a cryptic code. `type` is a ConnectionType enum
 * (DHIS2, CUSTOM, GCS, IASO, POSTGRESQL, S3). Reading connections needs the
 * USER_READ scope in allowed_operations (added at deploy time, T2.6); if it's
 * missing or the app is opened outside OpenHEXA, the form falls back to a plain
 * text slug input. */
var CONNECTIONS_QUERY =
  "query ($ws: String!) {" +
  "  workspace(slug: $ws) {" +
  "    connections { id name slug type }" +
  "  }" +
  "}";

/* ------------------------------------------------------------------ *
 * Data loading + merge
 * ------------------------------------------------------------------ */

// Fetch both data files (same-origin, served alongside the app) in parallel.
async function loadData() {
  var responses = await Promise.all([
    fetch("./pipeline_map.json"),
    fetch("./pipeline_cards.json"),
  ]);
  for (var i = 0; i < responses.length; i++) {
    if (!responses[i].ok) {
      throw new Error(
        "Failed to load " +
          responses[i].url +
          " (HTTP " +
          responses[i].status +
          ")",
      );
    }
  }
  var map = await responses[0].json();
  var cards = await responses[1].json();
  return { map: map, cards: cards };
}

/* Merge the map with the workspace's cards into one list of nodes.
 *
 * Every node from the (workspace-independent) map is kept — the map is
 * identical across all workspaces. What differs per workspace is only which
 * nodes are *available*: a node is available iff its `id` matches a pipeline in
 * this workspace's cards (with a `uuid`). Otherwise it is *greyed* — rendered
 * disabled in later tasks. */
function mergeNodes(map, cards) {
  var cardsById = {};
  var pipelines = (cards && cards.pipelines) || [];
  for (var i = 0; i < pipelines.length; i++) {
    cardsById[pipelines[i].id] = pipelines[i];
  }

  var nodes = (map && map.nodes) || [];
  return nodes.map(function (node) {
    var card = cardsById[node.id] || null;
    var available = !!(card && card.uuid);
    return {
      id: node.id,
      code: node.code,
      label: node.label,
      description: node.description,
      type: node.type,
      group: node.group || null,
      row: node.row,
      col: node.col,
      track: node.track,
      // workspace-specific bits (null when greyed)
      uuid: card ? card.uuid : null,
      parameters: card ? card.parameters || [] : [],
      available: available,
    };
  });
}

/* Log the merged node list to the dev console (the T1.1 "engine sound").
 * Reading this list confirms: the map loaded, the cards loaded, and the two
 * were correctly matched on `id` (each node tagged available or greyed). */
function logMergedNodes(nodes, map, cards) {
  var availableCount = nodes.filter(function (n) {
    return n.available;
  }).length;

  console.log(
    "%cSNT Orchestrator — merged node list",
    "font-weight:bold;font-size:1.05em;",
  );
  console.log(
    "Map version: " +
      (map.version || "?") +
      "  |  Cards workspace: " +
      (cards.workspace_slug || "?") +
      " (generated " +
      (cards.generated_at || "?") +
      ")",
  );
  console.log(
    nodes.length +
      " nodes total — " +
      availableCount +
      " available, " +
      (nodes.length - availableCount) +
      " greyed:",
  );

  nodes.forEach(function (n) {
    console.log(
      "  " +
        (n.available ? "● available" : "○ greyed  ") +
        "  " +
        n.id +
        "  (" +
        n.label +
        ")",
    );
  });

  // A compact table view too, for quick scanning in the console.
  if (console.table) {
    console.table(
      nodes.map(function (n) {
        return {
          id: n.id,
          code: n.code,
          state: n.available ? "available" : "greyed",
          type: n.type,
          row: n.row,
          col: n.col,
        };
      }),
    );
  }
}

/* ------------------------------------------------------------------ *
 * T1.2 — Render the grid
 *
 * Place each node at its row/col on the canvas. Positions are absolute and
 * computed from row/col (not a CSS grid), so fractional columns — the two A.4
 * reporting-rate nodes use col 1.5 / 2.5 — land exactly between their integer
 * neighbours. The coordinate helpers are stashed on APP.layout so T1.3 can
 * reuse the same geometry to attach SVG arrows to node centres/borders.
 *
 * Scope is just placement: no arrows (T1.3), no greying (T1.4), no status
 * (T1.5), no click handling (T1.6) yet.
 * ------------------------------------------------------------------ */

// Card + grid geometry, in px. Mirrors knowledge/pipeline_map_preview.html so
// the deployed app matches the reviewed layout.
var LAYOUT = {
  NODE_W: 142,
  NODE_H: 64,
  COL_W: 162,
  ROW_H: 158,
  PAD_X: 30,
  PAD_Y: 30,
};

// SVG namespace — elements in the edge layer (T1.3) must be created with
// createElementNS, not createElement, or the browser won't render them.
var SVGNS = "http://www.w3.org/2000/svg";

// Only mandatory/output nodes carry a visible type label (top-right corner);
// alternative/facultative are left unlabelled, per the map conventions.
var FILLED_TYPES = { mandatory: true, output: true };

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Build the coordinate helpers + overall canvas size for a set of nodes.
 * nx/ny = top-left of a node's card; ncx/ncy = its centre. */
function makeLayout(nodes) {
  var L = LAYOUT;
  var nx = function (n) {
    return L.PAD_X + n.col * L.COL_W;
  };
  var ny = function (n) {
    return L.PAD_Y + n.row * L.ROW_H;
  };
  var maxCol = 0;
  var maxRow = 0;
  nodes.forEach(function (n) {
    if (n.col > maxCol) maxCol = n.col;
    if (n.row > maxRow) maxRow = n.row;
  });
  return {
    nx: nx,
    ny: ny,
    ncx: function (n) {
      return nx(n) + L.NODE_W / 2;
    },
    ncy: function (n) {
      return ny(n) + L.NODE_H / 2;
    },
    width: L.PAD_X * 2 + (maxCol + 1) * L.COL_W,
    height: L.PAD_Y * 2 + (maxRow + 1) * L.ROW_H,
  };
}

/* Render one card per node into #canvas, absolutely positioned at its row/col.
 * Keeps a map of id -> element on APP.nodeEls for later tasks. */
function renderGrid(nodes) {
  var canvas = document.getElementById("canvas");
  if (!canvas) return;

  var layout = makeLayout(nodes);
  APP.layout = layout;
  APP.nodeEls = {};

  canvas.innerHTML = "";
  canvas.style.width = layout.width + "px";
  canvas.style.height = layout.height + "px";

  nodes.forEach(function (n) {
    var div = document.createElement("div");
    // T1.4 — available vs greyed. A node is *available* iff its id matched a
    // pipeline in this workspace's cards (mergeNodes set n.available). Greyed
    // nodes get the .greyed class (desaturated in CSS) and are flagged
    // unclickable via aria-disabled + a data attribute later tasks (the click
    // handler in T1.6) read to skip them.
    div.className = "node track-" + n.track + (n.available ? "" : " greyed");
    div.dataset.id = n.id;
    div.dataset.available = n.available ? "1" : "0";
    if (!n.available) div.setAttribute("aria-disabled", "true");
    div.style.left = layout.nx(n) + "px";
    div.style.top = layout.ny(n) + "px";
    div.style.width = LAYOUT.NODE_W + "px";
    div.style.minHeight = LAYOUT.NODE_H + "px";
    div.title =
      (n.description || "") +
      "\n\n[" +
      n.type +
      "]  id: " +
      n.id +
      (n.available ? "" : "\n\n⦸ Not available in this workspace");

    var badge = FILLED_TYPES[n.type]
      ? '<span class="type-badge filled">' + escapeHtml(n.type) + "</span>"
      : "";
    div.innerHTML =
      badge +
      '<span class="code">' +
      escapeHtml(n.code) +
      "</span>" +
      '<div class="lbl">' +
      escapeHtml(n.label) +
      "</div>";

    // T1.6 — only *available* nodes are interactive. Greyed nodes already have
    // pointer-events:none in CSS, but we also skip the handler + the affordances
    // (pointer cursor, keyboard focus, button role) for them.
    if (n.available) {
      div.classList.add("clickable");
      div.setAttribute("role", "button");
      div.setAttribute("tabindex", "0");
      (function (id) {
        div.addEventListener("click", function () {
          selectNode(id);
        });
        div.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectNode(id);
          }
        });
      })(n.id);
    }

    canvas.appendChild(div);
    APP.nodeEls[n.id] = div;
  });
}

/* ------------------------------------------------------------------ *
 * T1.3 — Draw the SVG arrows
 *
 * One arrow per dependency `edge`, drawn into a single <svg> inserted *behind*
 * the node cards (renderGrid already appended them, so inserting the svg as the
 * canvas's first child puts the lines under the boxes). No graph-layout library:
 * endpoints are computed from the same row/col geometry as the cards (APP.layout)
 * so they line up exactly, fractional A.4 columns included.
 *
 * Two refinements ported from knowledge/pipeline_map_preview.html keep the
 * picture readable:
 *  - Alternative-group boxes: the members of a mutex `group` (the five A.3
 *    outlier methods, the two A.4 reporting-rate variants) are wrapped in one
 *    rect and edges attach to that *box*, treating the group as a single node.
 *  - Parallel-edge collapse: many member-to-member edges that resolve to the
 *    same box->box (and type) are drawn once, so the 5 A.3->A.4 solid edges
 *    become a single A.3-box -> A.4-box line, etc.
 *
 * Edge `type`: "solid" (or unset) = hard dependency, drawn thick + dark with a
 * filled arrowhead; "optional" = soft link, drawn thin + light. Both are solid
 * lines (no dashes), matching the reviewed preview.
 * ------------------------------------------------------------------ */
function renderEdges(nodes, edges) {
  var canvas = document.getElementById("canvas");
  if (!canvas) return;
  var layout = APP.layout;
  var L = LAYOUT;

  var nodeById = {};
  nodes.forEach(function (n) {
    nodeById[n.id] = n;
  });

  // SVG layer, sized to the full canvas and inserted before the cards so it
  // paints behind them. overflow:visible (in CSS) lets arrowheads spill.
  var svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "edges");
  svg.setAttribute("width", layout.width);
  svg.setAttribute("height", layout.height);
  svg.innerHTML =
    "<defs>" +
    '<marker id="ah-hard" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto" markerUnits="userSpaceOnUse">' +
    '<path d="M0,0 L8,3 L0,6 Z" fill="#37474f"/></marker>' +
    '<marker id="ah-opt" markerWidth="8" markerHeight="8" refX="6.5" refY="2.6" orient="auto" markerUnits="userSpaceOnUse">' +
    '<path d="M0,0 L6,2.6 L0,5.2 Z" fill="#b0bec5"/></marker>' +
    "</defs>";
  canvas.insertBefore(svg, canvas.firstChild);
  APP.edgesSvg = svg;

  // Bucket alternative-group members by their `group`.
  var groups = {};
  nodes.forEach(function (n) {
    if (n.type === "alternative" && n.group) {
      (groups[n.group] = groups[n.group] || []).push(n);
    }
  });

  // Draw one rect (+ label) per group and record its centre/half-extents so
  // edges can attach to the box. cx/cy = centre; hw/hh = half width/height.
  var groupRects = {};
  Object.keys(groups).forEach(function (gid) {
    var members = groups[gid];
    var pad = 12;
    var labelH = 16;
    var lefts = members.map(layout.nx);
    var tops = members.map(layout.ny);
    var rights = members.map(function (n) {
      return layout.nx(n) + L.NODE_W;
    });
    var bottoms = members.map(function (n) {
      return layout.ny(n) + L.NODE_H;
    });
    var left = Math.min.apply(null, lefts) - pad;
    var top = Math.min.apply(null, tops) - pad - labelH;
    var right = Math.max.apply(null, rights) + pad;
    var bottom = Math.max.apply(null, bottoms) + pad;
    groupRects[gid] = {
      cx: (left + right) / 2,
      cy: (top + bottom) / 2,
      hw: (right - left) / 2,
      hh: (bottom - top) / 2,
    };

    var rect = document.createElementNS(SVGNS, "rect");
    rect.setAttribute("x", left);
    rect.setAttribute("y", top);
    rect.setAttribute("width", right - left);
    rect.setAttribute("height", bottom - top);
    rect.setAttribute("rx", 10);
    rect.setAttribute("fill", "rgba(84,110,122,0.05)");
    rect.setAttribute("stroke", "#546e7a");
    rect.setAttribute("stroke-width", "1.6");
    svg.appendChild(rect);

    var t = document.createElementNS(SVGNS, "text");
    t.setAttribute("x", left + 10);
    t.setAttribute("y", top + 12);
    t.setAttribute("class", "grouplabel");
    t.textContent = members[0].code + " — choose one";
    svg.appendChild(t);
  });

  // An edge endpoint resolves to the member's own card — unless that member is
  // in an alternative group, in which case it resolves to the group box.
  function anchorOf(id) {
    var n = nodeById[id];
    if (n.group && groupRects[n.group]) {
      var r = groupRects[n.group];
      return { key: "grp:" + n.group, cx: r.cx, cy: r.cy, hw: r.hw, hh: r.hh };
    }
    return {
      key: id,
      cx: layout.ncx(n),
      cy: layout.ncy(n),
      hw: L.NODE_W / 2 + 2,
      hh: L.NODE_H / 2 + 2,
    };
  }

  // Where the line from anchor `a` towards (tx,ty) crosses a's bounding box —
  // so arrows touch the box border, not the centre.
  function borderPoint(a, tx, ty) {
    var dx = tx - a.cx;
    var dy = ty - a.cy;
    if (!dx && !dy) return [a.cx, a.cy];
    var s = Math.min(
      dx ? a.hw / Math.abs(dx) : Infinity,
      dy ? a.hh / Math.abs(dy) : Infinity,
    );
    return [a.cx + dx * s, a.cy + dy * s];
  }

  // Collapse parallel edges sharing the same (anchor -> anchor, type): the 5
  // A.3->A.4 member edges become ONE A.3-box -> A.4-box line, etc.
  var drawn = {};
  (edges || []).forEach(function (e) {
    var A = anchorOf(e.from);
    var B = anchorOf(e.to);
    if (A.key === B.key) return; // both endpoints in the same group box
    var k = A.key + "|" + B.key + "|" + e.type;
    if (drawn[k]) return;
    drawn[k] = true;

    var p1 = borderPoint(A, B.cx, B.cy);
    var p2 = borderPoint(B, A.cx, A.cy);
    var line = document.createElementNS(SVGNS, "line");
    line.setAttribute("x1", p1[0]);
    line.setAttribute("y1", p1[1]);
    line.setAttribute("x2", p2[0]);
    line.setAttribute("y2", p2[1]);
    var hard = e.type !== "optional";
    line.setAttribute("stroke", hard ? "#37474f" : "#b0bec5");
    line.setAttribute("stroke-width", hard ? 2.6 : 1.3);
    line.setAttribute("marker-end", hard ? "url(#ah-hard)" : "url(#ah-opt)");
    svg.appendChild(line);
  });
}

/* ------------------------------------------------------------------ *
 * T1.5 — Live status layer
 *
 * For each *available* node, fetch its latest run (one query for the whole
 * workspace, the proven STATUS_QUERY above) and stamp a status badge + last-run
 * datetime onto its card, plus a small ↗ link to that run's page in the
 * OpenHEXA UI. Greyed (not-installed) nodes get nothing.
 *
 * Join key: the status query returns each pipeline's UUID as `id`; each merged
 * node carries `uuid` from the cards (set in mergeNodes). We match on
 * node.uuid === pipeline.id — the same stable identity used everywhere else,
 * not the display code or the openhexa slug.
 *
 * The map renders instantly (renderGrid/renderEdges are synchronous); the
 * status query then fills the badges in a moment later. While it's in flight we
 * stamp a "loading…" placeholder so the user sees the board is live; on a
 * failed/blocked query we fall back to a "status unavailable" badge rather than
 * leaving the placeholder spinning.
 * ------------------------------------------------------------------ */

// Base URL of the companion OpenHEXA front-end (workspaces, pipeline runs,
// datasets). NOTE: on the SaaS the static webapp is served under *.openhexa.io
// but the main app UI lives at app.openhexa.org — a DIFFERENT domain, so it
// cannot be derived from this webapp's own hostname (verified 2026-06-18: a
// real run page is https://app.openhexa.org/workspaces/<slug>/pipelines/<code>/
// runs/<runId>/). Hardcoded for the SaaS; revisit for self-hosted installs
// (Phase 4 / T4.1 portability check).
function appBaseUrl() {
  return "https://app.openhexa.org";
}

// Parse an OpenHEXA executionDate ("2026-06-10 09:02:45.253270+00:00") into a
// Date: space -> "T" and microseconds trimmed to milliseconds so it's valid ISO
// across browsers. Returns null if absent/unparseable.
function parseRunDate(s) {
  if (!s) return null;
  var iso = String(s)
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1");
  var d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Compact local "YYYY-MM-DD HH:MM" for the on-card last-run line.
function fmtRunDate(s) {
  var d = parseRunDate(s);
  if (!d) return "—";
  function p(n) {
    return (n < 10 ? "0" : "") + n;
  }
  return (
    d.getFullYear() +
    "-" +
    p(d.getMonth() + 1) +
    "-" +
    p(d.getDate()) +
    " " +
    p(d.getHours()) +
    ":" +
    p(d.getMinutes())
  );
}

/* Build the inner HTML of a card's status row for a given state:
 *  - "loading" : query in flight
 *  - "error"   : query failed / blocked
 *  - "ok"      : query returned; `run` is the latest run, or null for no runs.
 * `runUrl` (when present) makes the ↗ link to the run's OpenHEXA-UI page. */
function statusRowHtml(state, run, runUrl) {
  if (state === "loading")
    return '<span class="status-badge loading">loading…</span>';
  if (state === "error")
    return '<span class="status-badge s-error">status unavailable</span>';
  if (!run) return '<span class="status-badge s-none">no runs</span>';

  var badge =
    '<span class="status-badge s-' +
    escapeHtml(run.status) +
    '">' +
    escapeHtml(run.status) +
    "</span>";
  var link = runUrl
    ? '<a class="run-link" href="' +
      escapeHtml(runUrl) +
      '" target="_blank" rel="noopener noreferrer" title="Open this run in OpenHEXA" aria-label="Open this run in OpenHEXA">↗</a>'
    : "";
  var date =
    '<span class="run-date" title="' +
    escapeHtml(run.executionDate || "") +
    '">' +
    fmtRunDate(run.executionDate) +
    "</span>";
  return badge + link + date;
}

// Create-or-replace the .status-row child of a node's card.
function setNodeStatusRow(id, html) {
  var el = APP.nodeEls[id];
  if (!el) return;
  var row = el.querySelector(".status-row");
  if (!row) {
    row = document.createElement("div");
    row.className = "status-row";
    el.appendChild(row);
  }
  row.innerHTML = html;
}

// Stamp the loading placeholder on every available card (greyed nodes skip).
function stampStatusLoading(nodes) {
  nodes.forEach(function (n) {
    if (n.available) setNodeStatusRow(n.id, statusRowHtml("loading"));
  });
}

/* Fetch every pipeline's latest run and paint the badges. One query covers the
 * whole workspace; results are matched onto nodes by UUID. Resolves quietly —
 * a status failure must not break the already-rendered map. */
async function loadStatuses(nodes) {
  var slug =
    window.OPENHEXA && window.OPENHEXA.workspaceSlug
      ? window.OPENHEXA.workspaceSlug
      : null;

  // Opened outside OpenHEXA (no platform global) — can't query; show the
  // fallback rather than a stuck spinner.
  if (!slug) {
    nodes.forEach(function (n) {
      if (n.available) setNodeStatusRow(n.id, statusRowHtml("error"));
    });
    return;
  }

  var data;
  try {
    data = await gql(STATUS_QUERY, { ws: slug });
  } catch (err) {
    console.error("SNT Orchestrator — status query failed:", err);
    nodes.forEach(function (n) {
      if (n.available) setNodeStatusRow(n.id, statusRowHtml("error"));
    });
    return;
  }

  var items = (data.pipelines && data.pipelines.items) || [];
  var byUuid = {};
  items.forEach(function (p) {
    var run = p.runs && p.runs.items && p.runs.items.length ? p.runs.items[0] : null;
    byUuid[p.id] = { code: p.code, run: run };
  });
  APP.statusByUuid = byUuid;

  var base = appBaseUrl();
  nodes.forEach(function (n) {
    if (!n.available) return;
    var entry = byUuid[n.uuid];
    // Available in the cards but absent from the live list (stale UUID) — treat
    // as "no runs" rather than erroring the whole board.
    if (!entry) {
      setNodeStatusRow(n.id, statusRowHtml("ok", null, null));
      return;
    }
    var run = entry.run;
    var runUrl = run
      ? base + "/workspaces/" + slug + "/pipelines/" + entry.code + "/runs/" + run.id + "/"
      : null;
    setNodeStatusRow(n.id, statusRowHtml("ok", run, runUrl));
  });
}

/* Fetch the workspace's connections once at boot and cache them on
 * APP.connections, grouped by ConnectionType ({ DHIS2: [{slug,name}], ... }).
 * Used by the T2.2 form to render connection dropdowns. Best-effort: any failure
 * (no platform global, missing USER_READ scope, network error) leaves
 * APP.connections null so the form falls back to a plain text slug input. */
async function loadConnections() {
  var slug =
    window.OPENHEXA && window.OPENHEXA.workspaceSlug
      ? window.OPENHEXA.workspaceSlug
      : null;
  if (!slug) return;

  var data;
  try {
    data = await gql(CONNECTIONS_QUERY, { ws: slug });
  } catch (err) {
    console.warn(
      "SNT Orchestrator — connections query unavailable (form falls back to text slug input):",
      err,
    );
    return;
  }

  var conns = (data.workspace && data.workspace.connections) || [];
  var byType = {};
  conns.forEach(function (c) {
    (byType[c.type] = byType[c.type] || []).push({
      slug: c.slug,
      name: c.name,
    });
  });
  APP.connections = byType;
}

/* ------------------------------------------------------------------ *
 * T1.6 — Read-only detail sidebar
 *
 * Clicking an *available* node opens the right-hand panel with everything we
 * know about that pipeline, all read-only (no Run button yet — that's Phase 2):
 *   - name + code + type, and the latest-run status line (reused from T1.5);
 *   - a link to the pipeline's README on GitHub;
 *   - a link to the latest run's page in the OpenHEXA UI (when it has run);
 *   - its latest outputs — output datasets and bucket files (e.g. the HTML
 *     report) — fetched per-click from pipelineRun(id:);
 *   - its parameters, shown as a definition list (label, type, default,
 *     choices, help) — display only, the input form arrives in T2.2.
 *
 * Selection is single: clicking a node highlights it and replaces the panel;
 * the ✕ button (or clicking nothing) returns to the empty placeholder.
 * ------------------------------------------------------------------ */

// The pipeline source repo. Each pipeline lives in a folder named after its
// Python function id (== node.id); linking to the *folder* (not a specific
// README filename) renders the folder's readme inline and is robust to the
// file's casing varying across pipelines (some are README.md, some readme.md).
var GITHUB_REPO = "https://github.com/BLSQ/snt_development";
function githubFolderUrl(id) {
  return GITHUB_REPO + "/tree/main/" + encodeURIComponent(id);
}

// pipelineRun outputs for one run — datasets + bucket/generic file outputs.
// outputs is a union, so use __typename inline fragments (CLAUDE.md pattern).
var OUTPUTS_QUERY =
  "query ($id: UUID!) {" +
  "  pipelineRun(id: $id) {" +
  "    outputs {" +
  "      __typename" +
  "      ... on BucketObject { key name type }" +
  // GenericOutput.name is String (nullable) vs BucketObject.name String! — same
  // response key with conflicting types is a GraphQL validation error, so alias it.
  "      ... on GenericOutput { uri genericName: name }" +
  "    }" +
  "    datasetVersions { id name dataset { slug name workspace { slug } } }" +
  "  }" +
  "}";

// Signed download URL for a bucket object (the HTML report etc.). Needs
// FILES_READ; forceAttachment:false so the report renders inline in the browser.
var DOWNLOAD_MUTATION =
  "mutation ($input: PrepareObjectDownloadInput!) {" +
  "  prepareObjectDownload(input: $input) { success downloadUrl }" +
  "}";

/* T2.3 — trigger a run. Pass the pipeline UUID as `id` and the form-built
 * `config` (JSON!). Needs the PIPELINES_RUN scope. `errors` is a list of
 * PipelineError enum values; `run.id` is the UUID we then poll. */
var RUN_MUTATION =
  "mutation ($input: RunPipelineInput!) {" +
  "  runPipeline(input: $input) {" +
  "    success" +
  "    errors" +
  "    run { id status }" +
  "  }" +
  "}";

/* T2.3 — poll one run for its live status (PIPELINES_READ). We refetch the
 * outputs separately (OUTPUTS_QUERY) only once the run is finished. */
var RUN_POLL_QUERY =
  "query ($id: UUID!) {" +
  "  pipelineRun(id: $id) {" +
  "    id status executionDate duration" +
  "  }" +
  "}";

// Human-readable run duration from a count of seconds ("6m 12s", "1h 03m 00s").
function fmtDuration(sec) {
  if (sec == null) return null;
  var s = Math.max(0, Math.round(sec));
  var h = Math.floor(s / 3600);
  s -= h * 3600;
  var m = Math.floor(s / 60);
  s -= m * 60;
  function p(n) {
    return (n < 10 ? "0" : "") + n;
  }
  if (h) return h + "h " + p(m) + "m " + p(s) + "s";
  if (m) return m + "m " + p(s) + "s";
  return s + "s";
}

function isHtmlKey(key) {
  return /\.html?$/i.test(String(key || ""));
}

// One external/destination link row (README, run page, dataset, generic output).
function extLinkHtml(href, icon, title, sub, arrow) {
  return (
    '<a class="extlink" href="' +
    escapeHtml(href) +
    '" target="_blank" rel="noopener noreferrer">' +
    '<span class="ic">' +
    icon +
    "</span>" +
    '<span class="extlink-txt">' +
    escapeHtml(title) +
    (sub ? "<small>" + escapeHtml(sub) + "</small>" : "") +
    "</span>" +
    '<span class="arr">' +
    (arrow || "↗") +
    "</span></a>"
  );
}

// The status line at the top of the panel, reusing the T1.5 status data + badge
// classes. entry = APP.statusByUuid[uuid] ({code, run}); run may be null.
function sidebarStatusHtml(entry) {
  if (!APP.statusByUuid)
    return '<div class="sb-status"><span class="status-badge s-error">status unavailable</span></div>';
  var run = entry ? entry.run : null;
  if (!run)
    return '<div class="sb-status"><span class="status-badge s-none">never run</span></div>';
  var dur = fmtDuration(run.duration);
  return (
    '<div class="sb-status">' +
    '<span class="status-badge s-' +
    escapeHtml(run.status) +
    '">' +
    escapeHtml(run.status) +
    "</span>" +
    '<span class="sb-statusmeta">last run ' +
    escapeHtml(fmtRunDate(run.executionDate)) +
    (dur ? " · " + escapeHtml(dur) : "") +
    "</span></div>"
  );
}

/* ------------------------------------------------------------------ *
 * T2.2 — Parameter form + config builder
 *
 * Phase 1 (T1.6) showed each pipeline's parameters as a read-only list. Here we
 * turn that same list into a real, editable form in the side panel, with the
 * right kind of input per parameter type:
 *   - bool             -> checkbox
 *   - int / float      -> number input (step 1 / step any)
 *   - str              -> text input (or a <select> when it has `choices`)
 *   - str + multiple   -> a checkbox group (when it has `choices`) else a
 *                         comma-separated text box
 *   - DHIS2Connection /
 *     CustomConnection -> a dropdown of the workspace's matching connections
 *                         (slugs), with a plain-text fallback if the connection
 *                         list isn't available (e.g. opened outside OpenHEXA, or
 *                         the USER_READ scope isn't granted yet)
 *   - File             -> a text input for a workspace file path
 *
 * `buildConfig(node)` then reads the form back into a plain `config` object in
 * exactly the shape `runPipeline` expects (keys == param keys; numbers as
 * numbers, bools as bools, multiples as arrays, connections as slug strings),
 * validating required fields. The Run button is wired in T2.3 — for now a
 * "Preview config" button prints the built package so the shape can be checked.
 * ------------------------------------------------------------------ */

function fieldId(key) {
  return "fld-" + key;
}

// The workspace connections cached by loadConnections, filtered to the enum type
// a connection-typed param needs. Returns an array of {slug, name}, or null when
// the list isn't available yet (caller then falls back to a plain text input).
function connOptionsFor(ptype) {
  if (!APP.connections) return null;
  var enumType =
    ptype === "DHIS2Connection"
      ? "DHIS2"
      : ptype === "CustomConnection"
        ? "CUSTOM"
        : null;
  if (!enumType) return null;
  return APP.connections[enumType] || [];
}

// The input control HTML for one parameter (label + help are added by caller).
function fieldControlHtml(p) {
  var id = fieldId(p.key);
  var t = p.type;

  // multiple + choices -> checkbox group (e.g. A.4 activity_indicators).
  if (p.multiple && p.choices && p.choices.length) {
    var defs = Array.isArray(p.default) ? p.default.map(String) : [];
    return (
      '<div class="fchecks">' +
      p.choices
        .map(function (c) {
          var v = String(c);
          return (
            '<label class="fcheck-sm"><input type="checkbox" class="finput-multi" value="' +
            escapeHtml(v) +
            '"' +
            (defs.indexOf(v) >= 0 ? " checked" : "") +
            "> " +
            escapeHtml(v) +
            "</label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  // single choice -> select.
  if (p.choices && p.choices.length) {
    var dv = p.default !== undefined && p.default !== null ? String(p.default) : "";
    return (
      '<select id="' +
      id +
      '" class="finput">' +
      '<option value="">— select —</option>' +
      p.choices
        .map(function (c) {
          var v = String(c);
          return (
            '<option value="' +
            escapeHtml(v) +
            '"' +
            (v === dv ? " selected" : "") +
            ">" +
            escapeHtml(v) +
            "</option>"
          );
        })
        .join("") +
      "</select>"
    );
  }

  // connection -> dropdown of workspace connections; text fallback if none cached.
  if (t === "DHIS2Connection" || t === "CustomConnection") {
    var conns = connOptionsFor(t);
    if (conns && conns.length) {
      return (
        '<select id="' +
        id +
        '" class="finput">' +
        '<option value="">— select connection —</option>' +
        conns
          .map(function (c) {
            return (
              '<option value="' +
              escapeHtml(c.slug) +
              '">' +
              escapeHtml(c.name || c.slug) +
              " (" +
              escapeHtml(c.slug) +
              ")</option>"
            );
          })
          .join("") +
        "</select>"
      );
    }
    return (
      '<input id="' +
      id +
      '" class="finput" type="text" placeholder="connection slug (e.g. dhis2-nmdr-drc)">'
    );
  }

  // bool -> checkbox (rendered inline beside the label by the caller).
  if (t === "bool") {
    return (
      '<input id="' +
      id +
      '" class="finput" type="checkbox"' +
      (p.default === true ? " checked" : "") +
      ">"
    );
  }

  // int / float -> number input.
  if (t === "int" || t === "float") {
    var step = t === "int" ? "1" : "any";
    var nv =
      p.default !== undefined && p.default !== null
        ? escapeHtml(String(p.default))
        : "";
    return (
      '<input id="' +
      id +
      '" class="finput" type="number" step="' +
      step +
      '" value="' +
      nv +
      '">'
    );
  }

  // multiple without choices -> comma-separated text.
  if (p.multiple) {
    var mv = Array.isArray(p.default) ? p.default.join(", ") : "";
    return (
      '<input id="' +
      id +
      '" class="finput" type="text" placeholder="comma-separated" value="' +
      escapeHtml(mv) +
      '">'
    );
  }

  // File -> workspace file path (no upload widget in a static webapp).
  if (t === "File") {
    return (
      '<input id="' +
      id +
      '" class="finput" type="text" placeholder="workspace file path (optional)">'
    );
  }

  // str (default) -> text input.
  var sv =
    p.default !== undefined && p.default !== null
      ? escapeHtml(String(p.default))
      : "";
  return '<input id="' + id + '" class="finput" type="text" value="' + sv + '">';
}

// Build the <form> of editable fields for a node's parameters.
function paramsFormHtml(node) {
  var params = node.parameters || [];
  if (!params.length)
    return '<p class="sb-muted">This pipeline takes no parameters.</p>';

  var fields = params
    .map(function (p) {
      var req = p.required
        ? ' <span class="req" title="Required">*</span>'
        : "";
      var help = p.help
        ? '<div class="fhelp">' + escapeHtml(p.help) + "</div>"
        : "";
      var data =
        ' data-key="' +
        escapeHtml(p.key) +
        '" data-ptype="' +
        escapeHtml(p.type) +
        '"' +
        (p.multiple ? ' data-multiple="1"' : "") +
        (p.required ? ' data-required="1"' : "");

      // bool reads more naturally with the checkbox beside its label.
      if (p.type === "bool") {
        return (
          '<div class="field field-bool"' +
          data +
          ">" +
          '<label class="fcheck">' +
          fieldControlHtml(p) +
          '<span class="flabel-inline">' +
          escapeHtml(p.label || p.key) +
          req +
          "</span></label>" +
          help +
          "</div>"
        );
      }

      return (
        '<div class="field"' +
        data +
        ">" +
        '<label class="flabel" for="' +
        fieldId(p.key) +
        '">' +
        escapeHtml(p.label || p.key) +
        req +
        "</label>" +
        fieldControlHtml(p) +
        help +
        "</div>"
      );
    })
    .join("");

  return '<form id="sb-form" class="sb-form" autocomplete="off">' + fields + "</form>";
}

/* Read the form back into a `config` object in runPipeline's shape, validating
 * required fields. Returns { config, errors }: empty optional inputs are omitted
 * (so we never send blank strings); empty required inputs are reported. Numbers
 * are coerced to JS numbers, multiples to arrays, everything else to strings
 * (connection slugs included). This is the package T2.3's Run button will send. */
function buildConfig(node) {
  var form = document.getElementById("sb-form");
  var config = {};
  var errors = [];
  if (!form) return { config: config, errors: errors };

  (node.parameters || []).forEach(function (p) {
    var wrap = form.querySelector('.field[data-key="' + p.key + '"]');
    if (!wrap) return;
    var t = p.type;
    var label = p.label || p.key;

    if (t === "bool") {
      var cb = wrap.querySelector('input[type="checkbox"]');
      config[p.key] = !!(cb && cb.checked);
      return;
    }

    if (p.multiple && p.choices && p.choices.length) {
      var picked = Array.prototype.map.call(
        wrap.querySelectorAll(".finput-multi:checked"),
        function (el) {
          return el.value;
        },
      );
      if (picked.length) config[p.key] = picked;
      else if (p.required) errors.push(label + " — select at least one");
      return;
    }

    if (p.multiple) {
      var rawmulti = (wrap.querySelector(".finput") || {}).value || "";
      var arr = rawmulti
        .split(",")
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      if (arr.length) config[p.key] = arr;
      else if (p.required) errors.push(label + " is required");
      return;
    }

    var ctl = wrap.querySelector(".finput");
    var val = ctl ? String(ctl.value).trim() : "";
    if (val === "") {
      if (p.required) errors.push(label + " is required");
      return; // omit empty optional value
    }

    if (t === "int") {
      var iv = Number(val);
      if (!isFinite(iv) || Math.floor(iv) !== iv) {
        errors.push(label + " must be a whole number");
        return;
      }
      config[p.key] = iv;
    } else if (t === "float") {
      var fv = Number(val);
      if (!isFinite(fv)) {
        errors.push(label + " must be a number");
        return;
      }
      config[p.key] = fv;
    } else {
      // str, File, DHIS2Connection, CustomConnection, single-choice select
      config[p.key] = val;
    }
  });

  return { config: config, errors: errors };
}

// Render the empty/placeholder panel (nothing selected).
function renderEmptySidebar() {
  var sb = document.getElementById("sidebar");
  if (!sb) return;
  sb.innerHTML =
    '<div class="sb-empty">' +
    "<p>Select a pipeline node to see its description, parameters, links, and latest outputs.</p>" +
    "</div>";
}

// Highlight the clicked card, deselect the rest, and render its panel.
function selectNode(id) {
  var node = APP.nodeById[id];
  if (!node || !node.available) return;
  APP.selectedId = id;
  Object.keys(APP.nodeEls).forEach(function (k) {
    APP.nodeEls[k].classList.toggle("selected", k === id);
  });
  renderSidebar(node);
}

function clearSelection() {
  APP.selectedId = null;
  Object.keys(APP.nodeEls).forEach(function (k) {
    APP.nodeEls[k].classList.remove("selected");
  });
  renderEmptySidebar();
}

// Build + inject the detail panel for a node, then kick off the outputs fetch.
function renderSidebar(node) {
  var sb = document.getElementById("sidebar");
  if (!sb) return;

  var entry =
    APP.statusByUuid && node.uuid ? APP.statusByUuid[node.uuid] : null;
  var run = entry ? entry.run : null;
  var slug =
    window.OPENHEXA && window.OPENHEXA.workspaceSlug
      ? window.OPENHEXA.workspaceSlug
      : null;
  var base = appBaseUrl();

  // Links: README always; the run page only when there's a run (+ slug + code).
  var links = extLinkHtml(
    githubFolderUrl(node.id),
    "▤",
    "README on GitHub",
    "snt_development / " + node.id,
  );
  if (run && slug && entry && entry.code) {
    var runUrl =
      base + "/workspaces/" + slug + "/pipelines/" + entry.code + "/runs/" + run.id + "/";
    links += extLinkHtml(
      runUrl,
      "▶",
      "Open latest run in OpenHEXA",
      "logs, messages, full detail",
    );
  }

  sb.innerHTML =
    '<div class="sb-head">' +
    '<div class="sb-titlerow">' +
    '<h2 class="sb-title">' +
    escapeHtml(node.label) +
    "</h2>" +
    '<button class="sb-close" type="button" aria-label="Close panel" title="Close">✕</button>' +
    "</div>" +
    '<div class="sb-sub">' +
    '<span class="sb-code">' +
    escapeHtml(node.code) +
    "</span>" +
    '<span class="sb-type">' +
    escapeHtml(node.type) +
    "</span>" +
    "</div>" +
    sidebarStatusHtml(entry) +
    "</div>" +
    '<div class="sb-body">' +
    '<div id="sb-altnote-slot">' +
    groupExclusionNoticeHtml(node) +
    "</div>" +
    (node.description
      ? '<p class="sb-desc">' + escapeHtml(node.description) + "</p>"
      : "") +
    '<div class="sb-links">' +
    links +
    "</div>" +
    '<section class="sb-sec">' +
    '<h3 class="sb-sectitle">Latest outputs</h3>' +
    '<div id="sb-outputs" class="sb-outputs"></div>' +
    "</section>" +
    '<section class="sb-sec">' +
    '<h3 class="sb-sectitle">Parameters</h3>' +
    paramsFormHtml(node) +
    '<div class="sb-runrow">' +
    '<button type="button" id="sb-run" class="btn-primary">▶ Run pipeline</button>' +
    '<button type="button" id="sb-preview" class="btn-secondary">Preview config</button>' +
    "</div>" +
    '<div id="sb-runstatus" class="sb-runstatus" hidden></div>' +
    '<pre id="sb-config" class="sb-config" hidden></pre>' +
    "</section>" +
    "</div>";

  var closeBtn = sb.querySelector(".sb-close");
  if (closeBtn) closeBtn.addEventListener("click", clearSelection);

  // T2.2 — the "debug line": build + validate the config from the form and show
  // the package that T2.3's Run button will send. Errors (missing required
  // fields, bad numbers) are listed instead, so the form's correctness is
  // checkable before runs are wired.
  var previewBtn = sb.querySelector("#sb-preview");
  var configBox = sb.querySelector("#sb-config");
  if (previewBtn && configBox) {
    previewBtn.addEventListener("click", function () {
      var built = buildConfig(node);
      configBox.hidden = false;
      if (built.errors.length) {
        configBox.className = "sb-config has-errors";
        configBox.textContent =
          "⚠ Fix these before running:\n  - " +
          built.errors.join("\n  - ") +
          "\n\nconfig so far:\n" +
          JSON.stringify(built.config, null, 2);
        console.warn(
          "SNT Orchestrator — config validation errors for " + node.id + ":",
          built.errors,
          built.config,
        );
      } else {
        configBox.className = "sb-config";
        configBox.textContent = JSON.stringify(built.config, null, 2);
        console.log(
          "SNT Orchestrator — config for " + node.id + ":",
          built.config,
        );
      }
    });
  }

  // T2.3 — wire the Run button. If a run for this node is already in flight
  // (the user navigated away and came back), reflect that on the freshly
  // rendered panel: disable the button and re-show the live status line.
  var runBtn = sb.querySelector("#sb-run");
  if (runBtn) {
    runBtn.addEventListener("click", function () {
      runNode(node);
    });
    if (APP.activeRun[node.id]) {
      runBtn.disabled = true;
      runBtn.classList.add("is-busy");
      var liveRun = entry ? entry.run : null;
      if (liveRun)
        setRunStatusLine(
          node.id,
          runStatusLineHtml(node, liveRun),
          runStatusCls(liveRun.status),
        );
    }
  }

  loadOutputs(node, run);
}

/* Fetch + render the latest run's outputs into the panel's #sb-outputs box.
 * Output datasets become direct links to their dataset page; bucket files (the
 * HTML report and any other artifacts) become links that lazily resolve a
 * signed download URL on click; generic outputs link straight to their uri.
 * Guarded by APP.selectedId so a slow fetch can't paint into a panel the user
 * has since navigated away from. */
async function loadOutputs(node, run) {
  var box = document.getElementById("sb-outputs");
  if (!box) return;

  if (!run) {
    box.innerHTML =
      '<p class="sb-muted">No outputs yet — this pipeline hasn\'t run.</p>';
    return;
  }
  var slug =
    window.OPENHEXA && window.OPENHEXA.workspaceSlug
      ? window.OPENHEXA.workspaceSlug
      : null;
  if (!slug) {
    box.innerHTML =
      '<p class="sb-muted">Outputs are only available inside OpenHEXA.</p>';
    return;
  }

  box.innerHTML = '<p class="sb-muted">loading outputs…</p>';

  var data;
  try {
    data = await gql(OUTPUTS_QUERY, { id: run.id });
  } catch (err) {
    console.error("SNT Orchestrator — outputs query failed:", err);
    if (APP.selectedId === node.id)
      box.innerHTML = '<p class="sb-muted">Couldn\'t load outputs.</p>';
    return;
  }
  // Selection changed while the query was in flight — drop this stale result.
  if (APP.selectedId !== node.id) return;

  var pr = data.pipelineRun || {};
  var base = appBaseUrl();
  var html = "";

  // Output datasets (one link per produced version, deduped by version id).
  // The dataset page URL is /workspaces/<viewingWs>/datasets/<datasetSlug>/from/
  // <sourceWs>/?version=<datasetVersionId> — the `from/<sourceWs>` segment + the
  // version query param are required (without them OpenHEXA 404s). The viewing
  // workspace is this app's workspace (slug); the source workspace is the one
  // that owns the dataset (same as viewing for run outputs, but use the
  // dataset's own workspace when present so shared/linked datasets resolve too).
  var seen = {};
  (pr.datasetVersions || []).forEach(function (dv) {
    var ds = dv.dataset;
    if (!ds || !dv.id || seen[dv.id]) return;
    seen[dv.id] = true;
    var fromSlug = ds.workspace && ds.workspace.slug ? ds.workspace.slug : slug;
    var url =
      base +
      "/workspaces/" +
      slug +
      "/datasets/" +
      ds.slug +
      "/from/" +
      fromSlug +
      "/?version=" +
      encodeURIComponent(dv.id);
    html += extLinkHtml(url, "▥", ds.name || ds.slug, "output dataset");
  });

  // File outputs: bucket objects (lazy signed URL) + generic outputs (direct).
  (pr.outputs || []).forEach(function (o) {
    if (o.__typename === "BucketObject") {
      if (o.type === "DIRECTORY") return;
      var html_report = isHtmlKey(o.key);
      html +=
        '<a class="extlink" href="#" data-objkey="' +
        escapeHtml(o.key) +
        '">' +
        '<span class="ic">' +
        (html_report ? "▦" : "▣") +
        "</span>" +
        '<span class="extlink-txt">' +
        escapeHtml(o.name || o.key) +
        "<small>" +
        (html_report ? "HTML report" : "output file") +
        "</small></span>" +
        '<span class="arr">↗</span></a>';
    } else if (o.__typename === "GenericOutput") {
      html += extLinkHtml(o.uri, "▣", o.genericName || o.uri, "output");
    }
  });

  if (!html)
    html = '<p class="sb-muted">This run produced no linkable outputs.</p>';
  box.innerHTML = html;

  // Wire each bucket-object link to resolve its signed URL on click.
  Array.prototype.forEach.call(
    box.querySelectorAll("a[data-objkey]"),
    function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        openBucketObject(a.getAttribute("data-objkey"), a);
      });
    },
  );
}

/* Resolve a signed download URL for a bucket object and open it. A blank tab is
 * opened synchronously inside the click gesture (so pop-up blockers allow it),
 * then redirected once prepareObjectDownload returns. */
async function openBucketObject(key, a) {
  var slug =
    window.OPENHEXA && window.OPENHEXA.workspaceSlug
      ? window.OPENHEXA.workspaceSlug
      : null;
  if (!slug) return;
  if (a && a.getAttribute("data-busy") === "1") return;

  var win = window.open("about:blank", "_blank");
  if (win) win.opener = null;
  if (a) {
    a.setAttribute("data-busy", "1");
    a.classList.add("busy");
  }

  try {
    var data = await gql(DOWNLOAD_MUTATION, {
      input: { workspaceSlug: slug, objectKey: key, forceAttachment: false },
    });
    var r = data.prepareObjectDownload;
    if (r && r.success && r.downloadUrl) {
      if (win) win.location = r.downloadUrl;
      else window.open(r.downloadUrl, "_blank", "noopener");
    } else {
      console.error("SNT Orchestrator — prepareObjectDownload failed:", key, r);
      if (win) win.close();
      alert("Could not open this output file.");
    }
  } catch (err) {
    console.error("SNT Orchestrator — prepareObjectDownload error:", err);
    if (win) win.close();
    alert("Could not open this output file.");
  } finally {
    if (a) {
      a.removeAttribute("data-busy");
      a.classList.remove("busy");
    }
  }
}

/* ------------------------------------------------------------------ *
 * T2.3 — Run + poll
 *
 * Wire the sidebar's Run button to the runPipeline mutation, then poll the run
 * until it reaches a terminal status, live-updating both the node's on-canvas
 * status badge and the panel's run-status line. On completion the panel is
 * re-rendered so the run-page link and Latest outputs reflect the just-finished
 * run.
 *
 * The form-built `config` (buildConfig) is sent verbatim; required-field
 * validation happens client-side first (same path as Preview config). Runs
 * survive navigating away — polling keeps the card badge current; the run-status
 * line in the panel updates only while that node stays selected. APP.activeRun
 * tracks the in-flight run id per node so a stale poll (or a re-render) never
 * double-counts and the Run button stays disabled until the run settles.
 * ------------------------------------------------------------------ */

// Poll cadence + a safety cap so a stuck/long run can't poll forever. At 5s the
// cap is ~40 min of watching; past that we stop polling but the run keeps going
// in OpenHEXA (the line says so) and a page reload picks its status back up.
var POLL_INTERVAL_MS = 5000;
var POLL_MAX_ATTEMPTS = 480;

// queued / running / terminating are still in flight; the rest are terminal.
function isRunFinished(status) {
  return (
    status === "success" ||
    status === "failed" ||
    status === "stopped" ||
    status === "skipped"
  );
}

// The OpenHEXA run-page URL for a node's run — needs the pipeline code (carried
// on the status entry) + slug. Null when any piece is missing.
function runPageUrl(node, run) {
  var slug =
    window.OPENHEXA && window.OPENHEXA.workspaceSlug
      ? window.OPENHEXA.workspaceSlug
      : null;
  var entry =
    APP.statusByUuid && node.uuid ? APP.statusByUuid[node.uuid] : null;
  var code = entry && entry.code ? entry.code : null;
  if (!slug || !code || !run || !run.id) return null;
  return (
    appBaseUrl() +
    "/workspaces/" +
    slug +
    "/pipelines/" +
    code +
    "/runs/" +
    run.id +
    "/"
  );
}

// Fold a fresh run into APP.statusByUuid (preserving the known code) and repaint
// that node's on-canvas status badge — so the board reflects the run live,
// whether or not the panel is open.
function applyRunToNode(node, run) {
  if (!APP.statusByUuid) APP.statusByUuid = {};
  var prev = APP.statusByUuid[node.uuid] || {};
  APP.statusByUuid[node.uuid] = { code: prev.code || null, run: run };
  setNodeStatusRow(node.id, statusRowHtml("ok", run, runPageUrl(node, run)));
  // T2.4 — a fresh success makes this member its group's most-recent success
  // (and thus the chosen one). Record it durably so a later re-run doesn't drop
  // the mark, then recompute the group's chosen / running / superseded display.
  if (run && run.status === "success") {
    var d = parseRunDate(run.executionDate);
    APP.lastSuccessAt[node.id] = d ? d.getTime() : Date.now();
  }
  refreshGroupStates();
}

// A status class for the run-status line's colour.
function runStatusCls(status) {
  if (status === "success") return "rs-ok";
  if (status === "failed") return "rs-err";
  if (status === "stopped" || status === "skipped" || status === "terminating")
    return "rs-warn";
  return "rs-run"; // queued / running / starting
}

// The inner HTML of the run-status line for a run (glyph + label + view-run link).
function runStatusLineHtml(node, run) {
  var s = run.status;
  var glyph =
    s === "success"
      ? "✓"
      : s === "failed"
        ? "✕"
        : s === "stopped" || s === "skipped" || s === "terminating"
          ? "■"
          : "●";
  var labels = {
    queued: "Queued…",
    running: "Running…",
    terminating: "Stopping…",
    success: "Completed successfully",
    failed: "Run failed",
    stopped: "Run stopped",
    skipped: "Run skipped",
  };
  var label = labels[s] || s;
  var spin = s === "queued" || s === "running" ? " spin" : "";
  var url = runPageUrl(node, run);
  var link = url
    ? ' <a class="run-link" href="' +
      escapeHtml(url) +
      '" target="_blank" rel="noopener noreferrer">view run ↗</a>'
    : "";
  return (
    '<span class="rs-glyph' + spin + '">' + glyph + "</span> " +
    escapeHtml(label) +
    link
  );
}

// Show/replace the panel's run-status line — only while this node is selected.
function setRunStatusLine(nodeId, html, cls) {
  if (APP.selectedId !== nodeId) return;
  var box = document.getElementById("sb-runstatus");
  if (!box) return;
  box.hidden = false;
  box.className = "sb-runstatus" + (cls ? " " + cls : "");
  box.innerHTML = html;
}

// Enable/disable the Run button — only while this node is selected.
function setRunBtnBusy(nodeId, busy) {
  if (APP.selectedId !== nodeId) return;
  var btn = document.getElementById("sb-run");
  if (!btn) return;
  btn.disabled = busy;
  btn.classList.toggle("is-busy", busy);
}

/* Trigger a run for the selected node: validate the form, call runPipeline,
 * then poll. Guards against a double-trigger (APP.activeRun) and against running
 * outside OpenHEXA / a node with no UUID. */
async function runNode(node) {
  if (APP.activeRun[node.id]) return; // a run for this node is already in flight

  var configBox = document.getElementById("sb-config");
  var built = buildConfig(node);
  if (built.errors.length) {
    // Reuse the Preview-config error surface so the offending fields are listed.
    if (configBox) {
      configBox.hidden = false;
      configBox.className = "sb-config has-errors";
      configBox.textContent =
        "⚠ Fix these before running:\n  - " + built.errors.join("\n  - ");
    }
    setRunStatusLine(
      node.id,
      '<span class="rs-glyph">⚠</span> Fix the highlighted fields, then run again.',
      "rs-err",
    );
    return;
  }

  var slug =
    window.OPENHEXA && window.OPENHEXA.workspaceSlug
      ? window.OPENHEXA.workspaceSlug
      : null;
  if (!slug) {
    setRunStatusLine(
      node.id,
      '<span class="rs-glyph">⚠</span> Running a pipeline only works inside OpenHEXA.',
      "rs-err",
    );
    return;
  }
  if (!node.uuid) {
    setRunStatusLine(
      node.id,
      '<span class="rs-glyph">⚠</span> This pipeline isn’t available in this workspace.',
      "rs-err",
    );
    return;
  }

  APP.activeRun[node.id] = "starting";
  setRunBtnBusy(node.id, true);
  if (configBox) configBox.hidden = true;
  setRunStatusLine(
    node.id,
    '<span class="rs-glyph spin">●</span> Starting run…',
    "rs-run",
  );

  var data;
  try {
    data = await gql(RUN_MUTATION, {
      input: { id: node.uuid, config: built.config },
    });
  } catch (err) {
    console.error("SNT Orchestrator — runPipeline error:", err);
    delete APP.activeRun[node.id];
    setRunBtnBusy(node.id, false);
    setRunStatusLine(
      node.id,
      '<span class="rs-glyph">⚠</span> Couldn’t start the run: ' +
        escapeHtml(err.message || "unknown error"),
      "rs-err",
    );
    return;
  }

  var rp = data && data.runPipeline;
  if (!rp || !rp.success || !rp.run || !rp.run.id) {
    var msg =
      rp && rp.errors && rp.errors.length
        ? rp.errors.join(", ")
        : "the run was not accepted.";
    delete APP.activeRun[node.id];
    setRunBtnBusy(node.id, false);
    setRunStatusLine(
      node.id,
      '<span class="rs-glyph">⚠</span> Couldn’t start the run: ' +
        escapeHtml(msg),
      "rs-err",
    );
    return;
  }

  var run = {
    id: rp.run.id,
    status: rp.run.status || "queued",
    executionDate: null,
    duration: null,
  };
  // applyRunToNode folds the run into the status + (T2.4) recomputes the group's
  // chosen/running/superseded display — so the just-triggered member immediately
  // shows as active (normal), without taking the ✓ mark until it succeeds.
  applyRunToNode(node, run);
  setRunStatusLine(
    node.id,
    runStatusLineHtml(node, run),
    runStatusCls(run.status),
  );
  pollRun(node, run.id);
}

/* Poll one run until it finishes, live-updating the card badge + panel line. The
 * loop self-cancels if APP.activeRun[node.id] no longer points at this run (a
 * newer run started, or the run already settled), so stale ticks never write. */
function pollRun(node, runId) {
  APP.activeRun[node.id] = runId;
  var attempts = 0;

  function stop() {
    if (APP.activeRun[node.id] === runId) delete APP.activeRun[node.id];
    setRunBtnBusy(node.id, false);
  }

  function tick() {
    if (APP.activeRun[node.id] !== runId) return; // superseded / cleared
    gql(RUN_POLL_QUERY, { id: runId })
      .then(function (data) {
        if (APP.activeRun[node.id] !== runId) return;
        var pr = data && data.pipelineRun;
        if (!pr) {
          stop();
          setRunStatusLine(
            node.id,
            '<span class="rs-glyph">⚠</span> Lost track of the run — check it in OpenHEXA.',
            "rs-err",
          );
          return;
        }
        var run = {
          id: runId,
          status: pr.status,
          executionDate: pr.executionDate,
          duration: pr.duration,
        };
        applyRunToNode(node, run);
        setRunStatusLine(
          node.id,
          runStatusLineHtml(node, run),
          runStatusCls(pr.status),
        );

        if (isRunFinished(pr.status)) {
          stop();
          finishRun(node, run);
          return;
        }
        attempts++;
        if (attempts >= POLL_MAX_ATTEMPTS) {
          stop();
          setRunStatusLine(
            node.id,
            runStatusLineHtml(node, run) +
              ' <small>(stopped watching — still running in OpenHEXA)</small>',
            runStatusCls(pr.status),
          );
          return;
        }
        setTimeout(tick, POLL_INTERVAL_MS);
      })
      .catch(function (err) {
        if (APP.activeRun[node.id] !== runId) return;
        // Transient error — keep retrying up to the cap rather than giving up.
        console.warn("SNT Orchestrator — run poll error (will retry):", err);
        attempts++;
        if (attempts >= POLL_MAX_ATTEMPTS) {
          stop();
          setRunStatusLine(
            node.id,
            '<span class="rs-glyph">⚠</span> Stopped watching the run — check it in OpenHEXA.',
            "rs-err",
          );
          return;
        }
        setTimeout(tick, POLL_INTERVAL_MS);
      });
  }
  setTimeout(tick, 2500);
}

/* The run reached a terminal status. The card badge + APP.statusByUuid are
 * already current (applyRunToNode); if the user is still on this node, re-render
 * the panel so the run-page link and Latest outputs reflect the finished run,
 * then restore the completion line (the re-render resets it). */
function finishRun(node, run) {
  if (APP.selectedId === node.id) {
    renderSidebar(node);
    setRunStatusLine(
      node.id,
      runStatusLineHtml(node, run),
      runStatusCls(run.status),
    );
  }
}

/* ------------------------------------------------------------------ *
 * T2.4 — Mutual exclusion (alternative groups)
 *
 * Alternative members that share a `group` (the five A.3 outlier methods, the
 * two A.4 reporting-rate variants) are mutually exclusive. Exactly one member is
 * the *chosen* method: **the one holding the most recent successful run**. The
 * choice is therefore derived purely from run history — never from the act of
 * triggering a run. Entirely data-driven from each node's `group` (set in
 * mergeNodes); nothing about A.3/A.4 is hardcoded.
 *
 * Per-member display (refreshGroupStates):
 *   - chosen      → "✓ chosen", normal colours. The member with the latest
 *                   successful run (tracked in APP.lastSuccessAt so it survives a
 *                   re-run: a newer non-success run does NOT drop the mark).
 *   - in-flight   → normal colours, NO mark. A member whose latest run is still
 *                   queued/running/terminating is shown active like any node, but
 *                   it does not become chosen until/unless it *succeeds*.
 *   - superseded  → greyed (still clickable). Any other member, once the group
 *                   has a chosen one. (If no member has ever succeeded, all show
 *                   normal — no choice has been made yet.)
 *
 * So running a member never moves the ✓ mark; only a succeeding run does, at
 * which point that member becomes the most-recent-success and takes the mark.
 *
 * State is set on load/refresh (seedGroupSuccessFromStatus → refreshGroupStates,
 * from the live status snapshot) and kept current during a run (applyRunToNode
 * calls refreshGroupStates on every poll tick). APP.groupChoice maps group id ->
 * chosen node id (recomputed each refresh); APP.lastSuccessAt maps node id -> ms
 * of its most recent observed success. */

// Record the most recent observed success per alternative-group member from the
// live status snapshot (boot). Kept in APP.lastSuccessAt so a later re-run (whose
// in-flight/failed status would otherwise hide the prior success) doesn't drop
// the chosen mark. Only `success` runs seed it.
function seedGroupSuccessFromStatus() {
  if (!APP.statusByUuid) return; // status unavailable (outside OpenHEXA / failed)
  APP.nodes.forEach(function (n) {
    if (!(n.available && n.type === "alternative" && n.group)) return;
    var entry = APP.statusByUuid[n.uuid];
    var run = entry ? entry.run : null;
    if (run && run.status === "success") {
      var d = parseRunDate(run.executionDate);
      APP.lastSuccessAt[n.id] = d ? d.getTime() : 0;
    }
  });
}

// Recompute every alternative group's chosen / in-flight / superseded display
// from APP.lastSuccessAt (chosen = latest success) + the live run status
// (in-flight = latest run not yet finished). Cheap + no network — safe to call on
// every poll tick. Also refreshes the open sidebar's group notice in place.
function refreshGroupStates() {
  var byGroup = {};
  APP.nodes.forEach(function (n) {
    if (n.available && n.type === "alternative" && n.group) {
      (byGroup[n.group] = byGroup[n.group] || []).push(n);
    }
  });

  Object.keys(byGroup).forEach(function (gid) {
    var members = byGroup[gid];

    // Chosen = the member with the most recent observed success.
    var chosenId = null;
    var best = -Infinity;
    members.forEach(function (n) {
      var t = APP.lastSuccessAt[n.id];
      if (t != null && t > best) {
        best = t;
        chosenId = n.id;
      }
    });
    APP.groupChoice[gid] = chosenId;
    var hasChosen = chosenId != null;

    members.forEach(function (n) {
      var el = APP.nodeEls[n.id];
      if (!el) return;
      var entry = APP.statusByUuid ? APP.statusByUuid[n.uuid] : null;
      var run = entry ? entry.run : null;
      var inFlight = !!(run && run.status && !isRunFinished(run.status));
      var isChosen = n.id === chosenId;
      el.classList.toggle("is-current", isChosen);
      // Greyed only once a chosen exists, and only for members that are neither
      // the chosen nor currently running (running members show normal/active).
      el.classList.toggle("superseded", hasChosen && !isChosen && !inFlight);
    });
  });

  updateAltNoteSlot();
}

// Replace the open sidebar's group-notice line in place (no full re-render, so it
// can run on every poll tick without refetching outputs). No-op if the panel is
// closed / the slot isn't present.
function updateAltNoteSlot() {
  var slot = document.getElementById("sb-altnote-slot");
  if (!slot) return;
  var node = APP.selectedId ? APP.nodeById[APP.selectedId] : null;
  slot.innerHTML = node ? groupExclusionNoticeHtml(node) : "";
}

// A small notice for the sidebar telling the user where this node stands in its
// alternative group: the chosen method, a not-yet-chosen run in flight, or
// superseded by whichever sibling holds the latest success.
function groupExclusionNoticeHtml(node) {
  if (!node.group) return "";
  var chosenId = APP.groupChoice[node.group];
  var chosen = chosenId ? APP.nodeById[chosenId] : null;
  var entry = APP.statusByUuid ? APP.statusByUuid[node.uuid] : null;
  var run = entry ? entry.run : null;
  var inFlight = !!(run && run.status && !isRunFinished(run.status));

  if (chosenId && chosenId === node.id) {
    return (
      '<div class="sb-altnote is-current">' +
      "✓ Chosen method for this group (it holds the most recent successful run)." +
      "</div>"
    );
  }
  if (inFlight) {
    return (
      '<div class="sb-altnote running">' +
      "● Running — " +
      (chosen
        ? escapeHtml(chosen.label) +
          " stays the chosen method until this run succeeds."
        : "this becomes the chosen method if the run succeeds.") +
      "</div>"
    );
  }
  if (chosenId) {
    return (
      '<div class="sb-altnote superseded">' +
      "⊘ Superseded — " +
      escapeHtml(chosen ? chosen.label : chosenId) +
      " is the chosen method for this group (most recent successful run)." +
      "</div>"
    );
  }
  return ""; // no member has succeeded yet → no choice made
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
// Holds the loaded + merged state so later tasks can render from it.
// layout = coordinate helpers + canvas size (set by renderGrid, reused by
// renderEdges for arrow geometry); nodeEls = id -> rendered card element;
// edgesSvg = the SVG edge layer (set by renderEdges).
var APP = {
  map: null,
  cards: null,
  nodes: [],
  layout: null,
  nodeEls: {},
  edgesSvg: null,
  // T1.5 — latest run per pipeline UUID, set by loadStatuses.
  statusByUuid: null,
  // T1.6 — node lookup by id + the currently-selected node (null = none).
  nodeById: {},
  selectedId: null,
  // T2.2 — workspace connections grouped by type, set by loadConnections.
  connections: null,
  // T2.3 — in-flight runs keyed by node id (value = the run id being polled).
  // Guards against double-triggering and lets stale poll ticks self-cancel.
  activeRun: {},
  // T2.4 — mutual exclusion for alternative groups. groupChoice = group id ->
  // chosen node id (recomputed each refresh = the member with the latest
  // success). lastSuccessAt = node id -> ms of its most recent observed success
  // (durable, so a later re-run doesn't drop the chosen mark).
  groupChoice: {},
  lastSuccessAt: {},
};

async function init() {
  var wsLabel = document.getElementById("workspaceLabel");
  // window.OPENHEXA is injected by the platform at page load; absent when the
  // file is opened directly, so guard it.
  if (wsLabel && window.OPENHEXA && window.OPENHEXA.workspaceSlug) {
    wsLabel.textContent = window.OPENHEXA.workspaceSlug;
  }

  // T1.6 — sidebar starts on its empty placeholder until a node is clicked.
  renderEmptySidebar();

  try {
    var data = await loadData();
    APP.map = data.map;
    APP.cards = data.cards;
    APP.nodes = mergeNodes(data.map, data.cards);
    // T1.6 — id -> node lookup, used by the click handler / sidebar.
    APP.nodeById = {};
    APP.nodes.forEach(function (n) {
      APP.nodeById[n.id] = n;
    });
    logMergedNodes(APP.nodes, data.map, data.cards);
    renderGrid(APP.nodes);
    renderEdges(APP.nodes, data.map.edges);
    // T1.5 — the map is now on screen; stamp a loading badge on every available
    // card, then fetch real last-run status and fill them in.
    stampStatusLoading(APP.nodes);
    await loadStatuses(APP.nodes);
    // T2.4 — with live status in hand, record each alternative-group member's
    // most recent success and render the chosen / running / superseded states so
    // the choice persists across refreshes (it then stays current as runs poll).
    seedGroupSuccessFromStatus();
    refreshGroupStates();
    // T2.2 — fetch the workspace's connections so the parameter form can offer a
    // dropdown for DHIS2Connection / CustomConnection params. Best-effort: a
    // failure just leaves the form's text-slug fallback in place.
    await loadConnections();
  } catch (err) {
    console.error("SNT Orchestrator — failed to load data:", err);
  }
}

document.addEventListener("DOMContentLoaded", init);
