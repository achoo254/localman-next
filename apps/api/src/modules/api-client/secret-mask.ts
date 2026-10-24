import { OperationError } from "@localman/operations";
import type { ClientResponse } from "@localman/shared/api-client";

/**
 * Masks secret values the server filled into a request wherever they come
 * back (ADR-0009): the upstream may echo them in headers, body or the
 * final URL, and errors may name them. Besides the value itself, the forms
 * the server or a usual echo produce are caught (URL path, query and form
 * encoding, JSON escaping, any letter case). A value the upstream
 * transforms otherwise (base64, hashed, split) is not. Values shorter than
 * `MIN_MASKED` are left alone, too short to tell from ordinary text.
 */
export const SECRET_MASK = "[secret]";
const MIN_MASKED = 4;

/** How `value` reads once serialized by the URL parser, if it parses. */
function urlForms(value: string): string[] {
	try {
		const path = new URL(`http://x.invalid/${value}`).pathname.slice(1);
		const query = new URL(`http://x.invalid/?q=${value}`).search.slice(3);
		return [path, query];
	} catch {
		return [];
	}
}

function formsOf(secret: string): string[] {
	const forms = [
		secret,
		encodeURIComponent(secret),
		encodeURI(secret),
		new URLSearchParams({ q: secret }).toString().slice(2),
		JSON.stringify(secret).slice(1, -1),
		...urlForms(secret),
	];
	return forms.filter((form) => form.length >= MIN_MASKED);
}

function maskable(secrets: readonly string[]): string[] {
	const forms = secrets
		.filter((secret) => secret.length >= MIN_MASKED)
		.flatMap(formsOf);
	// Longest first, so a secret containing another is masked whole.
	return [...new Set(forms)].sort((a, b) => b.length - a.length);
}

const escapeRegExp = (text: string): string =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function maskSecrets(text: string, secrets: readonly string[]): string {
	let out = text;
	for (const form of maskable(secrets)) {
		out = out.replace(new RegExp(escapeRegExp(form), "gi"), SECRET_MASK);
	}
	return out;
}

/** A copy with ASCII `A`–`Z` lowered; other bytes (UTF-8 included) kept. */
function asciiLower(bytes: Buffer): Buffer {
	const out = Buffer.from(bytes);
	for (let i = 0; i < out.length; i++) {
		const byte = out[i] ?? 0;
		if (byte >= 0x41 && byte <= 0x5a) out[i] = byte + 0x20;
	}
	return out;
}

/**
 * Masks the forms in bytes, ASCII letters in any case like `maskSecrets`
 * (a non-ASCII letter must match its case: bytes have no text case). The
 * search runs on a lowered copy kept in step with the bytes, so the
 * bytes around a match stay exactly as they came.
 */
function maskBytes(body: string, secrets: readonly string[]): string {
	let bytes = Buffer.from(body, "base64");
	let lowered = asciiLower(bytes);
	const mask = Buffer.from(SECRET_MASK);
	const loweredMask = asciiLower(mask);
	for (const form of maskable(secrets)) {
		const needle = asciiLower(Buffer.from(form));
		const parts: Buffer[] = [];
		const loweredParts: Buffer[] = [];
		let from = 0;
		for (
			let at = lowered.indexOf(needle);
			at !== -1;
			at = lowered.indexOf(needle, from)
		) {
			parts.push(bytes.subarray(from, at), mask);
			loweredParts.push(lowered.subarray(from, at), loweredMask);
			from = at + needle.length;
		}
		if (parts.length === 0) continue;
		parts.push(bytes.subarray(from));
		loweredParts.push(lowered.subarray(from));
		bytes = Buffer.concat(parts);
		lowered = Buffer.concat(loweredParts);
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

/**
 * An error as the caller and the log may see it: message and text details
 * masked; any other error keeps only its masked message.
 */
export function maskError(error: unknown, secrets: readonly string[]): unknown {
	if (maskable(secrets).length === 0) return error;
	if (!(error instanceof OperationError)) {
		return error instanceof Error
			? new Error(maskSecrets(error.message, secrets))
			: error;
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
