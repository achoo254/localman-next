/**
 * `multipart/form-data` (RFC 7578) built by hand, so the same bytes go out
 * whether the browser sends directly or the proxy forwards them, and the
 * size is known before sending.
 */
import { utf8Encode } from "./byte-encoding.js";

export type MultipartPart =
	| { kind: "text"; name: string; value: string }
	| {
			kind: "file";
			name: string;
			fileName: string;
			contentType: string;
			bytes: Uint8Array;
	  };

const BOUNDARY_ALPHABET =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 24 random characters after a fixed prefix, as browsers do. */
export function createMultipartBoundary(): string {
	const random = crypto.getRandomValues(new Uint8Array(24));
	let suffix = "";
	for (const byte of random) {
		suffix += BOUNDARY_ALPHABET.charAt(byte % BOUNDARY_ALPHABET.length);
	}
	return `----LocalmanFormBoundary${suffix}`;
}

export function multipartContentType(boundary: string): string {
	return `multipart/form-data; boundary=${boundary}`;
}

/**
 * Quoted names follow the HTML form encoding: `"`, CR and LF are
 * percent-escaped so a name cannot break out of the header line.
 */
function escapeQuoted(value: string): string {
	return value
		.replaceAll('"', "%22")
		.replaceAll("\r", "%0D")
		.replaceAll("\n", "%0A");
}

function partHeader(part: MultipartPart): string {
	const name = escapeQuoted(part.name);
	if (part.kind === "text") {
		return `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
	}
	const fileName = escapeQuoted(part.fileName);
	const type =
		part.contentType.replace(/[\r\n]/g, "") || "application/octet-stream";
	return `Content-Disposition: form-data; name="${name}"; filename="${fileName}"\r\nContent-Type: ${type}\r\n\r\n`;
}

export function encodeMultipart(
	parts: readonly MultipartPart[],
	boundary: string,
): Uint8Array {
	const chunks: Uint8Array[] = [];
	for (const part of parts) {
		chunks.push(utf8Encode(`--${boundary}\r\n${partHeader(part)}`));
		chunks.push(part.kind === "text" ? utf8Encode(part.value) : part.bytes);
		chunks.push(utf8Encode("\r\n"));
	}
	chunks.push(utf8Encode(`--${boundary}--\r\n`));

	const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}
