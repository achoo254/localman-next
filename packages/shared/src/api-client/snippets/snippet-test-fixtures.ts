/** Requests and strings shared by the snippet tests. */
import { utf8Encode } from "../byte-encoding.js";
import type { HeaderEntry, HttpMethod } from "../request-model.js";
import type { PreparedRequest } from "../request-preparer.js";

/** Printable hazards: quotes, sigils, backslashes, line breaks, Unicode. */
const PRINTABLE: readonly string[] = [
	`it's "quoted"`,
	"$HOME ${x} $(id) `id`",
	"back\\slash \\n \\u0041 \\$",
	"line1\nline2",
	"tab\there",
	"#{x} #$x #@x",
	"@/etc/passwd",
	"Tiếng Việt 🚀 中文",
	"‘smart’ “double” ‚low‛",
];

/** Strings that broke the old generators, one concern each. */
export const ADVERSARIAL: readonly string[] = [
	...PRINTABLE,
	"crlf\r\nend",
	"nul\u0000 bel\u0007 esc\u001b del\u007f",
	"\u2028\u2029\u0085",
	"",
];

/**
 * The printable hazards in one body; CR, control characters and Unicode
 * line separators are left to the escape tests, so golden files stay text.
 */
export const HOSTILE_BODY = PRINTABLE.join(" | ");
export const HOSTILE_HEADER = `it's "q" $HOME \`id\` #{x} \\ ‘s’ Tiếng Việt`;

export function preparedRequest(
	overrides: Partial<{
		method: HttpMethod;
		url: string;
		headers: HeaderEntry[];
		body: string | Uint8Array | null;
	}> = {},
): PreparedRequest {
	const body = overrides.body ?? null;
	return {
		method: overrides.method ?? "GET",
		url: overrides.url ?? "https://api.example.com/users?page=1",
		headers: overrides.headers ?? [],
		body:
			body === null
				? { kind: "none" }
				: typeof body === "string"
					? { kind: "text", text: body }
					: { kind: "bytes", bytes: body },
		secretsUsed: [],
		unresolved: [],
	};
}

/** A typical JSON POST with a repeated header. */
export const JSON_POST = preparedRequest({
	method: "POST",
	url: "https://api.example.com/users?notify=true",
	headers: [
		{ name: "Authorization", value: "Bearer abc123" },
		{ name: "Accept", value: "application/json" },
		{ name: "X-Tag", value: "a" },
		{ name: "X-Tag", value: "b" },
		{ name: "Content-Type", value: "application/json" },
	],
	body: '{\n  "name": "Ann",\n  "age": 30\n}',
});

/** Every hazard in the URL query, a header and the body. */
export const HOSTILE_PATCH = preparedRequest({
	method: "PATCH",
	url: "https://api.example.com/items/1?q=%24HOME&x=%27",
	headers: [
		{ name: "X-Note", value: HOSTILE_HEADER },
		{ name: "Content-Type", value: "text/plain; charset=utf-8" },
	],
	body: HOSTILE_BODY,
});

export const BINARY_PUT = preparedRequest({
	method: "PUT",
	headers: [{ name: "Content-Type", value: "image/png" }],
	body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe]),
});

export const UTF8_BYTES_POST = preparedRequest({
	method: "POST",
	headers: [{ name: "Content-Type", value: "multipart/form-data; boundary=b" }],
	body: utf8Encode(
		'--b\r\nContent-Disposition: form-data; name="a"\r\n\r\nViệt\r\n--b--\r\n',
	),
});
