import { defineOperation } from "@localman/operations";
import type { Types } from "mongoose";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import { projectIdParam } from "../resources/resource-operation-params.js";
import {
	type StoredMcpToken,
	createFirstMcpToken,
	findMcpToken,
	newMcpToken,
	saveMcpToken,
	setMcpTokenRequired,
} from "./mcp-token-model.js";

const MCP_TOKEN_PATH = "/projects/:projectId/mcp-token";
const OWNER_NOTE =
	"Owner only (collaborators get 403). The Hosted Mock MCP endpoint is {mockBaseUrl}/mcp; with the setting on, MCP clients must send `Authorization: Bearer <token>` (401 otherwise). The REST mock API is never affected.";

const mcpTokenStatus = z.object({
	/** Whether `/mcp` refuses calls without the Bearer token. */
	required: z.boolean(),
	/** The current token, never the token itself; `null` before the first one. */
	token: z.object({ last4: z.string(), createdAt: z.string() }).nullable(),
});

/** The token, present only in the response of the call that created it. */
const issuedToken = z.string().optional();

type McpTokenStatus = z.output<typeof mcpTokenStatus>;

function statusOf(stored: StoredMcpToken | null): McpTokenStatus {
	const last4 = stored?.tokenLast4;
	const createdAt = stored?.tokenCreatedAt;
	return {
		required: stored?.required === true,
		token:
			stored?.tokenHash && last4 && createdAt
				? { last4, createdAt: createdAt.toISOString() }
				: null,
	};
}

async function ownProjectId(
	sub: string,
	projectId: string,
): Promise<Types.ObjectId> {
	return (await requireProject(sub, "update", projectId))._id;
}

export const getMcpTokenSettings = defineOperation({
	id: "mock.getMcpTokenSettings",
	method: "GET",
	path: MCP_TOKEN_PATH,
	summary: "Show whether a mock project's MCP endpoint requires a token",
	description: `Returns whether the token is required and the last 4 characters and creation time of the current token. The token itself is never returned again after it was created. ${OWNER_NOTE}`,
	input: z.object({ projectId: projectIdParam }),
	output: mcpTokenStatus,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: async (ctx, input) => {
		const projectId = await ownProjectId(requireSubject(ctx), input.projectId);
		return statusOf(await findMcpToken(projectId));
	},
});

export const setMcpTokenRequirement = defineOperation({
	id: "mock.setMcpTokenRequired",
	method: "PUT",
	path: MCP_TOKEN_PATH,
	summary:
		"Require (or stop requiring) a Bearer token on a mock's MCP endpoint",
	description: `Turns "Require a token for MCP" on or off. Turning it on for the first time creates the token and returns it once in issuedToken: store it now, it cannot be read again (use rotate_mcp_token for a new one). Turning it off keeps the token, so turning it on again restores it. ${OWNER_NOTE}`,
	input: z.object({ projectId: projectIdParam, required: z.boolean() }),
	output: mcpTokenStatus.extend({ issuedToken }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "mock",
	mcp: true,
	createsCredential: true,
	handler: async (ctx, input) => {
		const projectId = await ownProjectId(requireSubject(ctx), input.projectId);
		const updated = await setMcpTokenRequired(projectId, input.required);
		if (updated || !input.required) {
			return statusOf(updated ?? (await findMcpToken(projectId)));
		}
		const issued = newMcpToken();
		const created = await createFirstMcpToken(projectId, issued);
		if (created) return { ...statusOf(created), issuedToken: issued.token };
		// Another first enable stored its token in between: turn that one on.
		return statusOf(await setMcpTokenRequired(projectId, true));
	},
});

export const rotateMcpToken = defineOperation({
	id: "mock.rotateMcpToken",
	method: "POST",
	path: `${MCP_TOKEN_PATH}/rotate`,
	summary: "Replace the Bearer token of a mock's MCP endpoint",
	description: `Creates a new token and returns it once in issuedToken; the previous token stops working at once, so every MCP client using it gets 401 until reconfigured. The "required" setting is kept (a project without a token gets one, still not required). Call with dryRun first to see the current token. ${OWNER_NOTE}`,
	input: z.object({ projectId: projectIdParam }),
	output: mcpTokenStatus.extend({ dryRun: z.boolean(), issuedToken }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: false },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	// Breaks every configured MCP client: the tool needs a confirm token.
	requiresConfirmation: true,
	createsCredential: true,
	handler: async (ctx, input) => {
		const projectId = await ownProjectId(requireSubject(ctx), input.projectId);
		const current = await findMcpToken(projectId);
		if (ctx.dryRun) return { dryRun: true, ...statusOf(current) };
		const issued = newMcpToken();
		const saved = await saveMcpToken(
			projectId,
			issued,
			current?.required === true,
		);
		return { dryRun: false, ...statusOf(saved), issuedToken: issued.token };
	},
});

export const mcpTokenOperations = [
	getMcpTokenSettings,
	setMcpTokenRequirement,
	rotateMcpToken,
];
