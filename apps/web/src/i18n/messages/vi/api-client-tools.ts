import type { Messages } from "../../message-types";
import { apiClientToolsErrors } from "./api-client-tools-errors";
import { apiClientToolsHistory } from "./api-client-tools-history";
import { apiClientToolsImport } from "./api-client-tools-import";
import { apiClientToolsResponse } from "./api-client-tools-response";
import { apiClientToolsSnippet } from "./api-client-tools-snippet";

export const apiClientTools: Messages["apiClientTools"] = {
	response: apiClientToolsResponse,
	errors: apiClientToolsErrors,
	history: apiClientToolsHistory,
	import: apiClientToolsImport,
	snippet: apiClientToolsSnippet,
};
