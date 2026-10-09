import { OperationError } from "@localman/operations";
import type { Request, Response } from "express";

/** Same cap as the SDK's own body reader (`DEFAULT_MAX_REQUEST_BODY_SIZE`). */
export const MAX_MCP_BODY_BYTES = 4 * 1024 * 1024;

/** Connection-level headers of the incoming hop; the body is re-framed. */
const HOP_HEADERS: ReadonlySet<string> = new Set([
	"connection",
	"content-length",
	"expect",
	"keep-alive",
	"proxy-connection",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

function tooLarge(): OperationError {
	return new OperationError(
		413,
		"PAYLOAD_TOO_LARGE",
		"Request body is too large",
	);
}

/** The raw body, refused past `MAX_MCP_BODY_BYTES` without reading on. */
export async function readMcpBody(req: Request): Promise<Buffer | undefined> {
	if (req.method === "GET" || req.method === "HEAD") return undefined;
	const declared = Number(req.headers["content-length"] ?? 0);
	if (declared > MAX_MCP_BODY_BYTES) throw tooLarge();
	const chunks: Buffer[] = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
		total += buffer.length;
		if (total > MAX_MCP_BODY_BYTES) throw tooLarge();
		chunks.push(buffer);
	}
	return Buffer.concat(chunks);
}

/**
 * The Express request as a web `Request` for the SDK's fetch-shaped
 * handler, at `url` (the public URL, so the SDK sees the real resource).
 * `signal` aborts when the client goes away. `body` is the raw body when
 * the caller already read it (`readMcpBody`); otherwise it is read here.
 */
export async function toFetchRequest(
	req: Request,
	url: string,
	signal: AbortSignal,
	body?: Buffer,
): Promise<globalThis.Request> {
	const headers = new Headers();
	for (const [name, value] of Object.entries(req.headers)) {
		if (HOP_HEADERS.has(name)) continue;
		if (Array.isArray(value)) {
			for (const item of value) headers.append(name, item);
		} else if (value !== undefined) {
			headers.set(name, value);
		}
	}
	const raw = body ?? (await readMcpBody(req));
	return new globalThis.Request(url, {
		method: req.method,
		headers,
		body: raw === undefined ? undefined : new Uint8Array(raw),
		signal,
	});
}

/** Waits until `res` can take more data, or the client is gone. */
function writable(res: Response): Promise<void> {
	return new Promise((resolve) => {
		const done = () => {
			res.off("drain", done);
			res.off("close", done);
			resolve();
		};
		res.once("drain", done);
		res.once("close", done);
	});
}

/**
 * Streams the SDK's `Response` to Express, chunk by chunk, so SSE
 * responses reach the client as they are produced. Stops reading when
 * the client disconnects.
 */
export async function sendFetchResponse(
	response: globalThis.Response,
	res: Response,
): Promise<void> {
	res.status(response.status);
	response.headers.forEach((value, name) => {
		res.setHeader(name, value);
	});
	if (!response.body) {
		res.end();
		return;
	}
	res.flushHeaders();
	const reader = response.body.getReader();
	const cancel = () => {
		reader.cancel().catch(() => undefined);
	};
	res.once("close", cancel);
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done || res.destroyed) break;
			if (!res.write(value)) await writable(res);
		}
	} finally {
		res.off("close", cancel);
		res.end();
	}
}
