import type { RequestHandler } from "express";

/** Responses that set cookies or redirect with codes must not be cached. */
export const noStore: RequestHandler = (_req, res, next) => {
	res.set("Cache-Control", "no-store");
	next();
};
