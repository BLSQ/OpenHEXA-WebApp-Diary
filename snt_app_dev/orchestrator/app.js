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
    div.className = "node track-" + n.track;
    div.dataset.id = n.id;
    div.style.left = layout.nx(n) + "px";
    div.style.top = layout.ny(n) + "px";
    div.style.width = LAYOUT.NODE_W + "px";
    div.style.minHeight = LAYOUT.NODE_H + "px";
    div.title =
      (n.description || "") + "\n\n[" + n.type + "]  id: " + n.id;

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
 * Boot
 * ------------------------------------------------------------------ */
// Holds the loaded + merged state so later tasks can render from it.
// layout = coordinate helpers + canvas size (set by renderGrid, reused by T1.3
// for arrows); nodeEls = id -> rendered card element.
var APP = { map: null, cards: null, nodes: [], layout: null, nodeEls: {} };

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
  } catch (err) {
    console.error("SNT Orchestrator — failed to load data:", err);
  }
}

document.addEventListener("DOMContentLoaded", init);
