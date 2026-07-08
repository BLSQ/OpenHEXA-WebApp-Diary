function optInt(id) {
  var v = document.getElementById(id).value;
  return v === "" ? null : parseInt(v, 10);
}

function optFloat(id) {
  var v = document.getElementById(id).value;
  return v === "" ? null : parseFloat(v);
}

function optStr(id) {
  var v = document.getElementById(id).value.trim();
  return v === "" ? null : v;
}

var PIPELINE_CONFIG = {
  pt: {
    id: "e6b6cdac-a1e2-4dce-a748-5f534134f2dc",
    getConfig: function () {
      var config = {};
      var tot_pop_reference = optInt("pt_tot_pop_reference");
      if (tot_pop_reference !== null) config.tot_pop_reference = tot_pop_reference;
      var tot_pop_reference_year = optInt("pt_tot_pop_reference_year");
      if (tot_pop_reference_year !== null) config.tot_pop_reference_year = tot_pop_reference_year;
      var pop_under_5 = optFloat("pt_pop_under_5");
      if (pop_under_5 !== null) config.pop_under_5 = pop_under_5;
      var pop_pregnant_women = optFloat("pt_pop_pregnant_women");
      if (pop_pregnant_women !== null) config.pop_pregnant_women = pop_pregnant_women;
      var pop_0_1_y = optFloat("pt_pop_0_1_y");
      if (pop_0_1_y !== null) config.pop_0_1_y = pop_0_1_y;
      var pop_1_2_y = optFloat("pt_pop_1_2_y");
      if (pop_1_2_y !== null) config.pop_1_2_y = pop_1_2_y;
      var pop_5_10_y = optFloat("pt_pop_5_10_y");
      if (pop_5_10_y !== null) config.pop_5_10_y = pop_5_10_y;
      var pop_5_36_m = optFloat("pt_pop_5_36_m");
      if (pop_5_36_m !== null) config.pop_5_36_m = pop_5_36_m;
      var disaggregation_file = optStr("pt_disaggregation_file");
      if (disaggregation_file !== null) config.disaggregation_file = disaggregation_file;
      config.growth_factor = parseFloat(document.getElementById("pt_growth_factor").value);
      config.growth_reference_year = parseInt(document.getElementById("pt_year_reference").value, 10);
      config.run_report_only = document.getElementById("pt_run_report_only").checked;
      config.pull_scripts = document.getElementById("pt_pull_scripts").checked;
      return config;
    },
    validate: function () {
      var gf = document.getElementById("pt_growth_factor").value;
      if (gf === "" || isNaN(parseFloat(gf)))
        return "Projection growth rate is required.";
      var yr = document.getElementById("pt_year_reference").value;
      if (yr === "" || isNaN(parseInt(yr, 10)))
        return "Projection reference year is required.";
      return null;
    },
  },
};

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

function setStatus(prefix, state, text, duration) {
  var box = document.getElementById(prefix + "_statusBox");
  var icon = document.getElementById(prefix + "_statusIcon");
  var textEl = document.getElementById(prefix + "_statusText");
  var durEl = document.getElementById(prefix + "_statusDuration");
  box.className = "status " + state;
  textEl.textContent = text;
  durEl.textContent = duration || "";
  if (state === "running") {
    icon.innerHTML = '<div class="spinner"></div>';
  } else if (state === "success") {
    icon.textContent = "✓";
  } else if (state === "failed") {
    icon.textContent = "✕";
  } else {
    icon.textContent = "⦸";
  }
}

function fmtDuration(seconds) {
  if (!seconds) return "";
  if (seconds < 60) return seconds + "s";
  return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
}

function hideOutputs(prefix) {
  document.getElementById(prefix + "_outputsSection").style.display = "none";
  document.getElementById(prefix + "_outputsList").innerHTML = "";
}

async function showOutputs(prefix, run) {
  var links = [];
  var workspaceSlug = window.OPENHEXA.workspaceSlug;

  var outputs = run.outputs || [];
  for (var i = 0; i < outputs.length; i++) {
    var output = outputs[i];
    if (
      output.__typename === "BucketObject" &&
      output.name &&
      output.name.slice(-5) === ".html"
    ) {
      try {
        var dlData = await gql(
          "mutation($input: PrepareObjectDownloadInput!) { prepareObjectDownload(input: $input) { success downloadUrl } }",
          {
            input: {
              workspaceSlug: workspaceSlug,
              objectKey: output.key,
              forceAttachment: false,
            },
          },
        );
        if (
          dlData.prepareObjectDownload.success &&
          dlData.prepareObjectDownload.downloadUrl
        ) {
          links.push({
            icon: "📄",
            label: "HTML Report",
            url: dlData.prepareObjectDownload.downloadUrl,
          });
        }
      } catch (e) {
        /* skip on error */
      }
    }
  }

  var versions = run.datasetVersions || [];
  var parts = window.location.hostname.split(".");
  var appBase = "https://app." + parts.slice(1).join(".");
  for (var j = 0; j < versions.length; j++) {
    var v = versions[j];
    var url =
      appBase +
      "/workspaces/" +
      workspaceSlug +
      "/datasets/" +
      v.dataset.slug +
      "/";
    links.push({ icon: "🗂", label: v.dataset.name, url: url });
  }

  if (links.length === 0) return;

  var list = document.getElementById(prefix + "_outputsList");
  list.innerHTML = links
    .map(function (l) {
      return (
        '<a class="output-link" href="' +
        l.url +
        '" target="_blank" rel="noopener noreferrer">' +
        '<span class="output-icon">' +
        l.icon +
        "</span>" +
        '<span class="output-label">' +
        l.label +
        "</span>" +
        '<span class="arrow">&#8599;</span>' +
        "</a>"
      );
    })
    .join("");
  document.getElementById(prefix + "_outputsSection").style.display =
    "block";
}

async function runPipeline(prefix) {
  var pipeline = PIPELINE_CONFIG[prefix];
  var btn = document.getElementById(prefix + "_runBtn");

  var validationError = pipeline.validate();
  if (validationError) {
    setStatus(prefix, "failed", validationError);
    return;
  }

  var config = pipeline.getConfig();
  btn.disabled = true;
  hideOutputs(prefix);
  setStatus(prefix, "running", "Starting pipeline…");

  try {
    var startData = await gql(
      "mutation($input: RunPipelineInput!) { runPipeline(input: $input) { success errors run { id status } } }",
      {
        input: {
          id: pipeline.id,
          config: config,
        },
      },
    );
    var result = startData.runPipeline;

    if (!result.success) {
      setStatus(
        prefix,
        "failed",
        "Failed to start: " + result.errors.join(", "),
      );
      btn.disabled = false;
      return;
    }

    var runId = result.run.id;
    var startTime = Date.now();
    setStatus(prefix, "running", "Pipeline is running…");

    var finalRun = null;
    while (true) {
      await new Promise(function (r) {
        setTimeout(r, 3000);
      });
      var pollData = await gql(
        "query($id: UUID!) { pipelineRun(id: $id) { status duration outputs { __typename ... on BucketObject { key name } ... on GenericOutput { uri } } datasetVersions { id dataset { slug name } } } }",
        { id: runId },
      );
      var run = pollData.pipelineRun;
      var elapsed = Math.round((Date.now() - startTime) / 1000);

      if (run.status === "success") {
        setStatus(
          prefix,
          "success",
          "Pipeline completed successfully.",
          fmtDuration(run.duration || elapsed),
        );
        finalRun = run;
        break;
      } else if (run.status === "failed") {
        setStatus(
          prefix,
          "failed",
          "Pipeline failed.",
          fmtDuration(run.duration || elapsed),
        );
        break;
      } else if (
        run.status === "stopped" ||
        run.status === "terminating"
      ) {
        setStatus(
          prefix,
          "stopped",
          "Pipeline was stopped.",
          fmtDuration(run.duration || elapsed),
        );
        break;
      } else {
        setStatus(
          prefix,
          "running",
          run.status === "queued"
            ? "Queued, waiting to start…"
            : "Pipeline is running…",
          elapsed + "s elapsed",
        );
      }
    }

    if (finalRun) {
      await showOutputs(prefix, finalRun);
    }
  } catch (err) {
    setStatus(prefix, "failed", "Error: " + err.message);
  }

  btn.disabled = false;
}
