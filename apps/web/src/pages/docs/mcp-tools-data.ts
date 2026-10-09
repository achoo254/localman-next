/**
 * Tools of the `mock` toolset that Localman MCP serves over OAuth, in
 * registry order, for the "MCP tools" docs page. Copied from the operation
 * registry (`pnpm check:mcp-coverage --markdown`); `pnpm test` fails
 * (`scripts/check-mcp-docs`) when an operation is added, removed or
 * changes its scopes or confirmation without this list following.
 * No imports: the check loads this file outside the web build.
 */

/** `none`: plain call; `optional`: accepts `dry_run`; `required`: `dry_run` then `confirm_token`. */
export type ToolConfirmation = "none" | "optional" | "required";

export interface McpToolDoc {
	/** MCP tool name. */
	readonly tool: string;
	/** Operation id without the `mock.` toolset prefix. */
	readonly operation: string;
	readonly scopes: readonly string[];
	readonly confirmation: ToolConfirmation;
}

const READ = ["mock:read"] as const;
const WRITE = ["mock:write"] as const;
const CREDENTIALS = ["mock:write", "credentials:write"] as const;

export const MOCK_TOOLSET_TOOLS = [
	{
		tool: "list_projects",
		operation: "listProjects",
		scopes: READ,
		confirmation: "none",
	},
	{
		tool: "get_project",
		operation: "getProject",
		scopes: READ,
		confirmation: "none",
	},
	{
		tool: "create_project",
		operation: "createProject",
		scopes: WRITE,
		confirmation: "none",
	},
	{
		tool: "update_project",
		operation: "updateProject",
		scopes: WRITE,
		confirmation: "none",
	},
	{
		tool: "delete_project",
		operation: "deleteProject",
		scopes: WRITE,
		confirmation: "required",
	},
	{
		tool: "clone_project",
		operation: "cloneProject",
		scopes: WRITE,
		confirmation: "none",
	},
	{
		tool: "rotate_project_secret",
		operation: "rotateProjectSecret",
		scopes: WRITE,
		confirmation: "required",
	},
	{
		tool: "get_mcp_token_settings",
		operation: "getMcpTokenSettings",
		scopes: READ,
		confirmation: "none",
	},
	{
		tool: "set_mcp_token_required",
		operation: "setMcpTokenRequired",
		scopes: CREDENTIALS,
		confirmation: "none",
	},
	{
		tool: "rotate_mcp_token",
		operation: "rotateMcpToken",
		scopes: CREDENTIALS,
		confirmation: "required",
	},
	{
		tool: "list_resources",
		operation: "listResources",
		scopes: READ,
		confirmation: "none",
	},
	{
		tool: "create_resource",
		operation: "createResource",
		scopes: WRITE,
		confirmation: "none",
	},
	{
		tool: "get_resource",
		operation: "getResource",
		scopes: READ,
		confirmation: "none",
	},
	{
		tool: "update_resource",
		operation: "updateResource",
		scopes: WRITE,
		confirmation: "none",
	},
	{
		tool: "create_resource_from_schema",
		operation: "createResourceFromSchema",
		scopes: WRITE,
		confirmation: "none",
	},
	{
		tool: "delete_resource",
		operation: "deleteResource",
		scopes: WRITE,
		confirmation: "required",
	},
	{
		tool: "move_resource",
		operation: "moveResource",
		scopes: WRITE,
		confirmation: "optional",
	},
	{
		tool: "list_faker_methods",
		operation: "listFakerMethods",
		scopes: READ,
		confirmation: "none",
	},
	{
		tool: "generate_resource_data",
		operation: "generateResourceData",
		scopes: WRITE,
		confirmation: "optional",
	},
	{
		tool: "generate_all_resource_data",
		operation: "generateAllResourceData",
		scopes: WRITE,
		confirmation: "required",
	},
	{
		tool: "reset_all_resource_data",
		operation: "resetAllResourceData",
		scopes: WRITE,
		confirmation: "required",
	},
	{
		tool: "get_resource_data",
		operation: "getResourceData",
		scopes: READ,
		confirmation: "none",
	},
	{
		tool: "replace_resource_data",
		operation: "replaceResourceData",
		scopes: WRITE,
		confirmation: "optional",
	},
	{
		tool: "get_mock_urls",
		operation: "getMockUrls",
		scopes: READ,
		confirmation: "none",
	},
] as const satisfies readonly McpToolDoc[];

/** Operation keys of the listed tools (keys of their translated summaries). */
export type MockToolOperation =
	(typeof MOCK_TOOLSET_TOOLS)[number]["operation"];
