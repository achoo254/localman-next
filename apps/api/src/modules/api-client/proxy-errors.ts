import { OperationError } from "@localman/operations";
import { MAX_REDIRECTS } from "@localman/shared/api-client";

/**
 * Failures of the proxy itself (the target never answered, or must not be
 * reached). An upstream that answers, even with 5xx, is a normal result.
 * Messages never echo the target's resolved address.
 */

/** Private, loopback, metadata… address, or a blocked port. */
export function targetBlocked(reason: "address" | "port"): OperationError {
	return new OperationError(
		403,
		"PROXY_TARGET_BLOCKED",
		reason === "port"
			? "The proxy does not connect to mail ports (25, 465, 587)"
			: "The proxy does not reach private, loopback or link-local addresses; use a public URL or a Tunelo tunnel",
		{ reason },
	);
}

export function dnsFailed(host: string): OperationError {
	return new OperationError(
		502,
		"PROXY_DNS_FAILED",
		"The target host name could not be resolved",
		{ host },
	);
}

export function proxyTimeout(timeoutMs: number): OperationError {
	return new OperationError(
		504,
		"PROXY_TIMEOUT",
		`The target did not answer within ${timeoutMs} ms`,
		{ timeoutMs },
	);
}

export function tooManyRedirects(): OperationError {
	return new OperationError(
		502,
		"PROXY_TOO_MANY_REDIRECTS",
		`The target redirected more than ${MAX_REDIRECTS} times`,
		{ max: MAX_REDIRECTS },
	);
}

/** Node error codes are upper-case identifiers; anything else is hidden. */
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

function errorCodeOf(error: unknown): string {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return "UNKNOWN";
	}
	const { code } = error;
	return typeof code === "string" && ERROR_CODE.test(code) ? code : "UNKNOWN";
}

/**
 * 502 `PROXY_CONNECTION_FAILED` with the Node error code as `details.cause`
 * (`ECONNREFUSED`, `ECONNRESET`, `CERT_HAS_EXPIRED`,
 * `DEPTH_ZERO_SELF_SIGNED_CERT`, `HPE_INVALID_CONSTANT`…).
 */
export function connectionFailed(error: unknown): OperationError {
	return new OperationError(
		502,
		"PROXY_CONNECTION_FAILED",
		"The connection to the target failed",
		{ cause: errorCodeOf(error) },
	);
}

/**
 * Error of a forward: operation errors pass through, an expired deadline
 * becomes a timeout, anything else a connection failure.
 */
export function toProxyError(
	error: unknown,
	deadline: AbortSignal,
	timeoutMs: number,
): OperationError {
	if (error instanceof OperationError) return error;
	if (deadline.aborted) return proxyTimeout(timeoutMs);
	return connectionFailed(error);
}
