import { apiClientToolsErrors } from "./api-client-tools-errors";
import { apiClientToolsHistory } from "./api-client-tools-history";
import { apiClientToolsImport } from "./api-client-tools-import";
import { apiClientToolsResponse } from "./api-client-tools-response";
import { apiClientToolsSnippet } from "./api-client-tools-snippet";

/**
 * Tools around the API client's request editor: response viewer, send
 * errors, history, import/export and code snippets.
 */
export const apiClientTools = {
	response: apiClientToolsResponse,
	errors: apiClientToolsErrors,
	history: apiClientToolsHistory,
	import: apiClientToolsImport,
	snippet: apiClientToolsSnippet,
} as const;
