import { Router } from "express";
import { errorHandler } from "./middleware/error-handler.js";
import { createVerifyRouter } from "./verify-routes.js";

// No accounts/admin: the only API surface is access-token verification.
// Tunnels authenticate over WebSocket with the access token directly.
export function createApiRouter(): Router {
	const router = Router();

	router.use("/verify", createVerifyRouter());

	router.use(errorHandler);

	return router;
}
