import { Router } from "express";
import {
	type TokenAuthenticator,
	bearerTokenOf,
} from "../auth/token-authenticator.js";

/**
 * GET /api/verify — checks a Bearer token (anonymous, link or account JWT).
 * `tunelo login --legacy-key` uses it to confirm a pasted token; `tunelo
 * whoami` reads `kind` and, for anonymous tokens, the cutoff date.
 */
export function createVerifyRouter(authenticator: TokenAuthenticator): Router {
	const router = Router();

	router.get("/", async (req, res, next) => {
		try {
			const token = bearerTokenOf(req.headers.authorization);
			if (!token) {
				res.status(401).json({ valid: false, code: "TUNELO_AUTH_002" });
				return;
			}
			const outcome = await authenticator.authenticate(token, null);
			if (!outcome.ok) {
				res
					.status(outcome.retryable ? 503 : 401)
					.json({ valid: false, code: outcome.code });
				return;
			}
			const { kind } = outcome.keyInfo;
			const cutoff =
				kind === "legacy" ? authenticator.legacyCutoffIso() : undefined;
			res.json({
				valid: true,
				kind,
				...(cutoff ? { legacyTokenCutoff: cutoff } : {}),
			});
		} catch (err) {
			next(err);
		}
	});

	return router;
}
