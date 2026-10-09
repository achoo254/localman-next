/**
 * Headers and query params produced by the request's auth. OAuth 2 of the
 * old client is dropped; API key can go to a header or the query.
 */
import { bytesToBase64, utf8Encode } from "./byte-encoding.js";
import type {
	EffectiveAuth,
	HeaderEntry,
	RequestAuth,
} from "./request-model.js";

export interface AuthParts {
	headers: HeaderEntry[];
	query: { key: string; value: string }[];
}

/**
 * `inherit` takes the parent's auth (folder or collection, resolved by the
 * caller); with no parent it means no auth.
 */
export function resolveEffectiveAuth(
	auth: RequestAuth,
	inherited?: EffectiveAuth,
): EffectiveAuth {
	if (auth.type !== "inherit") return auth;
	return inherited ?? { type: "none" };
}

/** RFC 7617 with UTF-8, so non-Latin-1 passwords work. */
export function basicCredentials(username: string, password: string): string {
	return bytesToBase64(utf8Encode(`${username}:${password}`));
}

/**
 * `fill` interpolates each field (identity by default). Incomplete auth
 * (empty token, empty username, empty key name) adds nothing; an empty
 * Basic password is allowed.
 */
export function authParts(
	auth: EffectiveAuth,
	fill: (text: string) => string = (text) => text,
): AuthParts {
	const none: AuthParts = { headers: [], query: [] };
	switch (auth.type) {
		case "none":
			return none;
		case "bearer": {
			const token = fill(auth.token).trim();
			return token
				? {
						headers: [{ name: "Authorization", value: `Bearer ${token}` }],
						query: [],
					}
				: none;
		}
		case "basic": {
			const username = fill(auth.username);
			if (!username.trim()) return none;
			const value = `Basic ${basicCredentials(username, fill(auth.password))}`;
			return { headers: [{ name: "Authorization", value }], query: [] };
		}
		case "apikey": {
			const key = fill(auth.key).trim();
			if (!key) return none;
			const value = fill(auth.value);
			return auth.in === "query"
				? { headers: [], query: [{ key, value }] }
				: { headers: [{ name: key, value }], query: [] };
		}
	}
}
