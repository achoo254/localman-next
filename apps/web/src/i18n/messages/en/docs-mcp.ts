/**
 * Docs: the MCP tools page. `toolSummaries` is keyed by the operation id
 * (`mock.<key>`) and holds the registry's own summaries;
 * `scripts/check-mcp-docs` fails when they drift apart.
 */
export const docsMcp = {
	lead: "Give AI coding agents access to your mocks over MCP (Model Context Protocol). Each project serves its own Hosted Mock MCP for its data; Localman MCP manages your projects and resources.",
	hosted: {
		title: "Hosted Mock MCP",
		url: "Every project has an MCP endpoint at <code>{url}</code>, the mock URL plus <code>/mcp</code>, over Streamable HTTP. The MCP tab on the project page shows the exact URL and ready-made config for Claude Code, Cursor and other clients.",
		caption: "Hosted Mock MCP URL of a project",
		tools:
			"Tools are generated from your resources: <code>list_</code>, <code>get_</code>, <code>create_</code>, <code>update_</code> and <code>delete_</code> followed by the resource name, for every resource including nested ones, and only for endpoints that are on. They work on the same data as REST, so a record created over MCP shows up in REST right away. Nested resources take a <code>parentId</code>; <code>list_</code> takes the same query parameters as REST and returns <code>{listShape}</code>.",
		resources:
			"Two MCP resources describe the mock: <code>mock://schema</code> (the resource tree, nested routes, schemas, endpoints and the tools of each resource) and <code>mock://openapi</code> (OpenAPI 3.1 of the endpoints that are on).",
		token:
			"Like REST, the endpoint is open to anyone with the URL. The project owner can require a token for MCP in the MCP tab: calls then need <code>Authorization: Bearer lmmcp_…</code>, and a missing or wrong token gets 401. The token is shown only once, when it's created.",
		limits:
			"Each tool call counts as 1 request toward the project owner's monthly mock quota and goes through the same rate limits as REST; over a limit, the tool returns the error <code>RATE_LIMITED</code> or <code>MONTHLY_QUOTA_EXCEEDED</code>. Custom responses don't apply to MCP results.",
		limitsFree:
			"Each tool call counts as 1 request toward the project owner's monthly mock quota ({requests} requests per month by default) and goes through the same rate limits as REST; over a limit, the tool returns the error <code>RATE_LIMITED</code> or <code>MONTHLY_QUOTA_EXCEEDED</code>. Custom responses don't apply to MCP results.",
	},
	localman: {
		title: "Localman MCP",
		intro:
			"Localman MCP at <code>{url}</code> lets an agent manage your projects and resources: create projects, add resources from a TypeScript, OpenAPI or JSON Schema type, generate data and read the mock URLs. It acts as you, with the same permissions and limits as the web app.",
		signIn:
			"Agents sign in with OAuth through your hoandat account at <code>{idp}</code>: the client registers itself and opens the browser for you to approve access. <code>mock:read</code> lets it read projects, resources, data and mock URLs (secrets included); <code>mock:write</code> lets it change them. Tools that create a credential also ask for <code>credentials:write</code>.",
		claudeAfter:
			"Then run <code>/mcp</code> in Claude Code and pick <code>localman</code> to sign in.",
		cursorAfter: "Cursor opens the sign-in page the first time it connects.",
		limits:
			"Requests are rate limited per account; over the limit you get 429 with a <code>Retry-After</code> header.",
	},
	tools: {
		title: "Tools of Localman MCP",
		intro:
			"Localman MCP serves the <code>mock</code> toolset, the one OAuth grants. Read-only tools need <code>mock:read</code>, the others <code>mock:write</code>.",
		caption: "Tools of the mock toolset",
		headerTool: "Tool",
		headerScopes: "Scopes",
		headerConfirm: "Confirmation",
		headerSummary: "What it does",
		confirmNone: "None",
		confirmOptional: "<code>dry_run</code> optional",
		confirmRequired: "<code>dry_run</code>, then <code>confirm_token</code>",
		confirmFlow: {
			one: "{count} tool changes or deletes a lot at once, so it runs in two steps: call it with <code>dry_run: true</code> to get a preview and a <code>confirm_token</code>, then call it again with that <code>confirm_token</code> to apply. Tools marked optional accept <code>dry_run</code> for a preview without requiring it.",
			other:
				"{count} tools change or delete a lot at once, so they run in two steps: call with <code>dry_run: true</code> to get a preview and a <code>confirm_token</code>, then call again with that <code>confirm_token</code> to apply. Tools marked optional accept <code>dry_run</code> for a preview without requiring it.",
		},
	},
	toolSummaries: {
		listProjects: "List mock projects",
		getProject: "Get one mock project",
		createProject: "Create a mock project",
		updateProject: "Rename a mock project or change its prefix",
		deleteProject: "Delete a mock project and everything in it",
		cloneProject: "Clone a mock project",
		rotateProjectSecret: "Give a mock project a new secret (new mock URL)",
		getMcpTokenSettings:
			"Show whether a mock project's MCP endpoint requires a token",
		setMcpTokenRequired:
			"Require (or stop requiring) a Bearer token on a mock's MCP endpoint",
		rotateMcpToken: "Replace the Bearer token of a mock's MCP endpoint",
		listResources: "List the resource tree of a mock project",
		createResource: "Create a resource in a mock project",
		getResource: "Get one resource of a mock project",
		updateResource:
			"Rename a resource or change its schema, template or endpoints",
		createResourceFromSchema:
			"Create a resource from a TypeScript, OpenAPI or JSON Schema type",
		deleteResource: "Delete a resource with its child resources and records",
		moveResource: "Nest a resource under another one, or move it to the root",
		listFakerMethods:
			"List the Faker methods usable in resource schemas and templates",
		generateResourceData: "Replace a resource's records with generated data",
		generateAllResourceData:
			"Regenerate the records of every resource in a project",
		resetAllResourceData: "Delete the records of every resource in a project",
		getResourceData: "Get the raw records of a resource",
		replaceResourceData: "Replace the records of a resource with a JSON array",
		getMockUrls: "Get the REST and MCP URLs of a mock project",
	},
} as const;
