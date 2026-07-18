import { Router } from "express";
import * as keyService from "../services/key-service.js";
import { combinedAuth } from "./middleware/api-key-auth.js";
import { requireUserId } from "./middleware/require-user-id.js";
import { validateBody } from "./middleware/validate-body.js";
import { createKeySchema } from "./schemas/key-schemas.js";

export function createKeyRouter(): Router {
	const router = Router();

	// Support both cookie auth (dashboard) and Bearer API key auth (CLI)
	router.use(combinedAuth);

	router.get("/", async (req, res, next) => {
		try {
			const keys = await keyService.listKeys(requireUserId(req));
			res.json({ keys });
		} catch (err) {
			next(err);
		}
	});

	router.post("/", validateBody(createKeySchema), async (req, res, next) => {
		try {
			const result = await keyService.createKey(
				requireUserId(req),
				req.body.label,
			);
			res.status(201).json(result);
		} catch (err) {
			next(err);
		}
	});

	router.delete("/:keyId", async (req, res, next) => {
		try {
			await keyService.revokeKey(requireUserId(req), String(req.params.keyId));
			res.json({ success: true });
		} catch (err) {
			next(err);
		}
	});

	return router;
}
