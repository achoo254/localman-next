import { OperationError } from "@localman/operations";
import { type RequestHandler, Router } from "express";

/**
 * API routes of features removed when every account got the same limits
 * (docs/decisions/0011-one-level-for-everyone.md): the Pro trial, its
 * extension requests and the Pro interest form, with their admin pages.
 * Older clients may still call them, so they answer 410 `GONE` in the
 * usual error shape instead of a bare 404. Paths are below `/api/v1`.
 */
export const RETIRED_API_PATHS: readonly string[] = [
	"/users/me/trial",
	"/users/me/trial/extension",
	"/admin/trial-extensions",
	"/admin/trial-extensions/*rest",
	"/admin/users/:sub/extend-trial",
	"/feedback/pro-interest",
	"/admin/pro-interest",
	"/admin/pro-interest/*rest",
];

const gone: RequestHandler = (_req, res) => {
	const error = new OperationError(
		410,
		"GONE",
		"This feature was removed: every account has the same limits",
	);
	res.status(error.status).json(error.toBody());
};

export function createRetiredRoutesRouter(): Router {
	const router = Router();
	router.all([...RETIRED_API_PATHS], gone);
	return router;
}
