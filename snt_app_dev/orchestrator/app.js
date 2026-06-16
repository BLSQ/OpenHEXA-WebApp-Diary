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
 * Boot
 * ------------------------------------------------------------------ */
// Holds the loaded + merged state so later tasks (T1.2+) can render from it.
var APP = { map: null, cards: null, nodes: [] };

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
  } catch (err) {
    console.error("SNT Orchestrator — failed to load data:", err);
  }
}

document.addEventListener("DOMContentLoaded", init);
