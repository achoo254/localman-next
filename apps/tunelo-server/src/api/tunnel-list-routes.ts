import { TUNNEL_SCOPES } from "@tunelo/shared";
import { Router } from "express";
import type { TokenAuthenticator } from "../auth/token-authenticator.js";
import { listByDeviceId, listByOwner } from "../tunnel-directory.js";
import { authenticateRequest } from "./middleware/authenticate-request.js";

/**
 * GET /api/tunnels — live tunnels (HTTP and TCP) of the caller.
 * - Account JWT with `tunnels:read` (e.g. exchanged by Localman): every
 *   tunnel of that account, on all machines.
 * - Link token: the tunnels of the one anonymous machine it was linked to.
 */
export function createTunnelListRouter(
	authenticator: TokenAuthenticator,
): Router {
	const router = Router();

	router.get("/", async (req, res, next) => {
		try {
			const keyInfo = await authenticateRequest(
				req,
				authenticator,
				TUNNEL_SCOPES.READ,
				["idp", "link"],
			);
			const tunnels = keyInfo.ownerSub
				? listByOwner(keyInfo.ownerSub)
				: keyInfo.linkedDeviceId
					? listByDeviceId(keyInfo.linkedDeviceId)
					: [];
			res.set("cache-control", "no-store").json({ tunnels });
		} catch (err) {
			next(err);
		}
	});

	return router;
}
