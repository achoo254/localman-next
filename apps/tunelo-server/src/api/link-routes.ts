import { TUNNEL_SCOPES } from "@tunelo/shared";
import { type Request, Router, json } from "express";
import type { TokenAuthenticator } from "../auth/token-authenticator.js";
import type { KeyInfo } from "../key-store/key-store-types.js";
import * as deviceLink from "../services/device-link-service.js";
import {
	listAccountLinks,
	revokeAccountLink,
} from "../services/self-link-service.js";
import { TUNELO_LOGIN_COMMAND } from "../tenancy/login-command.js";
import { authenticateRequest } from "./middleware/authenticate-request.js";
import { TuneloError } from "./middleware/error-handler.js";
import { registerSelfLinkRoutes } from "./self-link-routes.js";

/** Anonymous device token that knows its machine (device-login minted). */
function requireDevice(keyInfo: KeyInfo): { keyId: string; deviceId: string } {
	if (!keyInfo.deviceId) {
		throw new TuneloError(
			"TUNELO_LINK_004",
			`This token is not bound to a machine; run \`${TUNELO_LOGIN_COMMAND}\` first`,
			400,
		);
	}
	return { keyId: keyInfo.keyId, deviceId: keyInfo.deviceId };
}

/**
 * Links of a machine to an app (Localman). New links are only minted for
 * an account's own machines (`POST|GET /self`, self-link-routes.ts); links
 * an anonymous machine approved with a code before that flow was retired
 * stay valid until revoked.
 *   GET    /         — an account token: the links of all its machines;
 *                      an anonymous machine's token: its older code links
 *   DELETE /self     — a link token revokes itself
 *   DELETE /:id      — the account (or the anonymous machine) revokes one
 */
export function createLinkRouter(authenticator: TokenAuthenticator): Router {
	const router = Router();
	router.use(json({ limit: "16kb" }));

	const machineOrAccount = (req: Request): Promise<KeyInfo> =>
		authenticateRequest(req, authenticator, TUNNEL_SCOPES.OPEN, [
			"legacy",
			"idp",
		]);

	router.get("/", async (req, res, next) => {
		try {
			const caller = await machineOrAccount(req);
			if (caller.kind === "idp" && caller.ownerSub) {
				res.json({ links: await listAccountLinks(caller.ownerSub) });
				return;
			}
			const { deviceId } = requireDevice(caller);
			res.json({ links: await deviceLink.listLinks(deviceId) });
		} catch (err) {
			next(err);
		}
	});

	// Before `/:id`, which would otherwise capture "self".
	registerSelfLinkRoutes(router, authenticator);
	router.delete("/self", async (req, res, next) => {
		try {
			const keyInfo = await authenticateRequest(
				req,
				authenticator,
				TUNNEL_SCOPES.READ,
				["link"],
			);
			await deviceLink.revokeOwnLink(keyInfo.keyId);
			res.json({ ok: true });
		} catch (err) {
			next(err);
		}
	});

	router.delete("/:id", async (req, res, next) => {
		try {
			const caller = await machineOrAccount(req);
			const id = String(req.params.id);
			if (caller.kind === "idp" && caller.ownerSub) {
				await revokeAccountLink(caller.ownerSub, id);
			} else {
				const { deviceId } = requireDevice(caller);
				await deviceLink.revokeLink(deviceId, id);
			}
			res.json({ ok: true });
		} catch (err) {
			next(err);
		}
	});

	return router;
}
