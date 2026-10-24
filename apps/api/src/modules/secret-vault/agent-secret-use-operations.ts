import { type AnyOperation, defineOperation } from "@localman/operations";
import { agentHostsSchema } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSession } from "../../http/require-auth.js";
import {
	listAgentSecretUses,
	removeAgentSecretUse,
	setAgentSecretUse,
} from "./agent-secret-use-service.js";

/** Why none of these is an MCP tool. */
const USER_ONLY =
	"Only the person lets their agents use a secret, from the browser; an agent granting itself a secret would defeat the point";

const PATH = "/agent-secret-uses/:kind/:id";
const target = {
	kind: z.enum(["environment", "collection", "global"]),
	/** Environment, collection or (globals) workspace id. */
	id: z.string().min(1).max(64),
};
const key = z.string().trim().min(1).max(200);
const use = z.object({ key: z.string(), hosts: z.array(z.string()) });

const NOTE =
	"Agents fill a secret into send_request `variables` only when the person turned this on for it, and only for requests to the listed hosts (`api.example.com`, or `*.example.com` for its subdomains); never to Localman's own mock, tunnel or app hosts. A vault value also needs its agent copy, sent with the local value as `agentValue`.";

export const listAgentSecretUsesOperation = defineOperation({
	id: "client.listAgentSecretUses",
	method: "GET",
	path: PATH,
	summary: "List the secrets you let your agents use in a scope",
	description: `The caller's own list for an environment, a collection's variables or a workspace's globals (\`kind\`, \`id\`). ${NOTE}`,
	input: z.object(target),
	output: z.object({ uses: z.array(use) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: { exempt: USER_ONLY },
	handler: async (ctx, input) => ({
		uses: await listAgentSecretUses(requireSession(ctx).sub, input),
	}),
});

export const setAgentSecretUseOperation = defineOperation({
	id: "client.setAgentSecretUse",
	method: "PUT",
	path: `${PATH}/:key`,
	summary: "Let your agents use a secret, for some hosts",
	description: `Turns it on, or replaces its hosts. 400 AGENT_USE_NOT_SECRET when \`key\` is not a secret there, 400 AGENT_HOST_NOT_ALLOWED for a Localman host. ${NOTE}`,
	input: z.object({ ...target, key, hosts: agentHostsSchema }),
	output: use,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: { exempt: USER_ONLY },
	handler: async (ctx, input) =>
		setAgentSecretUse(requireSession(ctx).sub, input, input.key, input.hosts),
});

export const removeAgentSecretUseOperation = defineOperation({
	id: "client.removeAgentSecretUse",
	method: "DELETE",
	path: `${PATH}/:key`,
	summary: "Stop letting your agents use a secret",
	description: `Agents can no longer fill it; the copy of a vault value goes too. ${NOTE}`,
	input: z.object({ ...target, key }),
	output: z.object({ removed: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: { exempt: USER_ONLY },
	handler: async (ctx, input) =>
		removeAgentSecretUse(requireSession(ctx).sub, input, input.key),
});

export const agentSecretUseOperations: readonly AnyOperation[] = [
	listAgentSecretUsesOperation,
	setAgentSecretUseOperation,
	removeAgentSecretUseOperation,
];
