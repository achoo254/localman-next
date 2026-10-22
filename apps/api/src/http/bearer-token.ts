import type { Request } from "express";

/**
 * The credential of an `Authorization: Bearer …` header (scheme matched
 * case-insensitively, RFC 9110 §11.1), or `undefined` without one. The
 * value is not validated here; its store checks the format.
 */
export function bearerTokenOf(req: Request): string | undefined {
	const header = req.headers.authorization;
	if (typeof header !== "string") return undefined;
	const match = /^Bearer[ ]+(\S*)\s*$/i.exec(header);
	return match ? (match[1] ?? "") : undefined;
}
