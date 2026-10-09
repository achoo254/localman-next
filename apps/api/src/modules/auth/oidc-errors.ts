import { OperationError } from "@localman/operations";
import * as oidc from "openid-client";

/** The IdP could not be reached or its metadata is unusable. */
export class IdpUnavailableError extends Error {
	constructor(cause: unknown) {
		super("Identity provider is unavailable", { cause });
		this.name = "IdpUnavailableError";
	}
}

/** Client-facing error while the IdP cannot be reached. */
export function authUnavailableError(): OperationError {
	return new OperationError(
		503,
		"AUTH_UNAVAILABLE",
		"The sign-in service is unavailable, try again shortly",
	);
}

/** OAuth error code of a token endpoint error response, if any. */
export function oauthErrorCode(error: unknown): string | undefined {
	return error instanceof oidc.ResponseBodyError ? error.error : undefined;
}
