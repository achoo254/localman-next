import { TUNNEL_SCOPES } from "@tunelo/shared";
import { type Request, Router, json } from "express";
import type { TokenAuthenticator } from "../auth/token-authenticator.js";
import type { KeyInfo } from "../key-store/key-store-types.js";
import * as deviceLink from "../services/device-link-service.js";
import { TUNELO_LOGIN_COMMAND } from "../tenancy/login-command.js";
import { authenticateRequest } from "./middleware/authenticate-request.js";
import { TuneloError } from "./middleware/error-handler.js";

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
 * Links of an anonymous machine to an app (Localman), approved with a code
 * before that flow was retired. Nothing mints them any more; they stay
 * valid until revoked.
 *   GET    /         — the machine's token: its code links
 *   DELETE /self     — a link token revokes itself
 *   DELETE /:id      — the machine revokes one
 */
export function createLinkRouter(authenticator: TokenAuthenticator): Router {
	const router = Router();
	router.use(json({ limit: "16kb" }));

	const machine = (req: Request): Promise<KeyInfo> =>
		authenticateRequest(req, authenticator, TUNNEL_SCOPES.OPEN, ["legacy"]);

	router.get("/", async (req, res, next) => {
		try {
			const { deviceId } = requireDevice(await machine(req));
			res.json({ links: await deviceLink.listLinks(deviceId) });
		} catch (err) {
			next(err);
		}
	});

	// Before `/:id`, which would otherwise capture "self".
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
			const { deviceId } = requireDevice(await machine(req));
			await deviceLink.revokeLink(deviceId, String(req.params.id));
			res.json({ ok: true });
		} catch (err) {
			next(err);
		}
	});

	return router;
}
