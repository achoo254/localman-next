import {
	type AuthContext,
	type OperationContext,
	OperationError,
	type OperationRouterOptions,
} from "@localman/operations";
import type { Request } from "express";

/**
 * Localman-internal scope of a user signed in through a browser session.
 * Operations for the signed-in user declare `scopes: [USER_SCOPE]`; tokens
 * of other callers (MCP, service accounts) will carry their own scopes.
 */
export const USER_SCOPE = "user";

/** Identity of a request authenticated by the session cookie. */
export interface SessionAuthContext extends AuthContext {
	/** Server-side session id (hash of the cookie, never the cookie itself). */
	readonly sessionId: string;
}

export interface AuthenticatedSession {
	readonly id: string;
	readonly sub: string;
}

export type SessionAuthenticator = (
	req: Request,
) => Promise<AuthenticatedSession | null>;

/** `resolveAuth` for the operation router: the session cookie, if any. */
export function createSessionAuthResolver(
	authenticate: SessionAuthenticator,
): OperationRouterOptions["resolveAuth"] {
	return async (req): Promise<SessionAuthContext | null> => {
		const session = await authenticate(req);
		if (!session) return null;
		return {
			subjectId: session.sub,
			scopes: [USER_SCOPE],
			sessionId: session.id,
		};
	};
}

/**
 * The caller's subject id. The router already answered 401 for anonymous
 * callers of a scoped operation; this keeps handlers type-safe.
 */
export function requireSubject(ctx: OperationContext): string {
	if (!ctx.auth) {
		throw new OperationError(401, "UNAUTHENTICATED", "Authentication required");
	}
	return ctx.auth.subjectId;
}

/** The caller's subject and session; only a browser session has one. */
export function requireSession(ctx: OperationContext): {
	readonly sub: string;
	readonly sessionId: string;
} {
	const auth = ctx.auth;
	if (!auth || !("sessionId" in auth) || typeof auth.sessionId !== "string") {
		throw new OperationError(
			401,
			"UNAUTHENTICATED",
			"A browser session is required",
		);
	}
	return { sub: auth.subjectId, sessionId: auth.sessionId };
}
