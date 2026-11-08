import { TUNNEL_SCOPES } from "@tunelo/shared";
import { type Request, Router, json } from "express";
import type { TokenAuthenticator } from "../auth/token-authenticator.js";
import type { KeyInfo } from "../key-store/key-store-types.js";
import { AttemptLimiter } from "../lib/attempt-limiter.js";
import { cleanDisplayName } from "../lib/display-name.js";
import * as deviceLink from "../services/device-link-service.js";
import {
	listAccountLinks,
	revokeAccountLink,
} from "../services/self-link-service.js";
import { TUNELO_LOGIN_COMMAND } from "../tenancy/login-command.js";
import { authenticateRequest } from "./middleware/authenticate-request.js";
import { TuneloError } from "./middleware/error-handler.js";
import { registerSelfLinkRoutes } from "./self-link-routes.js";

const MAX_CLIENT_NAME = 80;
const INITS_PER_WINDOW = 20;
const INIT_WINDOW_MS = 10 * 60 * 1000;

function bodyString(req: Request, field: string, max: number): string {
	const body: unknown = req.body;
	const value =
		typeof body === "object" && body !== null && field in body
			? (body as Record<string, unknown>)[field]
			: undefined;
	return typeof value === "string" ? value.trim().slice(0, max) : "";
}

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
 * `tunelo link` for machines without an account:
 *   POST   /init     — a client (Localman) opens a pairing, shows the code
 *   POST   /approve  — the machine approves it (Bearer: its anonymous token)
 *   POST   /poll     — the client collects its read-only token, once
 *   GET    /         — the machine lists its links (an account token:
 *                      the links of all the account's machines)
 *   DELETE /self     — a link token revokes itself
 *   DELETE /:id      — the machine (or the account) revokes one of its links
 * plus `POST|GET /self` for an account's own machines (self-link-routes.ts).
 */
export function createLinkRouter(authenticator: TokenAuthenticator): Router {
	const router = Router();
	router.use(json({ limit: "16kb" }));
	const inits = new AttemptLimiter(INITS_PER_WINDOW, INIT_WINDOW_MS);

	const device = (req: Request): Promise<KeyInfo> =>
		authenticateRequest(req, authenticator, TUNNEL_SCOPES.OPEN, ["legacy"]);
	const machineOrAccount = (req: Request): Promise<KeyInfo> =>
		authenticateRequest(req, authenticator, TUNNEL_SCOPES.OPEN, [
			"legacy",
			"idp",
		]);

	router.post("/init", async (req, res, next) => {
		try {
			const ip = req.ip ?? "unknown";
			if (inits.isBlocked(ip)) {
				throw new TuneloError("TUNELO_LINK_002", "Too many link requests", 429);
			}
			inits.hit(ip);
			const clientName = cleanDisplayName(
				bodyString(req, "clientName", MAX_CLIENT_NAME),
			);
			res.json(await deviceLink.initLink(clientName ?? "Unknown client"));
		} catch (err) {
			next(err);
		}
	});

	router.post("/approve", async (req, res, next) => {
		try {
			const approver = requireDevice(await device(req));
			const code = bodyString(req, "code", 32);
			res.json(await deviceLink.approveLink(code, approver));
		} catch (err) {
			next(err);
		}
	});

	router.post("/poll", async (req, res, next) => {
		try {
			const requestId = bodyString(req, "requestId", 128);
			res
				.set("cache-control", "no-store")
				.json(await deviceLink.pollLink(requestId));
		} catch (err) {
			next(err);
		}
	});

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
