import { Router } from "express";
import type { TokenAuthenticator } from "../auth/token-authenticator.js";
import { createDeviceRouter } from "./device-routes.js";
import { createLinkRouter } from "./link-routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createTunnelListRouter } from "./tunnel-list-routes.js";
import { createVerifyRouter } from "./verify-routes.js";

// API surface (apex host only):
//   /device/*  — anonymous device pairing of tunelo CLI 1.6.x; approving is
//                off unless AUTH_MODE=legacy (new CLIs sign in at the IdP)
//   /verify    — check a Bearer token (anonymous, link or account JWT)
//   /links/*   — `tunelo link`: read-only tokens for machines without an account
//   /tunnels   — list the caller's live tunnels (account JWT or link token)
// Tunnels themselves authenticate over WebSocket with the token directly.
export function createApiRouter(authenticator: TokenAuthenticator): Router {
	const router = Router();

	router.use("/device", createDeviceRouter(authenticator.config));
	router.use("/verify", createVerifyRouter(authenticator));
	router.use("/links", createLinkRouter(authenticator));
	router.use("/tunnels", createTunnelListRouter(authenticator));

	router.use(errorHandler);

	return router;
}
