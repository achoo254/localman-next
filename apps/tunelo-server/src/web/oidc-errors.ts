import * as oidc from "openid-client";

/** The IdP could not be reached or its metadata is unusable. */
export class IdpUnavailableError extends Error {
	constructor(cause: unknown) {
		super("Identity provider is unavailable", { cause });
		this.name = "IdpUnavailableError";
	}
}

/** OAuth error code of an error response from the IdP, if any. */
export function oauthErrorCode(error: unknown): string | undefined {
	return error instanceof oidc.ResponseBodyError ||
		error instanceof oidc.AuthorizationResponseError
		? error.error
		: undefined;
}

/** Loggable facts about an error; never a response body or token. */
export function describeError(error: unknown): Record<string, string> {
	if (!(error instanceof Error)) return { error: typeof error };
	const code = (error as { code?: unknown }).code;
	return {
		name: error.name,
		message: error.message,
		...(typeof code === "string" ? { code } : {}),
		...(oauthErrorCode(error)
			? { oauthError: String(oauthErrorCode(error)) }
			: {}),
	};
}
