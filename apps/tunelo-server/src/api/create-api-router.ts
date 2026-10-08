import { Router } from "express";
import { createDeviceRouter } from "./device-routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createVerifyRouter } from "./verify-routes.js";

// No accounts/admin. API surface:
//   /device/*  — browser<->CLI pairing for `tunelo login`
//   /verify    — check a Bearer access token
// Tunnels authenticate over WebSocket with the access token directly.
export function createApiRouter(): Router {
	const router = Router();

	router.use("/device", createDeviceRouter());
	router.use("/verify", createVerifyRouter());

	router.use(errorHandler);

	return router;
}
