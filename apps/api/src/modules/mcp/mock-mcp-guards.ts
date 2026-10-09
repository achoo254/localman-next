import { MOCK_MCP_SEGMENT } from "@localman/shared";
import type { Request, Response } from "express";
import type { Logger } from "../../logger.js";
import type { MockProject } from "../mock-runtime/resolve-project.js";
import { TtlLruCache } from "../mock-runtime/ttl-lru-cache.js";
import type { StoredResource } from "../resources/resource-model.js";
import {
	JSON_RPC_METHOD_NOT_FOUND,
	jsonRpcCallOf,
	sendJsonRpcError,
} from "./mcp-json-rpc.js";

/**
 * Refuses `subscriptions/listen` in-band (HTTP 200, as the SDK refuses a
 * listen it cannot serve): every request builds its own server from the
 * project's resources, so its tool list never changes while a stream
 * would stay open. Clients list the tools again instead. Returns true
 * when it answered.
 */
export function refuseListen(req: Request, res: Response): boolean {
	const call = req.method === "POST" ? jsonRpcCallOf(req.body) : null;
	if (call?.method !== "subscriptions/listen") return false;
	sendJsonRpcError(
		res,
		200,
		{
			code: JSON_RPC_METHOD_NOT_FOUND,
			message:
				"subscriptions/listen is not supported: the tools of a mock change only when its resources do; list the tools again",
		},
		call.id,
	);
	return true;
}

/** Projects already warned about, so each is logged once per process. */
const warned = new TtlLruCache<true>(10_000, Number.POSITIVE_INFINITY);

/**
 * Logs once per project that a root resource named `mcp` (created before
 * the name was reserved) is shadowed: `{prefix}/mcp` is the MCP endpoint,
 * so its REST collection route no longer answers. Only the project id is
 * logged, never the secret.
 */
export function warnShadowedResource(
	resources: readonly StoredResource[],
	project: MockProject,
	logger: Logger,
): void {
	const projectId = project.id.toHexString();
	if (warned.get(projectId)) return;
	const shadowed = resources.some(
		(r) => !r.parentId && r.name === MOCK_MCP_SEGMENT,
	);
	if (!shadowed) return;
	warned.set(projectId, true);
	logger.warn(
		{ projectId },
		"A root resource named mcp is shadowed by the Hosted Mock MCP endpoint",
	);
}

/** TEST ONLY. Forgets the projects already warned about. */
export function clearShadowWarnings(): void {
	warned.clear();
}
