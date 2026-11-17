import { TUNNEL_SCOPES } from "@tunelo/shared";
import { Router } from "express";
import type { TokenAuthenticator } from "../auth/token-authenticator.js";
import {
	listByDeviceId,
	listByMachine,
	listByOwner,
} from "../tunnel-directory.js";
import { authenticateRequest } from "./middleware/authenticate-request.js";

/**
 * GET /api/tunnels — live tunnels (HTTP and TCP) of the caller.
 * - Account JWT with `tunnels:read` (e.g. exchanged by Localman): every
 *   tunnel of that account, on all machines.
 * - Link token: the tunnels of the one machine it was linked to (an
 *   account's own machine, or an anonymous one from an older code link).
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
			const { ownerSub, linkedOwnerSub, linkedDeviceId } = keyInfo;
			const tunnels = ownerSub
				? listByOwner(ownerSub)
				: linkedOwnerSub && linkedDeviceId
					? listByMachine(linkedOwnerSub, linkedDeviceId)
					: linkedDeviceId
						? listByDeviceId(linkedDeviceId)
						: [];
			res.set("cache-control", "no-store").json({ tunnels });
		} catch (err) {
			next(err);
		}
	});

	return router;
}
