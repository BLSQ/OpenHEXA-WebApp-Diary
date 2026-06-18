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
};

async function init() {
  var wsLabel = document.getElementById("workspaceLabel");
  // window.OPENHEXA is injected by the platform at page load; absent when the
  // file is opened directly, so guard it.
  if (wsLabel && window.OPENHEXA && window.OPENHEXA.workspaceSlug) {
    wsLabel.textContent = window.OPENHEXA.workspaceSlug;
  }

  try {
    var data = await loadData();
    APP.map = data.map;
    APP.cards = data.cards;
    APP.nodes = mergeNodes(data.map, data.cards);
    logMergedNodes(APP.nodes, data.map, data.cards);
    renderGrid(APP.nodes);
    renderEdges(APP.nodes, data.map.edges);
    // T1.5 — the map is now on screen; stamp a loading badge on every available
    // card, then fetch real last-run status and fill them in.
    stampStatusLoading(APP.nodes);
    await loadStatuses(APP.nodes);
  } catch (err) {
    console.error("SNT Orchestrator — failed to load data:", err);
  }
}

document.addEventListener("DOMContentLoaded", init);
