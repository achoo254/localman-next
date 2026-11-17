import { OperationError } from "@localman/operations";
import { type Router, json } from "express";
import { z } from "zod";
import { TUNELO_PATHS } from "../../operations/protocol-routes.js";
import { ensureKnownSubject } from "../mcp/localman-mcp-limits.js";
import {
	type McpResourceSettings,
	authenticateBearer,
	refuseInsufficientScope,
} from "../mcp/mcp-resource-metadata.js";
import { tuneloRuntimeOrNull } from "./tunelo-runtime.js";
import { linkOwnMachine } from "./tunnel-self-link-service.js";

/** Granted by the IdP to the `tunelo` process only (`tunelo-agent`). */
export const MACHINES_WRITE_SCOPE = "machines:write";

/** No control characters: the name is shown in the UI and in logs. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: refusing them is the point
const DISPLAY_NAME = /^[^\u0000-\u001f\u007f-\u009f]+$/;

const selfLinkBody = z.object({
	token: z.string().min(1).max(512),
	machineId: z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/),
	machineName: z.string().trim().min(1).max(100).regex(DISPLAY_NAME),
});

/**
 * `POST /tunelo/links/self`: the `tunelo` process of the signed-in account
 * hands Localman the link token Tunelo minted for its machine. Bearer
 * access token of the Localman MCP resource with `machines:write`; the
 * session cookie plays no part (mounted on the MCP router, before CSRF).
 */
export function registerTunnelSelfLinkRoute(
	router: Router,
	settings: McpResourceSettings,
): void {
	router.post(
		TUNELO_PATHS.selfLink,
		json({ limit: "16kb" }),
		async (req, res) => {
			const access = await authenticateBearer(req, res, settings);
			if (!access.scopes.includes(MACHINES_WRITE_SCOPE)) {
				throw refuseInsufficientScope(res, settings, [MACHINES_WRITE_SCOPE]);
			}
			if (!tuneloRuntimeOrNull()) {
				throw new OperationError(
					503,
					"TUNELO_UNAVAILABLE",
					"Tunelo is not configured on this server",
				);
			}
			const parsed = selfLinkBody.safeParse(req.body);
			if (!parsed.success) {
				throw new OperationError(400, "VALIDATION_ERROR", "Invalid input");
			}
			await ensureKnownSubject(access.subject);
			const link = await linkOwnMachine(access.subject, parsed.data);
			res.set("Cache-Control", "no-store").json({ link });
		},
	);
}
