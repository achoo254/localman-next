import { type AnyOperation, defineOperation } from "@localman/operations";
import { z } from "zod";
import { requireSession, requireSubject } from "../../http/require-auth.js";
import {
	LINK_EXEMPT,
	LIST_EXEMPT,
	TUNELO_ABOUT,
	linkPollView,
	localTunnelListView,
	pendingLinkView,
	tuneloOperationBase,
	tunnelLinksView,
} from "./tunelo-view.js";
import {
	listTunnelLinks as readLinks,
	deleteTunnelLink as removeLink,
} from "./tunnel-link-service.js";
import { listLocalTunnels as readTunnels } from "./tunnel-list-service.js";
import {
	pollTunnelLink as pollLink,
	startTunnelLink as startLink,
} from "./tunnel-pairing-service.js";

const linkId = z.string().min(1).max(64);
const READ = { readOnly: true, destructive: false, idempotent: true } as const;

export const listLocalTunnels = defineOperation({
	...tuneloOperationBase,
	id: "client.listLocalTunnels",
	method: "GET",
	path: "/client/local-tunnels",
	summary: "List the user's live Tunelo tunnels, optionally for one local port",
	description: `${TUNELO_ABOUT} \`port\` keeps the tunnels of that local port only. The merged list is cached 10 seconds per user; \`refresh=true\` reads it anew. A source Tunelo refused or did not answer is listed in \`failures\` (\`unauthorized\` or \`unavailable\`), the other sources still answer. Needs a browser session.`,
	input: z.object({
		port: z.number().int().min(1).max(65_535).optional(),
		refresh: z.boolean().optional(),
	}),
	output: localTunnelListView,
	annotations: READ,
	mcp: { exempt: LIST_EXEMPT },
	handler: async (ctx, input) => {
		const { sub, sessionId } = requireSession(ctx);
		return readTunnels(sub, sessionId, input);
	},
});

export const listTunnelLinks = defineOperation({
	...tuneloOperationBase,
	id: "client.listTunnelLinks",
	method: "GET",
	path: "/client/tunnel-links",
	summary: "List the machines the user linked with `tunelo link`",
	description: TUNELO_ABOUT,
	input: z.object({}),
	output: tunnelLinksView,
	annotations: READ,
	mcp: { exempt: LINK_EXEMPT },
	handler: async (ctx) => readLinks(requireSubject(ctx)),
});

export const startTunnelLink = defineOperation({
	...tuneloOperationBase,
	id: "client.startTunnelLink",
	method: "POST",
	path: "/client/tunnel-links",
	summary: "Open a pairing code for `tunelo link <code>`",
	description: `${TUNELO_ABOUT} Answers the pairing id, the code to type on the machine and when it expires (10 minutes); poll it until the machine approves. 409 TUNNEL_LINK_LIMIT_REACHED past the limit of machines, 502 TUNELO_UNAVAILABLE when Tunelo does not answer.`,
	input: z.object({}),
	output: pendingLinkView,
	annotations: { readOnly: false, destructive: false, idempotent: false },
	mcp: { exempt: LINK_EXEMPT },
	handler: async (ctx) => startLink(requireSubject(ctx)),
});

export const pollTunnelLink = defineOperation({
	...tuneloOperationBase,
	id: "client.pollTunnelLink",
	method: "POST",
	path: "/client/tunnel-links/:id/poll",
	summary: "Check whether the machine approved a pairing",
	description: `${TUNELO_ABOUT} \`pending\` until the machine runs \`tunelo link <code>\`, then \`linked\` with the machine; \`expired\` when the code ran out (the pairing is gone). Own pairings only (404 otherwise).`,
	input: z.object({ id: linkId }),
	output: linkPollView,
	annotations: { readOnly: false, destructive: false, idempotent: true },
	mcp: { exempt: LINK_EXEMPT },
	handler: async (ctx, input) => pollLink(requireSubject(ctx), input.id),
});

export const deleteTunnelLink = defineOperation({
	...tuneloOperationBase,
	id: "client.deleteTunnelLink",
	method: "DELETE",
	path: "/client/tunnel-links/:id",
	summary: "Revoke a linked machine, or cancel a pairing",
	description: `${TUNELO_ABOUT} Revokes the link token at Tunelo (a failure there does not keep the link) and forgets the machine; answers the remaining links. Own links only (404 otherwise).`,
	input: z.object({ id: linkId }),
	output: tunnelLinksView,
	annotations: { readOnly: false, destructive: false, idempotent: true },
	mcp: { exempt: LINK_EXEMPT },
	handler: async (ctx, input) => removeLink(requireSubject(ctx), input.id),
});

/** Served only while `TUNELO_ACCOUNTS_ENABLED` is on (`feature-gates.ts`). */
export const tuneloOperations: readonly AnyOperation[] = [
	listLocalTunnels,
	listTunnelLinks,
	startTunnelLink,
	pollTunnelLink,
	deleteTunnelLink,
];
