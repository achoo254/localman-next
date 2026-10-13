import { type IncomingHttpHeaders, request } from "node:http";

/** A tenant IdP call answers within this long, as discovery does. */
const TIMEOUT_MS = 10_000;

/** What openid-client hands its `customFetch` (and jose its fetch). */
export interface LoopbackFetchOptions {
	readonly method?: string;
	readonly headers?: HeadersInit;
	readonly body?: unknown;
	readonly signal?: AbortSignal | null;
}

export type LoopbackFetch = (
	url: string,
	options: LoopbackFetchOptions,
) => Promise<Response>;

function headersOf(options: LoopbackFetchOptions): Record<string, string> {
	const headers: Record<string, string> = {};
	new Headers(options.headers).forEach((value, name) => {
		headers[name] = value;
	});
	return headers;
}

function bodyOf(body: unknown): string | Buffer | undefined {
	if (body === undefined || body === null) return undefined;
	if (typeof body === "string" || Buffer.isBuffer(body)) return body;
	if (body instanceof URLSearchParams) return body.toString();
	if (body instanceof Uint8Array) return Buffer.from(body);
	throw new TypeError("Unsupported request body for the IdP");
}

function responseHeaders(raw: IncomingHttpHeaders): Headers {
	const headers = new Headers();
	for (const [name, value] of Object.entries(raw)) {
		if (typeof value === "string") headers.set(name, value);
		else if (Array.isArray(value))
			for (const v of value) headers.append(name, v);
	}
	return headers;
}

/**
 * Fetch for one tenant's IdP endpoints (`https://auth.<domain>/…`): the
 * request goes to the IdP's own listener on loopback with the tenant's
 * Host and `X-Forwarded-Proto: https`, as nginx would send it, so the
 * domain's public DNS (its owner's) never decides where the client
 * secret and codes go. Any other origin is refused.
 */
export function loopbackFetch(
	loopbackOrigin: string,
	idpOrigin: string,
): LoopbackFetch {
	return (url, options) =>
		new Promise((resolve, reject) => {
			const target = new URL(url);
			if (target.origin !== idpOrigin) {
				reject(new Error("Refused a call outside the tenant's IdP"));
				return;
			}
			const body = bodyOf(options.body);
			const req = request(
				new URL(`${target.pathname}${target.search}`, loopbackOrigin),
				{
					method: options.method ?? "GET",
					headers: {
						...headersOf(options),
						host: target.host,
						"x-forwarded-proto": "https",
					},
					signal: options.signal ?? undefined,
					timeout: TIMEOUT_MS,
				},
				(res) => {
					const chunks: Buffer[] = [];
					res.on("data", (chunk: Buffer) => chunks.push(chunk));
					res.on("error", reject);
					res.on("end", () => {
						const status = res.statusCode ?? 502;
						const empty = status === 204 || status === 304;
						resolve(
							new Response(empty ? null : Buffer.concat(chunks), {
								status,
								headers: responseHeaders(res.headers),
							}),
						);
					});
				},
			);
			req.once("timeout", () => req.destroy(new Error("IdP call timed out")));
			req.once("error", reject);
			req.end(body);
		});
}
