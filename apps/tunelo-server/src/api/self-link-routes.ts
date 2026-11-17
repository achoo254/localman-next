import { TUNNEL_SCOPES } from "@tunelo/shared";
import type { Request, Router } from "express";
import type { TokenAuthenticator } from "../auth/token-authenticator.js";
import { cleanDisplayName } from "../lib/display-name.js";
import { isMachineDeviceId } from "../machine-subdomain.js";
import { forwardUrlOf, issueSelfLink } from "../services/self-link-service.js";
import { authenticateRequest } from "./middleware/authenticate-request.js";
import { TuneloError } from "./middleware/error-handler.js";

const MAX_CLIENT_NAME = 80;

function field(req: Request, name: string): unknown {
	const body: unknown = req.body;
	return typeof body === "object" && body !== null && name in body
		? (body as Record<string, unknown>)[name]
		: undefined;
}

/**
 * Links of an account's own machines (the `tunelo` process links itself
 * to Localman after `tunelo login`):
 *   POST /self — Bearer: the account's token (`tunnels:open`); body
 *                `{ deviceId, clientName }`. Answers the link token, its id
 *                and the machine's forward URL, once.
 *   GET  /self — Bearer: such a link token. Answers whose machine it is,
 *                so the app checks it belongs to the account it signed in.
 * Mounted before `DELETE /:id` of the link router.
 */
export function registerSelfLinkRoutes(
	router: Router,
	authenticator: TokenAuthenticator,
): void {
	router.post("/self", async (req, res, next) => {
		try {
			const keyInfo = await authenticateRequest(
				req,
				authenticator,
				TUNNEL_SCOPES.OPEN,
				["idp"],
			);
			const ownerSub = keyInfo.ownerSub;
			if (!ownerSub) {
				throw new TuneloError("TUNELO_AUTH_003", "Account token needed", 403);
			}
			const deviceId = field(req, "deviceId");
			if (!isMachineDeviceId(deviceId)) {
				throw new TuneloError("TUNELO_LINK_004", "Invalid deviceId", 400);
			}
			const rawName = field(req, "clientName");
			const clientName = cleanDisplayName(
				typeof rawName === "string"
					? rawName.trim().slice(0, MAX_CLIENT_NAME)
					: "",
			);
			if (!clientName) {
				throw new TuneloError("TUNELO_LINK_001", "clientName required", 400);
			}
			const link = await issueSelfLink({ ownerSub, deviceId, clientName });
			res.set("cache-control", "no-store").json(link);
		} catch (err) {
			next(err);
		}
	});

	router.get("/self", async (req, res, next) => {
		try {
			const keyInfo = await authenticateRequest(
				req,
				authenticator,
				TUNNEL_SCOPES.READ,
				["link"],
			);
			const { linkedOwnerSub, linkedDeviceId } = keyInfo;
			if (!linkedOwnerSub || !linkedDeviceId) {
				// An older code link: no account, nothing to forward to.
				throw new TuneloError("TUNELO_LINK_003", "Link not found", 404);
			}
			res.set("cache-control", "no-store").json({
				linkId: keyInfo.keyId,
				ownerSub: linkedOwnerSub,
				deviceId: linkedDeviceId,
				forwardUrl: forwardUrlOf(linkedOwnerSub, linkedDeviceId),
			});
		} catch (err) {
			next(err);
		}
	});
}
