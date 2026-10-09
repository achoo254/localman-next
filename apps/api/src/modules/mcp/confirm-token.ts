import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { OperationError } from "@localman/operations";

/** How long a dry run's confirm token stays valid. */
export const CONFIRM_TOKEN_TTL_MS = 5 * 60 * 1000;

const TOKEN_VERSION = "v1";
const MIN_SECRET_BYTES = 32;

/** What a confirm token is bound to: who, which tool, which exact input. */
export interface ConfirmTokenBinding {
	readonly subjectId: string;
	readonly tool: string;
	/** Parsed tool input, without the `dry_run`/`confirm_token` controls. */
	readonly input: unknown;
}

export interface IssuedConfirmToken {
	readonly token: string;
	readonly expiresAt: Date;
}

export interface ConfirmTokenService {
	issue(binding: ConfirmTokenBinding): IssuedConfirmToken;
	/**
	 * Accepts a token once for this exact binding, or throws
	 * `OperationError` with `CONFIRMATION_REQUIRED`, `CONFIRM_TOKEN_INVALID`,
	 * `CONFIRM_TOKEN_EXPIRED` or `CONFIRM_TOKEN_USED`.
	 */
	consume(token: string | undefined, binding: ConfirmTokenBinding): void;
}

export interface ConfirmTokenOptions {
	/** HMAC key, at least 32 bytes; random per process when omitted. */
	readonly secret?: Uint8Array;
	readonly ttlMs?: number;
	readonly now?: () => number;
}

/**
 * JSON with object keys sorted at every level, so two equal inputs always
 * serialize the same way. `undefined` members are dropped like JSON does.
 */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(value, (_key, nested: unknown) => {
		if (
			typeof nested !== "object" ||
			nested === null ||
			Array.isArray(nested)
		) {
			return nested;
		}
		const entries = Object.entries(nested).sort(([a], [b]) =>
			a < b ? -1 : a > b ? 1 : 0,
		);
		return Object.fromEntries(entries);
	});
}

function confirmError(code: string, message: string): OperationError {
	return new OperationError(400, code, message);
}

const RETRY_HINT = "Call the tool with dry_run=true again for a new token.";

/**
 * Confirm tokens for destructive MCP tools: a `dry_run` call returns one,
 * and the real call must present it. The token is an HMAC over the
 * caller, the tool and the canonical input, valid for 5 minutes and
 * accepted once. Consumed tokens are remembered in this process until
 * they expire, so every API process must share one instance.
 */
export function createConfirmTokenService(
	options: ConfirmTokenOptions = {},
): ConfirmTokenService {
	const secret = options.secret ?? randomBytes(MIN_SECRET_BYTES);
	if (secret.byteLength < MIN_SECRET_BYTES) {
		throw new Error(
			`Confirm token secret must be at least ${MIN_SECRET_BYTES} bytes`,
		);
	}
	const ttlMs = options.ttlMs ?? CONFIRM_TOKEN_TTL_MS;
	const now = options.now ?? Date.now;
	/** Nonce of each consumed token → its expiry (ms). */
	const consumed = new Map<string, number>();

	function mac(expiresAt: number, nonce: string, b: ConfirmTokenBinding) {
		const message = JSON.stringify([
			TOKEN_VERSION,
			expiresAt,
			nonce,
			b.subjectId,
			b.tool,
			canonicalJson(b.input) ?? "null",
		]);
		return createHmac("sha256", secret).update(message).digest();
	}

	function forgetExpired(at: number): void {
		for (const [nonce, expiresAt] of consumed) {
			if (expiresAt <= at) consumed.delete(nonce);
		}
	}

	return {
		issue(binding) {
			const expiresAt = now() + ttlMs;
			const nonce = randomBytes(16).toString("base64url");
			const signature = mac(expiresAt, nonce, binding).toString("base64url");
			return {
				token: `${TOKEN_VERSION}.${expiresAt.toString(36)}.${nonce}.${signature}`,
				expiresAt: new Date(expiresAt),
			};
		},

		consume(token, binding) {
			if (token === undefined || token === "") {
				throw confirmError(
					"CONFIRMATION_REQUIRED",
					"This tool changes or removes data. Call it with dry_run=true first, review the summary, then call again with the same input and the returned confirm_token.",
				);
			}
			const [version, expiresRaw, nonce, signature, ...rest] = token.split(".");
			const expiresAt = Number.parseInt(expiresRaw ?? "", 36);
			const given = Buffer.from(signature ?? "", "base64url");
			if (
				version !== TOKEN_VERSION ||
				rest.length > 0 ||
				!nonce ||
				!Number.isSafeInteger(expiresAt)
			) {
				throw confirmError(
					"CONFIRM_TOKEN_INVALID",
					`Malformed confirm_token. ${RETRY_HINT}`,
				);
			}
			const expected = mac(expiresAt, nonce, binding);
			if (
				given.length !== expected.length ||
				!timingSafeEqual(given, expected)
			) {
				throw confirmError(
					"CONFIRM_TOKEN_INVALID",
					`confirm_token does not match this tool, caller and input. ${RETRY_HINT}`,
				);
			}
			const at = now();
			forgetExpired(at);
			if (expiresAt <= at) {
				throw confirmError(
					"CONFIRM_TOKEN_EXPIRED",
					`confirm_token has expired. ${RETRY_HINT}`,
				);
			}
			if (consumed.has(nonce)) {
				throw confirmError(
					"CONFIRM_TOKEN_USED",
					`confirm_token was already used. ${RETRY_HINT}`,
				);
			}
			consumed.set(nonce, expiresAt);
		},
	};
}
