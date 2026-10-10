import type { TunnelScope } from "@tunelo/shared";
import type { Request } from "express";
import {
	type TokenAuthenticator,
	bearerTokenOf,
} from "../../auth/token-authenticator.js";
import type { KeyInfo, KeyKind } from "../../key-store/key-store-types.js";
import { TuneloError } from "./error-handler.js";

const STATUS_BY_CODE = {
	TUNELO_AUTH_001: 401,
	TUNELO_AUTH_003: 403,
	TUNELO_AUTH_004: 403,
} as const;

/**
 * Resolves the request's Bearer token, requiring `scope` and one of `kinds`.
 * Throws a `TuneloError` the router's error handler turns into JSON.
 */
export async function authenticateRequest(
	req: Request,
	authenticator: TokenAuthenticator,
	scope: TunnelScope | null,
	kinds: readonly KeyKind[],
): Promise<KeyInfo> {
	const token = bearerTokenOf(req.headers.authorization);
	if (!token) {
		throw new TuneloError("TUNELO_AUTH_002", "Bearer token required", 401);
	}
	const outcome = await authenticator.authenticate(token, scope);
	if (!outcome.ok) {
		const status = outcome.retryable ? 503 : STATUS_BY_CODE[outcome.code];
		throw new TuneloError(outcome.code, outcome.message, status);
	}
	if (!kinds.includes(outcome.keyInfo.kind)) {
		throw new TuneloError(
			"TUNELO_AUTH_003",
			"This token cannot be used here",
			403,
		);
	}
	return outcome.keyInfo;
}
