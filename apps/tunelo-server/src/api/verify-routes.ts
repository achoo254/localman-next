import { createHash } from "node:crypto";
import { Router } from "express";
import { ApiKey } from "../db/models/api-key-model.js";

/**
 * GET /api/verify — checks a Bearer access token is valid and active.
 * Used by `tunelo login` to confirm a pasted token before saving it.
 */
export function createVerifyRouter(): Router {
	const router = Router();

	router.get("/", async (req, res, next) => {
		try {
			const authHeader = req.headers.authorization;
			if (!authHeader?.startsWith("Bearer ")) {
				res.status(401).json({ valid: false });
				return;
			}
			const rawKey = authHeader.slice(7);
			const keyHash = createHash("sha256").update(rawKey).digest("hex");
			const key = await ApiKey.findOne({ keyHash, status: "active" }).lean();
			const valid = Boolean(
				key && (!key.expiresAt || new Date(key.expiresAt) > new Date()),
			);
			res.status(valid ? 200 : 401).json({ valid });
		} catch (err) {
			next(err);
		}
	});

	return router;
}
