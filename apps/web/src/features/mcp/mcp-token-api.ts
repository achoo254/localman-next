import { apiRequest } from "../../lib/api-client";
import {
	type JsonRecord,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

/** "Require a token for MCP" of a project; owner only (403 otherwise). */
export interface McpTokenStatus {
	required: boolean;
	/** Hint of the current token, never the token; null before the first. */
	token: { last4: string; createdAt: string } | null;
}

export interface McpTokenChange {
	status: McpTokenStatus;
	/** The new token, returned once by the call that created it. */
	issuedToken: string | null;
}

export const mcpTokenQueryKey = (projectId: string) =>
	["mcp-token", projectId] as const;

const tokenPath = (projectId: string) =>
	`/api/v1/projects/${encodeURIComponent(projectId)}/mcp-token`;

function parseStatus(data: JsonRecord): McpTokenStatus {
	const hint =
		data.token === null || data.token === undefined
			? null
			: expectRecord(data.token, "mcp token");
	return {
		required: expectBoolean(data, "required"),
		token: hint
			? {
					last4: expectString(hint, "last4"),
					createdAt: expectString(hint, "createdAt"),
				}
			: null,
	};
}

function parseChange(value: unknown): McpTokenChange {
	const data = expectRecord(value, "mcp token change");
	return {
		status: parseStatus(data),
		issuedToken: optionalString(data, "issuedToken"),
	};
}

export async function fetchMcpTokenStatus(
	projectId: string,
): Promise<McpTokenStatus> {
	return parseStatus(
		expectRecord(await apiRequest(tokenPath(projectId)), "mcp token status"),
	);
}

/** Turning it on the first time creates the token (`issuedToken`). */
export async function setMcpTokenRequired(
	projectId: string,
	required: boolean,
): Promise<McpTokenChange> {
	return parseChange(
		await apiRequest(tokenPath(projectId), {
			method: "PUT",
			body: { required },
		}),
	);
}

/** New token; the old one stops working at once. */
export async function rotateMcpToken(
	projectId: string,
): Promise<McpTokenChange> {
	return parseChange(
		await apiRequest(`${tokenPath(projectId)}/rotate`, {
			method: "POST",
			body: {},
		}),
	);
}
