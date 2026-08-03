QUERY_PARAMS = """
    query getPipeline($workspaceSlug:String!, $pipelineCode:String!){
        pipelineByCode(workspaceSlug: $workspaceSlug, code: $pipelineCode) {
            currentVersion {
                parameters {
                    code
                    name
                    type
                    help
                    default
                    required
                    multiple
                    choices
                }
                files {
                    name
                    content
                }
            }
        }
    }
"""
PIPELINE_SOURCE_FILE = "pipeline.py"
PIPELINE_DECORATOR_PATTERN = r"""@pipeline\(\s*["']([^"']+)["']"""
PARAMETER_TYPE_MAP = {
    "dhis2": "DHIS2Connection",
    "custom": "CustomConnection",
    "iaso": "IASOConnection",
    "postgresql": "PostgreSQLConnection",
    "gcs": "GCSConnection",
    "s3": "S3Connection",
    "file": "File",
}
WEBAPP_MAP_PATH = "pipeline_map.json"
QUERY_WEBAPP_FILE = """
    query readWebappFile($workspaceSlug: String!, $webappSlug: String!, $path: String!) {
        readWebappFile(workspaceSlug: $workspaceSlug, webappSlug: $webappSlug, path: $path) {
            content
            errors
        }
    }
"""
NOTES = "Catalog for the SNT App Dev workspace (18 pipelines). All of the IDs are workspace-specific. "
PARAMETERS_SOURCE = "openhexa_deployed"
EXPECTED_NUM_PIPELINES = 18
PIPELINES_PER_PAGE = 50
OUTPUT_DIR = "pipelines/create_pipeline_cards/pipeline_cards"
WEBAPP_CARDS_PATH = "pipeline_cards.json"
QUERY_WEBAPPS = """
    query listWebapps($workspaceSlug: String!, $page: Int, $perPage: Int) {
        webapps(workspaceSlug: $workspaceSlug, page: $page, perPage: $perPage) {
            totalPages
            items {
                id
                name
                slug
            }
        }
    }
"""
MUTATION_UPDATE_WEBAPP = """
    mutation updateWebapp($input: UpdateWebappInput!) {
        updateWebapp(input: $input) {
            success
            errors
        }
    }
"""
