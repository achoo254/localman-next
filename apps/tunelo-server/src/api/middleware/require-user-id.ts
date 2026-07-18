import type { Request } from "express";

/**
 * Returns the authenticated user id attached by the auth middleware.
 *
 * Auth guards (cookieAuth / combinedAuth) always set req.userId before these
 * handlers run, so this narrows the optional type at the call site. It fails
 * loudly if a handler is ever mounted without an auth guard in front of it —
 * a routing mistake, not a client error.
 */
export function requireUserId(req: Request): string {
	const userId = req.userId;
	if (!userId) {
		throw new Error("req.userId missing — route mounted without an auth guard");
	}
	return userId;
}
