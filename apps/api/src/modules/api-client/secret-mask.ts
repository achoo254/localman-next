import { OperationError } from "@localman/operations";
import type { ClientResponse } from "@localman/shared/api-client";

/**
 * Masks secret values the server filled into a request wherever they come
 * back (ADR-0009): the upstream may echo them in headers, body or the
 * final URL, and errors may name them. Only exact copies are caught: a
 * value the upstream transforms (base64, hashed) is not. Values shorter
 * than `MIN_MASKED` are left alone, too short to tell from ordinary text.
 */
export const SECRET_MASK = "[secret]";
const MIN_MASKED = 4;

function maskable(secrets: readonly string[]): string[] {
	// Longest first, so a secret containing another is masked whole.
	return [...new Set(secrets)]
		.filter((secret) => secret.length >= MIN_MASKED)
		.sort((a, b) => b.length - a.length);
}

export function maskSecrets(text: string, secrets: readonly string[]): string {
	let out = text;
	for (const secret of maskable(secrets))
		out = out.split(secret).join(SECRET_MASK);
	return out;
}

function maskBytes(body: string, secrets: readonly string[]): string {
	let bytes = Buffer.from(body, "base64");
	const mask = Buffer.from(SECRET_MASK);
	for (const secret of maskable(secrets)) {
		const needle = Buffer.from(secret);
		const parts: Buffer[] = [];
		let from = 0;
		for (
			let at = bytes.indexOf(needle);
			at !== -1;
			at = bytes.indexOf(needle, from)
		) {
			parts.push(bytes.subarray(from, at), mask);
			from = at + needle.length;
		}
		if (parts.length === 0) continue;
		parts.push(bytes.subarray(from));
		bytes = Buffer.concat(parts);
	}
	return bytes.toString("base64");
}

export function maskResponse(
	response: ClientResponse,
	secrets: readonly string[],
): ClientResponse {
	if (maskable(secrets).length === 0) return response;
	return {
		...response,
		headers: response.headers.map((header) => ({
			name: maskSecrets(header.name, secrets),
			value: maskSecrets(header.value, secrets),
		})),
		body:
			response.bodyEncoding === "base64"
				? maskBytes(response.body, secrets)
				: maskSecrets(response.body, secrets),
		finalUrl: maskSecrets(response.finalUrl, secrets),
	};
}

/** An error as the caller may see it: message and text details masked. */
export function maskError(error: unknown, secrets: readonly string[]): unknown {
	if (!(error instanceof OperationError) || maskable(secrets).length === 0) {
		return error;
	}
	const details = error.details;
	const masked =
		details && typeof details === "object" && !Array.isArray(details)
			? Object.fromEntries(
					Object.entries(details).map(([key, value]) => [
						key,
						typeof value === "string" ? maskSecrets(value, secrets) : value,
					]),
				)
			: details;
	return new OperationError(
		error.status,
		error.code,
		maskSecrets(error.message, secrets),
		masked,
	);
}
