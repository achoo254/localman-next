import { docsCustomResponses } from "./docs-custom-responses";
import { docsMcp } from "./docs-mcp";
import { docsPublicSharing } from "./docs-public-sharing";
import { docsQuickStart } from "./docs-quick-start";
import { docsReference } from "./docs-reference";

/** Public docs (`/docs/*`): layout, table of contents and every page. */
export const docs = {
	documentTitle: "{page} · Localman docs",
	toc: {
		label: "Docs contents",
		heading: "Docs",
	},
	pager: {
		label: "Previous and next page",
		previous: "Previous",
		next: "Next",
	},
	pages: {
		quickStart: {
			title: "Quick start",
			summary: "From an empty project to a callable API",
		},
		codeExamples: {
			title: "Code examples",
			summary: "fetch, axios and curl",
		},
		customResponses: {
			title: "Custom responses",
			summary: "Reshape the response body",
		},
		mcp: {
			title: "MCP tools",
			summary: "Connect AI agents to your mocks",
		},
		publicSharing: {
			title: "Public sharing",
			summary: "Share a collection outside your workspace",
		},
	},
	headerMethod: "Method",
	headerRoute: "Route",
	quickStart: docsQuickStart,
	reference: docsReference,
	codeExamples: {
		lead: "Call the mock API with fetch, axios or curl: read, write, nested routes, pagination and error handling.",
		howToRead: "How to read the examples",
		intro:
			"The examples use the <code>customers</code> resource and the <code>orders</code> resource nested inside it, with the fields <code>product</code>, <code>quantity</code> and <code>paid</code>. Replace <angle>secret</angle> with the secret from the project's API endpoint card. Later blocks reuse <code>BASE_URL</code>, <code>JSON_HEADERS</code> and <code>api</code> declared in the first block.",
		languageLegend: "Language of the examples",
		titles: {
			crud: "Read and write on the flat route",
			nested: "Nested routes",
			pagination: "Filter, sort and paginate",
			errors: "Handle errors",
		},
		paginationNote:
			"A list is just an array of records by default. To also get the total record count for a pager, see <countLink>list with the total record count</countLink> in Custom responses. Every parameter is listed in the <queryLink>query parameter table</queryLink>.",
		errorsNote:
			"Every response has an <code>X-Localman-Request-Id</code> header. See also the <statusLink>status and error code table</statusLink>.",
	},
	customResponses: docsCustomResponses,
	mcp: docsMcp,
	publicSharing: docsPublicSharing,
} as const;
