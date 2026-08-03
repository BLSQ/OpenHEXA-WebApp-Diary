from datetime import date, datetime
import json
from pathlib import Path
import re
from collections import Counter
from typing import cast

from openhexa.sdk import current_run, parameter, pipeline, workspace
from openhexa.sdk.client import openhexa as hexa_client

import config


@pipeline("create_pipeline_cards")
@parameter(
    "webapp_name",
    name="Name of the webapp to deploy the pipeline cards to",
    help="if empty, the webapp will not be updated. The JSON will still be saved",
    type=str,
    required=False,
    default="SNT Pipelines Orchestrator - Cockpit",
)
def create_pipeline_cards(webapp_name: str | None):
    workspace_slug = workspace.slug
    current_run.log_info(f"Workspace: {workspace_slug}")

    webapp = resolve_webapp(workspace_slug, webapp_name)
    map_node_ids = get_map_node_ids(workspace_slug, webapp)
    pipeline_cards = initialize_pipeline_cards(workspace_slug)
    pipeline_cards = get_pipelines(workspace_slug, pipeline_cards)
    pipeline_cards = format_pipelines(pipeline_cards)
    pipeline_cards = add_ids(workspace_slug, pipeline_cards)
    pipeline_cards = curate_pipelines(pipeline_cards, map_node_ids)
    pipeline_cards = add_parameters(workspace_slug, pipeline_cards)
    move_files_to_historical(Path(workspace.files_path) / config.OUTPUT_DIR)
    save_json(pipeline_cards, Path(workspace.files_path) / config.OUTPUT_DIR)
    # update_webapp(pipeline_cards, webapp)


# ---------------------------------------------------------------------------
# Webapp helpers
# ---------------------------------------------------------------------------


def update_webapp(
    pipeline_cards: dict[str, str | list[dict]],
    webapp: dict | None,
):
    """Update the webapp with the pipeline cards.

    Parameters
    ----------
    pipeline_cards : dict[str, str | list[dict]]
        The pipeline cards containing the pipelines.
    webapp : dict | None
        The resolved webapp (``id``, ``name``, ``slug``). If None, the webapp will not be updated.
    """
    if webapp is None:
        current_run.log_info("No webapp specified. Skipping webapp update.")
        return

    update_webapp_with_id(webapp["id"], webapp["name"], pipeline_cards)


def update_webapp_with_id(
    webapp_id: str,
    webapp_name: str,
    pipeline_cards: dict[str, str | list[dict]],
):
    """Update the webapp with the pipeline cards.

    Parameters
    ----------
    webapp_id : str
        The UUID of the webapp to deploy the pipeline cards to.
    webapp_name : str
        The name of the webapp to deploy the pipeline cards to.
    pipeline_cards : dict[str, str | list[dict]]
        The pipeline cards containing the pipelines.
    """
    response = _gql(
        config.MUTATION_UPDATE_WEBAPP,
        variables={
            "input": {
                "id": webapp_id,
                "files": [
                    {
                        "path": config.WEBAPP_CARDS_PATH,
                        "content": json.dumps(pipeline_cards, indent=4),
                        "encoding": "TEXT",
                    }
                ],
            }
        },
    ).get("updateWebapp")

    if not response.get("success"):
        errors = response.get("errors", [])
        if "PERMISSION_DENIED" in errors:
            current_run.log_error(
                f"Permission denied when updating webapp '{webapp_name}'. "
                "The pipeline token does not have write access to this webapp. "
                "Please ensure the pipeline user has Editor (or Admin) permissions "
                "on the workspace, or update the webapp manually using the JSON "
                f"saved to {config.OUTPUT_DIR}."
            )
        else:
            current_run.log_error(f"Failed to update webapp '{webapp_name}': {errors}")
        return

    current_run.log_info(
        f"Webapp {webapp_name} updated with {config.WEBAPP_CARDS_PATH}."
    )


def resolve_webapp(workspace_slug: str, webapp_name: str | None) -> dict | None:
    """Resolve the webapp matching the given name.

    Parameters
    ----------
    workspace_slug : str
        The workspace slug.
    webapp_name : str | None
        The name of the webapp to resolve. If empty, no webapp is resolved.

    Returns
    -------
    dict | None
        The matching webapp (``id``, ``name``, ``slug``), or None if no name was given.
    """
    if not webapp_name:
        return None

    webapps = []
    pages = (
        _gql(config.QUERY_WEBAPPS, variables={"workspaceSlug": workspace_slug})
        .get("webapps")
        .get("totalPages")
    )
    for page in range(1, pages + 1):
        items = (
            _gql(
                config.QUERY_WEBAPPS,
                variables={"workspaceSlug": workspace_slug, "page": page},
            )
            .get("webapps")
            .get("items")
        )
        webapps.extend(items)

    matches = [webapp for webapp in webapps if webapp["name"] == webapp_name]
    if len(matches) == 0:
        raise ValueError(
            f"No webapp named '{webapp_name}' found in workspace {workspace_slug}"
        )
    if len(matches) > 1:
        raise ValueError(
            f"Multiple webapps named '{webapp_name}' found in workspace {workspace_slug}"
        )

    current_run.log_info(f"Webapp {webapp_name} found")
    return matches[0]


def get_map_node_ids(workspace_slug: str, webapp: dict | None) -> set[str] | None:
    """Read the node ids of the webapp's deployed ``pipeline_map.json``.

    Parameters
    ----------
    workspace_slug : str
        The workspace slug.
    webapp : dict | None
        The resolved webapp (``id``, ``name``, ``slug``), or None if no webapp was given.

    Returns
    -------
    set[str] | None
        The map's node ids, or None if the map could not be read (curation is then skipped).
    """
    if webapp is None:
        current_run.log_warning(
            "No webapp specified, so the deployed pipeline map cannot be read: "
            "all workspace pipelines will be included without curation"
        )
        return None

    response = _gql(
        config.QUERY_WEBAPP_FILE,
        variables={
            "workspaceSlug": workspace_slug,
            "webappSlug": webapp["slug"],
            "path": config.WEBAPP_MAP_PATH,
        },
    ).get("readWebappFile")

    errors = response.get("errors")
    content = response.get("content")
    if errors or not content:
        raise ValueError(
            f"Failed to read {config.WEBAPP_MAP_PATH} from webapp {webapp['name']}: "
            f"{errors or 'empty content'}"
        )

    node_ids = {node["id"] for node in json.loads(content).get("nodes", [])}
    if not node_ids:
        raise ValueError(
            f"{config.WEBAPP_MAP_PATH} in webapp {webapp['name']} declares no nodes"
        )

    current_run.log_info(
        f"{len(node_ids)} nodes read from {config.WEBAPP_MAP_PATH} in webapp {webapp['name']}"
    )
    return node_ids


# ---------------------------------------------------------------------------
# Pipeline listing & enrichment
# ---------------------------------------------------------------------------


def get_pipelines(
    workspace_slug: str, pipeline_cards: dict[str, str | list[dict]]
) -> dict[str, str | list[dict]]:
    """Get the pipelines from the workspace.

    Parameters
    ----------
    workspace_slug : str
        The workspace slug.
    pipeline_cards : dict[str, str | list[dict]]
        The pipeline cards containing the pipelines.

    Returns
    -------
    dict[str, str | list[dict]]
        The pipeline cards with the pipelines for the given workspace.
    """
    response = hexa_client.pipelines(
        workspace_slug=workspace_slug, page=1, per_page=config.PIPELINES_PER_PAGE
    )
    for p in response.items:
        pipeline_cards["pipelines"].append({"id": p.id, "name": p.name, "code": p.code})

    for page in range(2, response.total_pages + 1):
        page_response = hexa_client.pipelines(
            workspace_slug=workspace_slug, page=page, per_page=config.PIPELINES_PER_PAGE
        )
        for p in page_response.items:
            pipeline_cards["pipelines"].append(
                {"id": p.id, "name": p.name, "code": p.code}
            )

    current_run.log_info(f"{len(pipeline_cards['pipelines'])} pipelines found live")
    return pipeline_cards


def format_pipelines(
    pipeline_cards: dict[str, str | list[dict]],
) -> dict[str, str | list[dict]]:
    """Format the pipelines to the output that the WebApp expects.

    Parameters
    ----------
    pipeline_cards : dict[str, str | list[dict]]
        The pipeline cards containing the pipelines.

    Returns
    -------
    dict[str, str | list[dict]]
        The pipeline cards with formatted pipelines.
    """
    formatted_pipelines = []
    raw_pipelines = cast(list[dict], pipeline_cards["pipelines"])
    for one_pipeline in raw_pipelines:
        formatted_pipeline = {
            "id": None,
            "name": one_pipeline["name"],
            "uuid": one_pipeline["id"],
            "openhexa_code": one_pipeline["code"],
            "parameters_source": config.PARAMETERS_SOURCE,
        }
        formatted_pipelines.append(formatted_pipeline)
    pipeline_cards["pipelines"] = formatted_pipelines
    return pipeline_cards


def add_ids(
    workspace_slug: str, pipeline_cards: dict[str, str | list[dict]]
) -> dict[str, str | list[dict]]:
    """Add the ``@pipeline("...")`` id to each pipeline, when it can be determined.

    Parameters
    ----------
    workspace_slug : str
        The workspace slug.
    pipeline_cards : dict[str, str | list[dict]]
        The pipeline cards containing the pipelines.

    Returns
    -------
    dict[str, str | list[dict]]
        The pipeline cards with pipelines including their id when resolvable.
    """
    for one_pipeline in pipeline_cards["pipelines"]:
        pipeline_code = one_pipeline["openhexa_code"]
        current_version = get_current_version(workspace_slug, pipeline_code)
        if current_version is None:
            continue

        source_code = extract_pipeline_code(current_version.get("files"), pipeline_code)
        if source_code is not None:
            one_pipeline["id"] = extract_function_name(source_code, pipeline_code)

    return pipeline_cards


def add_parameters(
    workspace_slug: str, pipeline_cards: dict[str, str | list[dict]]
) -> dict[str, str | list[dict]]:
    """Add parameters to the pipelines.

    Parameters
    ----------
    workspace_slug : str
        The workspace slug.
    pipeline_cards : dict[str, str | list[dict]]
        The pipeline cards containing the pipelines.

    Returns
    -------
    dict[str, str | list[dict]]
        The pipeline cards with pipelines including parameters.
    """
    for one_pipeline in pipeline_cards["pipelines"]:
        pipeline_code = one_pipeline["openhexa_code"]
        current_version = get_current_version(workspace_slug, pipeline_code)
        parameters = (current_version or {}).get("parameters") or []
        one_pipeline["parameters"] = format_parameters(parameters)

        current_run.log_info(f"Parameters added to {pipeline_code}")

    return pipeline_cards


def get_current_version(workspace_slug: str, pipeline_code: str) -> dict | None:
    """Get the current version of a pipeline.

    Parameters
    ----------
    workspace_slug : str
        The workspace slug.
    pipeline_code : str
        The pipeline's OpenHEXA code.

    Returns
    -------
    dict | None
        The pipeline's current version, or None if it has none (e.g. a pipeline that
        has never been deployed).
    """
    return (
        _gql(
            config.QUERY_PARAMS,
            variables={
                "workspaceSlug": workspace_slug,
                "pipelineCode": pipeline_code,
            },
        ).get("pipelineByCode")
        or {}
    ).get("currentVersion")


def extract_pipeline_code(files: list[dict] | None, pipeline_code: str) -> str | None:
    """Extract the pipeline's Python source code from its deployed files.

    Parameters
    ----------
    files : list[dict] | None
        The files of the pipeline's current version, each with ``name`` and ``content``.
        None for pipelines with no file listing (e.g. notebook-based ones).
    pipeline_code : str
        The pipeline's OpenHEXA code, used for logging only.

    Returns
    -------
    str | None
        The Python source code, or None if it could not be determined.
    """
    return next(
        (
            one_file.get("content")
            for one_file in files or []
            if one_file.get("name") == config.PIPELINE_SOURCE_FILE
        ),
        None,
    )


def extract_function_name(source: str, pipeline_code: str) -> str | None:
    """Extract the pipeline's Python function name from its deployed source.

    The function name is the ``@pipeline("...")`` argument.

    Parameters
    ----------
    source : str
        The Python source code of the pipeline.
    pipeline_code : str
        The pipeline's OpenHEXA code, used for logging only.

    Returns
    -------
    str | None
        The Python function name, or None if it could not be determined.
    """
    match = re.search(config.PIPELINE_DECORATOR_PATTERN, source)
    if not match:
        current_run.log_warning(
            f"No @pipeline decorator found in {config.PIPELINE_SOURCE_FILE} for "
            f"{pipeline_code}: cannot determine the pipeline id"
        )
        return None

    return match.group(1)


def format_parameters(parameters: list[dict]) -> list[dict]:
    """Format the parameters to the output that the WebApp expects.

    Parameters
    ----------
    parameters : list[dict]
        A list of parameters.

    Returns
    -------
    list[dict]
        A list of formatted parameters.
    """
    formatted_parameters = []
    for one_parameter in parameters:
        formatted_parameter = {
            "key": one_parameter["code"],
            "label": one_parameter["name"],
            **{
                other_key: one_parameter[other_key]
                for other_key in one_parameter
                if other_key not in ["code", "name"]
                and one_parameter[other_key] is not None
            },
        }
        if "type" in formatted_parameter:
            formatted_parameter["type"] = config.PARAMETER_TYPE_MAP.get(
                formatted_parameter["type"], formatted_parameter["type"]
            )

        formatted_parameters.append(formatted_parameter)
    return formatted_parameters


def _gql(query: str, variables: dict | None = None) -> dict:
    """Execute a GraphQL query via the SDK client and return the data dict.

    Parameters
    ----------
    query : str
        The GraphQL query or mutation string.
    variables : dict | None
        Optional variables for the query.

    Returns
    -------
    dict
        The ``data`` portion of the GraphQL response.
    """
    response = hexa_client.execute(query=query, variables=variables or {})
    return response.json()["data"]


# ---------------------------------------------------------------------------
# Curation & output
# ---------------------------------------------------------------------------


def curate_pipelines(
    pipeline_cards: dict[str, str | list[dict]], map_node_ids: set[str] | None
) -> dict[str, str | list[dict]]:
    """Keep only the pipelines that are nodes of the deployed pipeline map.

    Parameters
    ----------
    pipeline_cards : dict[str, str | list[dict]]
        The pipeline cards containing the pipelines.
    map_node_ids : set[str] | None
        The node ids of the deployed map. If None, curation is skipped.

    Returns
    -------
    dict[str, str | list[dict]]
        The pipeline cards with only the curated pipelines.
    """
    if map_node_ids is None:
        return pipeline_cards

    pipelines = cast(list[dict], pipeline_cards["pipelines"])

    id_counts = Counter(p["id"] for p in pipelines if p["id"] is not None)
    duplicated_ids = {pid for pid, count in id_counts.items() if count > 1}
    if duplicated_ids:
        for dup_id in sorted(duplicated_ids):
            dup_codes = [p["openhexa_code"] for p in pipelines if p["id"] == dup_id]
            current_run.log_warning(
                f"Duplicate @pipeline id '{dup_id}' found in {len(dup_codes)} "
                f"workspace pipelines: {', '.join(dup_codes)}. "
                "Consider removing or renaming the deprecated ones."
            )

    kept = [one for one in pipelines if one["id"] in map_node_ids]
    dropped = [one for one in pipelines if one["id"] not in map_node_ids]

    for one_pipeline in dropped:
        if one_pipeline["id"] is None:
            current_run.log_warning(
                f"Excluded '{one_pipeline['openhexa_code']}': its pipeline id could not be "
                "determined, so it cannot be matched against the map"
            )
        else:
            current_run.log_info(
                f"Excluded '{one_pipeline['openhexa_code']}' (id: {one_pipeline['id']}): "
                f"not a node of {config.WEBAPP_MAP_PATH}"
            )

    missing = sorted(map_node_ids - {one["id"] for one in kept})
    for node_id in missing:
        current_run.log_info(
            f"Map node '{node_id}' has no pipeline in this workspace: "
            "it will render greyed-out"
        )

    current_run.log_info(
        f"{len(kept)} pipelines included, {len(dropped)} excluded, "
        f"{len(missing)} map node(s) unavailable"
    )
    if len(kept) != config.EXPECTED_NUM_PIPELINES:
        current_run.log_warning(
            f"Expected {config.EXPECTED_NUM_PIPELINES} pipelines, but curated {len(kept)}"
        )

    pipeline_cards["pipelines"] = kept
    return pipeline_cards


def initialize_pipeline_cards(workspace_slug: str) -> dict[str, str | list[dict]]:
    """Initialize the pipeline cards.

    Parameters
    ----------
    workspace_slug : str
        The workspace slug.

    Returns
    -------
    dict[str, str | list[dict]]
        The initialized pipeline cards.
    """
    return {
        "workspace_slug": workspace_slug,
        "generated_at": date.today().isoformat(),
        "_notes": config.NOTES,
        "pipelines": [],
    }


def move_files_to_historical(dir_path: Path) -> None:
    """Moves all of the files in the given path to a ``historical/`` subfolder, appending
    a timestamp to avoid collisions (e.g. report.pdf → historical/report_20250126_110000.pdf).

    Parameters
    ----------
    dir_path : Path
        The directory whose files should be archived. Does nothing if it does not exist.
    """
    if not dir_path.is_dir():
        return

    historical_dir = dir_path / "historical"
    files = [p for p in dir_path.iterdir() if p.is_file()]
    if not files:
        return

    historical_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    for file_path in files:
        dest = historical_dir / f"{file_path.stem}_{ts}{file_path.suffix}"
        file_path.rename(dest)
        current_run.log_info(f"Moved {file_path.name} to {historical_dir}.")


def save_json(pipeline_cards: dict[str, str | list[dict]], output_dir: Path):
    """Save the pipeline cards to a JSON file with a standard name, archiving any
    previous version into a ``historical/`` subfolder.

    Parameters
    ----------
    pipeline_cards : dict[str, str | list[dict]]
        The pipeline cards containing the pipelines.
    output_dir : Path
        The directory to save the JSON file in. Created if it does not exist.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    file_path = output_dir / config.WEBAPP_CARDS_PATH
    with open(file_path, "w") as f:
        json.dump(pipeline_cards, f, indent=4)
    current_run.log_info(f"Dictionary saved successfully at {file_path}.")


if __name__ == "__main__":
    create_pipeline_cards()
